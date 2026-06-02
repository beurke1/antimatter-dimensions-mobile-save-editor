const createItem = (id, label, state, detail) => ({
  id,
  label,
  state,
  detail,
});

export const buildReadinessSummary = ({
  coverageReport,
  analysisSummary = { errors: 0, warnings: 0, info: 0 },
  isDirty = false,
  encodedOutput = '',
}) => {
  if (!coverageReport) {
    return {
      status: 'empty',
      label: 'No save loaded',
      canEncode: false,
      readyToImport: false,
      items: [
        createItem('loaded', 'Save loaded', 'pending', 'Import a save to evaluate readiness.'),
      ],
    };
  }

  const allPathsEditable = coverageReport.totals.paths === coverageReport.totals.editablePaths;
  const hasSafetyErrors = analysisSummary.errors > 0;
  const hasWarnings = analysisSummary.warnings > 0 || analysisSummary.info > 0 || coverageReport.totals.unknownPaths > 0;
  const hasEncodedOutput = Boolean(encodedOutput);
  const readyToImport = hasEncodedOutput && !isDirty && !hasSafetyErrors;

  const items = [
    createItem(
      'loaded',
      'Save loaded',
      'pass',
      `${coverageReport.saveType.toUpperCase()} save with ${coverageReport.totals.paths} indexed paths.`
    ),
    createItem(
      'editable-coverage',
      'Path coverage',
      allPathsEditable ? 'pass' : 'fail',
      `${coverageReport.totals.editablePaths} of ${coverageReport.totals.paths} paths are editable.`
    ),
    createItem(
      'classification',
      'Classification',
      coverageReport.totals.unknownPaths === 0 ? 'pass' : 'warn',
      coverageReport.totals.unknownPaths === 0
        ? 'No unknown paths.'
        : `${coverageReport.totals.unknownPaths} unknown paths remain reachable.`
    ),
    createItem(
      'safety',
      'Safety',
      hasSafetyErrors ? 'fail' : hasWarnings ? 'warn' : 'pass',
      `${analysisSummary.errors} errors, ${analysisSummary.warnings} warnings, ${analysisSummary.info} notes.`
    ),
    createItem(
      'export',
      'Export',
      readyToImport ? 'pass' : hasEncodedOutput && isDirty ? 'warn' : 'pending',
      readyToImport
        ? 'Encoded output is current.'
        : hasEncodedOutput && isDirty
          ? 'Encoded output is stale after edits.'
          : 'Encode when edits are ready.'
    ),
  ];

  let status = 'ready';
  if (items.some((item) => item.state === 'fail')) {
    status = 'blocked';
  } else if (items.some((item) => item.state === 'warn')) {
    status = 'review';
  } else if (!readyToImport) {
    status = 'encode';
  }

  const labelByStatus = {
    blocked: 'Fix before export',
    review: 'Review before export',
    encode: 'Ready to encode',
    ready: 'Ready to import',
  };

  return {
    status,
    label: labelByStatus[status],
    canEncode: !hasSafetyErrors,
    readyToImport,
    items,
  };
};

