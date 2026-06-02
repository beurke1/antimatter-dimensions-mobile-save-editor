import { decodeSave, encodeSaveData, SaveType, stringifySaveJson } from './save-codec.js';
import {
  buildChangeIndex,
  buildPathIndex,
  calculateCoverage,
  deleteValueAtSegments,
  getAncestorNodes,
  getDirectChildNodes,
  getNodeByPath,
  getValueAtSegments,
  getValueType,
  isNodeWithinScope,
  setValueAtSegments,
} from './path-index.js';
import { analyzeEditRisks, analyzeSaveData, summarizeAnalysis } from './save-analysis.js';
import { buildCoverageReport, buildQaSummary } from './coverage-report.js';
import { buildReadinessSummary } from './readiness.js';
import { CATEGORIES, getCategory } from './taxonomy.js';
import { PRESETS, applyPreset } from './presets.js';
import { detectStage } from './stage.js';

const appRoot = document.querySelector('#app');
const searchableTypes = new Set(['string', 'number', 'boolean', 'null', 'big-number', 'array', 'object']);
const stageFilters = [
  { id: 'all', label: 'All', stage: '' },
  { id: 'normal', label: 'Normal', stage: '' },
  { id: 'infinity', label: 'Infinity', stage: 'infinity' },
  { id: 'eternity', label: 'Eternity', stage: 'eternity' },
  { id: 'reality', label: 'Reality', stage: 'reality' },
  { id: 'meta', label: 'Meta', stage: '' },
  { id: 'fallback', label: 'Fallback', stage: '' },
];

const state = {
  rawInput: '',
  data: null,
  originalData: null,
  saveType: SaveType.PC,
  source: null,
  nodes: [],
  changes: [],
  analysisIssues: [],
  analysisSummary: { errors: 0, warnings: 0, info: 0 },
  coverage: null,
  coverageReport: null,
  readiness: buildReadinessSummary({ coverageReport: null }),
  activeCategoryId: 'all',
  activeStageId: 'all',
  scopePath: 'root',
  query: '',
  typeFilter: 'all',
  showChangedOnly: false,
  visibleLimit: 120,
  dirty: false,
  notice: null,
  error: null,
  encodedOutput: '',
  importCollapsed: false,
  showDetails: false,
  showPresets: false,
  showAllSafety: false,
};

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#039;');
};

const preserveFocus = (renderWork) => {
  const activeElement = document.activeElement;
  const activeId = activeElement?.id || activeElement?.dataset?.focusKey;
  const selectionStart = activeElement && 'selectionStart' in activeElement ? activeElement.selectionStart : null;
  const selectionEnd = activeElement && 'selectionEnd' in activeElement ? activeElement.selectionEnd : null;

  renderWork();

  if (!activeId) {
    return;
  }

  const nextElement = document.getElementById(activeId) ?? appRoot.querySelector(`[data-focus-key="${CSS.escape(activeId)}"]`);
  if (nextElement && typeof nextElement.focus === 'function') {
    nextElement.focus({ preventScroll: true });

    if (selectionStart !== null && 'setSelectionRange' in nextElement) {
      nextElement.setSelectionRange(selectionStart, selectionEnd);
    }
  }
};

const setNotice = (message, tone = 'neutral') => {
  state.notice = { message, tone };
  state.error = null;
};

const setError = (message) => {
  state.error = message;
  state.notice = null;
};

const stageMatchesFilter = (stage, filterId) => {
  if (filterId === 'all') {
    return true;
  }

  const normalizedStage = String(stage ?? '').toLowerCase();

  if (normalizedStage === 'all game') {
    return filterId !== 'fallback';
  }

  if (filterId === 'meta') {
    return normalizedStage.includes('meta');
  }

  if (filterId === 'fallback') {
    return normalizedStage.includes('fallback');
  }

  return normalizedStage.includes(filterId);
};

const stageCssClass = (stage) => {
  const s = String(stage ?? '').toLowerCase();
  if (s.includes('infinity')) {
    return 'stage-infinity';
  }

  if (s.includes('eternity')) {
    return 'stage-eternity';
  }

  if (s.includes('reality')) {
    return 'stage-reality';
  }

  return '';
};

const refreshReadiness = () => {
  state.readiness = buildReadinessSummary({
    coverageReport: state.coverageReport,
    analysisSummary: state.analysisSummary,
    isDirty: state.dirty,
    encodedOutput: state.encodedOutput,
  });
};

const rebuildIndex = () => {
  state.nodes = state.data ? buildPathIndex(state.data, state.saveType) : [];
  state.changes = state.data && state.originalData
    ? buildChangeIndex(state.originalData, state.data, state.saveType)
    : [];
  state.analysisIssues = state.data
    ? [
      ...analyzeSaveData(state.data, state.saveType),
      ...analyzeEditRisks(state.changes),
    ]
    : [];
  state.analysisSummary = summarizeAnalysis(state.analysisIssues);
  state.coverage = state.nodes.length ? calculateCoverage(state.nodes) : null;
  state.coverageReport = state.coverage
    ? buildCoverageReport({
      saveType: state.saveType,
      nodes: state.nodes,
      coverage: state.coverage,
      changes: state.changes,
      analysisIssues: state.analysisIssues,
    })
    : null;
  refreshReadiness();

  if (state.scopePath !== 'root' && !getNodeByPath(state.nodes, state.scopePath)) {
    state.scopePath = 'root';
  }
};

const getNode = (path) => {
  return getNodeByPath(state.nodes, path);
};

const getChange = (path) => {
  return state.changes.find((change) => change.path === path);
};

const markDataChanged = () => {
  rebuildIndex();
  state.dirty = state.changes.length > 0;
  state.encodedOutput = '';
  refreshReadiness();
};

const updateDataAtNode = (node, value, sourceLabel = 'field') => {
  state.data = setValueAtSegments(state.data, node.segments, value);
  markDataChanged();
  setNotice(`${node.path} updated.`, 'success');
  render();
};

const resetChangeAtPath = (path) => {
  const change = getChange(path);

  if (!change || !state.originalData) {
    return;
  }

  const originalValue = getValueAtSegments(state.originalData, change.segments);
  state.data = originalValue === undefined
    ? deleteValueAtSegments(state.data, change.segments)
    : setValueAtSegments(state.data, change.segments, structuredClone(originalValue));
  markDataChanged();
  setNotice(`${path} reset.`, 'success');
  render();
};

const resetAllChanges = () => {
  if (!state.originalData) {
    return;
  }

  state.data = structuredClone(state.originalData);
  markDataChanged();
  state.dirty = false;
  setNotice('All edits reset.', 'success');
  render();
};

const revealIssuePath = (path) => {
  const node = getNode(path);

  state.activeCategoryId = 'all';
  state.activeStageId = 'all';
  state.typeFilter = 'all';
  state.showChangedOnly = false;
  state.visibleLimit = 120;

  if (node) {
    state.scopePath = node.isContainer ? node.path : node.parentPath ?? 'root';
    state.query = node.path;
    setNotice(`${node.path} opened in the path browser.`, 'success');
  } else {
    state.scopePath = 'root';
    state.query = path === 'root' ? '' : path;
    setNotice(`${path} is not present in the indexed save; searching from root.`, 'neutral');
  }

  render();
};

const parseJsonValue = (text) => {
  return JSON.parse(text);
};

const commitLeafInput = (input) => {
  const card = input.closest('[data-node-path]');
  const node = card ? getNode(card.dataset.nodePath) : null;

  if (!node) {
    return;
  }

  const type = input.dataset.editorType;
  let nextValue;

  if (type === 'number') {
    nextValue = Number(input.value.trim());

    if (!Number.isFinite(nextValue)) {
      setError(`Invalid number for ${node.path}.`);
      render();
      return;
    }
  } else if (type === 'big-mantissa' || type === 'big-exponent') {
    const currentValue = getValueAtSegments(state.data, node.segments);
    const parsedValue = Number(input.value.trim());

    if (!Number.isFinite(parsedValue) || !currentValue || typeof currentValue !== 'object') {
      setError(`Invalid big number value for ${node.path}.`);
      render();
      return;
    }

    nextValue = {
      ...currentValue,
      [type === 'big-mantissa' ? 'mantissa' : 'exponent']: parsedValue,
    };
  } else if (type === 'string') {
    nextValue = input.value;
  } else if (type === 'json') {
    try {
      nextValue = parseJsonValue(input.value);
    } catch (error) {
      setError(error instanceof Error ? error.message : `Invalid JSON for ${node.path}.`);
      render();
      return;
    }
  } else {
    return;
  }

  updateDataAtNode(node, nextValue, 'inline edit');
};

const filteredNodes = () => {
  const normalizedQuery = state.query.trim().toLowerCase();
  const changedPathSet = new Set(state.changes.map((change) => change.path));
  const nodeByPath = new Map(state.nodes.map((node) => [node.path, node]));

  return state.nodes.filter((node) => {
    if (!isNodeWithinScope(node, state.scopePath, nodeByPath)) {
      return false;
    }

    if (state.activeCategoryId !== 'all' && node.categoryId !== state.activeCategoryId) {
      return false;
    }

    if (!stageMatchesFilter(node.stage, state.activeStageId)) {
      return false;
    }

    if (state.typeFilter !== 'all' && node.type !== state.typeFilter) {
      return false;
    }

    if (state.showChangedOnly && !changedPathSet.has(node.path)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchableText = [
      node.path,
      node.key,
      node.type,
      node.categoryTitle,
      node.stage,
      node.preview,
    ].join(' ').toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
};

/* ── RENDER HELPERS ── */

const renderHeader = () => {
  const gameStage = state.data ? detectStage(state.data) : null;
  const status = state.data
    ? `${state.saveType.toUpperCase()} · ${gameStage}`
    : 'No save loaded';
  const editState = state.dirty ? 'Needs encode' : state.changes.length ? 'Encoded' : 'Clean';

  return `
    <header class="topbar">
      <div class="title-block">
        <span class="eyebrow">Antimatter Dimensions</span>
        <h1>Save Editor</h1>
      </div>
      <div class="status-stack" aria-label="Save status">
        <span class="status-pill">${escapeHtml(status)}</span>
        ${state.data ? `<span class="status-pill ${state.dirty || state.changes.length ? 'dirty' : ''}">${escapeHtml(editState)}</span>` : ''}
      </div>
    </header>
  `;
};

const renderImportPanel = () => {
  if (state.importCollapsed) {
    const pathCount = state.coverage?.total ?? 0;
    const stage = state.data ? detectStage(state.data) : '';
    return `
      <section class="panel import-panel" aria-label="Import">
        <div class="import-compact">
          <div class="import-compact-info">
            <strong>${escapeHtml(state.saveType.toUpperCase())} save · ${escapeHtml(stage)}</strong>
            <span>${pathCount} paths indexed</span>
          </div>
          <button type="button" class="secondary-button compact" data-action="toggle-import">Re-import</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="panel import-panel" aria-labelledby="import-title">
      <div class="panel-heading">
        <div>
          <h2 id="import-title">Import Save</h2>
          <p>Paste a PC or Android save string, or a decoded JSON object.</p>
        </div>
        <button class="icon-button" type="button" data-action="choose-file" aria-label="Open save file">↥</button>
      </div>
      <textarea
        id="raw-save"
        class="save-input"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="AntimatterDimensionsSavefileFormat..."
      >${escapeHtml(state.rawInput)}</textarea>
      <input id="file-input" class="file-input" type="file" accept=".txt,.json,text/plain,application/json" />
      <div class="action-row">
        <button type="button" class="secondary-button" data-action="paste">Paste</button>
        <button type="button" class="primary-button" data-action="decode">Decode</button>
      </div>
    </section>
  `;
};

const renderMessages = () => {
  if (state.error) {
    return `<div class="alert" role="alert">${escapeHtml(state.error)}</div>`;
  }

  if (state.notice) {
    return `<div class="notice ${escapeHtml(state.notice.tone)}" role="status">${escapeHtml(state.notice.message)}</div>`;
  }

  return '';
};

const renderStatStrip = () => {
  if (!state.coverage) {
    return '';
  }

  const issueTotal = state.analysisSummary.errors + state.analysisSummary.warnings;

  return `
    <div class="stat-strip" aria-label="Save statistics">
      <div class="stat-cell">
        <span>Paths</span>
        <strong>${state.coverage.total}</strong>
      </div>
      <div class="stat-cell ${state.changes.length ? 'has-changes' : ''}">
        <span>Changed</span>
        <strong>${state.changes.length}</strong>
      </div>
      <div class="stat-cell ${state.analysisSummary.errors ? 'has-errors' : state.analysisSummary.warnings ? 'has-warnings' : ''}">
        <span>Issues</span>
        <strong>${issueTotal}</strong>
      </div>
      <div class="stat-cell">
        <span>Fallback</span>
        <strong>${state.coverage.uncategorizedCount}</strong>
      </div>
    </div>
  `;
};

const renderCategoryTabs = () => {
  if (!state.coverage) {
    return '';
  }

  const allCount = state.coverage.total;
  const categoryButtons = [
    { id: 'all', title: 'All', count: allCount, accentStage: '' },
    ...CATEGORIES.map((category) => ({
      id: category.id,
      title: category.title,
      count: state.coverage.categoryCounts[category.id] ?? 0,
      accentStage: category.accentStage ?? '',
    })).filter((category) => category.count > 0 || category.id === 'unknown'),
  ];

  return `
    <nav class="category-tabs" aria-label="Save categories">
      ${categoryButtons.map((category) => `
        <button
          type="button"
          class="${category.id === state.activeCategoryId ? 'active' : ''}"
          data-action="set-category"
          data-category-id="${escapeHtml(category.id)}"
          data-accent="${escapeHtml(category.accentStage)}"
        >
          <span>${escapeHtml(category.title)}</span>
          <strong>${category.count}</strong>
        </button>
      `).join('')}
    </nav>
  `;
};

const renderStageTabs = () => {
  if (!state.coverage) {
    return '';
  }

  return `
    <nav class="stage-tabs" aria-label="Game stage filters">
      ${stageFilters.map((stage) => `
        <button
          type="button"
          class="${stage.id === state.activeStageId ? 'active' : ''}"
          data-action="set-stage"
          data-stage-id="${escapeHtml(stage.id)}"
          data-stage="${escapeHtml(stage.stage)}"
        >
          ${escapeHtml(stage.label)}
        </button>
      `).join('')}
    </nav>
  `;
};

const renderFilters = () => {
  if (!state.data) {
    return '';
  }

  const typeOptions = ['all', ...searchableTypes];

  return `
    <section class="filter-bar" aria-label="Search and filters">
      <input
        id="path-search"
        type="search"
        value="${escapeHtml(state.query)}"
        placeholder="Search path, key, value..."
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <select id="type-filter" aria-label="Type filter">
        ${typeOptions.map((type) => `
          <option value="${escapeHtml(type)}" ${state.typeFilter === type ? 'selected' : ''}>${escapeHtml(type === 'all' ? 'All types' : type)}</option>
        `).join('')}
      </select>
      <button
        type="button"
        class="changed-toggle ${state.showChangedOnly ? 'active' : ''}"
        data-action="toggle-changed-filter"
        aria-pressed="${state.showChangedOnly ? 'true' : 'false'}"
      >
        ${state.changes.length ? `Changed (${state.changes.length})` : 'No changes yet'}
      </button>
    </section>
  `;
};

const renderScopeNavigator = () => {
  if (!state.data || state.nodes.length === 0) {
    return '';
  }

  const scopeNode = getNode(state.scopePath) ?? getNode('root');
  const breadcrumbs = getAncestorNodes(state.nodes, scopeNode.path);
  const children = getDirectChildNodes(state.nodes, scopeNode.path);
  const visibleChildren = children.slice(0, 72);
  const hiddenChildren = Math.max(0, children.length - visibleChildren.length);

  return `
    <section class="panel scope-panel" aria-labelledby="scope-title">
      <div class="panel-heading">
        <div>
          <h2 id="scope-title">Browse</h2>
          <p>${escapeHtml(scopeNode.path)} · ${scopeNode.childCount} direct child${scopeNode.childCount === 1 ? '' : 'ren'}</p>
        </div>
        ${scopeNode.path !== 'root' ? '<button type="button" class="secondary-button compact" data-action="set-scope" data-scope-path="root">Root</button>' : ''}
      </div>
      <nav class="breadcrumbs" aria-label="Path breadcrumbs">
        ${breadcrumbs.map((crumb, index) => `
          <button
            type="button"
            class="${crumb.path === scopeNode.path ? 'active' : ''}"
            data-action="set-scope"
            data-scope-path="${escapeHtml(crumb.path)}"
          >
            ${escapeHtml(index === 0 ? 'root' : crumb.key)}
          </button>
        `).join('')}
      </nav>
      ${visibleChildren.length ? `
        <div class="child-grid" aria-label="Direct child paths">
          ${visibleChildren.map((child) => {
            const childChange = getChange(child.path);
            return `
              <button
                type="button"
                class="${child.isContainer ? 'container-child' : ''} ${childChange ? 'changed-child' : ''}"
                data-action="set-scope"
                data-scope-path="${escapeHtml(child.path)}"
                ${child.isContainer ? '' : 'disabled'}
              >
                <span>${escapeHtml(child.key)}</span>
                <small>${escapeHtml(child.type)}${child.isContainer ? ` · ${child.childCount}` : ''}${childChange ? ' · edited' : ''}</small>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}
      ${hiddenChildren ? `<p class="scope-more">${hiddenChildren} more children. Use search to narrow.</p>` : ''}
    </section>
  `;
};

const renderBooleanEditor = (node, value) => {
  return `
    <button
      type="button"
      role="switch"
      aria-checked="${value ? 'true' : 'false'}"
      class="switch ${value ? 'enabled' : ''}"
      data-action="toggle-boolean"
    >
      ${value ? 'On' : 'Off'}
    </button>
  `;
};

const renderLeafEditor = (node) => {
  const value = getValueAtSegments(state.data, node.segments);

  if (node.type === 'boolean') {
    return renderBooleanEditor(node, value);
  }

  if (node.type === 'number') {
    return `
      <input
        class="field-input"
        data-editor-type="number"
        type="text"
        inputmode="decimal"
        value="${escapeHtml(value)}"
        autocomplete="off"
      />
    `;
  }

  if (node.type === 'string') {
    const inputTag = String(value).length > 80 ? 'textarea' : 'input';

    if (inputTag === 'textarea') {
      return `
        <textarea
          class="field-input field-textarea"
          data-editor-type="string"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        >${escapeHtml(value)}</textarea>
      `;
    }

    return `
      <input
        class="field-input"
        data-editor-type="string"
        type="text"
        value="${escapeHtml(value)}"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
    `;
  }

  return `
    <textarea class="field-input field-textarea" data-editor-type="json">${escapeHtml(JSON.stringify(value))}</textarea>
  `;
};

const renderBigNumberEditor = (node, value) => {
  return `
    <div class="big-number-editor" aria-label="${escapeHtml(node.path)} big number">
      <label>
        <span>Mantissa</span>
        <input
          class="field-input"
          data-editor-type="big-mantissa"
          type="text"
          inputmode="decimal"
          value="${escapeHtml(value.mantissa)}"
          autocomplete="off"
        />
      </label>
      <label>
        <span>Exponent</span>
        <input
          class="field-input"
          data-editor-type="big-exponent"
          type="text"
          inputmode="numeric"
          value="${escapeHtml(value.exponent)}"
          autocomplete="off"
        />
      </label>
    </div>
  `;
};

const renderContainerEditor = (node) => {
  const value = getValueAtSegments(state.data, node.segments);
  const json = stringifySaveJson(value);

  return `
    <details class="subtree-editor">
      <summary></summary>
      <textarea class="subtree-textarea" spellcheck="false" autocapitalize="off">${escapeHtml(json)}</textarea>
      <button type="button" class="secondary-button full" data-action="apply-subtree-json">Apply JSON</button>
    </details>
  `;
};

const renderNodeCard = (node) => {
  const category = getCategory(node.categoryId);
  const value = getValueAtSegments(state.data, node.segments);
  const freshType = getValueType(value);
  const isContainer = node.isContainer;
  const change = getChange(node.path);
  const stageClass = stageCssClass(category.stage);

  return `
    <article class="path-card ${isContainer ? 'container' : 'leaf'} ${change ? 'changed' : ''}" data-node-path="${escapeHtml(node.path)}">
      <div class="path-main">
        <div class="path-copy">
          <span class="node-key">${escapeHtml(node.key)}</span>
          <code>${escapeHtml(node.path)}</code>
        </div>
        <div class="node-badges">
          ${change ? `<span class="badge changed-badge">${escapeHtml(change.changeType)}</span>` : ''}
          <span class="badge">${escapeHtml(freshType)}</span>
          ${stageClass ? `<span class="badge ${escapeHtml(stageClass)}">${escapeHtml(category.stage)}</span>` : ''}
        </div>
      </div>
      <div class="value-preview">${escapeHtml(node.preview)}</div>
      ${change ? `
        <div class="change-inline">
          <span>${escapeHtml(change.beforePreview)} → ${escapeHtml(change.afterPreview)}</span>
          <button type="button" class="tiny-button" data-action="reset-node">Reset</button>
        </div>
      ` : ''}
      ${node.type === 'big-number' ? renderBigNumberEditor(node, value) : ''}
      ${isContainer ? `
        <div class="container-meta">
          <span>${node.childCount} children · ${escapeHtml(category.title)}</span>
          <button type="button" class="tiny-button" data-action="set-scope" data-scope-path="${escapeHtml(node.path)}">Browse</button>
        </div>
        ${renderContainerEditor(node)}
      ` : `
        <div class="leaf-editor">${renderLeafEditor(node)}</div>
      `}
    </article>
  `;
};

const renderBrowser = () => {
  if (!state.data) {
    return `
      <section class="empty-state">
        <h2>Load a save above</h2>
        <p>Paste a PC or Android save string and tap Decode. Every path in the save becomes editable — organized by game stage, searchable, with before/after change tracking.</p>
      </section>
    `;
  }

  const category = state.activeCategoryId === 'all' ? null : getCategory(state.activeCategoryId);
  const results = filteredNodes();
  const visible = results.slice(0, state.visibleLimit);
  const hiddenCount = Math.max(0, results.length - visible.length);

  return `
    <section class="panel browser-panel" aria-labelledby="browser-title">
      <div class="panel-heading">
        <div>
          <h2 id="browser-title">${escapeHtml(category?.title ?? 'All Paths')}</h2>
          <p>${results.length} path${results.length === 1 ? '' : 's'} · all editable inline or via subtree JSON</p>
        </div>
      </div>
      <div class="path-list">
        ${visible.map(renderNodeCard).join('')}
      </div>
      ${hiddenCount ? `
        <button type="button" class="secondary-button full" data-action="load-more">Show ${Math.min(120, hiddenCount)} more</button>
      ` : ''}
    </section>
  `;
};

const renderChangeReview = () => {
  if (!state.data || state.changes.length === 0) {
    return '';
  }

  const previewChanges = state.changes.slice(0, 8);
  const remainingCount = Math.max(0, state.changes.length - previewChanges.length);

  return `
    <section class="panel change-review" aria-labelledby="changes-title">
      <div class="panel-heading">
        <div>
          <h2 id="changes-title">Review edits</h2>
          <p>${state.changes.length} changed path${state.changes.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" class="secondary-button compact" data-action="reset-all">Reset all</button>
      </div>
      <div class="change-list">
        ${previewChanges.map((change) => `
          <article class="change-row" data-change-path="${escapeHtml(change.path)}">
            <div>
              <span class="change-type">${escapeHtml(change.changeType)}</span>
              <code>${escapeHtml(change.path)}</code>
              <p>${escapeHtml(change.beforePreview)} → ${escapeHtml(change.afterPreview)}</p>
            </div>
            <button type="button" class="tiny-button" data-action="reset-change">Reset</button>
          </article>
        `).join('')}
      </div>
      ${remainingCount ? `<p class="change-more">${remainingCount} more via Changed filter above.</p>` : ''}
    </section>
  `;
};

const renderSafetyPanel = () => {
  if (!state.data || state.analysisIssues.length === 0) {
    return '';
  }

  const visibleIssues = state.showAllSafety ? state.analysisIssues : state.analysisIssues.slice(0, 6);
  const remainingCount = Math.max(0, state.analysisIssues.length - visibleIssues.length);
  const canToggle = state.analysisIssues.length > 6;

  return `
    <section class="panel safety-panel" aria-labelledby="safety-title">
      <div class="panel-heading">
        <div>
          <h2 id="safety-title">Safety check</h2>
          <p>${state.analysisSummary.errors} error${state.analysisSummary.errors === 1 ? '' : 's'} · ${state.analysisSummary.warnings} warning${state.analysisSummary.warnings === 1 ? '' : 's'} · ${state.analysisSummary.info} note${state.analysisSummary.info === 1 ? '' : 's'}</p>
        </div>
        ${canToggle ? `
          <button type="button" class="secondary-button compact" data-action="toggle-safety-list">
            ${state.showAllSafety ? 'Show fewer' : 'Show all'}
          </button>
        ` : ''}
      </div>
      <div class="safety-list">
        ${visibleIssues.map((issue) => {
          const targetNode = getNode(issue.path);
          return `
          <article class="safety-row ${escapeHtml(issue.severity)}">
            <div>
              <span class="safety-badge">${escapeHtml(issue.severity)}</span>
              <strong>${escapeHtml(issue.title)}</strong>
              <code>${escapeHtml(issue.path)}</code>
              <p>${escapeHtml(issue.message)}</p>
            </div>
            <button
              type="button"
              class="tiny-button"
              data-action="open-safety-path"
              data-issue-path="${escapeHtml(issue.path)}"
            >
              ${targetNode ? 'Open' : 'Find'}
            </button>
          </article>
        `;
        }).join('')}
      </div>
      ${remainingCount ? `<p class="safety-more">${remainingCount} more issue${remainingCount === 1 ? '' : 's'}.</p>` : ''}
    </section>
  `;
};

const renderPresetsPanel = () => {
  if (!state.data) {
    return '';
  }

  const gameStage = detectStage(state.data);
  const relevantPresets = PRESETS.filter((preset) => {
    // Always show Normal presets; show later presets only for appropriate saves
    if (preset.stage === 'Normal') {
      return true;
    }

    if (preset.stage === 'Infinity' && ['Infinity', 'Eternity', 'Reality'].includes(gameStage)) {
      return true;
    }

    if (preset.stage === 'Eternity' && ['Eternity', 'Reality'].includes(gameStage)) {
      return true;
    }

    if (preset.stage === 'Reality' && gameStage === 'Reality') {
      return true;
    }

    return false;
  });

  return `
    <section class="panel presets-panel" aria-labelledby="presets-title">
      <div class="panel-heading">
        <div>
          <h2 id="presets-title">Quick Edits</h2>
          <p>One-tap edits for common game states. Review changes before encoding.</p>
        </div>
      </div>
      <div class="presets-grid">
        ${relevantPresets.map((preset) => `
          <button
            type="button"
            class="preset-button"
            data-action="apply-preset"
            data-preset-id="${escapeHtml(preset.id)}"
            data-accent="${escapeHtml(preset.accentStage)}"
          >
            <strong>${escapeHtml(preset.label)}</strong>
            <small>${escapeHtml(preset.description)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
};

const renderDetailsSection = () => {
  if (!state.data) {
    return '';
  }

  const toggle = `
    <button
      type="button"
      class="secondary-button full"
      data-action="toggle-details"
      style="margin-top:0;margin-bottom:8px;"
    >
      ${state.showDetails ? 'Hide details' : 'Show coverage & readiness'}
    </button>
  `;

  if (!state.showDetails) {
    return toggle;
  }

  const coverageSection = state.coverage ? `
    <section class="panel coverage-panel" aria-label="Coverage">
      <div class="panel-heading">
        <div>
          <h2>Coverage</h2>
          <p>${state.coverage.total} paths · ${state.coverage.leafCount} leaves · ${state.coverage.containerCount} containers</p>
        </div>
      </div>
      <div class="coverage-grid">
        <div><span>Total</span><strong>${state.coverage.total}</strong></div>
        <div><span>Leaves</span><strong>${state.coverage.leafCount}</strong></div>
        <div><span>Fallback</span><strong>${state.coverage.uncategorizedCount}</strong></div>
      </div>
      <div class="coverage-actions">
        <button type="button" class="secondary-button compact" data-action="copy-qa-summary">Copy QA summary</button>
        <button type="button" class="secondary-button compact" data-action="copy-report">Copy report</button>
        <button type="button" class="secondary-button compact" data-action="download-report">Download JSON</button>
      </div>
    </section>
  ` : '';

  const readinessSection = `
    <section class="panel readiness-panel ${escapeHtml(state.readiness.status)}" aria-labelledby="readiness-title">
      <div class="panel-heading">
        <div>
          <h2 id="readiness-title">Readiness</h2>
          <p>${escapeHtml(state.readiness.label)}</p>
        </div>
      </div>
      <div class="readiness-list">
        ${state.readiness.items.map((item) => `
          <article class="readiness-row ${escapeHtml(item.state)}">
            <span>${escapeHtml(item.state)}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;

  return toggle + coverageSection + readinessSection;
};

const renderOutput = () => {
  if (!state.data) {
    return '';
  }

  return `
    <section class="panel output-panel" aria-labelledby="output-title">
      <div class="panel-heading">
        <div>
          <h2 id="output-title">Encoded Output</h2>
          <p>${state.encodedOutput ? 'Ready to import into the game.' : 'Tap Encode in the bar below.'}</p>
        </div>
        <button type="button" class="icon-button" data-action="download" aria-label="Download save" ${state.encodedOutput ? '' : 'disabled'}>↓</button>
      </div>
      <textarea id="encoded-output" class="output-textarea" readonly>${escapeHtml(state.encodedOutput)}</textarea>
    </section>
  `;
};

const renderExportBar = () => {
  return `
    <footer class="export-bar" aria-label="Export actions">
      <button type="button" data-action="encode" ${state.data ? '' : 'disabled'}>Encode</button>
      <button type="button" data-action="copy" ${state.encodedOutput ? '' : 'disabled'}>Copy</button>
      <button type="button" data-action="share" ${state.encodedOutput ? '' : 'disabled'}>Share</button>
    </footer>
  `;
};

function render() {
  preserveFocus(() => {
    appRoot.innerHTML = `
      ${renderHeader()}
      <main class="app-shell">
        ${renderImportPanel()}
        ${renderMessages()}
        ${state.data ? `
          ${renderStatStrip()}
          ${renderCategoryTabs()}
          ${renderStageTabs()}
          ${renderFilters()}
          ${renderScopeNavigator()}
          ${renderBrowser()}
          ${renderPresetsPanel()}
          ${renderChangeReview()}
          ${renderSafetyPanel()}
          ${renderDetailsSection()}
          ${renderOutput()}
        ` : `
          ${renderBrowser()}
        `}
      </main>
      ${renderExportBar()}
    `;
  });
}

/* ── ACTIONS ── */

const handleDecode = async () => {
  state.rawInput = document.querySelector('#raw-save')?.value ?? state.rawInput;

  try {
    const decoded = await decodeSave(state.rawInput);
    state.data = decoded.data;
    state.originalData = structuredClone(decoded.data);
    state.saveType = decoded.saveType;
    state.source = decoded.source;
    state.dirty = false;
    state.encodedOutput = '';
    state.activeCategoryId = 'all';
    state.activeStageId = 'all';
    state.scopePath = 'root';
    state.showChangedOnly = false;
    state.visibleLimit = 120;
    state.importCollapsed = true;
    state.showDetails = false;
    state.showAllSafety = false;
    rebuildIndex();
    setNotice(`Decoded ${decoded.saveType.toUpperCase()} save — ${state.coverage.total} paths ready to edit.`, 'success');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Could not decode save.');
  }

  render();
};

const handleEncode = async () => {
  if (!state.data) {
    return;
  }

  if (state.analysisSummary.errors > 0) {
    setError(`Fix ${state.analysisSummary.errors} safety error${state.analysisSummary.errors === 1 ? '' : 's'} before encoding. See Safety check panel.`);
    render();
    return;
  }

  try {
    state.encodedOutput = await encodeSaveData(state.data, state.saveType);
    state.dirty = false;
    refreshReadiness();
    setNotice('Encoded. Copy or share the output below.', 'success');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Could not encode save.');
  }

  render();
};

const copyText = async (value, fallbackElement = null) => {
  if (!value) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const output = fallbackElement;
    output?.focus();
    output?.select();
    return document.execCommand('copy');
  }
};

const copyOutput = async () => {
  return copyText(state.encodedOutput, document.querySelector('#encoded-output'));
};

const downloadText = (value, filename, type = 'text/plain;charset=utf-8') => {
  if (!value) {
    return;
  }

  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const getCoverageReportText = () => {
  return state.coverageReport ? JSON.stringify(state.coverageReport, null, 2) : '';
};

const getQaSummaryText = () => {
  return buildQaSummary(state.coverageReport);
};

/* ── EVENT DELEGATION ── */

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');

  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === 'choose-file') {
    document.querySelector('#file-input')?.click();
    return;
  }

  if (action === 'toggle-import') {
    state.importCollapsed = !state.importCollapsed;
    render();
    return;
  }

  if (action === 'toggle-details') {
    state.showDetails = !state.showDetails;
    render();
    return;
  }

  if (action === 'toggle-safety-list') {
    state.showAllSafety = !state.showAllSafety;
    render();
    return;
  }

  if (action === 'paste') {
    try {
      const text = await navigator.clipboard.readText();
      state.rawInput = text;
      setNotice('Pasted from clipboard.', 'success');
    } catch {
      setError('Clipboard paste unavailable. Paste manually into the text area.');
    }
    render();
    return;
  }

  if (action === 'decode') {
    await handleDecode();
    return;
  }

  if (action === 'set-category') {
    state.activeCategoryId = target.dataset.categoryId;
    state.visibleLimit = 120;
    render();
    return;
  }

  if (action === 'set-stage') {
    state.activeStageId = target.dataset.stageId;
    state.visibleLimit = 120;
    render();
    return;
  }

  if (action === 'set-scope') {
    state.scopePath = target.dataset.scopePath ?? 'root';
    state.visibleLimit = 120;
    render();
    return;
  }

  if (action === 'open-safety-path') {
    revealIssuePath(target.dataset.issuePath ?? 'root');
    return;
  }

  if (action === 'toggle-changed-filter') {
    state.showChangedOnly = !state.showChangedOnly;
    state.visibleLimit = 120;
    render();
    return;
  }

  if (action === 'load-more') {
    state.visibleLimit += 120;
    render();
    return;
  }

  if (action === 'reset-all') {
    resetAllChanges();
    return;
  }

  if (action === 'reset-change') {
    const row = target.closest('[data-change-path]');
    if (row) {
      resetChangeAtPath(row.dataset.changePath);
    }
    return;
  }

  if (action === 'reset-node') {
    const card = target.closest('[data-node-path]');
    if (card) {
      resetChangeAtPath(card.dataset.nodePath);
    }
    return;
  }

  if (action === 'toggle-boolean') {
    const card = target.closest('[data-node-path]');
    const node = card ? getNode(card.dataset.nodePath) : null;

    if (node) {
      updateDataAtNode(node, !getValueAtSegments(state.data, node.segments), 'switch');
    }
    return;
  }

  if (action === 'apply-subtree-json') {
    const card = target.closest('[data-node-path]');
    const node = card ? getNode(card.dataset.nodePath) : null;
    const textarea = card?.querySelector('.subtree-textarea');

    if (!node || !textarea) {
      return;
    }

    try {
      const parsed = parseJsonValue(textarea.value);
      if (node.path === 'root' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
        throw new Error('Root save JSON must be an object.');
      }
      updateDataAtNode(node, parsed, 'subtree JSON');
    } catch (error) {
      setError(error instanceof Error ? error.message : `Invalid JSON for ${node.path}.`);
      render();
    }
    return;
  }

  if (action === 'apply-preset') {
    const presetId = target.dataset.presetId;
    if (!presetId || !state.data) {
      return;
    }

    try {
      state.data = applyPreset(state.data, presetId);
      markDataChanged();
      const preset = PRESETS.find((p) => p.id === presetId);
      setNotice(`Applied: ${preset?.label ?? presetId}. Review changes before encoding.`, 'success');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not apply preset.');
    }
    render();
    return;
  }

  if (action === 'encode') {
    await handleEncode();
    return;
  }

  if (action === 'copy') {
    const copied = await copyOutput();
    copied ? setNotice('Output copied.', 'success') : setError('Copy failed. Select the output text manually.');
    render();
    return;
  }

  if (action === 'copy-report') {
    const copied = await copyText(getCoverageReportText());
    copied ? setNotice('Coverage report copied.', 'success') : setError('Could not copy coverage report.');
    render();
    return;
  }

  if (action === 'copy-qa-summary') {
    const copied = await copyText(getQaSummaryText());
    copied ? setNotice('QA summary copied.', 'success') : setError('Could not copy QA summary.');
    render();
    return;
  }

  if (action === 'download-report') {
    downloadText(
      getCoverageReportText(),
      'antimatter-dimensions-coverage-report.json',
      'application/json;charset=utf-8'
    );
    setNotice('Coverage report downloaded.', 'success');
    render();
    return;
  }

  if (action === 'share') {
    if (navigator.share && state.encodedOutput) {
      try {
        await navigator.share({
          title: 'Antimatter Dimensions save',
          text: state.encodedOutput,
        });
        setNotice('Share sheet opened.', 'success');
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setError('Share failed.');
        }
      }
    } else {
      const copied = await copyOutput();
      copied ? setNotice('Share unavailable; output copied instead.', 'success') : setError('Share and copy are unavailable.');
    }
    render();
    return;
  }

  if (action === 'download') {
    if (!state.encodedOutput) {
      return;
    }

    downloadText(state.encodedOutput, 'antimatter-dimensions-save.txt');
    setNotice('Download prepared.', 'success');
    render();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;

  if (target.id === 'raw-save') {
    state.rawInput = target.value;
    return;
  }

  if (target.id === 'path-search') {
    state.query = target.value;
    state.visibleLimit = 120;
    render();
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;

  if (target.id === 'file-input') {
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    state.rawInput = await file.text();
    setNotice('File loaded. Tap Decode.', 'success');
    state.importCollapsed = false;
    target.value = '';
    render();
    return;
  }

  if (target.id === 'type-filter') {
    state.typeFilter = target.value;
    state.visibleLimit = 120;
    render();
    return;
  }

  if (target.dataset.editorType) {
    commitLeafInput(target);
  }
});

document.addEventListener('keydown', (event) => {
  const target = event.target;

  if (target.dataset?.editorType && event.key === 'Enter' && target.tagName !== 'TEXTAREA') {
    event.preventDefault();
    commitLeafInput(target);
  }
});

render();
