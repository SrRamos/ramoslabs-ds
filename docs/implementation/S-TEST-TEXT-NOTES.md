# S-TEST-TEXT notes (W1-311, text-safety test on every adapter)

Branch `feature/m3-text-safety`. Files: `packages/testing/text-safety/**` only.

## What it proves
Markup-like consumer strings go through the W1-316 probe label in a real browser, on Chromium, Firefox and
WebKit, for React, Vue and vanilla (ADR-002 text nodes only; ADR-013 L2). Per string the test asserts:
1. DOM text equals the literal string (`&lt;` stays `&lt;`, `{{x}}` stays `{{x}}`).
2. No element was created from the string: descendant tags equal the plain-text baseline (`SPAN` only).
3. No script ran (`window.__pwned` stays unset) and no dialog opened (`alert(1)` payload).

Seeded defect: a test-only wrapper writes the same label through `innerHTML` (React ref, Vue `innerHTML` prop,
vanilla concatenation). For each payload that would create elements, the same checks must fail, with a message
matching `created from the string`, `script ran` or `dialog opened`.

## Layout
- `text-safety.e2e.ts`: per engine, 6 payloads x 3 adapters (safe) plus 4 element-creating payloads x 3 adapters
  (seeded) = 30 cases; 90 across Chromium, Firefox and WebKit. Title format `SJProbe | <adapter> | text-safety | <payload>` (component from
  `probe.contract.json`).
- `host/entry.ts`: test-only browser host. `window.__ts.mount(adapter, label, mode)`. `safe` uses the real
  probe wrappers and the real runtimes (`SJProvider`, `createHost`); `innerhtml` is the seeded defect.
- `bundle.ts`: esbuild bundle of the host in memory (`write: false`), workspace packages aliased to source,
  injected with `page.addScriptTag`. No static server and no port.
- `playwright.config.ts`: the three L2 engines, `retries: 0`, output in `node_modules/.cache/text-safety`.

## Results
- `bunx playwright test -c text-safety/playwright.config.ts` from `packages/testing`: 90 passed in about 20 s.
  Seeded runs cover only the four element-creating payloads; `&lt;` and `{{x}}` are checked in the safe run.
- `TURBO_FORCE=1 bun run gate`: exit 0.
- Size: no core, adapter or CSS code touched; size budgets unchanged.

## Decisions
- Baseline per mode: the element check compares against a plain-text mount in the same mode, so the seeded
  `innerhtml` mode has its own (two-span) baseline and the check stays exact.
- Dialogs are auto-dismissed and recorded. `alert(1)` is in the payload set, so a markup injection that
  executes script is reported, not just a DOM diff.
- 100 ms settle after each mount so an injected `onerror` handler can fire before the DOM is read.
- Not using `probe.e2e.ts`/`executor.ts` from the L2 runner: they assert state machine behaviour. This test only
  asserts text and structure, so it has its own small host.

## Follow-ups (shared files, not edited here)
1. `packages/testing/package.json` has no script for this test. Suggested: `"test:text-safety": "playwright test -c text-safety/playwright.config.ts"`. Owner: W1-314 or the package owner.
2. `ci.yml` (W1-314, sole owner): run it after the browser install, same as `test:e2e`. Not edited here.
3. Browsers: needs `bunx playwright install --with-deps chromium firefox webkit` in CI, as for the L2 runner.
4. WebKit here is Playwright's build, not Safari. Same wording rule as the L2 runner (ADR-013 floor lane).
