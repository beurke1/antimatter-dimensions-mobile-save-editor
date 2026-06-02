import assert from 'node:assert/strict';
import { decodeSave, encodeSaveData, SaveType } from '../src/save-codec.js';
import { analyzeEditRisks, analyzeSaveData, summarizeAnalysis } from '../src/save-analysis.js';
import {
  buildChangeIndex,
  buildPathIndex,
  calculateCoverage,
  deleteValueAtSegments,
  getAncestorNodes,
  getDirectChildNodes,
  getValueAtSegments,
  isNodeWithinScope,
  setValueAtSegments,
} from '../src/path-index.js';

const samplePcSave = {
  antimatter: '10',
  dimensions: {
    antimatter: [
      {
        bought: 10,
        amount: '25',
      },
    ],
  },
  challenge: {
    normal: {
      current: 0,
    },
  },
  infinityPoints: '0',
  replicanti: {
    unl: false,
    amount: '0',
  },
  version: 14,
  lastUpdate: 1700000000000,
  options: {
    notation: 'Scientific',
  },
};

const sampleAndroidSave = {
  antimatter: {
    mantissa: 1,
    exponent: 10,
  },
  dimensions: {
    antimatter: [
      {
        bought: 3,
        amount: {
          mantissa: 2,
          exponent: 4,
        },
      },
    ],
  },
  brake: false,
  achievements: [1, 2, 3],
  version: 30100100,
  lastUpdate: 1700000000000,
};

const pcEncoded = await encodeSaveData(samplePcSave, SaveType.PC);
assert.ok(pcEncoded.startsWith('AntimatterDimensionsSavefileFormatAAB'));

const pcDecoded = await decodeSave(pcEncoded);
assert.equal(pcDecoded.saveType, SaveType.PC);
assert.deepEqual(pcDecoded.data, samplePcSave);

const androidEncoded = await encodeSaveData(sampleAndroidSave, SaveType.Android);
assert.ok(androidEncoded.startsWith('AntimatterDimensionsAndroidSaveFormatAAA'));

const androidDecoded = await decodeSave(androidEncoded);
assert.equal(androidDecoded.saveType, SaveType.Android);
assert.deepEqual(androidDecoded.data, sampleAndroidSave);

const nodes = buildPathIndex(samplePcSave, SaveType.PC);
const coverage = calculateCoverage(nodes);
assert.ok(nodes.some((node) => node.path === 'dimensions.antimatter[0].amount'));
assert.ok(nodes.some((node) => node.path === 'challenge.normal.current'));
assert.equal(coverage.total, nodes.length);
assert.equal(coverage.editableCount, nodes.length);

const nodeByPath = new Map(nodes.map((node) => [node.path, node]));
const rootChildren = getDirectChildNodes(nodes, 'root');
assert.ok(rootChildren.some((node) => node.path === 'dimensions'));

const dimensionAmountNode = nodeByPath.get('dimensions.antimatter[0].amount');
assert.ok(dimensionAmountNode);
assert.equal(isNodeWithinScope(dimensionAmountNode, 'dimensions', nodeByPath), true);
assert.equal(isNodeWithinScope(dimensionAmountNode, 'options', nodeByPath), false);

const breadcrumbs = getAncestorNodes(nodes, 'dimensions.antimatter[0].amount').map((node) => node.path);
assert.deepEqual(breadcrumbs, [
  'root',
  'dimensions',
  'dimensions.antimatter',
  'dimensions.antimatter[0]',
  'dimensions.antimatter[0].amount',
]);

const updated = setValueAtSegments(samplePcSave, ['dimensions', 'antimatter', 0, 'amount'], '99');
assert.equal(getValueAtSegments(updated, ['dimensions', 'antimatter', 0, 'amount']), '99');
assert.equal(samplePcSave.dimensions.antimatter[0].amount, '25');

const changedSave = setValueAtSegments(samplePcSave, ['options', 'notation'], 'Engineering');
const changes = buildChangeIndex(samplePcSave, changedSave, SaveType.PC);
assert.ok(changes.some((change) => change.path === 'options.notation' && change.changeType === 'changed'));
assert.ok(changes.some((change) => change.path === 'root'));

const addedSave = setValueAtSegments(samplePcSave, ['options', 'customFlag'], true);
const addedChanges = buildChangeIndex(samplePcSave, addedSave, SaveType.PC);
assert.ok(addedChanges.some((change) => change.path === 'options.customFlag' && change.changeType === 'added'));
assert.ok(analyzeEditRisks(addedChanges).some((risk) => risk.path === 'options.customFlag' && risk.severity === 'warning'));

const removedAddedSave = deleteValueAtSegments(addedSave, ['options', 'customFlag']);
assert.deepEqual(removedAddedSave, samplePcSave);

const invalidSaveIssues = analyzeSaveData({
  ...sampleAndroidSave,
  antimatter: { mantissa: 1, exponent: 1.5 },
  dimensionBoosts: Number.POSITIVE_INFINITY,
}, SaveType.Android);
const invalidSummary = summarizeAnalysis(invalidSaveIssues);
assert.equal(invalidSummary.errors, 1);
assert.ok(invalidSaveIssues.some((issue) => issue.path === 'antimatter' && issue.severity === 'warning'));
assert.ok(invalidSaveIssues.some((issue) => issue.path === 'dimensionBoosts' && issue.severity === 'error'));

const missingCoreIssues = analyzeSaveData({ antimatter: '10' }, SaveType.PC);
assert.equal(summarizeAnalysis(missingCoreIssues).warnings, 2);

console.log(`Smoke tests passed: ${coverage.total} indexed paths, round trips and change tracking verified.`);
