# Claude / Codex Coordination

Project: Antimatter Dimensions Mobile Save Editor
Repo intent: `beurke1/antimatter-dimensions-mobile-save-editor`
Repo URL: https://github.com/beurke1/antimatter-dimensions-mobile-save-editor
Public Pages URL: https://beurke1.github.io/antimatter-dimensions-mobile-save-editor/
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
- GitHub Actions runs smoke tests on pushes and pull requests.
- GitHub Pages deployment publishes the static app after smoke tests pass.
- Synthetic QA fixture saves and expected coverage reports can be generated for public mobile testing.
- Rendered mobile viewport checks run in CI with headless Chrome.
- Dark mobile-first design, browser-first flow, and quick-edit presets are merged to `main`.
- Quick-edit presets preserve PC decimal-string values and Android mantissa/exponent objects.

## Claude Inbox

_Cleared — decisions made and implemented on 2026-06-02. See Claude Outbox below._

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

Eighth follow-up implementation added:

- `.github/workflows/ci.yml` runs `npm test` on pushes to `main` and pull requests.
- `.github/workflows/pages.yml` runs `npm test`, uploads `index.html` and `src/`, and deploys through GitHub Pages.
- First CI and Pages workflow runs completed successfully.
- Public iPhone Safari testing should use the Pages URL above.

Ninth follow-up implementation added:

- `scripts/export-qa-fixtures.mjs` exports synthetic late-game PC and Android saves plus expected coverage reports.
- `qa-fixtures/` stores the generated fixture saves, reports, manifest, and local instructions.
- `QA.md` defines the synthetic fixture, mobile viewport, and real-save verification protocol.
- Smoke tests verify QA fixture artifact generation.

Tenth follow-up implementation added:

- `scripts/mobile-viewport-check.mjs` launches headless Chrome, decodes synthetic PC/Android saves, verifies iPhone-sized rendered layouts, and writes screenshots plus a JSON report to `artifacts/mobile-viewport/`.
- CI and Pages workflows run `npm run verify:mobile` after smoke tests.
- Local rendered verification passed for an empty iPhone SE layout, a PC fixture on iPhone 15, and an Android fixture on iPhone SE with no horizontal overflow, clipped controls, undersized controls, or export-bar overlap.

Eleventh follow-up implementation added:

- Merged PR #5, Claude's dark mobile-first redesign, browser-first flow, stage coloring, PWA manifest, and quick-edit presets, into `main`.
- Fixed the PR's rendered mobile verifier failure by raising breadcrumb touch targets.
- Added and merged a post-PR preset-format fix so PC presets write decimal strings while Android presets write `{ mantissa, exponent }` objects.
- Smoke tests now validate all 9 presets, PC/Android preset numeric formats, Android `brake` naming, and that Android replicanti presets do not add PC-only fields.
- Latest `main` CI and Pages deployment passed, and the public Pages URL returned HTTP 200.

Open engineering tasks:

- Decide whether to add optional real-save fixtures later; generated fixtures now cover the major taxonomy without vendoring legacy data.
- Collect Berke-approved real-save coverage reports or redacted summaries without committing private save strings.
- Refine validation rules with Claude using real-save coverage reports so warnings are useful without being noisy.

## Claude Outbox

### 2026-06-02

Design decisions resolved and implemented:

**Taxonomy (Issue #1):**
- Taxonomy categories confirmed with no structural changes. Added `accentStage` field to each category (values: `normal`, `infinity`, `eternity`, `reality`, `meta`, `fallback`) for CSS-driven stage coloring in the UI.
- Expanded top-level path mapping in `src/taxonomy.js` to cover ~20 additional stable AD keys (`glyphs`, `perks`, `automator`, `tab`, `subtab`, `totalTimePlayed`, `realityMachines`, etc.).
- Added more specific regex fallbacks for celestials, black hole, dilation, replicanti, and automation patterns.

**Navigation (Issue #1):**
- Flat search stays primary for v1. Drilldown navigator stays as secondary (it's already built, just placed lower).
- Decision: no change needed — the two modes already complement each other well.

**Row metadata (Issue #1):**
- Each card shows: key name, full dotted path (truncated), value preview (monospace), type badge, stage-colored badge.
- Changed paths get a left-edge accent color and a changed-type chip.

**Risk warnings (Issue #4):**
- Safety panel stays, but limited to 6 visible issues by default to reduce scroll noise.
- Container/subtree JSON editor now uses a `<details>` collapse. It is not open by default, so the editing surface is available but not prominent.
- Late-game info notes remain informational (not blocking).

**Android vs PC (Issue #1):**
- Save type displayed prominently in header pill and in collapsed import bar.
- `brake` (Android) vs `break` (PC) handled correctly in presets.

**New additions:**
- Full dark theme rewrite (`src/styles.css`) — AD-aesthetic dark, space palette, stage-colored accents (gold for Infinity, purple for Eternity, cyan for Reality).
- Import panel collapses to a compact strip after decode so the browser is immediately visible.
- Compact stat strip (Paths / Changed / Issues / Fallback) replaces the verbose coverage panel as the default above-fold summary.
- Coverage and readiness panels moved behind a "Show details" toggle to keep the primary editing flow clean.
- Browser section moved immediately below nav tabs — no more scrolling past coverage/readiness to reach the editor.
- New `src/presets.js` with 9 quick-edit presets (Normal through Reality). Presets respect game stage: only relevant presets appear based on the detected save stage.
- Stage tabs get colored active states matching their game stage.
- Category chips get `data-accent` attribute for CSS stage-coloring on active state.
- Smoke tests still pass (18 paths, 235 PC fixture, 196 Android fixture).

**Codex inbox status after merge:**

1. Rendered mobile viewport checks now pass in CI for empty, PC fixture, and Android fixture views.
2. Smoke tests cover `src/presets.js`, preset round trips, PC/Android numeric format preservation, and Android `brake` naming.
3. The subtree JSON summary uses `::before` content and rendered mobile checks pass.
4. GitHub Pages is enabled and the public URL is live.
5. Remaining: close or update issue #1/#3 once Berke/Claude agree that synthetic QA plus rendered mobile checks are enough to start real-save testing.
