import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { categorizePath, CATEGORIES } from '../src/taxonomy.js';
import { KNOWN_TOP_LEVEL_CATEGORIES } from '../src/schema-reference.js';
import { PRESETS, applyPreset } from '../src/presets.js';
import { buildCoverageReport, buildQaSummary } from '../src/coverage-report.js';
import { buildReadinessSummary } from '../src/readiness.js';
import { decodeSave, encodeSaveData, SaveType } from '../src/save-codec.js';
import { STAGES, detectStage, isPositiveQuantity } from '../src/stage.js';
import { analyzeEditRisks, analyzeSaveData, summarizeAnalysis } from '../src/save-analysis.js';
import { createQaArtifacts } from './export-qa-fixtures.mjs';
import {
  createComprehensiveAndroidSave,
  createComprehensivePcSave,
  createEternityAndroidSave,
  createEternityPcSave,
  createInfinityAndroidSave,
  createInfinityPcSave,
  createNormalAndroidSave,
  createNormalPcSave,
} from './fixture-saves.mjs';
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

const addedContainerSave = setValueAtSegments(samplePcSave, ['options', 'customGroup'], { enabled: true, level: 2 });
const addedContainerRisks = analyzeEditRisks(buildChangeIndex(samplePcSave, addedContainerSave, SaveType.PC));
assert.ok(addedContainerRisks.some((risk) => risk.path === 'options.customGroup' && risk.title === 'Added path'));
assert.equal(
  addedContainerRisks.some((risk) => risk.path === 'options.customGroup.enabled' || risk.path === 'options.customGroup.level'),
  false,
  'Added containers should not duplicate structural warnings for every added child'
);

const removedContainerSave = deleteValueAtSegments(samplePcSave, ['replicanti']);
const removedContainerRisks = analyzeEditRisks(buildChangeIndex(samplePcSave, removedContainerSave, SaveType.PC));
assert.ok(removedContainerRisks.some((risk) => risk.path === 'replicanti' && risk.title === 'Removed path'));
assert.equal(
  removedContainerRisks.some((risk) => risk.path === 'replicanti.unl' || risk.path === 'replicanti.amount'),
  false,
  'Removed containers should not duplicate structural warnings for every removed child'
);

const typeChangedContainerSave = setValueAtSegments(samplePcSave, ['replicanti'], false);
const typeChangedContainerRisks = analyzeEditRisks(buildChangeIndex(samplePcSave, typeChangedContainerSave, SaveType.PC));
assert.ok(typeChangedContainerRisks.some((risk) => risk.path === 'replicanti' && risk.title === 'Type changed'));
assert.equal(
  typeChangedContainerRisks.some((risk) => risk.path === 'replicanti.unl' || risk.path === 'replicanti.amount'),
  false,
  'Parent type changes should not duplicate removed-child structural warnings'
);

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

const pcFormatMismatchIssues = analyzeSaveData({
  ...samplePcSave,
  antimatter: { mantissa: 1, exponent: 1200 },
}, SaveType.PC);
assert.ok(pcFormatMismatchIssues.some((issue) => issue.path === 'antimatter' && issue.title === 'Android numeric format'));

const androidFormatMismatchIssues = analyzeSaveData({
  ...sampleAndroidSave,
  infinityPoints: '1e250',
}, SaveType.Android);
assert.ok(androidFormatMismatchIssues.some((issue) => issue.path === 'infinityPoints' && issue.title === 'PC numeric format'));

const warningSampleReport = buildCoverageReport({
  saveType: SaveType.PC,
  nodes,
  coverage,
  changes: [],
  analysisIssues: pcFormatMismatchIssues,
  generatedAt: '2026-06-02T00:00:00.000Z',
});
assert.equal(warningSampleReport.safetySamples.length, pcFormatMismatchIssues.length);
assert.equal(warningSampleReport.safetyIssueCounts['warning | Android numeric format'], 1);
assert.ok(warningSampleReport.safetySamples.some((sample) => sample.path === 'antimatter' && sample.title === 'Android numeric format'));
const warningQaSummary = buildQaSummary(warningSampleReport);
assert.ok(warningQaSummary.includes('## Safety Issue Counts'));
assert.ok(warningQaSummary.includes('- warning | Android numeric format: 1'));
assert.ok(warningQaSummary.includes('## Safety Samples'));
assert.ok(warningQaSummary.includes('warning | Android numeric format | antimatter'));
assert.ok(!warningQaSummary.includes('1200'), 'QA warning summary should not include warning sample values');
assert.ok(!warningQaSummary.includes('1e1200'), 'QA warning summary should not include unrelated save values');
assert.ok(!warningQaSummary.includes('AntimatterDimensionsSavefileFormat'), 'QA warning summary should not include encoded save text');

const countLikeIssues = analyzeSaveData({
  ...samplePcSave,
  dimensionBoosts: 1.5,
  galaxies: -1,
}, SaveType.PC);
assert.ok(countLikeIssues.some((issue) => issue.path === 'dimensionBoosts' && issue.title === 'Fractional count'));
assert.ok(countLikeIssues.some((issue) => issue.path === 'galaxies' && issue.title === 'Negative count'));

const unknownPathSave = {
  ...samplePcSave,
  qqqBucket: {
    alpha: {
      token: 'private-value',
    },
    beta: 3,
  },
  zzzFlag: false,
};
const unknownNodes = buildPathIndex(unknownPathSave, SaveType.PC);
const unknownCoverage = calculateCoverage(unknownNodes);
const unknownReport = buildCoverageReport({
  saveType: SaveType.PC,
  nodes: unknownNodes,
  coverage: unknownCoverage,
  changes: [],
  analysisIssues: [],
  generatedAt: '2026-06-02T00:00:00.000Z',
});
assert.equal(unknownReport.totals.unknownPaths, 5);
assert.deepEqual(unknownReport.unknownTopLevelCounts, {
  qqqBucket: 4,
  zzzFlag: 1,
});
const unknownQaSummary = buildQaSummary(unknownReport);
assert.ok(unknownQaSummary.includes('## Unknown Top-Level Counts'));
assert.ok(unknownQaSummary.includes('- qqqBucket: 4'));
assert.ok(unknownQaSummary.includes('- zzzFlag: 1'));
assert.ok(!unknownQaSummary.includes('private-value'), 'Unknown path QA summary should not include unknown save values');

const requiredCategoryIds = CATEGORIES
  .map((category) => category.id)
  .filter((categoryId) => categoryId !== 'unknown');

assert.ok(KNOWN_TOP_LEVEL_CATEGORIES.length >= 100, 'Known top-level taxonomy guard should cover the broad AD player shape');
assert.equal(
  new Set(KNOWN_TOP_LEVEL_CATEGORIES.map(([path]) => path)).size,
  KNOWN_TOP_LEVEL_CATEGORIES.length,
  'Known top-level taxonomy guard should not contain duplicate paths'
);

for (const [path, categoryId] of KNOWN_TOP_LEVEL_CATEGORIES) {
  assert.equal(categorizePath([path]).id, categoryId, `${path} should be categorized as ${categoryId}`);
}

const progressionFixtures = [
  ['pc-normal', createNormalPcSave(), SaveType.PC, STAGES.NORMAL],
  ['pc-infinity', createInfinityPcSave(), SaveType.PC, STAGES.INFINITY],
  ['pc-eternity', createEternityPcSave(), SaveType.PC, STAGES.ETERNITY],
  ['pc-late-game', createComprehensivePcSave(), SaveType.PC, STAGES.REALITY],
  ['android-normal', createNormalAndroidSave(), SaveType.Android, STAGES.NORMAL],
  ['android-infinity', createInfinityAndroidSave(), SaveType.Android, STAGES.INFINITY],
  ['android-eternity', createEternityAndroidSave(), SaveType.Android, STAGES.ETERNITY],
  ['android-late-game', createComprehensiveAndroidSave(), SaveType.Android, STAGES.REALITY],
];

assert.equal(isPositiveQuantity(0), false);
assert.equal(isPositiveQuantity(5), true);
assert.equal(isPositiveQuantity('0'), false);
assert.equal(isPositiveQuantity('0e1000'), false);
assert.equal(isPositiveQuantity('1e250'), true);
assert.equal(isPositiveQuantity('1e1000'), true);
assert.equal(isPositiveQuantity('-1e1000'), false);
assert.equal(isPositiveQuantity('not-a-number'), false);
assert.equal(isPositiveQuantity({ mantissa: 0, exponent: 0 }), false);
assert.equal(isPositiveQuantity({ mantissa: 1, exponent: 1000 }), true);
assert.equal(isPositiveQuantity(null), false);
assert.equal(isPositiveQuantity(undefined), false);
assert.equal(isPositiveQuantity(false), false);
assert.equal(detectStage(samplePcSave), STAGES.NORMAL);
assert.equal(detectStage(sampleAndroidSave), STAGES.NORMAL);
assert.equal(
  detectStage({
    ...samplePcSave,
    infinityPoints: '0',
    eternityPoints: '0',
    realities: '0',
    reality: { realityMachines: '0', imaginaryMachines: 0 },
    celestials: {},
    blackHole: [],
  }),
  STAGES.NORMAL,
  'present but zero later-stage trees should not imply late-game progress'
);

const assertProgressionFixture = async ([fixtureId, saveData, saveType, expectedStage]) => {
  const encoded = await encodeSaveData(saveData, saveType);
  const decoded = await decodeSave(encoded);
  assert.equal(decoded.saveType, saveType, `${fixtureId} should decode as ${saveType}`);
  assert.deepEqual(decoded.data, saveData, `${fixtureId} should round-trip through the codec`);
  assert.equal(detectStage(decoded.data), expectedStage, `${fixtureId} should be detected as ${expectedStage}`);

  const fixtureNodes = buildPathIndex(decoded.data, saveType);
  const fixtureCoverage = calculateCoverage(fixtureNodes);
  const safetySummary = summarizeAnalysis(analyzeSaveData(decoded.data, saveType));
  assert.equal(fixtureCoverage.total, fixtureNodes.length, `${fixtureId} coverage should match indexed nodes`);
  assert.equal(fixtureCoverage.editableCount, fixtureNodes.length, `${fixtureId} should keep every path editable`);
  assert.equal(safetySummary.errors, 0, `${fixtureId} should have no safety errors`);
  assert.ok(fixtureCoverage.total > 20, `${fixtureId} should cover more than a trivial save`);
  return fixtureCoverage.total;
};

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

  const qaSummary = buildQaSummary(report);
  assert.ok(qaSummary.includes('Real-Save QA Summary'));
  assert.ok(qaSummary.includes(`Save type: ${saveType.toUpperCase()}`));
  assert.ok(qaSummary.includes(`- Paths: ${fixtureCoverage.total}`));
  assert.ok(qaSummary.includes('- Errors: 0'));
  assert.ok(!qaSummary.includes('1e1200'), 'QA summary should not include save values');
  assert.ok(!qaSummary.includes('AntimatterDimensionsSavefileFormat'), 'QA summary should not include encoded save text');

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

const progressionCoverageTotals = await Promise.all(progressionFixtures.map(assertProgressionFixture));
const pcCoverageTotal = await assertComprehensiveCoverage(createComprehensivePcSave(), SaveType.PC);
const androidCoverageTotal = await assertComprehensiveCoverage(createComprehensiveAndroidSave(), SaveType.Android);
const qaArtifacts = await createQaArtifacts();
assert.deepEqual(
  qaArtifacts.manifest.fixtures.map((fixture) => fixture.id),
  progressionFixtures.map(([fixtureId]) => fixtureId)
);
assert.deepEqual(
  qaArtifacts.manifest.fixtures.map((fixture) => `${fixture.saveType}:${fixture.gameStage}`),
  [
    'pc:Normal',
    'pc:Infinity',
    'pc:Eternity',
    'pc:Reality',
    'android:Normal',
    'android:Infinity',
    'android:Eternity',
    'android:Reality',
  ]
);
assert.equal(qaArtifacts.files.length, (progressionFixtures.length * 2) + 2);
assert.ok(qaArtifacts.manifest.fixtures.every((fixture) => fixture.expectedTotals.paths > 20));
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

console.log(`Smoke tests passed: ${coverage.total} sample paths, ${progressionCoverageTotals.length} progression fixtures, ${pcCoverageTotal} PC late-game paths, ${androidCoverageTotal} Android late-game paths, ${PRESETS.length} presets validated.`);
