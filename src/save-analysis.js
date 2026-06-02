import { buildPathIndex, getValueAtSegments } from './path-index.js';

const CORE_PATHS = ['version', 'lastUpdate'];
const COUNT_KEY_PATTERN = /(?:bought|boosts?|galax(?:y|ies)|upgrades?|purchases?|infinities|eternities|realities|completions?|version)$/iu;
const ANDROID_DECIMAL_STRING_CATEGORIES = new Set([
  'resources',
  'dimensions',
  'challenges',
  'infinity',
  'replicanti',
  'eternity',
  'reality',
  'black-hole',
  'celestials',
  'records',
]);
const DECIMAL_STRING_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d+)?)|(?:\.\d+))(?:e[+-]?\d+)?$/iu;

const isRecord = (value) => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const makeIssue = (severity, path, title, message) => ({
  id: `${severity}:${path}:${title}`,
  severity,
  path,
  title,
  message,
});

const isDescendantOf = (segments, ancestorSegments) => {
  if (ancestorSegments.length >= segments.length) {
    return false;
  }

  return ancestorSegments.every((segment, index) => segment === segments[index]);
};

const hasStructuralAncestor = (change, structuralChanges) => {
  return structuralChanges.some((candidate) => {
    if (candidate.path === change.path) {
      return false;
    }

    return isDescendantOf(change.segments, candidate.segments);
  });
};

const isDecimalString = (value) => {
  return typeof value === 'string' && DECIMAL_STRING_PATTERN.test(value.trim());
};

export const analyzeSaveData = (data, saveType = 'pc') => {
  const issues = [];

  if (!isRecord(data)) {
    return [
      makeIssue('error', 'root', 'Invalid root', 'The decoded save must be a JSON object.'),
    ];
  }

  for (const path of CORE_PATHS) {
    if (!(path in data)) {
      issues.push(makeIssue('warning', path, 'Missing core field', `${path} is normally present in Antimatter Dimensions saves.`));
    }
  }

  const nodes = buildPathIndex(data, saveType);

  for (const node of nodes) {
    const value = getValueAtSegments(data, node.segments);

    if (node.type === 'number' && !Number.isFinite(value)) {
      issues.push(makeIssue('error', node.path, 'Invalid number', 'Numbers must be finite before export.'));
    }

    if (node.type === 'big-number') {
      if (!Number.isFinite(value.mantissa) || !Number.isFinite(value.exponent)) {
        issues.push(makeIssue('error', node.path, 'Invalid big number', 'Mantissa and exponent must both be finite numbers.'));
      }

      if (!Number.isInteger(value.exponent)) {
        issues.push(makeIssue('warning', node.path, 'Fractional exponent', 'Big-number exponents are normally integers.'));
      }

      if (saveType === 'pc') {
        issues.push(makeIssue(
          'warning',
          node.path,
          'Android numeric format',
          'PC saves normally store Decimal values as strings. Mantissa/exponent objects may only import correctly in Android saves.'
        ));
      }
    }

    if (
      saveType === 'android' &&
      node.type === 'string' &&
      ANDROID_DECIMAL_STRING_CATEGORIES.has(node.categoryId) &&
      isDecimalString(value)
    ) {
      issues.push(makeIssue(
        'warning',
        node.path,
        'PC numeric format',
        'Android saves normally store Decimal values as mantissa/exponent objects. Decimal strings may not import correctly.'
      ));
    }

    if (
      node.type === 'number' &&
      typeof value === 'number' &&
      value < 0 &&
      COUNT_KEY_PATTERN.test(node.key)
    ) {
      issues.push(makeIssue('warning', node.path, 'Negative count', 'This looks like a count-like field and may not support negative values.'));
    }

    if (
      node.type === 'number' &&
      typeof value === 'number' &&
      !Number.isInteger(value) &&
      COUNT_KEY_PATTERN.test(node.key)
    ) {
      issues.push(makeIssue('warning', node.path, 'Fractional count', 'This looks like a count-like field and may not support fractional values.'));
    }
  }

  return issues;
};

export const analyzeEditRisks = (changes) => {
  const risks = [];
  const structuralChanges = changes.filter((change) => {
    return change.changeType === 'added' ||
      change.changeType === 'removed' ||
      change.beforeType !== change.afterType;
  });

  for (const change of changes) {
    if (change.path === 'root' && change.changeType === 'changed') {
      continue;
    }

    if (hasStructuralAncestor(change, structuralChanges)) {
      continue;
    }

    if (change.changeType === 'removed') {
      risks.push(makeIssue('warning', change.path, 'Removed path', 'Removed save paths can make an imported save fail to load.'));
      continue;
    }

    if (change.changeType === 'added') {
      risks.push(makeIssue('warning', change.path, 'Added path', 'New paths may be ignored by the game or may break older versions.'));
      continue;
    }

    if (change.beforeType !== change.afterType) {
      risks.push(makeIssue('warning', change.path, 'Type changed', `Value type changed from ${change.beforeType} to ${change.afterType}.`));
      continue;
    }

    if (change.isContainer) {
      continue;
    }

    if (change.categoryId === 'celestials' || change.categoryId === 'reality' || change.categoryId === 'black-hole') {
      risks.push(makeIssue('info', change.path, 'Late-game edit', 'Late-game systems are highly interconnected. Encode after reviewing related fields.'));
    }
  }

  return risks;
};

export const summarizeAnalysis = (issues) => {
  return {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };
};
