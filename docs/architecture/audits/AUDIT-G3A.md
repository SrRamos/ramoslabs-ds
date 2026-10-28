# AUDIT G3A: C01 SJButton and C03s SJSwitch, the golden component pattern

Auditor: ds-fable. Date: 2026-10-28. Subject: `origin/main` at `dd62f9a` (PRs #54 to #65 merged; read-only, seeds ran in the throwaway worktree `ramoslabs-ds-g3a`, removed afterwards). Scope: PLAN-WAVE-1 6.3 G3A ("schema survived real use; Button accepted as golden; contrast and target-size fail on seeded breakage"), the C01 and C03s rows of 6.2, the six sub-task acceptance cells of 6.1, ADR-003, ADR-004, ADR-008, ADR-009, ADR-011, ADR-013, ADR-014, the G2 rulings and open SHOULDs, and the three notes files (C01, C03, RT-FOLLOWUP).
Method: (1) every acceptance cell read against the code; (2) `TURBO_FORCE=1 bun run gate` in the worktree (exit 0); (3) both conformance suites and their parity runs locally on Chromium, Firefox and WebKit; (4) CI run 40623683053 and E2E run 40623683017 on `dd62f9a` read job by job; (5) fifteen seeded defects against the contrast, target-size, contract, registry and skip gates, each at the css-test level and, for target size, again through the L3 browser gate; (6) one geometry probe of the switch with a wrapping label.

## Verdict: CONDITIONAL PASS. The three gate checks are met; three MUSTs fix the golden before it is copied.

The schema did not change since the G2 freeze and both contracts validate; the freeze rules fail on seeds. SJButton is accepted as the golden for CSS and for the adapter layout. Contrast and target size fail on seeded breakage at the css-test level and at L3. What is not yet golden is the `.f` conformance layout: C01.f and C03s.f disagree file by file, and both encode "no visual baseline may exist" as a test invariant, which blocks the human-reviewed visual lane they wait for. The switch CSS, which C03c copies, detaches the focus target from the visible track on a wrapping label.

Consequence for the plan: every `.b/.c/.d/.e` of C02, C04 to C11 may start now under the rulings below. C03c.b waits for MUST-3 (one CSS rule plus one test). No other component's `.f` starts before MUST-1 and MUST-2 land.

## Gate, CI and the suites

| Check | Result |
|---|---|
| `TURBO_FORCE=1 bun run gate` | exit 0 (lint, format, typecheck, test incl. css button 18 and switch 19 tests, build, size, contracts incl. codegen drift, registry drift, contract lint, evidence, honesty, skips) |
| CI 40623683053 on `dd62f9a` | Static checks, Unit/SSR/contrast, Size/registry drift: success |
| E2E 40623683017 on `dd62f9a` | Affected paths, L2 runner, ARIA, Supports+parity, a11y release lane, Text safety, Visual review (probe, NOT RUN), Conformance SJButton, Conformance SJSwitch, E2E: success |
| SJButton conformance (local, 3 engines) | 660 passed, `retries: 0`; parity PASS: 5,292 cells, 378 executed and passed, 1,890 not-applicable, 3,024 not run with reason, 0 missing |
| SJSwitch conformance (local, 3 engines) | 1,551 passed, 24 skipped (CDP on Firefox/WebKit, `#49 owner: SrRamos`); parity PASS: 294 cells, 126 executed and passed, 168 not run with reason, 0 missing |
| Schema drift since G2 (`15a16e0..dd62f9a`, `packages/contracts/{schema,scripts,test}`) | no change |
| Contract status | both `draft` in `registry.json` (ruling (h)) |

## Seeded defects (all caught unless stated)

Contrast: button solid/error fill to `red-200` fails `button/solid/error/text` at 1.45:1 naming the token; outline/neutral border to `slate-300` fails the boundary on all three surfaces at 1.48:1 and 1.42:1; switch off-track to `slate-300` fails the drawn-pair test (token and ratio). Target size: button component layer forcing `min-*-size: 0` fails the css test (root 38 px, compact 35.5 px) AND the L3 2.5.8 gate (`142.4x38, expected >= 44`); switch control forced to 24 px with `min-*-size: 0` fails the css test (24) AND the L3 2.5.8 gate (24). Contracts: `label` prop removed from the button fails `contract/icon-only-name` and codegen drift on three generated files; `checked` removed from the switch props with `controllable: ["checked"]` kept fails the G2 subset rule; `pattern.evidence` removed fails as required. Registry: committed status flipped fails `registry:check`. Skips: a tracked `test.skip` without issue or owner fails `skips:check`.
**Not caught, by design (recorded, no finding):** removing only the component's own `min-*-size` from `button.css` or sizing the switch input to 24 px without zeroing `min-*-size` keeps every target at 44 px because `base.css` sets `min-block-size`/`min-inline-size: var(--sj-target)` on every `[data-part]` control; the button rule is load-bearing only for the disabled link (38 px without it). An untracked file with a bare skip passes `skips:check` because it scans `git ls-files`; the same file staged fails.

## Status per task

| Task | Status | Verified how |
|---|---|---|
| C01.a contract + core | Pass | Stateless machine, pure getters, `mergeProps` ownership, no `aria-pressed` per `at-support/button.json` decision; `contract/icon-only-name` rule fails on the seed; harness normalisation for bare-state reducers; 0.904 KiB of 1.5 |
| C01.b CSS | Pass, golden | `sj.component`/`sj.variant`/`sj.state` split; root and link through `:is()` (test forbids a bare `.sj-button__root`); extractor reads the built CSS, 72 combos, Chromium cascade cross-checked; transparent fills on every surface; seeds above |
| C01.c Vue | Pass, golden | Thin render-function component, no store for a stateless core (1,000 cycles, scopes inactive), `classes` per part, prop-or-slot label, SSR with no fragment markers |
| C01.d React | Pass, golden | Namespace plus flat exports, `createButton` per render with nothing to dispose, `forwardRef` to the real element, StrictMode markup identical to SSR |
| C01.e vanilla | Pass, golden | No import-time registration, delegated click with the instance signal, no FACE (real `<button>` in light DOM), text nodes only, define idempotent; default host lazy; `liveHost` no-op removed per RT follow-up (not present in `button/index.ts`) |
| C01.f conformance | Pass, MUST-1, MUST-2, SHOULD-4 | 660 Playwright tests; keys derived from the contract (Space on a link is `none`); real `hydrateRoot`/`createSSRApp`; native submit with submitter name/value; 2.5.8, 2.4.13, forced colors each with a seeded failing case; VoiceOver hook renders every `atAssertions` id; no skips |
| C03s.a contract + core | Pass, golden for native-input | `{ state, checked }` snapshot with the reducer reading only `state` (lint clean); `reduce` overload serves both the equivalence check and the harness; `checked` always emitted from `view()`; `support: []` justified inside the floor; 0.746 KiB of 1 |
| C03s.b CSS | Pass, MUST-3, SHOULD-2 | Native input is the control and focus target, `appearance: none`, 44 px, 24 px floor on fine pointers only; drawn pairs at 3:1 on `color-surface`; forced-colors borders on track and knob; knob position carries state; logical properties, RTL mirrored; anatomy equals the contract |
| C03s.c Vue | Pass, NICE-3 | `useSJStore` (no local bridge), `checked` attribute kept at the initial value so `form.reset()` matches a bare input, reset listener re-syncs the model; 19 tests incl. FormData equality; `nextTick(commit)` now redundant after #64 |
| C03s.d React | Pass | `useMachine`, no FACE, no hidden mirror, `checked` always controlled; the `useReducer` forced commit removed per RT follow-up (`index.ts:134`); form `reset` listener; 1,000 StrictMode cycles with `gc()` |
| C03s.e vanilla | Pass | `mountSwitch`/`define`, `defaultChecked` written once, document-level signalled `reset` listener, no FACE; the runtime now schedules the flush on a rejected change (`runtime/index.ts:220-229`) |
| C03s.f conformance | Pass, MUST-1, MUST-2, SHOULD-6 | 1,551 tests; FormData, `requestSubmit()` navigation and reset sequences against a bare input for 9 fixtures x 10 sequences x 4 render paths; two adapter bugs found and fixed with unit tests; ARIA snapshots identical across adapters; hydration keeps every server node; no baseline self-approved |
| RT follow-up (#64) | Pass, SHOULD-1, NICE-2 | React/Vue/vanilla resync on a rejected controlled change with exact render counts; adapters' workarounds removed in React and vanilla; lazy live node tested in all three hosts |
| G2 SHOULD-1 Linux baselines (owner) | **Open** | `packages/testing/visual/baselines` has 0 `*-linux-*` entries; CI visual job prints NOT RUN |
| G2 SHOULD-3 remote fonts | Closed (#52) | gate's tree scan clean |
| G2 SHOULD-4 deny-list digests (owner) | **Open** | `contract:lint` prints "denylist: not configured (0 digests)" in the gate and in CI; `--require-denylist` not passed |
| G2 SHOULD-2, 5, 6 | Closed (#53, #51, #50) | skip rule requires issue and owner (seeded); one `wcag.js`; freeze rules fail on seeds above |

## Rulings

**(a) Schema survived real use: yes, frozen stays frozen.** No file under `packages/contracts/{schema,scripts}` changed between the freeze and `dd62f9a`; button and switch validate; the two G2 subset rules and the required `pattern.evidence` each fail on a seed. Everything the adapters needed beyond the contract is adapter vocabulary the ADRs already allow (`classes` per ADR-004, Vue `v-model:checked`, vanilla `text`/`icon`/`label` as text nodes), not schema gaps. One contract-level gap is a finding, not a schema one: the switch's visible label is a `<span class="sj-switch__label">` in Vue and vanilla and a bare text node in React, outside the anatomy (SHOULD-6).

**(b) SJButton is the golden for CSS and adapter layout: ACCEPTED.** CSS: structure in `sj.component`, axes and pointer states in `sj.variant` with explicit rules and no local custom properties (so the extractor reads real tokens), disabled and forced colors in `sj.state`, focus and motion inherited from `base/`; root and link always styled together. Adapters: core getters produce every attribute and handler; a stateless core needs no store, provider or effect; `classes` per part appended after the library class; prop-or-slot for the label; React namespace plus flat exports; vanilla `mount/update/destroy` with `define()` building the element class inside the call. The template for later `.b` is `button.css` plus `css/test/button.test.js`; for `.c/.d/.e` the three `button/` directories.

**(c) One `.f` layout, merged from both.** The golden `specs/<c>/` is: `fixtures.ts` (fixture maps, `ADAPTERS`, `ENGINES`, executed paths), `matrix.ts` (scenarios and the parity declaration derived from the contract), `playwright.config.ts` extending `e2e/runner/playwright.config` (switch shape; port `SJ_<C>_PORT`, results `<c>-results.json` / `<c>-diagnose.json`, expected `<c>-expected.json`, parity out `parity-<c>`), `global-setup.ts`, `build.mjs`, `serve.mjs`, `host/` (entry, html, hydrate), `open.ts` page helpers, the purpose-named specs `l2.e2e.ts`, `form.e2e.ts` (native-input components), `hydrate.e2e.ts`, `aria.e2e.ts` with `aria/<fixture>.yml`, `a11y.e2e.ts` reading the shared `a11y/triage.json` only (no per-component triage file, no in-code review list), `ssr.test.ts`, `bundle.test.ts` (switch shape: ceiling row plus the one-component import graph), `conformance.test.ts` (fixtures vs contract, parity declaration with its seeds, evidence, skip rule, VoiceOver hook), `voiceover.js` plus `render-voiceover.js`, and `visual/{cli.js,scenes.js,baselines/}` with the four commands `check | candidates | update | verify`. Scripts: `test:e2e:<c>`, `parity:<c>`, `visual:<c>`, `voiceover:<c>`. Button moves: `button.e2e.ts` to `l2.e2e.ts`, `fixtures.js` to `.ts`, `a11y-triage.json` deleted, config extends the base, cache names drop the `e2e-` prefix, `candidates` added to `visual/cli.js`. Switch moves: `snapshots/` to `aria/`, `visual.mjs`+`scenes.js`+`visual.test.js` to `visual/cli.js`+`visual/scenes.js` with the browser-free checks folded into `conformance.test.ts`, `bundle.test.js` to `.ts`, `ssr-render.ts`/`ssr-tree.ts` under `host/`. Codify it: `packages/testing/specs/_template/` plus a `specs:check` script (same idea as `checkStylesheets`) that asserts the file set per component directory, in the gate (MUST-1).

**(d) Outline fill `transparent`: ACCEPTED.** It is evaluated on all three surfaces, which is stricter than RECIPE's single `color-surface`, and matches what a consumer sees on any page color. G2 ruling (c) ("RECIPE is canonical until `sj.variant` CSS exists") is superseded: the built CSS is canonical for every axis a component defines; RECIPE remains the fallback for axes no CSS defines yet (NICE-1 aligns the two).

**(e) Switch contrast: the extractor, not in-test literals, for the drawn pairs that sit on the page.** The switch test checks the track against `color-surface` only; the matrix rule is every surface (both other surfaces pass today at 4.55:1 and 6.01:1, measured). Rule: extend `extractPairs` with a `ui` pair for `sj.state` rules keyed on `[data-state]` that set `background-color` on a part or its `::before`, checked at 3:1 against `SURFACES`; the adjacent pair (knob on track) stays in the component test because it is not on the page. C03c then gets it for free (SHOULD-2).

**(f) React microtask resync: ACCEPTED.** The corrective effect still runs post-commit in the layout effect exactly as ADR-003 and ADR-014 describe; the microtask only forces the commit an accepting owner would have produced, and an accepting owner costs no extra render (tested). The contract this implies must be written down: a controlled owner accepts synchronously in the callback; one that accepts later (a transition, I/O) sees the native control snap back until its render commits (NICE-2).

**(g) Lazy live region: NOT accepted as the default for announcing components (SHOULD-1).** `scheduler.soon` is `queueMicrotask`, so the region is inserted (`setText('')`) and filled in the same task; the RT note's "one task before" is inaccurate, and the research rule reads "mount persistent live-region containers before updating their text". Harmless for button and switch (`liveRegions: []`), so no block on G3A, but C02 and C11 announce.

**(h) Visual baselines: G3A does not require them; the lane must be closable.** ADR-013 L5 is a human review outside automation, so the gate passes without baselines. But today no human can close it: two tests assert that no baseline PNG exists (MUST-2), the visual CI job only runs the probe and only looks for Linux baselines under `packages/testing/visual/baselines`, and `visual-baselines.yml` generates probe scenes only (SHOULD-5). G2 SHOULD-1 stays open.

**(i) Contract status.** Nothing defines promotion. Rule: `draft` = may change; `beta` = contract and getters frozen, fixtures and parity green, visual and AT lanes pending; `stable` = M5 certification (VoiceOver protocol, reviewed baselines, floor lane). SJButton and SJSwitch become `beta` in the MUST-1 PR; the definition goes into ADR-010 as a dated edit.

## Findings

### MUST (before the golden is copied)

- **MUST-1. One conformance layout.** `specs/button` and `specs/switch` differ in file names, config inheritance, triage source, visual entry point, cache names and port variables (ruling (c)). Later `.f` tasks would pick one at random. Correction: apply ruling (c) to both directories, add `specs/_template/` and `specs:check` in the gate, rename the CI matrix entries' scripts accordingly. Deadline: before any other component's `.f` starts.
- **MUST-2. Tests forbid the baselines the lane waits for.** `packages/testing/specs/button/conformance.test.ts:161-167` asserts the baseline directory contains nothing; `packages/testing/specs/switch/visual.test.js:43-47` asserts zero PNGs. The moment a reviewer commits baselines the gate fails. Correction: replace both with `verifyBaselines(root)` being empty plus "every PNG has a manifest hash and a REVIEW-LOG entry" (the harness already provides this), and a seeded unreviewed PNG failing. Same PR as MUST-1.
- **MUST-3. Switch control detaches from the track on a wrapping label.** `packages/css/src/switch.css:36-41` pins the input at `inset-block-start: 0`, while the track (`:21-28`) and knob are centred at 50%. Measured with the contract's long-label fixture in a 220 px box: root 162 px tall, input at y 8 to 52, track at y 69 to 93; the keyboard focus ring (2.4.13) and the 44 px hit area sit 17 px above the visible control and do not overlap it. C03c.b extends this file. Correction: `inset-block-start: 50%; translate: 0 -50%` on `.sj-switch__control` (same as the track), and a css test that asserts the input rect contains the track rect for the long-label markup. Deadline: before C03c.b.

### SHOULD (before G3B)

- **SHOULD-1. Live region created in the same task as its first text** (ruling (g)). `packages/vanilla/src/runtime/index.ts:112-125`, `packages/react/src/runtime/live-host.ts`, `packages/vue/src/runtime/dom.ts`. Correction: eager creation for components that declare `a11y.liveRegions` (codegen can emit a `LIVE_REGIONS` constant the adapter passes as `{ live: 'eager' }` to the host), lazy otherwise; a "first announcement after mount" step in the W1-505 VoiceOver protocol. Deadline: before C02 and C11 `.c/.d/.e` merge; correct the RT note.
- **SHOULD-2. Switch drawn pairs through the extractor on every surface** (ruling (e)). `packages/testing/contrast/css.js` reads `sj.variant` only; `packages/css/test/switch.test.js:144-166` checks one surface. Correction as ruled; keep the knob-on-track pair in the component test.
- **SHOULD-3. The Vue switch keeps its own resync after #64.** `packages/vue/src/switch/SJSwitch.ts:88-93` calls `nextTick(sj.commit)` on every change, so an accepted change now reconciles and drains twice. RT follow-up section 3 listed React and vanilla only. Correction: use `sj.native` directly as the other two adapters do; the controlled-rejection tests must still pass unchanged.
- **SHOULD-4. Axe `incomplete` reviewed in code without issue or owner.** `packages/testing/specs/button/a11y.e2e.ts:34-36` (`REVIEWED_INCOMPLETE`) is a second triage path that bypasses `validateTriage`. Correction: two entries in the shared `a11y/triage.json` `incomplete` list with an issue and an owner, and the constant removed (part of MUST-1's move to the shared triage).
- **SHOULD-5. Component visual checks are outside CI and outside the baseline workflow.** `e2e.yml` visual job runs `visual/cli.js` (probe) and checks `packages/testing/visual/baselines` for `-linux-`; `visual-baselines.yml:37-38` captures `SCENES` of the probe only. Correction: the baseline workflow captures each component's scenes into its `visual/baselines`, and the visual job runs `visual:<c>` per component with the same strict-or-NOT-RUN rule; owner then reviews (G2 SHOULD-1, still open).
- **SHOULD-6. The switch label is not an anatomy part.** Vue (`SJSwitch.ts:147`) and vanilla (`switch/index.ts:72`) render `<span class="sj-switch__label">`; React renders bare text; the anatomy check forbids CSS from targeting the class. Correction: add `{ part: "label", element: "span" }` to `switch.contract.json` anatomy, a `getLabelProps` getter, and all three adapters render it; the a11y helper at `specs/switch/a11y.e2e.ts:31-32` then needs no fallback. Contract change, no schema change; C03c copies the result.
- **SHOULD-7 (owner, carried from G2 SHOULD-4).** Deny-list digests are still not provisioned; `contract:lint` runs with the scan skipped in the gate and CI.

### NICE

- **NICE-1.** Align RECIPE's outline/ghost entries to `bg: 'transparent'` with the same every-surface expansion, so the fallback and the CSS agree; pass the built `index.css` to `contrast.test.js` so the CI step named "Contrast matrix" also reads the real pairs.
- **NICE-2.** Write the synchronous-acceptance rule for controlled fields (ruling (f)) into the generated props doc for `checked` and into ADR-003's controlled paragraph.
- **NICE-3.** `e2e.yml:33-35` still says the probe is the only component; narrow the conformance entries by slug now that `specs/<c>` exist.
- **NICE-4.** `scripts/skip-check.mjs` failure text still offers `// skip-reason:` as a remedy; it now requires an issue and an owner.
- **NICE-5.** `specs/switch/a11y.e2e.ts:129` picks the target as "first with a height"; select `[data-part="control"]` by id.
- **NICE-6.** Record in C01-NOTES that the component `min-*-size` is load-bearing only for the disabled link; the base layer carries the rest (evidence above).

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| MUST-1 | MUST | `packages/testing/specs/{button,switch}`, `_template`, gate | One layout per ruling (c), `specs:check` in the gate |
| MUST-2 | MUST | `specs/button/conformance.test.ts:161`, `specs/switch/visual.test.js:43` | Assert reviewed-only, not none |
| MUST-3 | MUST | `packages/css/src/switch.css:36` | Centre the control on the track; geometry test with the long label |
| SHOULD-1 | SHOULD | three runtime live hosts, RT note | Eager region for components that declare `liveRegions` |
| SHOULD-2 | SHOULD | `contrast/css.js`, `css/test/switch.test.js` | `ui` pairs from `sj.state` on every surface |
| SHOULD-3 | SHOULD | `vue/src/switch/SJSwitch.ts:88` | Drop the adapter resync |
| SHOULD-4 | SHOULD | `specs/button/a11y.e2e.ts:34` | Triage entries with issue and owner |
| SHOULD-5 | SHOULD (owner) | `e2e.yml`, `visual-baselines.yml` | Component scenes in the baseline workflow and the visual job |
| SHOULD-6 | SHOULD | `switch.contract.json`, core getters, three adapters | `label` anatomy part |
| SHOULD-7 | SHOULD (owner) | CI secret, `contract:lint` | Provision digests, `--require-denylist` |
| NICE-1..6 | NICE | as listed | as listed |

Re-audit: MUST-1, MUST-2 and MUST-3 are verified file-level in their PRs (no gate re-run needed); SHOULD-1 and SHOULD-6 are checked at G3B; SHOULD-5 and SHOULD-7 are owner actions reported at G3B.

G3A-AUDIT DONE
