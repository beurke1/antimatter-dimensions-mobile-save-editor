# QA Protocol

Use this protocol for Codex verification, Claude review, and Berke's iPhone Safari pass.

## Synthetic Fixture Pass

Run:

```sh
npm run qa:fixtures
```

Then open the public app:

https://beurke1.github.io/antimatter-dimensions-mobile-save-editor/

For each file in `qa-fixtures/*-save.txt`:

1. Paste the full save into Import and tap Decode.
2. Confirm Total paths, Leaves, Containers, Fallback, Changed, and Warnings match the corresponding coverage report.
3. Confirm Readiness allows encoding and shows no hard safety errors.
4. Visit each category tab with a nonzero count.
5. Use every stage filter that has nonzero paths in the fixture.
6. Drill into `dimensions` on every fixture, and into `celestials` plus `reality.glyphs` when those paths exist.
7. If safety warnings are visible, use Show all and Open/Find on at least one warning row.
8. Edit at least one primitive leaf, one boolean, one Android big-number mantissa/exponent, and one subtree JSON value.
9. Confirm Review edits shows before/after values and that Reset works.
10. Tap Encode, then Copy, Share, and Download where the browser permits them.

## Mobile Viewport Pass

Automated check:

```sh
npm run verify:mobile
```

This starts a temporary local server, launches headless Chrome, decodes synthetic PC and Android saves, exercises rendered file import, category/stage/search/type navigation, changed-only filtering after edits, review/reset flows, value-free QA/report copy/download, representative edit/export flows, and a deep Celestials scoped edit, checks rendered iPhone-sized layouts, and writes screenshots plus `latest.json` to `artifacts/mobile-viewport/`.

Target iPhone Safari first. At minimum check 390x844 logical pixels and one narrower layout such as 375x667.

- The page must not have horizontal page scrolling.
- Category, stage, and breadcrumb rows may scroll within their own rows.
- Import, filters, path cards, scoped JSON editors, safety rows, and the export bar must fit without text overlapping controls.
- The sticky export bar must not hide the active input while editing.
- Long paths and long values must wrap or truncate within their cards.

## Real-Save Pass

Do not commit real saves. For each real save tested:

1. Import the save from the public app.
2. Open Show coverage & readiness.
3. Use Copy QA summary for a value-free report suitable for GitHub issues. It includes counts, path names, and safety warning samples, but not save values.
4. Download the coverage report JSON if Claude needs deeper taxonomy or warning review.
5. Record any confusing labels, noisy safety warnings, missing warnings, or hard-to-find paths.
6. Attach only QA summaries, coverage reports, or redacted notes to GitHub issues unless Berke explicitly approves sharing a save file.

Use issue #2 for Codex verification findings and issue #1 for Claude taxonomy/navigation feedback.
