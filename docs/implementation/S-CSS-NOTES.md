# S-CSS: implementation notes (M2, W1-201 to W1-205)

Branch `feature/m2-css-layer`. Spec: PLAN-WAVE-1 section 4 rows W1-201..205, ADR-002, ADR-008, ADR-009, ADR-013.

## What landed

| Task   | Where                                                              | Verified by                                                                                                      |
| ------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| W1-201 | `packages/css/scripts/build.mjs`, `test/build.test.js`, README     | layer string verbatim; `index.css` generated from a glob; unlayered consumer CSS wins (Chromium fixture); reset caveat fixture; build fails on any rule outside `sj.*` |
| W1-202 | `packages/testing/lint/stylelint/`, `packages/css/.stylelintrc.json` | six `sj/*` rules, seeded fail plus clean pass each (47 tests); tree scan for remote fonts                         |
| W1-203 | `packages/testing/contrast/`                                       | 4 variants x 6 tones x 3 sizes, text 4.5, ui/focus 3, muted floor; seeded token change names pair, ratio, token  |
| W1-204 | `packages/css/src/base/*.css`, `test/base.test.js`                 | Chromium probe: targets, ring area/contrast, `data-active`, forced-colors, reduced motion, RTL, svh/dvh, contain |
| W1-205 | `packages/css/src/_template/`, `bun run new`, `test/template.test.js` | generated CSS passes stylelint and the layer build; contract anatomy check works when a contract exists          |

## Decisions and ambiguities

- **Ring lives in `sj.state`, not `sj.base`.** Layers later in the order win (ADR-009 line "Cascade layers"). A component rule in `sj.component` that sets `box-shadow` would remove a base-layer ring, so the focus ring and the reduced-motion net sit in the last layer. Tested against a component `box-shadow`.
- **Ring = `--shadow-focus` plus a transparent outline.** The token is the two-tone ring (2px gap, 2px edge); forced colors drops `box-shadow`, so a transparent outline (UA turns it into a system color, also set to `Highlight`) is the fallback. Thickness is asserted `>= --focus-ring-width` and `>= 2px` (2.4.13).
- **Compact density.** ADR-008 only says a separate density preset serves dense desktops and touch is "never shrunk". `compact` = `--target-floor` (24px), reverting to 44px under `(any-pointer: coarse)`. Default and `touch` = `--target-min`.
- **48 dp** (ADR-008, "dp is not px"): no 48px token exists, so the probe reports it as advisory (`enforced: false`). Follow-up for tokens: add `--target-comfortable` (3rem) if the owner wants 48 enforced.
- **`interactive-widget`** (ADR-005 step 9) is a viewport `<meta>` setting; CSS cannot express it. Documented in the README; CSS exports `--sj-viewport-block-size` (svh) and `--sj-viewport-block-size-dynamic` (dvh).
- **Raw px exemption.** `sj/no-raw-px` flags every `px` in declarations (the hairline is the `--border-width-hairline` token, zero is unitless). `@media`/`@container` params are exempt because a variable cannot appear there.
- **Extra rule `sj/logical-properties`** (not in the W1-202 row): ADR-009 says "Logical properties and RTL are default"; the rule is cheap and enabled in `packages/css/.stylelintrc.json`.
- **Contrast matrix source.** No variant CSS or contract exists yet, so `RECIPE` in `testing/contrast/matrix.js` is the canonical `variant x tone` token pairing. It makes real design calls: solid success/info use emerald-700/blue-700 with white, solid warning uses slate-900 on amber-500, because `*-strong` tokens (written for 3:1 glyphs) fail 4.5:1 for text (success-strong 3.77, warning-strong 3.18). Outline borders use the dark text tones (the `*-border` tokens are 1.2:1 decoration). Variant CSS must follow RECIPE. Follow-up: once `sj.variant` CSS exists, add an extractor that reads pairs from the built CSS so the matrix cannot drift from it.
- **Contract name check (W1-205).** Real: `generate.mjs` requires `<name>.contract.json`, compares parts with `anatomy[].part` (missing contract or any mismatch fails), and `checkStylesheets` checks every `src/*.css` in the tests (button and switch contracts covered, seeded mismatch fails).
- **Per-file `dist` outputs** repeat the layer statement, so importing one component alone still fixes the order. `dist/base.css` is the base bundle.
- **Consumer-reset caveat** (risk 9): documented in the package README with the layered-reset recipe; the fixture shows an unlayered `button { min-block-size: 0 }` defeating the 44px target.

## Shared-file touches

- `.github/workflows/ci.yml`: one step, `bunx playwright install --with-deps chromium` in `packages/css`, because the probes drive Chromium. Local developers run `bunx playwright install chromium` once (the helper prints this when missing).
- `bun.lock`: regenerated (css devDependencies `@ramoslabs/testing` workspace, `playwright` 1.64.1, `postcss` 8.5.16; all exact).
- No change to root `package.json`, `.stylelintrc.json`, `turbo.json`, `eslint.config.js`; the `sj/*` rules are wired through `packages/css/.stylelintrc.json` (extends the root file), so no root line was needed. `packages/testing/lint/index.js` was not touched: it does not re-export the stylelint plugin (css references the path directly). S-CON may add the re-export together with the contract lint.

## Follow-ups owned by other streams

- **NICE-6 rewiring.** `packages/testing/contrast/wcag.js` (`contrastRatio`, `relativeLuminance`) is the shared implementation. Still to import it: `packages/tokens/test/tokens.test.ts` (own copy; note its threshold constant 0.03928 vs the spec's 0.04045, no practical difference for 8-bit values), the MCP `check_contrast` in `apps/site/worker/index.ts`, and the docs `TokenPicker.vue` copies in `apps/site` and `apps/storybook`.
- **Open defect: remote fonts in `apps/storybook`** (`.storybook/preview-head.html` and 11 MDX files load Google Fonts and Material Symbols). The W1-202 tree scan covers `packages/` and `apps/site` only. Fix plan: self-host the three families and the icon font under `apps/storybook/.storybook/` and drop the links, then widen the scan to the whole tree.
- Variant CSS and per-component `.b` files should start from `bun run new`.
