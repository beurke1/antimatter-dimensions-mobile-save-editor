# Claude / Codex Coordination

Project: Antimatter Dimensions Mobile Save Editor  
Repo intent: `beurke1/antimatter-dimensions-mobile-save-editor`  
Started clean-slate: 2026-06-02

## Roles

Claude owns design:

- Information architecture.
- Mobile navigation model.
- Row layout and interaction details.
- Risk warnings and editing UX.
- Visual polish and density decisions.

Codex owns engineering:

- Save decode and encode.
- Runtime full-save path inventory.
- Category mapping implementation.
- Mobile UI implementation.
- Tests, local hosting, and GitHub publication.

## Current Product Direction

This is a clean-slate app. Earlier copied/prototype code is reference only.

The editor must be comprehensive: every decoded PC or Android save item should appear in the browser. Primitive leaves are edited inline. Objects and arrays are edited through scoped JSON so nested or unusual values are still editable without using full raw JSON.

Use `V1_ACCEPTANCE.md` as the current draft acceptance checklist before Berke tests on iPhone Safari.

## Current Engineering State

Initial clean scaffold created:

- `index.html`
- `src/app.js`
- `src/save-codec.js`
- `src/path-index.js`
- `src/taxonomy.js`
- `src/styles.css`
- `scripts/smoke-test.mjs`
- `DESIGN.md`

Core behavior:

- Decode PC save strings with zlib deflate.
- Decode Android save strings with gzip.
- Accept decoded JSON directly.
- Generate runtime path index from imported data.
- Categorize every path with an Uncategorized fallback.
- Search, type-filter, stage-filter, and changed-only filter paths.
- Browse within a selected subtree with breadcrumbs and direct-child controls.
- Edit primitive values inline.
- Edit Android-style big-number objects with mantissa/exponent controls.
- Edit containers with scoped JSON.
- Review changed paths with before/after previews.
- Analyze invalid values and risky edits before export.
- Reset one changed path or reset all edits.
- Encode, copy, share, and download.
- Generated late-game PC and Android fixtures verify category and scope coverage.
- Imported saves can export a coverage report JSON for QA/review.
- Readiness panel distinguishes no-save, ready-to-encode, blocked, review, and ready-to-import states.

## Claude Inbox

Please review `DESIGN.md` and the live mobile UI. High-value design decisions needed next:

1. Confirm or replace the category taxonomy.
2. Decide whether the flat searchable path browser is enough for v1 or needs drilldown navigation.
3. Define what row metadata should be visible by default.
4. Define risk warnings for object/subtree edits.
5. Decide how Android and PC differences should be labeled.

## GitHub Coordination Issues

- [#1 Claude: Review taxonomy and mobile navigation](https://github.com/beurke1/antimatter-dimensions-mobile-save-editor/issues/1)
- [#2 Codex: Add real-save QA and mobile viewport verification](https://github.com/beurke1/antimatter-dimensions-mobile-save-editor/issues/2)
- [#3 Joint: Define minimum acceptable v1 for Berke testing](https://github.com/beurke1/antimatter-dimensions-mobile-save-editor/issues/3)
- [#4 Joint: Refine safety warnings and edit risk rules](https://github.com/beurke1/antimatter-dimensions-mobile-save-editor/issues/4)

## Codex Outbox

### 2026-06-02

Clean-slate implementation started per Berke's correction. I did not continue the copied/prototype checkout.

Follow-up implementation added:

- Changed-path index comparing imported data to working data.
- Changed-only filter in the mobile browser.
- Stage filter row for Normal, Infinity, Eternity, Reality, Meta, and fallback paths.
- Review edits panel with before/after previews.
- Per-path reset and reset-all actions.
- Smoke tests now cover change tracking and added-key reset.

Second follow-up implementation added:

- Direct mobile controls for detected `{ mantissa, exponent }` big-number objects.
- JSON subtree editing still remains available under those objects as an escape hatch.

Third follow-up implementation added:

- Scoped path browsing with breadcrumb buttons.
- Direct-child grid for drilling into objects and arrays.
- Container cards now have an Open action that narrows the browser to that subtree.
- Search, type, stage, category, and changed filters now apply inside the active scope.
- Smoke tests cover direct children, breadcrumb ancestry, and descendant scope matching.

Fourth follow-up implementation added:

- `src/save-analysis.js` analyzes decoded saves and edit risks.
- Safety check panel lists errors, warnings, and notes with exact paths.
- Encoding is blocked only for hard safety errors such as non-finite numbers.
- Added/removed paths, type changes, fractional big-number exponents, negative count-like values, and late-game edits are surfaced for review.
- Smoke tests cover save analysis and edit-risk summaries.

Fifth follow-up implementation added:

- `scripts/fixture-saves.mjs` generates broad late-game PC and Android save fixtures without copying legacy project data.
- Smoke tests round-trip both fixtures through the codec.
- Tests assert every non-fallback category has reachable paths on both platforms.
- Tests assert every indexed fixture path is editable and that deep celestial paths are reachable through scoped browsing.

Sixth follow-up implementation added:

- `src/coverage-report.js` generates a structured coverage report for any imported save.
- Mobile coverage panel now has Copy report and Download JSON actions.
- Reports include totals, category/stage/type/depth counts, top-level paths, unknown paths, safety counts, and changed-path count.
- Smoke tests assert report totals and category completeness on generated PC/Android fixtures.

Seventh follow-up implementation added:

- `V1_ACCEPTANCE.md` defines the draft minimum bar for Berke testing.
- `src/readiness.js` computes ready-to-encode versus ready-to-import state.
- Mobile readiness panel shows path coverage, classification, safety, and export freshness.
- Smoke tests cover readiness states for clean, encoded, and blocked saves.

Open engineering tasks:

- Verify in browser at mobile widths.
- Decide whether to add optional real-save fixtures later; generated fixtures now cover the major taxonomy without vendoring legacy data.
- Refine validation rules with Claude so warnings are useful without being noisy.
- Claude can use coverage report JSONs from real saves to critique taxonomy gaps.
