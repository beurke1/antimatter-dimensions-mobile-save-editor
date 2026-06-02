import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (path) => {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
};

const indexHtml = await readProjectFile('index.html');
const styles = await readProjectFile('src/styles.css');
const qaProtocol = await readProjectFile('QA.md');

const assertIncludes = (source, expected, label) => {
  assert.ok(source.includes(expected), label);
};

const getRuleBody = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'u');
  const match = styles.match(rulePattern);

  assert.ok(match, `${selector} rule should exist`);
  return match[1];
};

const assertRuleIncludes = (selector, expected) => {
  assertIncludes(getRuleBody(selector), expected, `${selector} should include ${expected}`);
};

const assertAnyRuleIncludes = (selector, expected) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'gu');
  const bodies = [...styles.matchAll(rulePattern)].map((match) => match[1]);

  assert.ok(bodies.some((body) => body.includes(expected)), `${selector} should include ${expected}`);
};

assertIncludes(
  indexHtml,
  'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"',
  'HTML should declare an iPhone-friendly viewport'
);

assertRuleIncludes('*', 'box-sizing: border-box');
assertRuleIncludes('body', 'overflow-x: hidden');
assertAnyRuleIncludes('input,\ntextarea,\nselect', 'font-size: 16px');
assertRuleIncludes('.app-shell', 'max-width: 520px');
assertRuleIncludes('.app-shell', 'env(safe-area-inset-bottom)');
assertRuleIncludes('.topbar', 'position: sticky');
assertRuleIncludes('.topbar', 'env(safe-area-inset-top)');
assertRuleIncludes('.category-tabs', 'overflow-x: auto');
assertRuleIncludes('.stage-tabs', 'overflow-x: auto');
assertRuleIncludes('.breadcrumbs', 'overflow-x: auto');
assertRuleIncludes('.filter-bar', 'grid-template-columns: minmax(0, 1fr) 122px');
assertRuleIncludes('.coverage-grid', 'grid-template-columns: repeat(2, minmax(0, 1fr))');
assertRuleIncludes('.child-grid', 'grid-template-columns: repeat(2, minmax(0, 1fr))');
assertRuleIncludes('.big-number-editor', 'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
assertRuleIncludes('.path-copy', 'min-width: 0');
assertRuleIncludes('.field-input', 'width: 100%');
assertRuleIncludes('.export-bar', 'position: fixed');
assertRuleIncludes('.export-bar', 'max-width: 520px');
assertAnyRuleIncludes('.export-bar button', 'min-width: 0');

const tooWideDeclarations = [];

for (const line of styles.split('\n')) {
  const declaration = line.trim();
  const fixedWidthMatch = declaration.match(/^(?:width|min-width):\s*(\d+)px/u);

  if (!fixedWidthMatch) {
    continue;
  }

  const width = Number(fixedWidthMatch[1]);

  if (width > 390) {
    tooWideDeclarations.push(declaration.replace(/;$/u, ''));
  }
}

assert.deepEqual(
  tooWideDeclarations,
  [],
  'Mobile CSS should not contain fixed width/min-width declarations wider than a 390px iPhone viewport'
);

assertIncludes(qaProtocol, '390x844', 'QA protocol should include a modern iPhone viewport target');
assertIncludes(qaProtocol, '375x667', 'QA protocol should include a narrow iPhone viewport target');
assertIncludes(qaProtocol, 'horizontal page scrolling', 'QA protocol should explicitly check horizontal overflow');

console.log('Mobile viewport checks passed: viewport meta, responsive CSS invariants, and QA targets verified.');
