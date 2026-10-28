# AUDIT G2: M2 CSS layer and M3 contracts, wiring, evidence and test infrastructure

Auditor: ds-fable. Date: 2026-10-27. Subject: `main` at `5003089` (read-only; seeds ran in a scratch copy under my scratchpad). Scope: PLAN-WAVE-1 sections 4, 5 and 8 (G2 row: schema, codegen equivalence, registry drift from `integration.ts`, MCP, lint, evidence schema, staleness and honesty checks, probe through all layers on all adapters; "CSS gates failing on seeded breakage, schema frozen"), ADR-009, ADR-010, ADR-013, ADR-015, and the fifteen stream notes.
Method: (1) every M2/M3 row's acceptance cell read against the code; (2) `TURBO_FORCE=1 bun run gate` (exit 0); (3) every browser suite run locally on Chromium, Firefox and WebKit: L2 runner, ARIA and CDP, text safety, a11y release lane, supports paths, parity, visual check and self-test; (4) 34 seeded defects against the static gates in the scratch copy plus four against the browser-side harnesses; (5) CI run 40608147331 and E2E run 40608147326 on `5003089` read job by job; (6) the live MCP endpoint and the three served schema URLs probed.

## Verdict: PASS. G2 is met, the schema is frozen as ruled below, and M4 may start.

Every gate the row names exists, is wired into the local gate and CI, and failed on my seeds. The probe runs through L1 (vitest), L2 (87 runner, 42 ARIA/CDP, 90 text-safety cases), L3 (123 a11y cases, release lane), L5 (36 darwin baselines, 1-px self-test) and L6 (804 supports-path cases, 1,848-cell parity matrix with 0 missing) on React, Vue and vanilla. Six SHOULDs are owed before the first M4 component PR; none blocks starting M4.

## Gate, CI and the probe

| Check | Result |
|---|---|
| `TURBO_FORCE=1 bun run gate` | exit 0 (lint, format, typecheck, test, build, size, contracts incl. codegen drift, registry drift, contract lint, evidence, honesty, skips) |
| CI on `5003089` | Static checks, Unit/SSR/contrast, Size/registry drift: success |
| E2E on `5003089` | Affected paths, L2 runner, ARIA, Text safety, Visual review: success; a11y and supports+parity were in progress when read, both passed locally |
| L2 runner (local) | 87 passed, 3 engines x 3 adapters, seeded wrapper defects reported |
| ARIA + CDP (local) | 42 passed, 24 skipped with reason (CDP on Firefox/WebKit), IME composition fixture passes |
| Text safety (local) | 90 passed, seeded `innerHTML` fails as required |
| a11y release lane (local) | 123 passed; axe `target-size` explicit; triage empty and valid |
| Supports paths (local) | 804 passed: 11 paths (native plus ten forced-false) x 3 adapters x 3 engines; injection proven by read-back |
| Parity (local) | PASS: 1,848 cells, 792 executed, 1,056 declared `not run` with ADR-013 reasons, 0 missing |
| Visual (local, darwin) | 36 passed; self-test: seeded 1 px fails; `verify` catches a hand-edited PNG; `--update all`, `*`, `''` refused |
| Live MCP | 10 tools listed; `get_component SJNope` returns `isError` with the known names and "do not invent one"; the three `$id` schema URLs return 200 `application/json` |

## Seeded defects (all caught unless stated)

Schema: `a11y` removed (path `/a11y`), NVDA `tested-real` (`at` const), VoiceOver `tested-real` without `log`, wrong `$schema` URL. Codegen: edited generated file ("differs"), stale file ("no contract produces it"). Evidence: stale `next_review`, dangling ref, `focusStrategy` conflict, TalkBack entries removed (coverage). AT registry: 7-month review window, T3-only `supportedBy`. Honesty: NVDA "tested and verified" sentence, NVDA `tested-real` in a contract, VoiceOver claim with no `tested-real` entry. Skips: `it.skip` without reason. Registry drift: committed `registry.json` status flipped. Stylelint: raw hex, raw px, raw duration, `outline: none`, physical property (6 errors). CSS build: rule outside an `sj.*` layer. Contrast: slate-500 lightened (muted floor and matrix both fail, naming pair, ratio and token). Contract lint: unknown kind; seeded deny-list digest matches. Parity: one result removed (1 missing, FAIL); a `*diagnose*` file refused. Visual: 1 px, tamper, update-all.
**Not caught, by design of the check (findings below):** a skip with a `skip-reason:` comment but no issue and no owner passes (SHOULD-2); `contract:lint` without `--require-denylist` passes with the scan unconfigured (SHOULD-4).

## Status per task

| Task | Status | Verified how |
|---|---|---|
| W1-201 CSS build | Pass | Layer string verbatim in `build.mjs`; `index.css` from a glob; build throws on an unlayered rule (seeded); consumer-wins and reset-caveat fixtures in `test/build.test.js` |
| W1-202 stylelint | Pass, SHOULD-3 | Six `sj/*` rules fail on seeds; tree scan clean in `packages/` and `apps/site`; `apps/storybook` still loads Google Fonts in 24 files and is outside the scan |
| W1-203 contrast | Pass, SHOULD-5 | 4 x 6 x 3 matrix from the token source; seeded token fails with pair, ratio, token; the "one shared luminance implementation" is not yet imported by the tokens test, the worker `check_contrast` or `TokenPicker.vue` (three own copies remain) |
| W1-204 base styles | Pass | Chromium probes for targets, ring area and contrast, `data-active`, forced-colors, reduced motion, RTL, `svh`/`dvh`, contain, in the vitest gate; 48 dp advisory only (no token) |
| W1-205 template | Pass | Generator requires a contract and compares parts with `anatomy[].part`; seeded mismatch fails; probe uses `sj-probe__<part>` exactly |
| W1-301 schema | Pass | Required fields, `$schema` const, `tested-real` rules, `tested_on`/`log` forbidden otherwise, `evidence: []` only for pending; validator adds uniqueness, machine and part naming, AT pairing, real dates |
| W1-302 shake-out | Pass | Six gaps found and fixed before any composite; `button` and `switch` validate |
| W1-303 kinds | Pass | 31 kinds, rules, certification scenarios; `kinds.schema.json`; drift guard against the core table |
| W1-304 codegen | Pass | Deterministic, prettier-formatted; `--check` in `contracts:check` and CI; drift and stale seeds fail; reducer equivalence with seeded failures; one types file per adapter |
| W1-305 registry | Pass, ruling (b) | `buildRegistry` from contracts; verbatim `test_status`; drift check on built and committed copies (seeded); three schema URLs served and resolve live |
| W1-306 MCP | Pass | `list_components`, `get_component`, `get_kind` read only from the registry; exact match, not-found with known names; property test "never an invented entry"; live endpoint confirms |
| W1-307 contract lint | Pass, SHOULD-4 | Rules with pass/fail fixtures; worker `lint_css` appends contract findings; deny-list hashed, seeded term fails; digests not provisioned so the scan is inert in the gate and in CI |
| W1-308a spec derivation | Pass | Pure, deterministic (snapshot, fast-check over authoring order); `disabled` fixture convention (NICE-2) |
| W1-308b reducer harness | Pass | Model-based sequences over the real kernel; seeded reducer and kernel defects caught; auto-discovery of `reducer.ts` |
| W1-309a runner | Pass | `retries: 0` with diagnose-file separation; focus target and IDREF assertions; 3 x 3 matrix; seeded wrapper defects |
| W1-309b supports | Pass | Eleven paths, injection proven by read-back, noop annotation when the engine lacks the capability |
| W1-309c ARIA | Pass | One YAML per state shared across adapters and engines; CDP AX tree on Chromium; CDP IME composition with the guard-off seed |
| W1-310 a11y | Pass | axe per state with explicit `target-size`; 2.4.11, 2.4.13, 2.5.7, 2.5.8 per PR; 3.3.7, 3.3.8, 3.2.6 per release; each with pass and seeded-fail fixtures; triage needs issue and owner |
| W1-311 text safety | Pass | 90 cases, seeded `innerHTML` fails on all adapters |
| W1-312 visual | Pass, SHOULD-1 | Hermetic, production fonts with `font-display: block`, byte-stable twice, no update-all, hash-to-review-log integrity; Linux baselines pending human review, so CI prints NOT RUN loudly instead of comparing |
| W1-313 parity | Pass | Generated from results plus a declaration; missing cell fails; retried file refused |
| W1-314 CI | Pass, SHOULD-2 | Every ADR-013 per-PR gate has a job except visual diffs (NOT RUN until Linux baselines) and the skip rule (reason accepted without issue and owner); seeded defects fail the static jobs (my seeds); affected selection is path-level until components exist |
| W1-315 AT schema | Pass | Field table, `impact` iff observation, review window, T1/T2 rule, `atEvidence` observations, no-measured-evidence contradiction (R3 follow-up); seeds fail |
| W1-316 probe | Pass | Two-state switch-like contract reusing the `switch` registry; all five tools accept it by path; through L1, L2, L3, L5, L6 on all three adapters |
| W1-317 evidence | Pass | Staleness, dangling ref, decision conflict on `recommended` and referenced entries, pattern coverage over the five primary pairs; nothing pending |
| W1-318 wiring | Pass | `at-wording.mjs` single source; `statement` per row in codegen, registry, MCP and `llms-full.txt`; `tested-real` renders only from its own date and log |
| W1-319 honesty | Pass, NICE-3 | Data and sentence rules; seeds fail; audits exempt by policy; built output not scanned |

## Rulings

**(a) Schema freeze.** `contract.schema.json` v1 and `kinds.schema.json` v1 are frozen at G2. Two of S-CON's deliberately unenforced rules become part of v1 now, because all three existing contracts (button, switch, probe) already satisfy them and the cost rises with every composite: `state.controllable` must be a subset of `props[].name`, and every `actions[].emit` must name an entry of `events[]`. `pattern.evidence` becomes required. The ADR-010 sample is corrected to satisfy these (add `open` and `value` props, the `openChange` event, `"evidence": "select-only-combobox"`), which is the same kind of dated ADR edit G1 made. After this, any schema change is a broadcast event (plan section 9) and needs a G-gate ruling. Left open on purpose: the `keyboard` vocabulary stays free strings (the spec derivation already separates movements from actions), and `runtime` stays the closed five-name enum.

**(b) Root `registry.json`.** The plan row W1-305 says no root `registry.json` is written; the build regenerates the committed root copy and the drift check compares both the built and the committed file. Keep it: the published docs, `llms.txt` and AGENTS.md point at the root copy, and CI proves it never drifts (my seed on the root copy failed the check). Amend the W1-305 cell to "the root copy is regenerated by the build and checked for drift".

**(c) S-CSS decisions accepted.** Focus ring and reduced-motion net live in `sj.state` (last layer wins, proven against a component `box-shadow`); `compact` density is the 24 px floor reverting to 44 px under `any-pointer: coarse`; the contrast `RECIPE` is the canonical `variant x tone` pairing until `sj.variant` CSS exists, when an extractor from the built CSS must replace it (NICE-1). 48 dp stays advisory until the owner adds a `--target-comfortable` token.

**(d) Test-infrastructure decisions accepted.** React omits the fresh client pass in SSR (G1 R2); CDP specs skip with reason on non-Chromium; WebKit on Linux is Playwright's build and the reports say so; a11y 2.4.11 is strict (any obscured sample fails); native unstyled checkboxes get no user-agent target-size exemption; visual scenes are static markup (adapter parity is L2's).

## Findings

### SHOULD (before the first M4 component PR)

- **SHOULD-1. Linux visual baselines.** CI's visual job cannot compare anything until reviewed `*-linux-*` baselines are committed; it says NOT RUN loudly, which is honest, but the ADR-013 per-PR gate "deterministic visual diffs reviewed" is not enforced on any PR today, and M4 PRs change pixels. Action: dispatch `visual-baselines.yml`, a person reviews every PNG, commits them with the REVIEW-LOG; the job then runs `test:visual` strict. Owner action, already scheduled in CLOSE-M3.
- **SHOULD-2. Skip check is weaker than ADR-013.** ADR-013: "no skipped test without issue and owner". `scripts/skip-check.mjs` accepts a reason string or a `// skip-reason:` comment alone (seeded: passes). The two existing skips carry reasons but no issue or owner. Correction: require an issue reference on every skip (reason optional), and an owner (`@handle` or `owner:` in the same comment); keep the self-test and update the two existing skips.
- **SHOULD-3. Remote fonts in `apps/storybook`.** 24 files load Google Fonts and Material Symbols; ADR-009 and the BRIEF name remote font imports as a defect, and W1-202's acceptance reads "no remote font anywhere in the tree". The scan excludes `apps/storybook`. Correction: self-host the families under `.storybook/` as S-CSS proposed, then widen the scan to the whole tree so it cannot regress.
- **SHOULD-4. Deny-list digests not provisioned.** The scan works (seeded digest caught) but runs as "not configured (skipped)" in the gate and in CI; `--require-denylist` is not passed. BRIEF constraint 1 is therefore unenforced. Correction: the owner provisions `RAMOSLABS_DENYLIST_SHA256` as a CI secret (or commits digests to `denylist.sha256`), and both `contract:lint` in the gate and the CI step pass `--require-denylist`.
- **SHOULD-5. One WCAG luminance implementation (W1-203 acceptance, G0 NICE-6).** `packages/testing/contrast/wcag.js` exists, but `packages/tokens/test/tokens.test.ts`, `apps/site/worker/index.ts` (`check_contrast`) and `apps/site/src/components/TokenPicker.vue` keep their own copies (one with the 0.03928 threshold). Correction: import the shared module in all three; the worker already bundles testing modules by relative path.
- **SHOULD-6. Schema freeze changes from ruling (a)**: the two subset rules and required `pattern.evidence` in `validate.mjs`/schema with seeded failures, and the ADR-010 sample corrected, in one PR.

### NICE

- **NICE-1.** When `sj.variant` CSS lands, add the extractor so the contrast matrix reads pairs from the built CSS instead of `RECIPE`.
- **NICE-2.** The `disabled` fixture convention (`INERT_FIXTURE`) is a string match; record it in the ADR-010 consumers paragraph rather than adding a schema field.
- **NICE-3.** The honesty scan reads sources, not built output; add a scan of `apps/site/dist` (`llms-full.txt`, `registry.json`) to the size-and-drift job, which already builds.
- **NICE-4.** Add the cheap `fallback:all` path (every capability false) to the supports injector; ADR-013 asks for one per capability, this adds the floor-like combination for free.
- **NICE-5.** Actions `checkout@v4`, `setup-node@v4`, `cache@v4`, `upload-artifact@v4` warn about Node 20 deprecation; bump when the v5 lines are adopted.
- **NICE-6.** The a11y 2.5.7 gate fails when a page has no drag candidates; document the `data-sj-drag*` and `data-sj-help` markers in the component authoring template so M4 authors cannot miss them.

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| SHOULD-1 | SHOULD (owner) | `visual-baselines.yml`, `packages/testing/visual/baselines` | Generate, review and commit Linux baselines; CI then compares |
| SHOULD-2 | SHOULD | `scripts/skip-check.mjs` | Require issue and owner on every skip |
| SHOULD-3 | SHOULD | `apps/storybook`, stylelint tree scan | Self-host fonts; scan the whole tree |
| SHOULD-4 | SHOULD (owner) | CI secret, `gate`, `ci.yml` | Provision digests; pass `--require-denylist` |
| SHOULD-5 | SHOULD | tokens test, worker, `TokenPicker.vue` | Import `contrast/wcag.js` |
| SHOULD-6 | SHOULD | `contract.schema.json`, `validate.mjs`, ADR-010 sample | Freeze with the two subset rules and required `pattern.evidence` |
| NICE-1..6 | NICE | as listed | as listed |

Re-audit: none. SHOULD-2, 5 and 6 are verified file-level in their PRs; SHOULD-1, 3 and 4 are owner actions reported in the first M4 gate (G3A).

G2-AUDIT DONE
