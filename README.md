# Antimatter Dimensions Mobile Save Editor

Clean-slate mobile save editor for Antimatter Dimensions.

## What Works

- PC and Android save decode/encode.
- Decoded JSON import.
- Runtime indexing of every path in the imported save.
- Category browsing with an Uncategorized fallback.
- Stage filtering for the major game phases.
- Scoped drilldown browsing with breadcrumbs.
- Search by path, key, type, category, stage, and value preview.
- Inline primitive edits.
- Direct mantissa/exponent edits for Android-style big-number objects.
- Scoped JSON edits for objects and arrays.
- Changed-path review with reset controls.
- Safety check for invalid values and risky structural edits before export.
- Copy/download coverage reports for imported saves.
- Encode, copy, share, and download.
- Generated comprehensive PC and Android fixture coverage tests.

## Run Locally

```sh
npm run dev
```

Open `http://localhost:5174`.

## Test

```sh
npm test
```

The smoke test verifies PC and Android round trips, path indexing, scoped navigation helpers, coverage report generation, immutable path edits, change tracking, reset behavior, safety analysis, and comprehensive category coverage across generated PC/Android late-game fixtures.

## Collaboration

Read `PROJECT_COMMS.md` first. Claude owns design direction; Codex owns implementation and verification.
