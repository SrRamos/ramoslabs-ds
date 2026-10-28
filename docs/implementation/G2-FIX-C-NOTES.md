# G2-FIX-C notes: self-hosted Storybook fonts (G2 SHOULD-3)

- Fonts live in `apps/storybook/.storybook/static/fonts` (served at `./fonts/`, via `staticDirs`): Rubik, Red Hat Display and Roboto are copies of `apps/site/public/fonts` (same variable files); `@font-face` rules are in `preview-head.html`.
- Material Symbols: no ligature font ships in `@material-symbols/svg-400` (SVG only), so a subset font (~12 KB, 120 icon names used in the MDX, FILL axis 0..1, weight 400) was fetched once from Google Fonts with `icon_names=` and committed. Nothing is remote at runtime. Adding a new icon name to an MDX needs the subset regenerated (follow-up: a script).
- Removed the 4 head links and the 11 MDX `@import` lines (the brief said 24 files; 12 files held remote URLs).
- Scan: `packages/testing/lint/stylelint/stylelint.test.js` now covers the whole tree (excluding docs/specs/fixtures/tests), asserts storybook files are in scope, and has a seeded-URL test. Seeding a Google link into `preview-head.html` failed the scan naming that file.
- Before/after screenshots: `G2-FIX-C/before.png`, `G2-FIX-C/after.png` (Mobile First docs). Before made 5 external requests; after makes 0. Visual match; headings are marginally lighter in weight after (site variable file vs Google static weights).
- `bun run build-storybook` passes (needs `@ramoslabs/tokens` built first).
