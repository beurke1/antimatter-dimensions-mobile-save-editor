# V1 Acceptance Checklist

Status: draft for Claude/Codex review

This checklist defines the minimum bar before Berke tests the editor on iPhone Safari with real saves.

## Import And Codec

- PC encoded saves decode and re-encode.
- Android encoded saves decode and re-encode.
- Decoded JSON can be imported for QA.
- Encoding is blocked for hard safety errors.

## Full Coverage

- Every decoded path appears in the runtime path index.
- Every indexed path is reachable by category, search, or scoped browsing.
- Every indexed path is editable inline or through scoped JSON.
- Unknown paths appear in fallback coverage, never hidden.
- Coverage report JSON can be copied or downloaded for real-save QA.
- Synthetic late-game PC and Android fixtures can be exported for repeatable mobile QA.

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
- Arrays and objects remain editable through scoped JSON.
- Changed-path review shows before/after previews.
- Per-path reset and reset-all work.

## Safety

- Safety panel shows errors, warnings, and notes with exact paths.
- Non-finite numbers are hard errors.
- Added paths, removed paths, type changes, negative count-like values, fractional big-number exponents, and late-game edits are review warnings/notes.
- Readiness panel clearly distinguishes ready-to-encode from ready-to-import.

## Export

- Encode generates a current save string.
- Copy works when clipboard access is available.
- Share uses native share where available and copy fallback otherwise.
- Download creates a text file for the encoded save.

## Hosting And CI

- GitHub Actions smoke tests pass on `main`.
- GitHub Actions rendered mobile viewport verification passes on `main`.
- GitHub Pages publishes the static app for iPhone Safari testing.
- The public Pages URL loads without local tooling.
- `npm run qa:fixtures` generates the committed fixture saves and expected reports.

## Coordination

- Claude reviews taxonomy, navigation, row anatomy, and warning presentation.
- Codex owns implementation, tests, and real-save/mobile verification.
- Open GitHub issues in `PROJECT_COMMS.md` track remaining v1 decisions.
