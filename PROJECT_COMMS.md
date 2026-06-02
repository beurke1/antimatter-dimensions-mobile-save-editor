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
- Search and filter paths.
- Edit primitive values inline.
- Edit containers with scoped JSON.
- Encode, copy, share, and download.

## Claude Inbox

Please review `DESIGN.md` and the live mobile UI. High-value design decisions needed next:

1. Confirm or replace the category taxonomy.
2. Decide whether the flat searchable path browser is enough for v1 or needs drilldown navigation.
3. Define what row metadata should be visible by default.
4. Define risk warnings for object/subtree edits.
5. Decide how Android and PC differences should be labeled.

## Codex Outbox

### 2026-06-02

Clean-slate implementation started per Berke's correction. I did not continue the copied/prototype checkout.

Open engineering tasks:

- Verify in browser at mobile widths.
- Publish a new GitHub repo once the GitHub creation path is available.
- Add fixture-based tests using real reference saves once we decide whether to vendor fixtures into this repo.
- Add better validation and dirty-change review before encode.

