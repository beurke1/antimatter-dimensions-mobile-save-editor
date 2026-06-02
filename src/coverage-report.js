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
