# S-TEST-VIS notes (W1-312, visual harness, ADR-013 L5)

Branch `feature/m3-visual-harness`. Files: `packages/testing/visual/**` plus two scripts in
`packages/testing/package.json` (`test:visual`, `visual:verify`). Excludes `apps/storybook`.

## Layout
- `site.mjs`: builds tokens and css (`style-dictionary`, `packages/css/scripts/build.mjs`), copies the PRODUCTION
  font files from `apps/site/public/fonts` (rubik, red-hat-display, roboto variable woff2, the same bytes the
  site serves), writes `@font-face { font-display: block; src: url('/fonts/..') }` and one static HTML per scene,
  and serves them on an ephemeral loopback port. Output: `packages/testing/node_modules/.cache/visual/site`.
- `capture.js`: one context per engine x DPR (fixed viewport, `en-US`, UTC, light, reduced motion, service workers
  blocked, `--disable-lcd-text --font-render-hinting=none` on Chromium). Every request outside the loopback
  origin is aborted and recorded; any blocked request fails the run. Before each shot every production family
  must be `loaded` with `display === 'block'`, otherwise the run throws (no silent fallback font).
- `scenes.js`: static scenes (probe off/on/disabled/focus via a real Tab, type specimen, swatches). Tokens only.
- `png.js`: dependency-free PNG decoder, zero-tolerance pixel compare (1 px difference or size change fails).
- `baselines.js`: store and policy. `index.js` API, `cli.js` CLI, `visual.test.js` browser-free vitest (15 tests).
- Baselines: `visual/baselines/<engine>-<platform>-<dpr>x/<scene>.png` + `manifest.json` (sha256) and one
  `baselines/REVIEW-LOG.json`. Committed for this machine only: chromium, firefox, webkit x darwin x DPR 1 and 2
  (36 PNGs). I looked at the type specimen and focus scene; fonts render as Rubik/Red Hat Display/Roboto.

## Policy
- `check` never writes. Missing baseline or missing engine is `NOT RUN` (exit 0 locally, exit 1 with `--strict`);
  it is never auto-accepted.
- `update --update <scene[,scene]> --reviewer <name> --reason <text>`: scenes must be named; empty, `all`, `*`
  and globs are refused (no update-all). Writes the PNG, the manifest hash and a REVIEW-LOG entry (before/after
  hash, reviewer, reason, date).
- `verify` (also run first by `check`/`update`, and by `bun run visual:verify`): fails when a PNG differs from the
  manifest, has no manifest entry, is missing, or when a manifest hash has no REVIEW-LOG entry. So a baseline
  changed by hand, or by copying a new screenshot over it, fails even if the manifest was edited too.

## Acceptance evidence
- Byte-stable twice: `node visual/cli.js stability` (two fresh-context captures, byte-identical) passes on all
  three engines at DPR 1 and 2; also `check` passes in a separate process against the committed baselines.
- Seeded 1 px change: `node visual/cli.js selftest` paints one CSS pixel on `probe-on`; the run must fail on
  exactly that scene ("1 px differ, first at 0,0"). Unit test covers the one-pixel compare and the tamper cases.
- `bun run test:visual` = strict check + selftest + stability. `TURBO_FORCE=1 bun run gate` passes.

## Decisions
- Scenes are static markup, not framework mounts: hermetic and isolated from the e2e host. Adapter rendering
  parity is L2's job; L5 guards CSS/tokens/fonts.
- WebKit's focus ring (UA auto outline) differs in shape from Chromium's; each engine has its own baseline.
- Harness files use `// @ts-nocheck` (plain JS with untyped helpers); follow-up: JSDoc types.

## What CI needs (W1-314 owns ci.yml; not edited)
1. Baselines are platform-specific: darwin baselines do NOT match Linux. Generate `linux` baselines on the CI image
   (`engine-linux-<dpr>x`) through the reviewed `update` flow on that platform, commit them, then run
   `node visual/cli.js check --strict` so a missing cell is a failure. Pin the runner image and Playwright
   version (1.64.1) because font raster and engine builds change pixels.
2. Browsers: `bunx playwright install --with-deps chromium firefox webkit`.
3. Run `bun run --filter @ramoslabs/testing visual:verify` (no browser, cheap) on every PR; add a diff check
   that PNGs under `visual/baselines/` changed only together with a REVIEW-LOG entry in the same PR (verify
   enforces hash-to-log; a reviewer still approves the PR).
4. Upload nothing special; failures print scene, key and first differing pixel. No env or network needed.
