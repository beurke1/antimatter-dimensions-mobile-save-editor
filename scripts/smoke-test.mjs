import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CATEGORIES } from '../src/taxonomy.js';
import { buildCoverageReport } from '../src/coverage-report.js';
import { buildReadinessSummary } from '../src/readiness.js';
import { decodeSave, encodeSaveData, SaveType } from '../src/save-codec.js';
import { analyzeEditRisks, analyzeSaveData, summarizeAnalysis } from '../src/save-analysis.js';
import { createQaArtifacts } from './export-qa-fixtures.mjs';
import { createComprehensiveAndroidSave, createComprehensivePcSave } from './fixture-saves.mjs';
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

const requiredCategoryIds = CATEGORIES
  .map((category) => category.id)
  .filter((categoryId) => categoryId !== 'unknown');

const assertComprehensiveCoverage = async (saveData, saveType) => {
  const encoded = await encodeSaveData(saveData, saveType);
  const decoded = await decodeSave(encoded);
  assert.equal(decoded.saveType, saveType);

  const fixtureNodes = buildPathIndex(decoded.data, saveType);
  const fixtureCoverage = calculateCoverage(fixtureNodes);
  assert.equal(fixtureCoverage.total, fixtureNodes.length);
  assert.equal(fixtureCoverage.editableCount, fixtureNodes.length);

  for (const categoryId of requiredCategoryIds) {
    assert.ok(
      fixtureCoverage.categoryCounts[categoryId] > 0,
      `${saveType} fixture should cover category ${categoryId}`
    );
  }

  const fixtureNodeByPath = new Map(fixtureNodes.map((node) => [node.path, node]));
  const lateGameNode = fixtureNodeByPath.get(saveType === SaveType.PC
    ? 'celestials.ra.pets.teresa.level'
    : 'celestials.ra.pets.teresa.level');
  assert.ok(lateGameNode);
  assert.equal(isNodeWithinScope(lateGameNode, 'celestials', fixtureNodeByPath), true);

  const rootChildrenCount = getDirectChildNodes(fixtureNodes, 'root').length;
  assert.ok(rootChildrenCount > 30);

  const safetySummary = summarizeAnalysis(analyzeSaveData(decoded.data, saveType));
  assert.equal(safetySummary.errors, 0);

  const report = buildCoverageReport({
    saveType,
    nodes: fixtureNodes,
    coverage: fixtureCoverage,
    changes: [],
    analysisIssues: [],
  });
  assert.equal(report.totals.paths, fixtureCoverage.total);
  assert.equal(report.totals.editablePaths, fixtureCoverage.editableCount);
  assert.equal(report.missingCategories.length, 0);
  assert.ok(report.topLevelPaths.includes('celestials'));
  assert.ok(report.valueTypes.object > 0);

  const cleanReadiness = buildReadinessSummary({
    coverageReport: report,
    analysisSummary: safetySummary,
    isDirty: false,
    encodedOutput: '',
  });
  assert.equal(cleanReadiness.status, 'encode');
  assert.equal(cleanReadiness.canEncode, true);
  assert.equal(cleanReadiness.readyToImport, false);

  const encodedReadiness = buildReadinessSummary({
    coverageReport: report,
    analysisSummary: safetySummary,
    isDirty: false,
    encodedOutput: encoded,
  });
  assert.equal(encodedReadiness.status, 'ready');
  assert.equal(encodedReadiness.readyToImport, true);

  const blockedReadiness = buildReadinessSummary({
    coverageReport: report,
    analysisSummary: { errors: 1, warnings: 0, info: 0 },
    isDirty: false,
    encodedOutput: '',
  });
  assert.equal(blockedReadiness.status, 'blocked');
  assert.equal(blockedReadiness.canEncode, false);

  return fixtureCoverage.total;
};

const pcCoverageTotal = await assertComprehensiveCoverage(createComprehensivePcSave(), SaveType.PC);
const androidCoverageTotal = await assertComprehensiveCoverage(createComprehensiveAndroidSave(), SaveType.Android);
const qaArtifacts = await createQaArtifacts();
assert.equal(qaArtifacts.files.length, 6);
assert.deepEqual(
  qaArtifacts.manifest.fixtures.map((fixture) => fixture.id),
  ['pc-late-game', 'android-late-game']
);
assert.ok(qaArtifacts.manifest.fixtures.every((fixture) => fixture.expectedTotals.paths > 100));
assert.ok(qaArtifacts.manifest.fixtures.every((fixture) => fixture.expectedSafety.error === 0));

for (const file of qaArtifacts.files) {
  const committedContent = await readFile(new URL(`../qa-fixtures/${file.path}`, import.meta.url), 'utf8');

  if (file.path.endsWith('-save.txt')) {
    const committedDecoded = await decodeSave(committedContent);
    const generatedDecoded = await decodeSave(file.content);

    assert.equal(committedDecoded.saveType, generatedDecoded.saveType);
    assert.deepEqual(
      committedDecoded.data,
      generatedDecoded.data,
      `qa-fixtures/${file.path} should decode to the generated fixture save`
    );
  } else {
    assert.equal(committedContent, file.content, `qa-fixtures/${file.path} should match npm run qa:fixtures output`);
  }
}

console.log(`Smoke tests passed: ${coverage.total} sample paths, ${pcCoverageTotal} PC fixture paths, ${androidCoverageTotal} Android fixture paths verified.`);
