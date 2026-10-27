# S-TEST-PATH notes (W1-309b supports injector, W1-313 parity matrix)

Branch `feature/m3-supports-parity`. Files: `packages/testing/e2e/supports/**`, `packages/testing/parity/**`.

## W1-309b: supports injector
- Ten keys come from core's `SUPPORT_KEYS` (K1-NOTES), imported from source, never copied.
- `paths.ts`: path ids are `native` (real detection) and `fallback:<key>` (one key forced false), eleven in all
  (ADR-013 L6: "once with real detection and once per capability forced false"). `applyPath`, `parsePath`,
  `isNoop`.
- `detect.ts`: real detection of the ten keys, parameterised on the global object so it is unit-tested with fakes;
  a throwing probe is `false`. Core stays free of environment reads (ADR-003); detection lives in the harness host.
- Injection is proven, not labelled: the host builds a runtime with the effective map and passes it to each
  adapter's own provider (`SJProvider runtime`, `createHost`); a zero-DOM tap reads it back through the adapter's
  own hook (`useRuntime`, `useSJRuntime`, `host.runtime`) into `window.__sj.seen`. Every matrix test asserts
  `injectionProblems(real, seen, path) == []`. Seeded wrong maps are reported in `supports.test.js`.
- A forced-false path whose capability the engine already lacks equals `native` there. It still runs and stays a
  distinct row, but gets a `noop` annotation and is listed in the Markdown ("identical to native on that engine")
  so it is not read as extra coverage.
- Title format (parsed by W1-313): `<component> | <adapter> | <scenario> | <action> | path=<path>`. Titles without
  `path=` (detection checks) are not matrix rows.
- Separate config `supports/playwright.config.ts` extends the runner's (3 engines, `retries: 0`), writes
  `node_modules/.cache/e2e/e2e-supports-results.json` plus `e2e-supports-expected.json` (global setup). Retried
  runs (`SJ_E2E_RETRIES`) write `*-diagnose.json`, which the parity CLI refuses.
- Run: `bun run test:e2e:supports` (from `packages/testing`), then `bun run parity`.

## W1-313: parity matrix
- Rows `component / scenario / action / browser / adapter / path`; cell status `passed | failed | not-applicable |
  not-run`, `executed = passed + failed`, plus `reason` and `notes`.
- Status comes from the Playwright JSON only. What the matrix must CONTAIN comes from a separate declaration
  (contract-derived dimensions plus exemptions), because results alone cannot show absence. A declared cell with
  no result and no reasoned exemption is MISSING and fails; extra results, duplicates, retried tests, skips
  without a reason, results for exempt cells and malformed declarations also fail. Nothing is defaulted.
- Probe declaration: 3 engines + 4 explicit `not run` rows (Chromium 114, Firefox 125, iOS 17, Android floor, each
  with the ADR-013 reason) x 3 adapters x 11 paths x 8 scenarios.
- Outputs: `parity-matrix.json` and `parity-matrix.md` in `node_modules/.cache/e2e/parity`. W1-508 can consume the JSON.

## Result on the probe
804 tests (792 matrix cells + 12 harness checks), 3 engines x 3 adapters x 11 paths, all passed in ~2.2 min.
Parity: PASS, 1848 cells, 792 executed (792 passed), 1056 not run (declared, with reasons), 0 missing, 0 invalid.
Existing runner suite still 87/87.

## Shared-file edits (outside the owned dirs, minimal)
- `e2e/runner/host/entry.ts`: `mount(adapter, props, defect, path)`, runtime built with injected supports, read-back
  taps, `window.__sj.real/seen`. Defaults reproduce the previous behaviour (path `native`).
- `e2e/runner/executor.ts`: `RunOptions.path`, forwarded to `mount`.
- `packages/testing/package.json`: scripts `test:e2e:supports`, `parity`.

## Notes and follow-ups
- Runner results (`e2e-results.json`) have no `path=` in titles, so the matrix ignores them (counted as
  non-matrix). W1-309a's `probe.e2e.ts` may later adopt the supports titles so there is one results file.
- No hand-run of the Chromium 114 / Firefox 125 floor lane; those rows are `not run` by declaration (W1-503).
- A `fallback:all` (every key false) path is not included: ADR-013 asks for one per capability. Cheap to add.
- W1-314 wiring: `bun run --filter @ramoslabs/testing test:e2e:supports && bun run --filter @ramoslabs/testing parity`;
  upload both result files and `parity/` as artifacts. `ci.yml` not edited.
