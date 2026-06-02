# Antimatter Dimensions Mobile Save Editor

Clean-slate mobile save editor for Antimatter Dimensions.

GitHub repo: https://github.com/beurke1/antimatter-dimensions-mobile-save-editor

Public test URL:
https://beurke1.github.io/antimatter-dimensions-mobile-save-editor/

## What Works

- PC and Android save decode/encode.
- Decoded JSON import.
- Dark mobile-first, browser-first UI tuned for iPhone-sized screens.
- Runtime indexing of every path in the imported save.
- Category browsing with an Uncategorized fallback.
- Source-backed taxonomy guard for stable AD top-level keys.
- Stage filtering for the major game phases.
- Scoped drilldown browsing with breadcrumbs.
- Search by path, key, type, category, stage, and value preview.
- Inline primitive edits.
- Direct mantissa/exponent edits for Android-style big-number objects.
- Scoped JSON edits for objects and arrays.
- Changed-path review with reset controls.
- Safety check for invalid values and risky structural edits before export, with grouped subtree warnings and direct jumps to affected paths.
- Stage-aware quick-edit presets with PC/Android numeric format preservation.
- Copy value-free QA summaries with coverage counts, unknown top-level counts, safety issue counts, and warning samples, plus copy/download coverage reports for imported saves.
- Encode, copy, share, and download.
- Generated progression-stage PC and Android fixture coverage tests.
- Synthetic Normal, Infinity, Eternity, and late-game QA fixture exports for public mobile testing.

## Run Locally

```sh
npm run dev
```

Open `http://localhost:5174`.

## Test

```sh
npm test
npm run verify:mobile
```

The smoke test verifies PC and Android round trips, path indexing, scoped navigation helpers, coverage report generation, immutable path edits, change tracking, reset behavior, safety analysis, progression-stage fixtures, and comprehensive category coverage across generated PC/Android late-game fixtures. The mobile verifier launches headless Chrome, decodes early and late PC/Android fixture saves, exercises rendered file import, category/stage/search/type navigation, changed-only filtering after edits, review/reset flows, stage-filtered quick edits with PC/Android numeric preservation, value-free QA/report copy/download, representative edit/export flows, and deep scoped browsing, checks iPhone-sized rendered layout overflow, and writes screenshots plus a JSON report to `artifacts/mobile-viewport/`.

GitHub Actions runs the same smoke and mobile checks on pushes and pull requests. The Pages deployment also runs them before publishing the static app.

## QA Fixtures

```sh
npm run qa:fixtures
```

This writes synthetic PC and Android Normal, Infinity, Eternity, and late-game saves plus expected coverage reports to `qa-fixtures/`. Use `QA.md` for the mobile and real-save verification protocol.

## Public Mobile Testing

Use the public test URL above for iPhone Safari checks.

## Collaboration

Read `PROJECT_COMMS.md` first. Claude owns design direction; Codex owns implementation and verification.

Use `V1_ACCEPTANCE.md` as the current checklist for Berke's iPhone Safari pass and remaining real-save QA.
