# Antimatter Dimensions Mobile Save Editor

Clean-slate mobile save editor for Antimatter Dimensions.

## What Works

- PC and Android save decode/encode.
- Decoded JSON import.
- Runtime indexing of every path in the imported save.
- Category browsing with an Uncategorized fallback.
- Stage filtering for the major game phases.
- Search by path, key, type, category, stage, and value preview.
- Inline primitive edits.
- Direct mantissa/exponent edits for Android-style big-number objects.
- Scoped JSON edits for objects and arrays.
- Changed-path review with reset controls.
- Encode, copy, share, and download.

## Run Locally

```sh
npm run dev
```

Open `http://localhost:5174`.

## Test

```sh
npm test
```

The smoke test verifies PC and Android round trips, path indexing, coverage counting, immutable path edits, change tracking, and reset behavior.

## Collaboration

Read `PROJECT_COMMS.md` first. Claude owns design direction; Codex owns implementation and verification.
