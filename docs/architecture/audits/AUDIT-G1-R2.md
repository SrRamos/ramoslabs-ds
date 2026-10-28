# AUDIT G1, round 2: verification of the round-1 corrections

Auditor: ds-fable. Date: 2026-10-27. Subject: `main` at `96e9f1c` (read-only). Reference: `audits/AUDIT-G1.md` (round 1 at `b63a075`) and its orchestrator note on MUST-4; corrections in #41 (ADR text, reducer lint), #42 (core), #43 (adapters), W1-114 in #34.
Method: (1) `git show` of #41, #42, #43 read hunk by hunk against each round-1 finding; (2) the sixteen core seeds and the React and vanilla bridge seeds from round 1 re-run unchanged against the corrected sources and the rebuilt `dist` (vanilla needed `allowFakeScheduler: true`, which is itself the SHOULD-1 proof); (3) `TURBO_FORCE=1 bun run gate` run twice; (4) `node packages/testing/size/cli.js`; (5) `packages/testing/ssr` read (runner, graph, three wrappers, 20 tests); (6) every commit since `b63a075` checked for touches on the G1 directories.

## Verdict: PASS. G1 is met; M4 may start.

All four MUSTs are resolved and verified by the same seeds that found them. All five SHOULDs and all eight NICEs are applied. W1-114 is delivered and does what the row says. The full forced gate exits 0 on the second run; the first run failed on a vitest cache race, not on an assertion (R2-SHOULD-2). Two new findings came out of the check, neither in the kernel: the SHOULD-4 lint as implemented forbids what the pipeline requires (it must be corrected before the first reducer with a controllable field lands, which is `switch`), and the `test` step of the gate has a cache race between parallel vitest processes.

## Gate and ceilings

`TURBO_FORCE=1 bun run gate`, run 1: exit 1 at `turbo run test` (`@ramoslabs/contracts:test` startup error `ENOTEMPTY … rmdir node_modules/.vitest-cache`, `tokens:test` killed with 130; no test assertion failed). Run 2: exit 0 across lint, format, typecheck, test (all packages, including `testing` with `ssr/ssr.test.ts`, 20 tests), build, size, contracts, evidence (10 refs in 2 contracts) and honesty (165 files clean).

Size CLI at `96e9f1c`: store 282 B (1 KiB), overlay 2,375 B (4 KiB), collection + focus + typeahead 1,607 B (3 KiB), live 457 B (1 KiB; `HIDDEN_STYLE` now lives in core, +124 B), kinds + number 1,711 B (2 KiB), fixture 0 B. Every ceiling holds; no amendment needed.

## Status per round-1 finding

| Finding | Status | Verified how |
|---|---|---|
| MUST-1 effect-only dispatch never drained (React, vanilla) | **Resolved** | React `useMachine` bumps a `useReducer` tick from `onEffects`, forcing the commit that drains; vanilla calls `schedule()` from `onEffects`. Seeds re-run on `dist`: React runs `focus@1` on the effect-only dispatch and the announce-only dispatch reaches the live host; vanilla runs `focus@1` with nothing pending. Both suites carry the seeded case (React "G1 MUST-1", vanilla likewise); Vue's existing line-58 case unchanged |
| MUST-2 tier-1 close desync on prevented `cancel` | **Resolved** | `OverlayEl.open?` added; after `requestClose()`, `if (el.open === true) return false` before `finish`. Seed: `close()` returns false, one entry left, no `onClose`; the later native close event then restores the opener. Test "tier 1 with a prevented cancel … keeps the entry and restores nothing". Note: a fake without `open` still finishes (previous behaviour); real dialogs always expose `open`, acceptable |
| MUST-3 vanilla live region visible | **Resolved** | `HIDDEN_STYLE` exported from `core/src/live` (both `clip` and `clip-path`, no `display`/`visibility`) and applied with `setAttribute('style', …)` by all three hosts; vanilla keeps `sj-sr-only` as a hook only. Tests in core, React and Vue assert the attribute; R2's open question is closed as "inline" |
| MUST-4 W1-114 missing | **Resolved by delivery (#34)** | `packages/testing/ssr`: server pass with `window`/`document`/`navigator`/`location`/`HTMLElement`/`Element`/`Node` deleted and restored; hydrate into one shared document; optional fresh client pass; ids, IDREF lists, single IDREFs and structural paths extracted and diffed; duplicates, dangling refs and cross-root resolution reported; markup linted for script/style; hydration diagnostics captured. Three roots with distinct `idPrefix`, seeded shared-prefix collision fails, repeatability asserted. Vanilla runs on the injected `idFactory` and throws clearly without one. React omits the fresh client pass by design (client-only `useId` is `_r_<n>_`), documented in the runner; Vue and vanilla run all three passes. 20 tests, in the gate |
| SHOULD-1 fake scheduler on the client | Applied | React and Vue providers default `target: 'client'`; both outside-provider fallbacks too; vanilla `createHost` throws in development on a fake scheduler unless `allowFakeScheduler` (my round-1 seed now throws exactly that message). Tests in React and Vue assert no `advance` on the scheduler |
| SHOULD-2 `anchorPositioning` definition, deferred keys | Applied | `ANCHOR_PROPERTIES` (five properties with representative values) and pure `detectAnchorPositioning(cssSupports)`; tests: Chromium-125-like engine (no `position-area`) is false, each missing property is false. ADR-013 records the closed ten-key list, the conjunction rule and the three deferred keys (`closedby`, `popover="hint"`, `interestfor`) |
| SHOULD-3 focus target per strategy | Applied | Seed: `native-roving` focuses the active item, `native` calls no `focus()`, `activedescendant` the container, `roving` the item; `it.each` over the four strategies |
| SHOULD-4 reducer rule | Applied, with a defect in the lint (**R2-SHOULD-1**) | Rule written in K1b-NOTES and the plan `.a` row; `lintReducerSource` in `testing/lint/contract/source.js`, wired into `lintReducers` and the CLI with seeded cases |
| SHOULD-5 one corrective version | Applied | `correctiveVersion(last) = last + 1` in `core/src/effects`, used by React, Vue and vanilla; test proves supersession of a same-batch same-key reducer effect |
| NICE-1 subscribe dedupe | Documented | Store doc comment plus a test |
| NICE-2 key collision | Documented | `itemId` doc comment plus a test |
| NICE-3 undefined supports | Applied | `definedOnly` in `createRuntime` and `withSupports`; seed gives `false` |
| NICE-4 `reconcile` uses `this` | Applied | Closure `self`; seed destructured call returns the corrective |
| NICE-5 Vue handler arrays | Applied | Arrays chained in order then the library handler; test |
| NICE-6 L6 lane note | Applied | W1-110 plan cell |
| NICE-7 dev-guard helpers | Applied | `react/src/runtime/dev.ts` deleted, inline at the site; vanilla `dev()` removed, inline at both sites |
| NICE-8 `data-active` on release | Applied | `release()` removes it from every item; test |

Rulings (a), (b), (c) are recorded in ARCHITECTURE.md as written in round 1 (ADR-002 table rows and dev-guard paragraph, ADR-011 adapter row, ADR-013 closed key list), each dated.

## Regression check of the other merged PRs

Since `b63a075` only #42, #43 and #32 touch the G1 directories. #32 adds generated `at-support.ts` files under `core/src/generated/{button,switch}` (codegen output, W1-318); the button and switch rows still measure 0 B. #33..#40 and #44 live under `packages/testing` and do not touch the kernel or the runtimes. Adapter runtime rows: react 1,523 B, vue 1,325 B, vanilla 1,326 B (reported only).

## New findings

### SHOULD

- **R2-SHOULD-1. The reducer lint forbids the writes the pipeline requires.** My round-1 rule was that a reducer never *reads* a controllable field. `lintReducerSource` also flags every object-literal key and shorthand for the field (its own test: `{ ...state, open: true }` fails). But in uncontrolled mode the only way a controllable field changes is the reducer applying `toEvent(next)` (`request('checked', next)` dispatches it), so the first real reducer, `switch` with `controllable: ["checked"]`, cannot write `checked: e.checked` and pass. Today nothing is linted because no `core/src/<slug>/reducer.ts` exists, so the gate is green by absence. Correction: flag reads only. Keep the `state.f`, `state?.f`, `state['f']` patterns and the first-parameter destructure `({ f }, e)`; drop object-literal keys and shorthand from the match (or match them only when the value expression references the first parameter). Change the seeded cases accordingly: `{ ...state, open: e.open }` passes, `state.open ? … : …` fails, `{ ...s, checked: !s.checked }` fails (a read). Land it before the `switch` reducer.
- **R2-SHOULD-2. The `test` step of the gate races on a shared vitest cache.** First gate run at `96e9f1c`: `@ramoslabs/contracts:test` startup error `ENOTEMPTY: directory not empty, rmdir node_modules/.vitest-cache`, `tokens:test` killed (130), gate exit 1. Second run: clean. Eight packages now run `vitest run` in parallel under Turbo and all resolve the same root `node_modules/.vitest-cache`, which vitest 5 clears on startup. The flake appeared the moment S-TEST added packages; CI will see it. Correction: give each package its own cache directory (`cacheDir: 'node_modules/.vitest'` in `sharedTestConfig`, relative to the package's config file, or a `cacheDir` per `vitest.config.ts`), and confirm with three consecutive forced gates. Until then a red `test` step with `ENOTEMPTY` is a rerun, not a finding.

### NICE

- **R2-NICE-1.** React `SJProvider` now creates a client-target runtime on the server render too; harmless (nothing schedules during `renderToString`, the SSR test passes), but `serializeRuntime` docs should say the client rebuilds with the serialized values plus `target: 'client'`, which the Vue provider comment already implies.
- **R2-NICE-2.** `HIDDEN_STYLE` costs 124 B in the live row for every consumer; fine at 46 % of the ceiling, record it in the W1-113 report's live row on the next re-measure.

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| R2-SHOULD-1 | SHOULD (before the `switch` reducer) | `testing/lint/contract/source.js` + tests | Flag reads of the first parameter only; writes are the pipeline's path |
| R2-SHOULD-2 | SHOULD (before CI relies on `test`) | `vitest.shared.ts` or per-package configs | Per-package `cacheDir`; three clean forced gates |
| R2-NICE-1..2 | NICE | as listed | as listed |

No further G1 round. R2-SHOULD-1 and R2-SHOULD-2 are verified file-level in the PR that lands them.

G1-AUDIT-2 DONE
