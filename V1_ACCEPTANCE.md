# V1 Acceptance Checklist

Status: v1 checklist; synthetic/mobile verification passes, real-save QA still pending

This checklist defines the minimum bar before Berke tests the editor on iPhone Safari with real saves.

## Import And Codec

- PC encoded saves decode and re-encode.
- Android encoded saves decode and re-encode.
- PC and Android codecs work without native browser compression streams.
- Decoded JSON can be imported for QA.
- Encoding is blocked for hard safety errors.

## Full Coverage

- Every decoded path appears in the runtime path index.
- Every indexed path is reachable by category, search, or scoped browsing.
- Every indexed path is editable inline or through scoped JSON.
- Unknown paths appear in fallback coverage, never hidden.
- Stable known AD top-level keys are guarded against fallback classification.
- Value-free QA summaries with detected game stage and stage signal paths, coverage counts, unknown top-level counts, unknown-path sample omission counts, safety issue counts, and warning samples can be copied, and coverage report JSON can be copied or downloaded for real-save QA.
- Synthetic Normal, Infinity, Eternity, and late-game PC/Android fixtures can be exported for repeatable mobile QA, with the PC late-game fixture covering 1,500+ current-source-shaped paths.

## Mobile Navigation

- Categories cover the current taxonomy in `DESIGN.md`.
- Stage filters support Normal, Infinity, Eternity, Reality, Meta, and fallback paths.
- Breadcrumbs and child grids support deep object/array browsing.
- Changed-only filtering works after edits.
- Text and controls fit at iPhone-sized widths without horizontal page overflow.
- Mobile viewport checks follow `QA.md` before Berke tests real saves.

## Editing

- Primitive leaves edit inline.
- Booleans use switch controls.
- Android-style `{ mantissa, exponent }` big numbers use direct mantissa/exponent controls.
- Object containers can add new keys, arrays can append items, and non-root paths can be removed from the mobile UI.
- Arrays and objects remain editable through scoped JSON.
- Quick-edit presets preserve PC decimal-string values and Android mantissa/exponent values.
- Direct edits such as `eternities` encode back exactly without hidden timestamp mutation.
- Changed-path review shows before/after previews.
- Per-path reset and reset-all work.

## Safety

- Safety panel shows errors, warnings, and notes with exact paths.
- Safety rows can expand past the first few issues and jump to affected paths.
- Non-finite numbers are hard errors.
- Added paths, removed paths, parent type changes, negative count-like values, fractional big-number exponents, and late-game edits are review warnings/notes; subtree structural edits are grouped at the nearest changed container to reduce duplicate warning noise.
- Readiness panel clearly distinguishes ready-to-encode from ready-to-import.

## Export

- Encode generates a current save string.
- Copy works when clipboard access is available.
- Share uses native share where available and copy fallback otherwise.
- Download creates a text file for the encoded save.

## Hosting And CI

- GitHub Actions smoke tests pass on `main`.
- GitHub Actions rendered mobile viewport verification passes on `main`, including file import, review/reset flows, structural add/remove/export controls, stage-filtered quick edits with PC/Android numeric preservation, value-free QA/report copy/download, and encoded output copy/share/download.
- GitHub Pages publishes the static app for iPhone Safari testing.
- The public Pages URL loads without local tooling.
- `npm run qa:fixtures` generates the committed fixture saves and expected reports.

## Coordination

- Claude reviews taxonomy, navigation, row anatomy, and warning presentation.
- Codex owns implementation, tests, and real-save/mobile verification.
- Open GitHub issues in `PROJECT_COMMS.md` track remaining real-save QA and safety-warning refinement.
