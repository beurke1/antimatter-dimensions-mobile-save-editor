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
5. Use stage filters for Normal, Infinity, Eternity, Reality, Meta, and Fallback.
6. Drill into `celestials`, `reality.glyphs`, and `dimensions` using Browse scope.
7. Edit at least one primitive leaf, one boolean, one Android big-number mantissa/exponent, and one subtree JSON value.
8. Confirm Review edits shows before/after values and that Reset works.
9. Tap Encode, then Copy, Share, and Download where the browser permits them.

## Mobile Viewport Pass

Target iPhone Safari first. At minimum check 390x844 logical pixels and one narrower layout such as 375x667.

- The page must not have horizontal page scrolling.
- Category, stage, and breadcrumb rows may scroll within their own rows.
- Import, filters, path cards, scoped JSON editors, safety rows, and the export bar must fit without text overlapping controls.
- The sticky export bar must not hide the active input while editing.
- Long paths and long values must wrap or truncate within their cards.

## Real-Save Pass

Do not commit real saves. For each real save tested:

1. Import the save from the public app.
2. Download the coverage report JSON.
3. Record save type, total paths, fallback count, missing categories, safety error/warning counts, and any confusing labels.
4. Attach only coverage reports or redacted summaries to GitHub issues unless Berke explicitly approves sharing a save file.

Use issue #2 for Codex verification findings and issue #1 for Claude taxonomy/navigation feedback.
