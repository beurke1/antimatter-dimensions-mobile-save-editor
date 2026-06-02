import { CATEGORIES } from './taxonomy.js';

const sortByCount = (entries) => {
  return Object.fromEntries(
    Object.entries(entries).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
  );
};

const increment = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

export const buildCoverageReport = ({
  saveType,
  nodes,
  coverage,
  changes = [],
  analysisIssues = [],
  generatedAt = new Date().toISOString(),
}) => {
  const stageCounts = {};
  const typeCounts = {};
  const depthCounts = {};
  const topLevelPaths = [];
  const unknownPaths = [];

  for (const node of nodes) {
    increment(stageCounts, node.stage);
    increment(typeCounts, node.type);
    increment(depthCounts, String(node.depth));

    if (node.depth === 1) {
      topLevelPaths.push(node.path);
    }

    if (node.categoryId === 'unknown') {
      unknownPaths.push(node.path);
    }
  }

  const knownCategoryIds = CATEGORIES.map((category) => category.id);
  const missingCategories = knownCategoryIds.filter((categoryId) => {
    if (categoryId === 'unknown') {
      return false;
    }

    return (coverage.categoryCounts[categoryId] ?? 0) === 0;
  });

  const issueCounts = {
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const issue of analysisIssues) {
    increment(issueCounts, issue.severity);
  }

  return {
    generatedAt,
    saveType,
    totals: {
      paths: coverage.total,
      editablePaths: coverage.editableCount,
      leaves: coverage.leafCount,
      containers: coverage.containerCount,
      changedPaths: changes.length,
      unknownPaths: unknownPaths.length,
    },
    categories: sortByCount(coverage.categoryCounts),
    missingCategories,
    stages: sortByCount(stageCounts),
    valueTypes: sortByCount(typeCounts),
    depths: sortByCount(depthCounts),
    topLevelPaths: topLevelPaths.sort(),
    unknownPaths: unknownPaths.slice(0, 250).sort(),
    safety: issueCounts,
  };
};

const formatCountBlock = (counts) => {
  const entries = Object.entries(counts ?? {});
  return entries.length
    ? entries.map(([key, value]) => `- ${key}: ${value}`)
    : ['- none'];
};

const formatListBlock = (items, limit = 40) => {
  if (!items || items.length === 0) {
    return ['- none'];
  }

  const visibleItems = items.slice(0, limit).map((item) => `- ${item}`);
  const remaining = items.length - visibleItems.length;

  return remaining > 0
    ? [...visibleItems, `- ... ${remaining} more`]
    : visibleItems;
};

export const buildQaSummary = (coverageReport) => {
  if (!coverageReport) {
    return '';
  }

  const totals = coverageReport.totals ?? {};
  const safety = coverageReport.safety ?? {};

  return [
    '# Antimatter Dimensions Real-Save QA Summary',
    '',
    'This summary intentionally excludes save values and encoded save text.',
    '',
    `Generated: ${coverageReport.generatedAt}`,
    `Save type: ${String(coverageReport.saveType ?? 'unknown').toUpperCase()}`,
    '',
    '## Totals',
    `- Paths: ${totals.paths ?? 0}`,
    `- Editable paths: ${totals.editablePaths ?? 0}`,
    `- Leaves: ${totals.leaves ?? 0}`,
    `- Containers: ${totals.containers ?? 0}`,
    `- Changed paths: ${totals.changedPaths ?? 0}`,
    `- Unknown paths: ${totals.unknownPaths ?? 0}`,
    '',
    '## Safety',
    `- Errors: ${safety.error ?? 0}`,
    `- Warnings: ${safety.warning ?? 0}`,
    `- Notes: ${safety.info ?? 0}`,
    '',
    '## Missing Categories',
    ...formatListBlock(coverageReport.missingCategories),
    '',
    '## Category Counts',
    ...formatCountBlock(coverageReport.categories),
    '',
    '## Stage Counts',
    ...formatCountBlock(coverageReport.stages),
    '',
    '## Value Types',
    ...formatCountBlock(coverageReport.valueTypes),
    '',
    '## Unknown Paths',
    ...formatListBlock(coverageReport.unknownPaths),
    '',
    '## Top-Level Paths',
    ...formatListBlock(coverageReport.topLevelPaths),
    '',
  ].join('\n');
};
