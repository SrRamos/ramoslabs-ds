# S-TEST-E2E notes (W1-309a, Playwright runner)

Branch `feature/m3-e2e-runner`. Files: `packages/testing/e2e/runner/**` and a `test:e2e` script in
`packages/testing/package.json` (`playwright test -c e2e/runner/playwright.config.ts`; root `bun run test:e2e`
already fans out through turbo, `dependsOn: build`, `cache: false`).

## Layout
- `playwright.config.ts`: projects `chromium`, `firefox`, `webkit`; `retries: 0`; `fullyParallel`; webServer
  runs `serve.mjs`. `SJ_E2E_RETRIES=n` is a local diagnosis switch and writes `e2e-diagnose.json` instead of
  `e2e-results.json`, so a retried run can never be read as manifest input (ADR-013: retries diagnose, never certify).
- `build.mjs` / `serve.mjs`: esbuild bundles `host/entry.ts`; `@ramoslabs/{core,react,vue,vanilla}[/sub]` are
  aliased to `packages/<pkg>/src/<sub>/index.ts`, so the run needs no prior `build`. Output and results live in
  `packages/testing/node_modules/.cache/e2e/` (ignored by git, eslint, prettier).
- `host/entry.ts` + `host.html`: one page, `window.__sj.mount(adapter, props, defect)`. Mounts the W1-316 probe on
  the REAL adapter runtimes (React in StrictMode under `SJProvider`, Vue under `SJProvider`, vanilla `createHost`)
  and records every `pressedChange` payload.
- `executor.ts`: consumes `l2Plan(deriveSpec(contract))` (same `spec.sequences` arrays the L1 harness replays;
  asserted by identity in `runner.test.js`). Per sequence and per variant (`pointer` plus each declared key:
  Enter, Space) it asserts: precondition state, resulting `data-state`, contract `aria` expectations, FOCUS TARGET
  (`document.activeElement` is the owner part; keyboard runs only), emitted event count and payload, and the IDREF
  graph (no duplicate ids, no dangling `aria-*`/`for`). No cross-adapter DOM comparison. Also `runInert` (disabled
  fixture: no state change, no events) and `runControlled` (request reported, view follows the prop only).
- `probe.e2e.ts`: generates the matrix. Title format `<component> | <adapter> | <scenario>`, engine = project name.
- `runner.test.js`: vitest unit tests (retries 0, three engines, plan identity, variants).

## Result
87 tests, 3 engines x 3 adapters: 6 sequence runs, 1 inert and 1 controlled per cell, plus 9 seeded-defect runs, all
green in about 15 s locally. Seeded wrapper defects (must be REPORTED, test passes only when the executor fails them):
`vanilla-wrong-emit` (wrong `pressedChange` payload), `react-lose-focus` (focused node replaced, focus on body),
`vue-wrong-aria` (`aria-checked` stuck). Verified the messages are the intended ones, not setup failures.
Defects live in `host/entry.ts` as wrappers around the probe; the probe itself was not edited.

## Decisions
- Pointer runs do not assert focus: WebKit does not focus a `<button>` on click (engine policy). Focus is asserted
  on keyboard runs, where the focus owner is the contract `focus.owner`.
- The probe barrel (`probe/index.ts`) imports `node:path`, so the browser bundle imports the three wrapper
  modules directly instead.
- Host page loads `probe.css` only; tokens CSS is not loaded (not needed for L2 semantics; W1-312 visual owns it).
- Fixture-name to props mapping (`off`, `on`, `disabled`) is the component author's, kept in `probe.e2e.ts`.

## What CI needs (W1-314 owns ci.yml; not edited here)
1. Browsers: `bunx playwright install --with-deps chromium firefox webkit` (Linux needs `--with-deps` for system
   libs). Cache `~/.cache/ms-playwright` keyed on the `@playwright/test` version (1.64.1).
2. Command: `bun run --filter @ramoslabs/testing test:e2e` (or root `bun run test:e2e`, which builds first; the run
   itself does not need `dist/`, so the filter form is enough).
3. No env needed. Keep `SJ_E2E_RETRIES` unset; the manifest consumer reads only
   `packages/testing/node_modules/.cache/e2e/e2e-results.json` (Playwright JSON reporter; suites carry the project
   name = engine, titles carry adapter and scenario).
4. Port 4179 must be free (`E2E_PORT` overrides). Runs on loopback only.
5. Upload `node_modules/.cache/e2e/artifacts` and the results JSON as CI artifacts on failure.
6. WebKit on Linux is Playwright's build, not Safari: the report must keep saying emulation/patched WebKit is not
   real iOS Safari (ADR-013 floor lane wording).

## Follow-ups
- W1-309b: add a `path` field to the host (`window.__sj.mount` takes `supports` overrides) and to test titles.
- W1-309c: ARIA snapshots reuse `open()` and the host page.
- `bun run gate` does not run `test:e2e` (browsers are not a gate prerequisite locally); CI wiring is W1-314.
