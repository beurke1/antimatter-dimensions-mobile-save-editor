# Antimatter Dimensions Mobile Save Editor Design Contract

Status: clean-slate v1  
Design lead: Claude  
Engineering lead: Codex

## Goal

Build a mobile-first Antimatter Dimensions save editor that can be used throughout the whole game. The editor must cover the entire decoded save object, not a curated subset of common fields.

## Product Rules

- Every decoded JSON item must be reachable.
- Every existing item must be editable either inline or through a scoped subtree JSON editor.
- Unknown keys must remain visible in an Uncategorized fallback area.
- Raw full-save JSON can exist as an escape hatch, but it is not the primary way to find fields.
- PC and Android saves should both be supported.
- iPhone Safari is the primary runtime.

## Current V1 Shape

- Static mobile web app with no framework dependency.
- Encoded PC and Android save import.
- Decoded JSON import for inspection and development.
- Runtime path index generated from the actual imported save.
- Category chips for broad game-stage navigation.
- Stage filters for Normal, Infinity, Eternity, Reality, Meta, and fallback content.
- Scoped drilldown browsing with breadcrumbs and direct child navigation.
- Search over path, key, type, category, stage, and preview value.
- Type-aware inline editing for primitive leaves.
- Direct mantissa/exponent editing for Android-style big-number objects.
- Scoped JSON editing for objects, arrays, and edge-case values.
- Changed-path review with original/current previews.
- Per-path reset and reset-all controls before export.
- Safety analysis for invalid values, grouped added/removed subtree risks, type changes, and late-game edit notes.
- Copyable/downloadable coverage report JSON for QA and Claude review.
- Readiness summary for ready-to-encode versus ready-to-import state.
- Encode, copy, share, and download output.
- Generated comprehensive PC and Android fixture tests for category and scope coverage.
- Synthetic progression-stage QA fixture exports for repeatable public mobile testing.
- GitHub Pages hosting for public iPhone Safari testing after CI passes.

## Taxonomy

The initial taxonomy is intentionally broad and full-coverage oriented:

- Core
- Resources
- Dimensions
- Achievements
- Challenges
- Infinity
- Automation
- Replicanti
- Eternity
- Reality
- Black Hole
- Celestials
- Records
- Options
- Uncategorized

Claude should refine labels, ordering, grouping, and mobile navigation. Codex should keep unknown paths reachable regardless of taxonomy changes.

## Engineering Invariants

- Codec logic lives in `src/save-codec.js`.
- Path inventory and immutable edits live in `src/path-index.js`.
- Coverage report generation lives in `src/coverage-report.js`.
- QA fixture export lives in `scripts/export-qa-fixtures.mjs`.
- Rendered mobile viewport verification lives in `scripts/mobile-viewport-check.mjs`.
- Save and edit risk analysis lives in `src/save-analysis.js`.
- Readiness calculation lives in `src/readiness.js`.
- Category mapping lives in `src/taxonomy.js`.
- Known top-level save-key taxonomy guards live in `src/schema-reference.js`; they protect stable AD keys from fallback classification but must not become a fixed-schema dependency.
- The UI must never hide an unmapped imported path.
- Smoke tests must verify PC round trip, Android round trip, path indexing, scoped navigation helpers, coverage report generation, readiness calculation, immutable path edits, change tracking, added-key reset, safety analysis, progression-stage fixture coverage, and all non-fallback category coverage in generated late-game PC/Android fixtures.
- Smoke tests must verify that synthetic QA fixture artifacts can be generated.
- Mobile verification must check rendered iPhone-sized layouts for horizontal overflow, clipped controls, undersized controls, fixed export-bar overlap, file import, category/stage/search/type navigation, changed-only filtering, value-free QA/report copy, representative edits, deep scoped browsing, reset, and encode.
- GitHub Pages deployment must publish only after smoke tests pass.
