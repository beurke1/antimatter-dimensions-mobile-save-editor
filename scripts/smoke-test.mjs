import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CATEGORIES } from '../src/taxonomy.js';
import { PRESETS, applyPreset } from '../src/presets.js';
import { buildCoverageReport } from '../src/coverage-report.js';
import { buildReadinessSummary } from '../src/readiness.js';
import { decodeSave, encodeSaveData, SaveType } from '../src/save-codec.js';
import { STAGES, detectStage, isPositiveQuantity } from '../src/stage.js';
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

// Preset tests
assert.ok(PRESETS.length >= 9, 'At least 9 presets defined');

// Every preset has required fields
for (const preset of PRESETS) {
  assert.ok(preset.id, `Preset missing id`);
  assert.ok(preset.label, `Preset ${preset.id} missing label`);
  assert.ok(preset.description, `Preset ${preset.id} missing description`);
  assert.ok(preset.stage, `Preset ${preset.id} missing stage`);
  assert.ok(typeof preset.apply === 'function', `Preset ${preset.id} missing apply function`);
}

// PC presets produce valid data that round-trips
const basePC = createComprehensivePcSave();
for (const preset of PRESETS) {
  const applied = applyPreset(basePC, preset.id);
  assert.ok(applied && typeof applied === 'object' && !Array.isArray(applied), `Preset ${preset.id} returns a plain object`);
  const encoded = await encodeSaveData(applied, SaveType.PC);
  const reDecoded = await decodeSave(encoded);
  assert.ok(reDecoded.data, `Preset ${preset.id} round-trips through PC codec`);
}

const assertAndroidBigNumber = (value, mantissa, exponent, label) => {
  assert.deepEqual(value, { mantissa, exponent }, label);
};

// Presets preserve PC decimal-string fields instead of writing Android objects
assert.equal(applyPreset(basePC, 'antimatter-e308').antimatter, '1.79e308');
assert.equal(applyPreset(basePC, 'infinity-points-e100').infinityPoints, '1e100');
assert.equal(applyPreset(basePC, 'eternity-points-e100').eternityPoints, '1e100');
assert.equal(applyPreset(basePC, 'time-shards-e6').timeShards, '1e6');
assert.equal(applyPreset(basePC, 'reality-machines-1000').reality.realityMachines, '1000');
assert.equal(applyPreset(basePC, 'replicanti-unlock').replicanti.amount, '1');

// Presets preserve Android mantissa/exponent fields and Android break naming
const baseAndroid = createComprehensiveAndroidSave();
assertAndroidBigNumber(applyPreset(baseAndroid, 'antimatter-e308').antimatter, 1.79, 308, 'Android antimatter stays big-number object');
assertAndroidBigNumber(applyPreset(baseAndroid, 'infinity-points-e100').infinityPoints, 1, 100, 'Android IP stays big-number object');
assertAndroidBigNumber(applyPreset(baseAndroid, 'eternity-points-e100').eternityPoints, 1, 100, 'Android EP stays big-number object');
assertAndroidBigNumber(applyPreset(baseAndroid, 'time-shards-e6').timeShards, 1, 6, 'Android time shards stay big-number object');
assertAndroidBigNumber(applyPreset(baseAndroid, 'reality-machines-1000').reality.realityMachines, 1000, 0, 'Android RM stays big-number object');
const androidReplicantiPreset = applyPreset(baseAndroid, 'replicanti-unlock');
assertAndroidBigNumber(androidReplicantiPreset.replicanti.amount, 1, 0, 'Android replicanti amount stays big-number object');
assert.equal('chance' in androidReplicantiPreset.replicanti, false, 'Android replicanti preset should not add PC chance field');
assert.equal('interval' in androidReplicantiPreset.replicanti, false, 'Android replicanti preset should not add PC interval field');
const brakeApplied = applyPreset(baseAndroid, 'break-infinity');
assert.equal(brakeApplied.brake, true, 'break-infinity preset sets brake on Android-style saves');

// Unknown preset throws
assert.throws(() => applyPreset(basePC, 'does-not-exist'), /Unknown preset/);

// Stage detection inspects values, not key presence. AD saves always contain
// reality/eternity/infinity keys initialized to zero, so a fresh save must not
// be mis-detected as a later stage.
assert.equal(isPositiveQuantity(0), false);
assert.equal(isPositiveQuantity(5), true);
assert.equal(isPositiveQuantity('0'), false);
assert.equal(isPositiveQuantity('1e250'), true);
assert.equal(isPositiveQuantity('1e1000'), true, 'overflowing decimal strings count as positive');
assert.equal(isPositiveQuantity({ mantissa: 0, exponent: 0 }), false);
assert.equal(isPositiveQuantity({ mantissa: 1, exponent: 1000 }), true);
assert.equal(isPositiveQuantity(null), false);
assert.equal(isPositiveQuantity(undefined), false);
assert.equal(isPositiveQuantity(false), false);

assert.equal(detectStage(samplePcSave), STAGES.NORMAL, 'fresh PC sample is Normal');
assert.equal(detectStage(sampleAndroidSave), STAGES.NORMAL, 'fresh Android sample is Normal');
assert.equal(detectStage({ ...samplePcSave, infinityPoints: '1e10' }), STAGES.INFINITY);
assert.equal(detectStage({ ...samplePcSave, brake: true }), STAGES.INFINITY);
assert.equal(detectStage({ ...samplePcSave, eternityPoints: '1e5' }), STAGES.ETERNITY);
assert.equal(detectStage({ ...samplePcSave, realities: '3' }), STAGES.REALITY);
assert.equal(detectStage(createComprehensivePcSave()), STAGES.REALITY, 'late-game PC fixture is Reality');
assert.equal(detectStage(createComprehensiveAndroidSave()), STAGES.REALITY, 'late-game Android fixture is Reality');

// Regression: a present-but-zero late-game tree must not be read as Reality.
assert.equal(
  detectStage({
    ...samplePcSave,
    reality: { realityMachines: '0', imaginaryMachines: 0 },
    celestials: {},
    realities: '0',
  }),
  STAGES.NORMAL,
  'empty reality/celestials objects do not imply Reality stage',
);

console.log(`Smoke tests passed: ${coverage.total} sample paths, ${pcCoverageTotal} PC fixture paths, ${androidCoverageTotal} Android fixture paths verified, ${PRESETS.length} presets validated, stage detection verified.`);
