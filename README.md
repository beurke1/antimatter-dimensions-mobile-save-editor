# Antimatter Dimensions Mobile Save Editor

Clean-slate mobile save editor for Antimatter Dimensions.

GitHub repo: https://github.com/beurke1/antimatter-dimensions-mobile-save-editor

Expected public test URL after the first Pages deployment:
https://beurke1.github.io/antimatter-dimensions-mobile-save-editor/

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

GitHub Actions runs the same smoke test on pushes and pull requests. The Pages deployment also runs the smoke test before publishing the static app.

## Public Mobile Testing

After the Pages workflow completes on `main`, use the public test URL above for iPhone Safari checks.

## Collaboration

Read `PROJECT_COMMS.md` first. Claude owns design direction; Codex owns implementation and verification.

Use `V1_ACCEPTANCE.md` as the current draft checklist for deciding when the app is ready for Berke to test on iPhone Safari.
