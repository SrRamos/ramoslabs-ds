# G2-FIX-C notes: self-hosted Storybook fonts (G2 SHOULD-3)

- Fonts live in `apps/storybook/.storybook/static/fonts` (served at `./fonts/`, `staticDirs`); `@font-face` rules sit in the generated block of `preview-head.html`.
- Exact set the old Google URL requested, latin subset, normal style: Red Hat Display 400/500/700/900, Rubik 300/400/500/600/700, Roboto 400/500/700. Origin: `fonts.gstatic.com` woff2 files named by the Google CSS API response (fetched once). The earlier site-copy variable files were dropped because they rendered headings lighter (the regression). latin-ext was never needed by the stories.
- Material Symbols Outlined: `@material-symbols/svg-400` is SVG only (no ligatures), so a subset font (FILL 0..1, weight 400, 121 icon names scraped from the stories) is fetched once from Google Fonts with `icon_names=` and committed.
- Regenerate fonts and icon subset after adding an icon: `node apps/storybook/scripts/fetch-fonts.mjs` (network; rewrites the woff2 files and the block between `fonts:begin/end` in `preview-head.html`). Icons set from data (not literal text in a class element) must be added to the script by hand.
- Removed 4 head links and 11 MDX `@import` lines (12 files, not 24).
- Scan: `packages/testing/lint/stylelint/stylelint.test.js` covers the whole tree (excluding docs/specs/fixtures/tests), asserts storybook is in scope, and has a seeded-URL test. Seeding a Google link into `preview-head.html` failed the scan naming that file.
- Screenshots in `G2-FIX-C/`: `before-/after-introduction--docs.png` (icon glyphs: book and arrows, identical) and `before-/after-patterns-mobile-first--docs.png` (heading weights now match). Before made external requests, after makes 0; no ligature text found wider than 2x font size.
- `bun run build-storybook` passes (needs `@ramoslabs/tokens` built first).
