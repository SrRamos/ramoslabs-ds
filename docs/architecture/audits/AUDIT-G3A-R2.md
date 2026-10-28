# AUDIT G3A, round 2: verification of the round-1 corrections

Auditor: ds-fable. Date: 2026-10-28. Subject: `origin/main` at `1615520` (read-only; seeds ran in the throwaway worktree `ramoslabs-ds-g3a-r2`, removed afterwards). Reference: `audits/AUDIT-G3A.md` (round 1 at `dd62f9a`, recorded in #66); corrections in #68 (MUST-3, SHOULD-2, NICE-1, NICE-6), #69 (SHOULD-1, SHOULD-3, NICE-2), #70 (MUST-1, MUST-2, SHOULD-4, SHOULD-5, SHOULD-6, NICE-3, NICE-4, NICE-5; issue #67).
Method: (1) `git show` of #68, #69 and #70 read hunk by hunk against each round-1 finding; (2) `TURBO_FORCE=1 bun run gate` (exit 0; now ends with `specs:check`); (3) both conformance suites, their parity runs and both component visual checks run locally on Chromium, Firefox and WebKit; (4) thirteen seeds against the corrected sources: the three round-1 MUST seeds re-run, plus one per runtime host, the Vue double commit, the extractor pairs, three layout drifts, an unreviewed baseline and the label anatomy part; (5) CI run 40628930677 and E2E run 40628930708 on `1615520`.

## Verdict: PASS. G3A closes; every remaining component's `.a/.b/.c/.d/.e/.f` may start.

All three MUSTs are resolved and verified by the seeds that found them. All seven SHOULDs that were not owner items and all six NICEs are applied. The forced gate exits 0 and includes the new `specs:check`. The two component visual lanes now report NOT RUN loudly (60 and 54 cells awaiting human review) instead of forbidding baselines. Three things remain, none blocking: ruling (i) of round 1 (contract status `beta` and its definition) was not applied; the hand-passed `live: 'eager'` flag is acceptable until the first announcing component, under the condition in R2-SHOULD-2; the owner items (deny-list digests, Linux baselines) are unchanged.

## Gate, CI and the suites

| Check | Result |
|---|---|
| `TURBO_FORCE=1 bun run gate` at `1615520` | exit 0; `specs:check: 2 component dir(s) and _template follow the conformance layout` |
| CI 40628930677 | Static checks, Unit/SSR/contrast, Size/registry drift: success |
| E2E 40628930708 | success: Affected paths, L2 runner, ARIA, Supports+parity, a11y, Text safety, Conformance button, Conformance switch, Visual review (NOT RUN for the probe and both components, as designed), E2E |
| SJButton conformance (local, 3 engines) | 696 passed (660 in round 1 plus the new real-browser hydration spec); parity PASS: 5,292 cells, 378 executed, 0 missing |
| SJSwitch conformance (local, 3 engines) | 1,560 passed, 24 skipped (`#49 owner: SrRamos`); parity PASS: 294 cells, 126 executed, 0 missing |
| `visual:button`, `visual:switch` | 60 and 54 cells NOT RUN (awaiting human-reviewed baselines), exit 0 non-strict; `verify` exits 1 on a seeded unreviewed PNG |
| Schema | unchanged since the G2 freeze; the switch anatomy gained a `label` part (contract change, no schema change) |

## Status per round-1 finding

| Finding | Status | Verified how |
|---|---|---|
| MUST-1 one conformance layout | **Resolved** | Both directories carry the ruling (c) file set: `fixtures.ts`, `matrix.ts`, config extending `e2e/runner/playwright.config` with `SJ_<C>_PORT` and `<c>-results.json`, `open.ts`, `l2/hydrate/aria/a11y.e2e.ts`, `ssr.test.ts`, `bundle.test.ts`, `conformance.test.ts`, `voiceover.js` + `render-voiceover.js`, `host/{entry,host.html,hydrate,ssr-render,ssr-tree}`, `aria/*.yml`, `visual/{cli.js,scenes.js,baselines/}`; both visual CLIs delegate to `visual/component-cli.js` (`check | candidates | update | verify`). `specs/_template` holds the same set as `.tmpl` files; `specs/check.mjs` asserts required files, no stray or triage file, config inheritance, port and results naming and the four scripts, for every component directory and the template, in the gate. Seeds: `open.ts` deleted ("missing open.ts"), `a11y-triage.json` added ("per-component triage files are forbidden"), config import changed ("must extend e2e/runner/playwright.config"): each exits 1. `check.test.ts` seeds every required file |
| MUST-2 tests forbade baselines | **Resolved** | `specs/button/conformance.test.ts:154-176` and `specs/switch/conformance.test.ts:193-212` assert `verifyBaselines(root)` is empty and seed an unreviewed PNG and a manifest hash without a REVIEW-LOG entry. Seed on the real tree: a stray `chromium-linux-1x/button-default.png` fails the conformance test (two integrity problems) and `visual/cli.js verify` exits 1 |
| MUST-3 switch control detached from the track | **Resolved** | `switch.css:38-40`: `inset-block-start: 50%; translate: 0 -50%` on the control. New test "on a wrapping label the input stays centred on the track and contains it" at 180 px. Seed: control back to `inset-block-start: 0` fails it (`expected 52 to be >= 101`) |
| SHOULD-1 live region created in the same task as its text | Applied, **R2-SHOULD-2** on the derivation | All three DOM hosts expose `ensure()`; `live: 'eager'` on vanilla `ComponentSpec`, React `useMachine` and Vue `useSJStore` calls the provider's `requireLive` at mount, which the provider remembers until its host attaches (children mount first). Seeds: the eager call removed from `machine.ts`, `store.ts` and the vanilla host each fail their test. RT note corrected (microtask, not "one task before"). The flag is passed by hand; codegen emits nothing for `liveRegions` yet |
| SHOULD-2 switch pairs through the extractor on every surface | Applied | `extractUiPairs` reads `sj.state` rules keyed on `[data-state]` with a `background-color`, skipping disabled; `checkContrastMatrix` adds `ui` pairs at 3:1 on every surface (`switch/root::before/{off,on}/ui-on-*`, six pairs). `contrast.test.js` builds the real CSS and checks it (NICE-1). Seed: off-track `slate-300` fails the testing contrast suite (three failures) and the css switch test |
| SHOULD-3 Vue switch double commit | Applied | `SJSwitch.ts` passes `sj.native` directly; test "commits once per accepted change; a rejected change still resyncs". Seed: a re-added microtask commit fails it (`expected 2 to be 1`) |
| SHOULD-4 in-code axe review | Applied | `REVIEWED_INCOMPLETE` and `a11y-triage.json` deleted; two `incomplete` entries in `a11y/triage.json` with `reviewed: "pass"`, issue #67 and owner, validated by `validateTriage` |
| SHOULD-5 component visuals outside CI | Applied | `e2e.yml` visual job runs `specs/<c>/visual/cli.js check --strict` when `*-linux-*` baselines exist under the component, else prints NOT RUN per component into the step summary; `visual-baselines.yml` captures every component's `SCENES` into its own `visual/baselines` and uploads them. One conformance job per component directory, selected by slug (NICE-3) |
| SHOULD-6 label not an anatomy part | Applied | `switch.contract.json` anatomy `{ part: "label", element: "span" }`; core `getLabelProps` with protected `data-part/state/disabled`; React `SJSwitch.Label`, Vue and vanilla render it through the getter; ARIA snapshots unchanged; `switch.css` carries the part. Seed: part removed from the contract fails codegen drift (`generated/switch/aria.ts: differs`) and the css anatomy test |
| SHOULD-7 deny-list digests (owner) | **Open** | `contract:lint` still prints "denylist: not configured (0 digests)" in the gate |
| NICE-1 RECIPE transparent fills | Applied | outline and ghost `bg: 'transparent'`, expanded across `SURFACES` for recipe pairs too; test |
| NICE-2 synchronous-acceptance rule | Applied | ADR-003 paragraph (dated G3A NICE-2); codegen writes `CONTROLLED_RULE` into every controllable prop's doc |
| NICE-3 conformance by slug | Applied | `changes` job computes `components` from the `specs/` directories; a pull request whose package changes are all component-named runs only those; anything shared runs all (see R2-NICE-1) |
| NICE-4 skip-check message | Applied | failure text asks for an issue and an owner |
| NICE-5 switch target selection | Applied | `a11y.e2e.ts` picks `[data-part="control"]` |
| NICE-6 base layer load-bearing note | Applied | C01-NOTES |
| G2 SHOULD-1 Linux baselines (owner) | **Open** | 0 `*-linux-*` baselines for the probe, button or switch; all three lanes say NOT RUN |

Rulings (a) to (h) of round 1 are reflected in the code and notes. Ruling (i) is not: both contracts are still `draft` and ARCHITECTURE.md has no `beta` definition (R2-SHOULD-1).

## Ruling on the hand-passed `live: 'eager'` flag

Acceptable now; derivation must land before the first announcing component merges, not before G3B as a whole. Today no contract declares `liveRegions`, so nothing can be wrong; the first consumers are C02 (`SJField` error announcement) and C11 (`SJState`), and their `.a` tasks regenerate codegen anyway. Condition (R2-SHOULD-2): codegen emits `LIVE: 'eager' | 'lazy'` per component from `a11y.liveRegions`, the adapters pass that constant and never a literal, and a contract-lint source rule fails any adapter of a component with non-empty `liveRegions` that does not reference the generated constant. Land it in C02.a or C11.a, whichever is first, so the `.c/.d/.e` of those components build on it.

## New findings

### SHOULD

- **R2-SHOULD-1. Ruling (i) not applied.** `registry.json` and both contracts still say `draft`; ARCHITECTURE.md line 766 lists `draft | beta | stable` with no meaning. Correction: `status: "beta"` in `button.contract.json` and `switch.contract.json` (codegen and the root registry regenerate), and the dated ADR-010 sentence: draft = may change; beta = contract and getters frozen, fixtures and parity green, visual and AT lanes pending; stable = M5 certification. One small PR; verified file-level.
- **R2-SHOULD-2. `live` is a hand-written literal** (ruling above). `packages/contracts/scripts/codegen.mjs` emits no live constant; `useMachine`, `useSJStore` and vanilla `ComponentSpec` accept a free `'eager' | 'lazy'`. Correction as ruled: generated `LIVE` per component, adapters pass it, lint `contract/live-from-contract` with a seeded failure. Deadline: the first `.a` that declares `liveRegions` (C02 or C11).

### NICE

- **R2-NICE-1.** The slug filter in `e2e.yml` (`changes` job) treats any path segment or basename equal to a slug as component-only. Slugs coming later (`state`, `form`, `field`, `input`, `select`, `tabs`) are common file names, so a shared file such as a future `packages/core/src/live/state.ts` would narrow conformance to one component. Match only the owned locations: `packages/<pkg>/src/<slug>/`, `packages/*/src/generated/<slug>/`, `packages/css/src/<slug>.css`, `packages/contracts/contracts/<slug>.contract.json`, `packages/testing/specs/<slug>/`.
- **R2-NICE-2.** `specs/_template` stubs for the specs (`l2.e2e.ts.tmpl` and friends) are four-line comments pointing at the two golden directories; fine as a contract for the file set, but the next `.f` author copies button or switch anyway. When C02.f lands, promote whichever of its files proved reusable into real template bodies.

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| R2-SHOULD-1 | SHOULD (next docs PR) | two contracts, `registry.json`, ADR-010 | `beta` plus the status definition |
| R2-SHOULD-2 | SHOULD (first `.a` with `liveRegions`) | `codegen.mjs`, three adapters, contract lint | Generated `LIVE` constant, lint rule |
| R2-NICE-1..2 | NICE | as listed | as listed |

No further G3A round. R2-SHOULD-1 is verified file-level in its PR; R2-SHOULD-2 is checked at G3B together with the first announcing component.

G3A-AUDIT-2 DONE
