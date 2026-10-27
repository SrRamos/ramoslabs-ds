# RamosLabs component library: wave 1 implementation plan

Status: revision 1 for audit (answers [audits/AUDIT-plan.md](audits/AUDIT-plan.md); see [CHANGELOG-PLAN-R1.md](CHANGELOG-PLAN-R1.md)).
Source of truth: [ARCHITECTURE.md](ARCHITECTURE.md) (14 ADRs plus ADR-015, revised ADR-010, ADR-013 and Section 2) and [BRIEF.md](BRIEF.md).
Scope: the eleven components of Section 4 plus everything they need. Date: 2026-10-27.

## 0. Owner decisions and conventions

| # | Decision | Effect on this plan |
|---|---|---|
| D1 | Keep the floor Chromium 114 / Firefox 125 / Safari-iOS 17 (ADR-001 option B, the owner table's option A) | Geometry fallback, close tiers, `:user-invalid` fallback, `<details name>` fallback and the floor lane stay in scope. |
| D2 (resolved, ADR-015) | Real AT testing on **VoiceOver only**: macOS + Safari and a physical iPhone + Safari. NVDA, JAWS, TalkBack are `evidence-only` (implemented from the registry at `docs/architecture/evidence/at-support/`, never labelled tested). Optional later NVDA lane on the owner's Windows PC. No JAWS licence, no Android or iOS 17 floor device. | Device tasks are VoiceOver macOS and iPhone only. Android, JAWS and NVDA device tasks are removed. The floor real lane is desktop Chromium 114 plus Firefox 125. iOS 17 and Android-floor rows are reported `not run` (ADR-013), covered by forced-false path parity and evidence. |

Everything except the VoiceOver sign-off (W1-512, W1-513) proceeds before the owner's devices are used.

Conventions.
- **Layers** are the six of ADR-013: L1 unit/invariant, L2 interaction (3 engines x adapter), L3 axe plus WCAG 2.2 gates, L4 real-AT manual (VoiceOver only), L4b evidence gate (ADR-013 4b), L5 visual, L6 parity. **PRG** = the per-PR gate list of ADR-013 "Gates".
- **Models:** `haiku` mechanical; `sonnet` implementation; `fable` audit gates only.
- Git follows the user workflow: a `feature/<slug>` branch and a worktree per stream, rebased on updated `main`, pushed autonomously; PR and merge are the owner's. This plan runs no git commands.
- No prior-brand names or prefixes in any produced file (BRIEF constraint 1); enforced by a deny-list scan in W1-307.
- **Shared-file rules (single writer or pre-stub).** Barrels, `exports` maps, the css full file, generated types and `registry.json` are generated or pre-stubbed. Generated files are regenerated after a rebase, never merged by hand. `bun.lock` is never merged by hand: after a rebase run `bun install` and commit the regenerated lockfile.
- Ownership of the AT registry: files under `docs/architecture/evidence/at-support/` are produced by the research peer; this plan only validates and consumes them (W1-315, W1-317). Until they land, tests use fixtures under `packages/testing/fixtures/at-support/`.

---

## 1. Milestones and dependency order

```
M0 foundation --> G0 --+--> M2 CSS (S-CSS) ------------+
                       +--> M3a contracts/wiring (S-CON)+--> G2 --+
                       +--> M1 kernel K1..K5 --> W1-115 |         |
                              --> W1-120/121/122 ------>+         v
                              --> W1-308b, W1-309*, W1-316 --> G2   M4 --> G4 --> G5
                              --> G1 ----------------------------->
```

Start rules, stated as data.
- At G0: S-CSS (M2), S-CON (W1-301..303, 305..307, 315, 317..319), W1-308a, and K1..K5 begin.
- W1-304 (codegen) waits for W1-112b, W1-301, W1-303.
- **S-TEST (W1-308b, W1-309a/b/c, W1-310..313) starts only when K1 (W1-101..104), W1-114 and W1-120..122 are merged.** Before that, only W1-308a (pure data) runs.
- W1-316 (probe) needs W1-120..122, W1-301, W1-201.
- M4 starts when G1 and G2 pass. M5 preparation tasks start as soon as the harness exists.

---

## 2. M0 Repo foundation

Current state: bun@1.3.5 plus Turbo; `packages/tokens` works; `packages/vue` is a 0.0.0 scaffold with peer `^3.4.0`; `apps/site` generates `registry.json`, `llms.txt`, `llms-full.txt` at build via `agentic/integration.ts` (`buildRegistry`, `components: []`); the worker serves MCP; root has Turbo `lint` and `typecheck` scripts but no real lint config, format, tests, CI workflow or hooks; `apps/storybook` exists and Turbo lint includes it (exclude or configure it in W1-001). `.github/` holds only assets.

Root script names (all created by W1-001): `lint`, `format`, `format:check`, `typecheck`, `test`, `test:e2e`, `build`, `size`, `contracts:check`, `evidence:check`, `gate`.

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-001 | **Sole owner of root `package.json` and `turbo.json`**; declares every P0 devDependency up front (eslint, prettier, stylelint, vitest, fast-check, lefthook, @changesets/cli) plus the `prepare` script that installs hooks; ESLint flat config, Prettier, stylelint root config; storybook handled | root configs | none | `lint` and `format:check` exit 0 clean and non-zero on a seeded violation, per package via Turbo; no other P0 task edits a root file (lint plus format check both required, CONTRIBUTING) | PRG | sonnet |
| W1-002 | Vitest workspace, jsdom-free by default, coverage | `vitest.workspace.ts`, `packages/*/vitest.config.ts` | W1-001 | `test` runs in every package; a core test touching `document` at import fails (ADR-002); fast-check usable (ADR-013 L1) | L1 | sonnet |
| W1-003 | CI workflow, first version: lint, format check, typecheck, unit, build, size; frozen lockfile | `.github/workflows/ci.yml` | W1-001, W1-002 | Fails on seeded lint, format, type, test error; no `continue-on-error` (ADR-013 flaky-is-failure) | PRG | haiku |
| W1-004 | Commit hooks: lint-staged and conventional-commit check | `lefthook.yml` | W1-001 | Bad format or message rejected locally; no runtime dependency (Section 1.2 principle 3) | PRG | haiku |
| W1-005 | Scaffolds per ADR-002: `css`, `core`, `contracts`, `testing` (private), `react`, `vanilla`; vue peer raised to `>=3.5.0`; pre-stub `core` subpath `exports`, each adapter's per-component entries, and the **full `testing` devDependency set** (playwright, axe, fast-check, guidepup); `testing` exports `./lint`, `./size`, `./contrast`, `./spec`, `./e2e` | `packages/*/package.json` and stubs | W1-001 | Every package builds, typechecks, lints; `core` has zero `dependencies`; peer ranges `react >=18`, `vue >=3.5.0` (ADR-002); changesets lockstep config (ADR-002) | PRG | haiku |
| W1-006 | Boundary and hygiene lint in `testing/lint/boundaries/`: (1) `core` imports no `vue`/`react`/DOM global at module scope; (2) adapters never import CSS; (3) presets import only public primitives; (4) adapters touch the store only through `<pkg>/src/runtime`; (5) an adapter `addEventListener` must carry the instance `AbortController` signal; (6) `wheel`/`touch*`/`pointer*` listeners must be `passive` or call `preventDefault` | `testing/lint/boundaries/**` | W1-005 | Each rule has a seeded failure and a clean pass (ADR-002 consequences, ADR-004, ADR-003 bridge, ADR-011 Rules: passive listeners, direct listeners, observers disconnected) | L1, PRG | sonnet |
| W1-007 | Size harness: pinned bundler, min+gzip and raw bytes, import graph, 0 KiB unused-component fixture. `budgets.json` holds **only shared-kernel rows** (store 1, overlay 4, collection 3, live 1, kinds 2, fixture 0 KiB); component ceilings are read from each contract's `budgets` block (ADR-010) | `testing/size/**`, `budgets.json` | W1-005 | Reports every ADR-011 row; seeded oversize fails; adapters reported separately, peer code never counted; raw bytes and graph included (ADR-011) | PRG | sonnet |
| W1-008 | New tokens first: touch target 44 px, focus ring width/offset, control text minimum 16 px, overlay sizing caps, scroll-margin, hairline | `packages/tokens/src/tokens/**` | none | Appear in generated CSS/TS/JSON; tokens build passes; `check_contrast` still passes (ADR-009, risk 11) | PRG | sonnet |
| W1-009 | Evidence scaffolding **excluding `at-support/`**: clean-room notes template (ADR-004), dated AT issue log template (ADR-006), manifest schema with per-AT `test_status` and registry snapshot (ADR-013), floor-device registry | `docs/architecture/evidence/{clean-room,issue-log,manifest,devices}/**` | none | Every ADR-013 manifest field and ADR-006 issue-log field present; manifest schema has `not run` status with reason | none | haiku |

**Gate G0 (fable)** blocks everything after M0. The G0 audit also records the editorial line widening the ADR-002 `testing` Role cell to "spec runner, fixtures, lint rules, size and contrast tooling" in the architecture changelog.

---

## 3. M1 Core kernel and adapter runtimes

Each module is its own `packages/core/src/<module>/` directory (single owner) and runs W1-007 for its ceiling.

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-101 | Snapshot store: stable `getSnapshot`/`subscribe`, no-op dispatch returns same snapshot, deduped subscribe, idempotent `destroy`, no module-scope stores | `core/src/store/**` | W1-002, W1-007 | <= 1 KiB (ADR-011); 1,000 create/destroy retain 0 stores/listeners (ADR-011 gate); StrictMode double invocation safe (ADR-003) | L1 | sonnet |
| W1-102 | Ids: base id plus suffixes, item ids from keys, sanitized map for `anchor-name`, `CSS.escape` | `core/src/ids/**` | W1-002 | Same input gives same ids regardless of mount order or filtering; no counters/random/time/index (ADR-003) | L1 | sonnet |
| W1-103 | `createRuntime(config)`: locale, dir, idPrefix, idFactory, density, `supports`, scheduler; server defaults all-false and fake scheduler | `core/src/runtime/**` | W1-101 | Runtimes isolated; server defaults equal serialized client values; no `navigator`/`documentElement` reads; contract lists `runtime` provenance (ADR-003) | L1 | sonnet |
| W1-104 | Effects: versioned descriptors, post-commit drain queue, stale and missing-target drop, no synchronous re-dispatch, native-open-before-focus | `core/src/effects/**` | W1-101 | Fast-check invariants incl. stale effects and removed targets (ADR-003, ADR-013 L1); single drain hook exposed | L1 | sonnet |
| W1-105 | Prop-merge: library ARIA/role/ids win, class/style concatenate, consumer-then-library handlers with `defaultPrevented` cancel, dev warning | `core/src/merge/**` | W1-002 | A spread cannot override role, ids, IDREFs, state-derived `aria-*` (ADR-004); table tests per rule | L1 | sonnet |
| **W1-115** | **Controlled/uncontrolled pipeline**: `getProps()` read at derive and transition time; controlled props overlaid on the derived view, never copied into reducer state; native events report actual native state; corrective post-commit native effect when a controlled `open` stays true after native Escape (no re-dispatch); dev throw on ownership switch after mount | `core/src/controlled/**` | W1-101, W1-104, W1-105 | Four fixtures, one per rule above (ADR-003 "Controlled/uncontrolled"); reducer state never contains a controlled value; deterministic across repeated runs (ADR-012 determinism list) | L1 | sonnet |
| W1-106a | Collection kernel: data-first collection, key-to-id map, registration, deterministic successor on removal (focus never to `<body>`) | `core/src/collection/**` | W1-101, W1-102, W1-104 | Successor property test over random removals (ADR-013 L1); virtual items mount before `aria-activedescendant` is written (ADR-003); counts toward the 3 KiB collection + focus ceiling (ADR-011) | L1 | sonnet |
| W1-106b | Focus kernel: roving and activedescendant strategies, `data-active` in every composite, one `focus({preventScroll})` plus one `scrollIntoView`, focus scope and return (opener reference; connected, visible, enabled, not `inert`, else declared fallback) | `core/src/focus/**` | W1-106a | ADR-006 strategy table encoded; a component declaring both strategies throws; every active id resolves to an owned element and resets before unmount; 106a + 106b <= 3 KiB (ADR-011) | L1 | sonnet |
| W1-107 | Typeahead and IME sub-entry: normalize, trim/collapse, locale case folding, cycling prefix match, diacritics kept; `isComposing` plus session flag; `beforeinput` for editable, `keydown` for non-editable | `core/src/typeahead/**` | W1-106b, W1-103 | Deterministic next-match and wrap (ADR-012); no filter or accept during composition (ADR-006); Android `keyCode 229` covered by a `beforeinput` fixture; **bytes count toward the 3 KiB collection + focus ceiling; a miss is reported to W1-113 for an ADR amendment, the task never passes by reclassifying bytes** (ADR-011) | L1 | sonnet |
| W1-108 | Placement: parser of `position-area`, `position-try-fallbacks`, `position-try-order`, `position-visibility`; candidate evaluator in declaration order; read-compute-write scheduler (fallback only, commit-ordered); `visualViewport` keyboard handling | `core/src/overlay/placement/**` | W1-101, W1-103, W1-104 | Pure function of rectangles; no independent `requestAnimationFrame` (ADR-005 step 4); inactive when native anchor positioning is supported (step 3); exact compiled subset, no inference from Baseline (Section 2) | L1 | sonnet |
| W1-109 | Overlay behavior: nested stack synced from `toggle`/`close`, opener reference, Escape order, close tiers (`requestClose()` >= Chromium 134 / Safari 18.4, else cancelable `cancel` plus `close()`), capture `pointerdown` dismissal only when native light dismiss is absent, static `listboxMount` flag by `any-pointer` class | `core/src/overlay/behavior/**` | W1-108, W1-106b | The five ADR-005 step-5 rules are fixture dimensions; both tiers reach one close operation (step 7); no user-agent sniffing or `aria-owns` workaround (step 8); 108 + 109 <= 4 KiB (ADR-011) | L1 | sonnet |
| W1-110 | Placement parity oracle: identical rectangles to the reference evaluator and the fallback | `core/src/overlay/__parity__/**`, `testing/parity-geometry/**` | W1-108 | Identical candidate, offset, visibility over a versioned fixture set incl. flip-block, flip-inline, named `@position-try`, most-height, anchors-visible (ADR-005 step 2) | L1, L6 | sonnet |
| W1-111 | Live-region registry: persistent `status`/`alert` nodes per runtime document, client-only, dedupe, no duplicate of active-descendant moves | `core/src/live/**` | W1-103 | <= 1 KiB; SSR emits no live-region markup (ADR-006); `alert` only by explicit option | L1 | sonnet |
| W1-112a | `resolveKind(kind, ctx)` over a typed table (generated in W1-304) and form-owner `enterkeyhint` computation | `core/src/kinds/**` | W1-002, W1-103 | Every ADR-007 row resolves exactly; textarea kinds fixed to `enter` and excluded from position; no `maxlength` ever emitted; unknown kind is a type error (ADR-007) | L1 | sonnet |
| W1-112b | Owned locale number parser (separate sub-entry): both separators with grouping rule, signed amount accepts `-` and `−`, leading zeroes preserved | `core/src/number/**` | W1-112a | Both directions for de, en, es, fr, pt and an Arabic-numerals fixture; never `parseFloat`; 112a + 112b <= 2 KiB (ADR-007, ADR-011) | L1 | sonnet |
| W1-113 | Kernel measurement report vs ADR-011 ceilings; draft ADR amendments for any miss (no ceiling +50% without design review); **receives W1-109 last** | `evidence/kernel-sizes.md` | W1-101..112b, W1-115, W1-120..122 | Measured vs ceiling per module, raw bytes, graphs (ADR-011 revision measurement, Q2) | PRG | sonnet |
| W1-114 | SSR determinism runner: render twice (server then client), compare ids and full IDREF graph; **vanilla run uses an injected `idFactory`**; multiple roots with different `idPrefix` | `testing/ssr/**` | W1-102, W1-103 | Equal ids and IDREF graph; no collision across roots (ADR-003, ADR-013 PR gate) | L1, PRG | sonnet |
| **W1-120** | **React runtime**: `SJProvider`, `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` bridge, stable identities, effect drain in `useLayoutEffect` (native open, focus, geometry) and `useEffect` (announcements) | `react/src/runtime/**` | W1-101, W1-103, W1-104, W1-115 | ADR-003 bridge row; outside a provider: default plus dev warning; 1,000 mount/destroy retain nothing; StrictMode double invocation safe | L1, L2 | sonnet |
| **W1-121** | **Vue runtime**: `SJProvider` via `provide`, `shallowRef` snapshot replaced only on changed dispatch, `markRaw` registries, subscription in an effect scope, drain in `watch(...,{flush:'post'})`, native effects after mount | `vue/src/runtime/**` | same as W1-120 | ADR-003 bridge row; effect scope disposed on unmount; 1,000 mount/destroy retain nothing; fallback plus warning | L1, L2 | sonnet |
| **W1-122** | **Vanilla runtime**: `mount(el, runtime)`/`update`/`destroy`, one `AbortController` per instance, post-patch microtask drain, browser APIs only after mount | `vanilla/src/runtime/**` | same as W1-120 | ADR-003 bridge row; every listener carries the instance signal; destroy aborts all; 1,000 mount/destroy retain nothing | L1, L2 | sonnet |

**Gate G1 (fable)** covers W1-101..115 and W1-120..122; blocks M4.

---

## 4. M2 CSS layer

Depends on M0 (W1-008). Runs in parallel with M1 and M3.

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-201 | CSS build: `@layer sj.reset, sj.base, sj.component, sj.variant, sj.state;`, per-component files, **the full file generated at build time from a glob of `css/src/*.css`** (never hand-edited), `sideEffects` only here | `css/src/**`, `css/package.json` | W1-005, W1-008 | Layer string verbatim (ADR-009); unlayered consumer CSS overrides all `sj.*` in a fixture; consumer-reset caveat documented (risk 9); adding a component CSS file edits no shared file | PRG | sonnet |
| W1-202 | Stylelint rule in `testing/lint/stylelint/`: raw hex, raw px (documented hairline/zero tokens only), non-token durations, `outline: none` without replacement, remote `@import`/`@font-face` URLs | `testing/lint/stylelint/**` | W1-001, W1-008 | Seeded violations fail; no remote font anywhere in the tree (ADR-009, BRIEF defects) | PRG | sonnet |
| W1-203 | Build-time contrast matrix, **light theme only**, every `variant x tone x size` text pair >= 4.5:1, UI and focus >= 3:1 | `testing/contrast/**` | W1-008 | Seeded token change fails with pair, ratio, token (ADR-009, ADR-013); muted text never below slate-500 on white (AGENTS.md) | PRG | sonnet |
| W1-204 | Base styles: focus ring (2.4.13 area, 3:1, drawn from `data-active` and `:focus-visible`), 44 px targets with 24 px floor and a 48 dp check, no overlapping pseudo-element hit areas, `touch`/`compact` density, 16 px control text, reduced-motion, logical properties and RTL, `svh`/`dvh` first and `interactive-widget` (ADR-005 step 9), `contain` that never clips focus; **forced-colors checked as an L3/L5 fixture under `forced-colors: active` emulation** | `css/src/base/**` | W1-201, W1-008 | Indicator area and contrast assertions in a probe fixture (ADR-013 L3); forced-colors fixture renders visible focus and borders (Section 2); motion collapses under reduced-motion (ADR-009); ADR-008 touch preset | L3, L5 | sonnet |
| W1-205 | Authoring template and generator for `sj-<c>__<part>`, `data-part`, `data-state`, `data-active`, `data-disabled`, `data-invalid` | `css/src/_template/**` | W1-201; W1-301 (contract name check only, template may land earlier) | Names match contract `anatomy[].part` (ADR-002, ADR-009) | PRG | haiku |

---

## 5. M3 Contracts, wiring, evidence and test infrastructure

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-301 | `contract.schema.json` v1: the ADR-010 example fields plus the revised `a11y` block listing per-AT entries (`at`, `platform`, `evidence: <file>#<id>`, `test_status`, `tested_on`, `log`); validator CLI. `tested-real` requires `tested_on` and a log reference | `contracts/contract.schema.json`, `contracts/scripts/validate.*` | W1-005 | ADR-010 sample validates; each required field removed fails with a path; `tested-real` without date or log fails; `$schema` URL as ADR-010 | PRG | sonnet |
| W1-302 | Schema shake-out contracts first: `button` and `switch` drafts, then fix the schema | `contracts/button.contract.json`, `contracts/switch.contract.json` | W1-301 | Both validate; schema gaps list written; changes made before any composite contract (risk 6) | PRG | sonnet |
| W1-303 | `kinds.contract.json` and `kinds.schema.json` | `contracts/kinds.*` | W1-301 | Every ADR-007 row and note present (`otp-alnum`, `amount-signed`, `cc-exp*`) | PRG | sonnet |
| W1-304 | Codegen into **`src/generated/<module>/` only** (owner: this task): state tables, keyboard maps, ARIA tables, `kind` union, per-component **types file** (props, events, slots) and the barrels; equivalence check reducer events == contract `actions`; kinds table compared with W1-112a | `core/src/generated/**`, `<adapter>/src/generated/**` | W1-301, W1-303, W1-112b | Deterministic, clean-tree check in CI; mismatch fails (ADR-010 consumers); one source for keyboard map in code and tests (ADR-006); types file generated (ADR-004 "one types file") | L1, PRG | sonnet |
| W1-305 | Registry from contracts: `apps/site` gains a dev workspace dependency on `@ramoslabs/contracts`; `buildRegistry` in **`apps/site/agentic/integration.ts`** fills `components` (name, status, anatomy, roles, keyboard, kinds, support floor, per-AT `test_status` with evidence refs, doc links); the same integration emits `/schema/contract.v1.json`. No root `registry.json` is written | `apps/site/agentic/integration.ts`, `apps/site/package.json` | W1-301 | CI compares the built `registry.json` with a fresh generation from the contracts and fails on drift (ADR-010); `$schema` URL resolves in the site build | PRG | sonnet |
| W1-306 | MCP `get_component`, `list_components`, `get_kind` (read-only, answers only from the registry), exposing per-AT `test_status` | `apps/site/worker/index.ts` (MCP block) | W1-305 | Tools listed; unknown name returns not-found; no invented values (ADR-010, ADR-015 honesty) | L1 | sonnet |
| W1-307 | Contract lint in `testing/lint/contract/`: unknown `kind`, preset using internals, missing label; worker `lint_css` block references contract parts/data-attributes; prior-brand deny-list scan. (Raw-value lint stays in W1-202.) | `testing/lint/contract/**`, worker `lint_css` block | W1-301, W1-306 | Pass and fail fixture per rule (ADR-010); scan fails on a seeded term | PRG | sonnet |
| W1-308a | Spec derivation (pure data): semantic actions from `actions`, `keyboard`, `focus`, `fixtures` | `testing/spec/derive/**` | W1-301 | Probe contract yields a deterministic action list (ADR-013 option B) | L1 | sonnet |
| W1-308b | Reducer harness: fast-check model-based sequences with disabled/removed items, controlled rejection, duplicate registration, stale effects | `testing/spec/reducer/**` | W1-308a, W1-101, W1-104, W1-115 | A seeded reducer defect is caught; one spec feeds L1 and L2 (ADR-013 L1) | L1 | sonnet |
| W1-309a | Playwright runner (Chromium, Firefox, WebKit), host pages for the three adapters, action executor; **`retries: 0` for any run feeding the manifest** | `testing/e2e/runner/**` | W1-308b, W1-114, W1-120..122 | Probe runs 3 engines x 3 adapters; assertions on focus target and IDREFs, not byte-identical DOM (ADR-013 L2; retries diagnose, never certify) | L2 | sonnet |
| W1-309b | `supports` injector: real detection plus each capability forced false; `path` recorded | `testing/e2e/supports/**` | W1-309a | Forced-false runs appear as distinct `path` rows (ADR-013 L6) | L2, L6 | sonnet |
| W1-309c | ARIA snapshots (`toMatchAriaSnapshot` YAML per state), CDP `getFullAXTree` on Chromium, CDP IME composition | `testing/e2e/aria/**` | W1-309a | Shared YAML per state; IME fixture drives composition on Chromium (ADR-013 L2) | L2 | sonnet |
| W1-310 | A11y gates: axe per state (zero untriaged, `target-size` explicit); 2.4.11, 2.4.13, 2.5.7, 2.5.8 per PR; 3.3.7, 3.3.8, 3.2.6 per release | `testing/a11y/**` | W1-309a | Each criterion has a pass and seeded-fail fixture; triage requires issue and owner (ADR-013 L3 table) | L3 | sonnet |
| W1-311 | Text-safety test on every adapter | `testing/text-safety/**` | W1-309a | Markup-like strings render as text; seeded `innerHTML` fails (ADR-002, ADR-013 L2) | L2 | haiku |
| W1-312 | Visual harness: hermetic, production fonts with `font-display: block`, baselines per `engine x platform x DPR`, reviewed updates only. Excludes `apps/storybook` | `testing/visual/**` | W1-309a | Byte-stable twice; no update-all command (ADR-013 L5) | L5 | sonnet |
| W1-313 | Parity matrix generator: `component / scenario / action / browser / adapter / path` with executed/passed/failed/not-applicable/not run, reasons | `testing/parity/**` | W1-309b | Generated from results only; missing cell fails (ADR-013 L6) | L6 | haiku |
| W1-314 | CI extension: sole owner of `ci.yml` and `e2e.yml`; jobs for size, contract/registry drift, contrast, SSR, e2e for affected components, a11y, visual review, skip-without-issue, evidence check (W1-317), honesty scan (W1-319) | `.github/workflows/ci.yml`, `e2e.yml` | W1-003, W1-307..313, W1-317, W1-319 | Every "Gates, every PR" item of ADR-013 has a job; each fails on a seeded defect; affected-component selection from changed paths | PRG | haiku |
| **W1-315** | **AT evidence schema and validation**: JSON Schema for the registry entry (all ADR-015 fields: pattern, at, at_version, browser, browser_version, platform, behavior, impact, source_url, source_date, retrieved, source_tier, decision, test_status, next_review) and validator over `evidence/at-support/*.json` (reconciled with any schema the research peer ships; this task is the single owner afterwards). Rules: `decision` needs a T1 source or two independent T2 sources; T3 alone never decides; `next_review` <= `retrieved` + 6 months; `tested-real` needs `tested_on` | `contracts/at-support.schema.json`, `contracts/scripts/at-validate.*`, `testing/fixtures/at-support/**` | W1-301 | Valid fixtures pass; seeded failures (missing field, T3-only decision, 7-month review window, `tested-real` without date) fail (ADR-015 rules of evidence, ADR-013 4b) | PRG | sonnet |
| **W1-316** | **Probe component**: `probe.contract.json`, two-state reducer, `probe.css`, one wrapper per adapter under `testing/probe/{react,vue,vanilla}/`; proves the whole harness | `testing/probe/**` | W1-120..122, W1-301, W1-201 | Runs through L1, L2, L3, L5, L6 on all adapters (ADR-013) | L1..L6 | sonnet |
| **W1-317** | **Evidence staleness and conflict CI check** (`evidence:check`): for every registry entry used by a contract, fail if `next_review` is before today; fail if a `decision` conflicts with the component's `focus.strategy` or `overlay.listboxMount`; fail if a contract's `evidence` ref does not resolve (`file#id`); **pattern coverage report**: each pattern a component uses has a registry file with an entry for every AT in the support matrix, unmapped patterns are returned to the research peer and block that component's `.a` | `testing/evidence/**` | W1-315, W1-301 | Seeded stale entry, seeded conflicting decision, dangling ref and missing-AT entry each fail (ADR-013 4b, ADR-015 Staleness, ADR-010) | PRG | sonnet |
| **W1-318** | **Contract `test_status` wiring**: codegen/registry/MCP carry per-AT `test_status`, `tested_on`, log ref; `docs/` generators print the permitted wording "implemented to documented evidence, not hands-on tested" for `evidence-only` entries | `contracts/scripts/**` (a11y block), site integration (a11y block), worker (a11y block) | W1-305, W1-306, W1-315 | Registry and MCP output expose `test_status` per AT and platform (ADR-010, ADR-015 Honesty); a contract with `tested-real` lacking evidence fails W1-301 | PRG | sonnet |
| **W1-319** | **AT honesty scan**: scans generated docs, `registry.json`, `llms*.txt`, MCP output for the labels "tested", "verified", "certified" attached to `evidence-only` ATs | `testing/honesty/**` | W1-318 | Seeded false label on an NVDA entry fails; VoiceOver `tested-real` entries with date and log pass (ADR-010 AT honesty gate, ADR-015) | PRG | haiku |

**Gate G2 (fable)** needs M2 plus M3: the probe component through all layers on all adapters, CSS gates failing on seeded breakage, schema frozen. Blocks M4.

---

## 6. M4 Components

### 6.1 Task template (six sub-tasks per component set)

IDs `W1-C<nn>.a` to `.f`. Gate blocking is data (6.3).

| Sub | Goal | Files | Depends on | Common acceptance | Model |
|---|---|---|---|---|---|
| .a | Contract plus core: contract (with `budgets` and `a11y` AT refs `file#id`), reducer, state table, getters, unit and invariant tests | `contracts/<c>.contract.json`, `core/src/<c>/**` | G1, G2, W1-317 coverage report clean for its patterns | Validates and equivalence passes (ADR-010); pure reducer, effects descriptors (ADR-003); getters pure (ADR-004); each pattern ref resolves and its registry `decision` is followed (ADR-015); `support[]` has `nativeFrom`/`fallbackUntil` (ADR-001); core within its ceiling (ADR-011) | sonnet |
| .b | CSS file | `css/src/<c>.css` | .a anatomy, W1-204, G3A | Token-only (W1-202); contrast matrix passes; 2.4.13 focus; forced-colors and RTL fixtures (ADR-009) | sonnet (haiku for Switch, Checkbox, Disclosure, State) |
| .c | Vue: flat `SJ<C>*` components and preset from public primitives | `vue/src/<c>/**` | .a, W1-121, G3A | Uses the shared runtime, never a local bridge (W1-006 rule 4); preset imports only public primitives (ADR-004); `classes` per-part overrides and prop-or-slot for label/hint/content (ADR-004); 1,000 mount/destroy retain nothing and effect scope disposed (ADR-011); one-component fixture within derived total | sonnet |
| .d | React: namespace object plus flat exports | `react/src/<c>/**` | .a, W1-120, G3A | Same shared-runtime, `classes`, prop-or-slot rules; StrictMode safe; 0 retained listeners (ADR-003, ADR-011) | sonnet |
| .e | Vanilla: `mount/update/destroy`, optional `sj-<c>` element in light DOM, explicit `define()` | `vanilla/src/<c>/**` | .a, W1-122, G3A | No import-time registration; text nodes only (ADR-002); FACE via `attachInternals()` only where needed (ADR-014); every listener carries the instance signal and `touch-action` is declared on every pointer-handling part (ADR-011 Rules); 1,000 cycles retain nothing | sonnet |
| .f | Conformance: fixtures, L2 matrix, ARIA snapshots, axe/WCAG, SSR, forced-false runs, bundle, visual baselines (human review), VoiceOver script hook, evidence check | `testing/specs/<c>/**` | .b, .c, .d, .e | PRG green; parity matrix has no empty cell (ADR-013 L6); contract `atAssertions` rendered into the W1-505 VoiceOver script; `evidence:check` green; every skip has issue and owner | sonnet (fixture data haiku) |

Inside a component .b, .c, .d, .e run in parallel after .a (the getters freeze is the sync point).

### 6.2 Components and component-specific criteria

Ceilings are per component (ADR-011): SJField 3 KiB (SJForm context inside it), SJInput 3 KiB. The fixture measured for ADR-011's "SJInput 6 KiB" is SJInput alone (3 + 1 + 2); the SJField + SJInput + SJForm fixture is reported in W1-511 and goes to an ADR amendment only if it matters.

| Group | Set | Kernel parts proven | Component-specific criteria |
|---|---|---|---|
| A | C01 `SJButton` (+ icon button, link variant) | Styling, contrast, target size, prop-merge | `data-variant/tone/size` map to tokens in `sj.variant` (ADR-009); target >= 44 px, 24 px floor (ADR-008); icon button without accessible name fails lint (ADR-010); link variant renders `<a>` (Section 1.2 principle 1); golden for CSS and adapter layout |
| A | C03s `SJSwitch` | Native-first, form participation | Real `<input>` underneath (Section 1.2 principle 1, ADR-008 rule 1, ADR-014); form state identical to a bare input in submit tests; no FACE in React/Vue (ADR-014); forced-colors visible; golden for native-input components |
| A | C03c `SJCheckbox` (after C03s.a; .b extends C03s.b) | Same, indeterminate | Native checkbox with `indeterminate` via property; same submit-equivalence test (ADR-014); ceiling 3 KiB |
| B | C02 `SJField` + `SJInput` + `SJForm` context. **.a1** SJForm + SJField (ids, IDREFs, error announcement); **.a2** SJInput (kinds in a rendered input, `:user-invalid` fallback) | Kinds, IDREFs, form-owner `enterkeyhint`, live region | Ids `-label/-hint/-error`, derived `aria-describedby`/`aria-invalid`, `aria-errormessage` only where tested (ADR-014); every ADR-007 row verified on a rendered input; owner computes `next/done/go/send/search` with textarea kinds excluded (ADR-007); Chromium 114-118 touched-state fallback via forced-false run (ADR-014, ADR-001); 3.3.7 prior values retained/offered; error announced once via the registry (ADR-006); no `type=number` for identifiers, no `maxlength` (ADR-007). **SJForm scope is exactly two duties** (Enter position from field order; retained values for 3.3.7) plus context plumbing, no validation orchestration or submission handling beyond native `<form>` (ADR-014). A minimal `form.contract.json` (root `form`, no state machine, `runtime`, `props`, `events`) ships with .a1 (ADR-010, BRIEF constraint 7) |
| B | C11 `SJState` | Live-region registry | Three empty kinds as distinct variants and copy slots (BRIEF); polite `status` for loading and counts, `alert` only for interruptions (ADR-006); no live markup in SSR; no color-only meaning (AGENTS.md) |
| C | C04 `SJRadioGroup` | Roving focus, collection, RTL | Roving per ADR-006 table; arrows follow DOM order and reverse in RTL; removal of the focused radio never lands on `<body>`; native radios underneath |
| C | C05 `SJTabs` | Collection, successor, keymap generation | Keyboard map generated from the contract (ADR-006, ADR-010); automatic and manual activation; Home/End, RTL; deterministic successor; panel ids from base id (ADR-003); core <= 3 KiB |
| C | C06 `SJDisclosure` | Native `<details>` ladder | Built on `<details>`; exclusive groups use `<details name>` with owned fallback on Chromium 114-119, Firefox 125-129, Safari 17.0-17.1 (Section 2) via forced-false run; no animation under reduced motion (ADR-009) |
| D | C07 `SJDialog` | `showModal()`, opener stack, close tiers, `inert` | `showModal()` only, never `show()` (ADR-005 step 1); explicit close control (step 6); focus returns per ADR-006 rules; both close tiers pass the same fixtures (step 7); 2.4.11 with sticky-header fixture (ADR-013); fixture total 3 + 1 + 4 = 8 KiB (ADR-011) |
| D | C08 `SJPopover` | Placement contract, geometry parity, Escape/nesting | Popover `auto`, no trap (ADR-006); native placement above each property floor and geometry below, each as its own L6 path (ADR-005 step 3); popover-over-dialog and dialog-from-popover Escape fixtures (step 5); fixture <= 8 KiB |
| D | C09 `SJTooltip` | Focus/hover/Escape, manual stack, touch policy | Focus and hover, Escape, hoverable, persistent (ADR-006); `popover="manual"` with engine stack (ADR-005 step 1); touch reachability without hover (ADR-008); fixture <= 8 KiB |
| E | C10 `SJSelect`. **.a1** native preset plus touch equivalence test; **.a2** custom listbox compound | Active-descendant, typeahead, IME, `listboxMount` | Native `<select>` default; on `(any-pointer: coarse)` native is rendered when accessible name, value and form state are identical (ADR-008 rule 3); custom needs a `customRequires` capability (rule 2); select-only combobox with DOM focus on trigger, `aria-activedescendant` and `data-active` (ADR-006); `listboxMount` from the static flag (ADR-005 step 8) consistent with the registry `decision` (ADR-015, enforced by W1-317); typeahead and IME fixtures (ADR-013 L2); core <= 8 KiB, custom fixture <= 16 KiB (ADR-011) |

### 6.3 Gates

| Gate | After | Fable checks | Blocking (data) |
|---|---|---|---|
| G3A | C01, C03s | Schema survived real use; Button accepted as golden; contrast and target-size fail on seeded breakage | Hard-blocks every `.b/.c/.d/.e` of all other components |
| G3B | C02, C11 | All ADR-007 rows in rendered DOM; SJForm scope is the two duties only; live region; SSR; 3.3.7. Editorial line "plus the `SJForm` owner context of ADR-014" under item 2 of ARCHITECTURE.md Section 4 recorded in the architecture changelog | Blocks G4 only |
| G3C | C04, C05, C06 | Focus kernel invariants; RTL; `<details name>` parity | Blocks G4 only |
| G3D | C07, C08, C09 | CSS vs geometry parity; Escape ordering; close tiers; size totals match ADR-011 | Blocks C10 `.c/.d/.e` and G4 |
| G3E | C10 | ADR-005 step 8 and ADR-008 coverage; equivalence; typeahead/IME; 16 KiB fixture; registry `decision` consistency | Blocks G4 only |

Anything not listed proceeds on its table dependencies.

---

## 7. M5 Certification

Meaning of wave-1 certification (ADR-015): `tested-real` on VoiceOver + Safari (macOS) and VoiceOver + Safari (iOS), and **evidence-conformant** for NVDA, JAWS and TalkBack. The manifest states the split and makes no tested claim for the three evidence-only ATs. Tags: `[OWNER]` needs the owner's Mac or iPhone.

| ID | Goal | Depends on | Acceptance criteria | Model |
|---|---|---|---|---|
| W1-501 | Reference-library size evidence (Q1) with versions, licences, clean-room notes | W1-007, W1-009 | Informational only; no ADR-011 change without an ADR; no third-party code (ADR-004) | sonnet |
| W1-502a | Performance harness and trace capture, 30+ iterations after warm-up, control/candidate protocol, environment fields; Chromium LoAF labelled as Chromium-only | G1 | Reproducible within stated variance twice (ADR-011 Rules) | sonnet |
| W1-502b | Three applicable scenarios scripted: roving step (C04/C05), overlay open (C07/C08), 1,000 mount/destroy (every component). The combobox filter at 1,000 items and 10,000-row scroll are recorded `not-applicable` with the reason "no wave-1 subject (SJCombobox is wave 2, no virtualized component)" | W1-502a, C07, C10 | Manifest case totals carry the two reasons (ADR-011, ADR-013). Gates are desktop-measured now; the iPhone run is part of W1-512; the Moto G Power 5G row is `not run` (device unavailable under D2) | sonnet |
| W1-503 | Floor lane: pinned **desktop Chromium 114 and Firefox 125**, same interaction suite, per release and on every fallback-component change | W1-309a, G2 | Green on both; report states emulation and patched WebKit were not used; iOS 17 and Android-floor rows are `not run`, paths covered by forced-false parity (ADR-013 floor lane) | sonnet |
| W1-504 | Device registry and setup: iPhone model and iOS build **pinned, auto-update off** (if it runs iOS 17 it covers the iOS floor row, otherwise record the newer version); Mac macOS and Safari build; Android recorded as unavailable | W1-009 | Registry validates against the manifest schema (risk 5, ADR-013) | haiku |
| W1-505 | VoiceOver protocol packs per component (macOS + Safari, iPhone + Safari), generated from `a11y.atAssertions` and `actions`: environment, initial announcement, every key/gesture, expected vs actual speech, focus before/after, reading order, state changes, pass/fail | G2, W1-009 | A pack exists for every component before M4 ends; field list equals ADR-013 4; results write `tested_on` and a log reference that W1-301/W1-318 consume | sonnet |
| W1-506 | iPhone input scenario packs generated from `kinds.contract.json` (keyboard, minus/decimal, Enter label, autofill, paste, caret, deletion, IME, leading zeroes, rotation, focus zoom for Q3); Android rows marked `not run` | W1-303, C02 | One scenario per kind row (ADR-007) | haiku |
| W1-507 | Guidepup regression net for VoiceOver on a macOS runner (NVDA only if the optional lane exists); stored as artifacts | G2 | A Guidepup pass never changes `test_status` (ADR-013 4, ADR-015) | sonnet |
| W1-508 | Evidence manifest generator: all ADR-013 fields incl. per-AT `test_status`, registry snapshot, `not run` rows with reasons | W1-009, W1-313, W1-317 | Reproducible from artifacts; documented as internal record, not WCAG certification | sonnet |
| W1-509 | Licence and provenance gate in `testing/licence/`: pinned lockfile-verified devDependencies, no behavioral runtime dependency (only `tokens` per ADR-002), clean-room notes present | W1-005 | Seeded runtime dependency fails (ADR-013, risk 8) | haiku |
| W1-510 | BCD regeneration in `testing/bcd/`: contract `nativeFrom` vs dataset, version recorded | W1-305 | Mismatch fails (ADR-001) | sonnet |
| W1-511 | Release-candidate dry run, owner of `.github/workflows/release.yml`: runs on branded channels where Playwright offers them (`chrome`, `msedge`; Firefox via branded `executablePath`; WebKit stays the Playwright build and the manifest says so) with `retries: 0`; includes the SJField + SJInput + SJForm fixture size; draft manifest with every `[OWNER]` row pending | all M4 | All PR gates and automatable release gates green (ADR-013 "stable branded browsers") | sonnet |
| **G4** | fable audit of the dry run | W1-511 | PASS = complete except VoiceOver sign-off | fable |
| W1-512 `[OWNER]` | iPhone: VoiceOver + Safari packs for all components; iPhone input packs; iPhone perf gates | G4 | Logged per ADR-013 4; failures raise issues, not skips | owner runs; sonnet triages |
| W1-513 `[OWNER]` | Mac: VoiceOver + Safari packs for all components | G4 | Same | owner runs; sonnet triages |
| W1-514 (optional, non-blocking) | NVDA on the owner's Windows PC (Chrome, Firefox); successful runs upgrade matching registry entries to `tested-real` with `tested_on` and a session log | G4 | Never required for G5; unrun entries stay `evidence-only` (ADR-015) | owner runs |
| W1-515 | Q3 and Q4: focus-zoom outcome; `listboxMount` per pointer class from VoiceOver iOS results plus registry evidence; ADR amendment draft only on dated evidence | W1-512 | No user-agent sniffing (ADR-005 step 8) | sonnet |
| W1-516 | Final manifest, signed and dated, with the tested-real / evidence-only split stated | W1-512, W1-513, W1-515 | Zero pending VoiceOver rows; failures fixed or tracked with owner | sonnet |
| **G5** | fable final audit plus owner sign-off | W1-516 | Wave 1 certified only on PASS and sign-off | fable plus owner |

---

## 8. Audit gates (summary)

fable audits, never implements. A FAIL returns numbered MUSTs; fixes are tasks in the failing milestone; the gate re-runs. Gate numbers are G0, G1, G2, G3A to G3E, G4, G5 (no gaps).

| Gate | Blocks | Pass condition |
|---|---|---|
| G0 | all after M0 | W1-001..009 done; seeded-failure proof per quality gate; CI green; `core` has no runtime dependency; scaffolds match ADR-002; testing Role-cell editorial line recorded; no prior-brand terms |
| G1 | M4 | Kernel ceilings met or amended by ADR (W1-113); ADR-003 and ADR-006 invariants under fast-check; controlled pipeline fixtures; three runtimes retain nothing; parity oracle; SSR determinism |
| G2 | M4 | Schema, codegen equivalence, registry drift (from `integration.ts`), MCP, lint, evidence schema, staleness and honesty checks, probe through all layers on all adapters |
| G3A to G3E | per Section 6.3 | Per-group criteria |
| G4 | owner device lane | Everything automatable green; packs complete; manifest drafted |
| G5 | certification | VoiceOver results complete, manifest signed, evidence-conformance for the three evidence-only ATs, owner approval |

---

## 9. Parallelization map

Rule: streams own disjoint directories; one worktree and one branch per stream. Rebase on `main` before each push; a schema change (W1-301 revision) is a broadcast event.

**P0.** W1-001 first. Then parallel: W1-002 (vitest files), W1-003 (`ci.yml`), W1-004 (`lefthook.yml`), W1-005 (new packages), W1-008 (tokens), W1-009 (evidence dirs). Then W1-006 and W1-007 (different `testing/` subfolders).

**P1 (after G0).**

| Stream | Tasks | Owns | Starts when |
|---|---|---|---|
| K1 | W1-101..104 | `core/src/{store,ids,runtime,effects}` | G0 |
| K2 | W1-105, W1-111 | `core/src/{merge,live}` | G0 |
| K1b | W1-115 | `core/src/controlled` | W1-101, 104, 105 |
| K3 | W1-106a, 106b, 107 | `core/src/{collection,focus,typeahead}` | K1 done for 101/102/104 |
| K4 | W1-108, 109, 110 | `core/src/overlay` | 101, 103, 104 (109 also 106b) |
| K5 | W1-112a, 112b | `core/src/{kinds,number}` | W1-103 |
| R1/R2/R3 | W1-120, 121, 122 | `react|vue|vanilla/src/runtime` | 101, 103, 104, 115 |
| S-CSS | W1-201..205 | `packages/css`, `testing/{contrast,lint/stylelint}` | G0 |
| S-CON | W1-301, 302, 303, 305, 306, 307, 315, 317, 318, 319 | `packages/contracts`, `apps/site/agentic`, worker blocks in sequence (306 MCP, 307 lint_css, 318 a11y), `testing/{lint/contract,evidence,honesty}` | G0 (318 after 305, 306, 315) |
| G-CODE | W1-304 | `*/src/generated/**` | 112b, 301, 303 |
| S-TEST-0 | W1-308a | `testing/spec/derive` | G0 |
| S-TEST | W1-114, 308b, 309a/b/c, 310..313 | one `testing/` subfolder per task | **K1, W1-114, W1-120..122 merged** |
| PROBE | W1-316 | `testing/probe` | 120..122, 301, 201 |
| CLOSE | W1-113, W1-314 | `evidence/kernel-sizes.md`, workflows | end of M1 / M3 |

**P2 (M4).** Component sets own distinct subfolders in contracts, core, css, adapters, testing/specs, so they run in parallel.
- Wave A: C01 and C03s together (C03c after C03s.a). C01 is golden; G3A hard-blocks all other `.b/.c/.d/.e`.
- Wave B: C02 (a1 then a2) and C11 in parallel. C06 may also start here.
- Wave C: C04, C05, C06.
- Wave D: C07 first, then C08 and C09 in parallel.
- Wave E: C10.a1 and C10.a2 may start at G1 and G2 (they use the kernel only); C10 `.c/.d/.e` wait for G3D.
- M5 preparation (W1-501, 502a, 504..510) runs alongside M4 in separate worktrees; it touches `evidence/`, `testing/{perf,at,licence,bcd}` only. `release.yml` belongs to W1-511.

---

## 10. Risks, containment and owner needs

### 10.1 Risks

| Risk | Containment |
|---|---|
| Provisional ceilings wrong (risk 3, Q2) | Harness before first module (W1-007); measurement W1-113; ADR-only changes; typeahead cannot be reclassified (W1-107) |
| Schema churn (risk 6) | W1-302 first; frozen at G2; broadcast rebase |
| Fallback matrix cost (risk 1) | Forced-false runs (W1-309b); floor lane per release (W1-503); affected-only CI (W1-314) |
| Geometry drifts from CSS policy | Parity oracle W1-110 plus per-component L6 paths; G3D |
| Untested ATs (risk 5, ADR-015) | Evidence schema, staleness and conflict checks (W1-315, 317), honesty scan (W1-319), conservative-conflict rule in the registry; optional NVDA lane (W1-514); regressions in NVDA/JAWS/TalkBack can ship undetected and the manifest says so |
| Registry delivery lags (research peer) | Fixtures in `testing/fixtures/at-support/` decouple W1-315..319; W1-317 coverage report blocks a component's `.a` only when its pattern is missing |
| Floor devices absent | iOS 17 and Android rows `not run` (ADR-013); forced-false parity; no hands-on claim in docs |
| AT evidence ages (risk 2) | Six-month `next_review` gate; dated issue log |
| Floor drift (risk 4) | Per-release review; BCD check W1-510 |
| Token gaps (risk 11) | W1-008 before CSS; W1-202 rejects raw values |
| Consumer resets (risk 9) | Documented; override fixture in W1-201 |
| Injection (risk 10) | W1-311 on every adapter |
| Licence/provenance (risk 8) | W1-009, W1-509, W1-501 |
| Native-on-touch identity (risk 7) | Equivalence tests; owner acceptance at G3E |
| Executor drift (runtime dependency, invented token) | Boundary lint (W1-006), licence gate, token-only stylelint, registry-derived MCP, fable gates |
| Parallel collisions | Single-writer rule, pre-stubbed exports, generated files in `generated/`, lockfile rule (Section 0) |
| Task size | Pre-split: 106a/b, 112a/b, 308a/b, 309a/b/c, 502a/b, C02.a1/a2, C03s/C03c, C10.a1/a2; an executor that still overflows splits at the getters freeze and notes it |

### 10.2 What needs the owner

| Item | When | Detail |
|---|---|---|
| Mac with VoiceOver + Safari | W1-513 | Record macOS and Safari build |
| iPhone with VoiceOver + Safari | W1-512 | Pin the iOS version, auto-update off. If it runs iOS 17 it covers the iOS floor row. The ADR-011 perf gate names iPhone 15 and Moto G Power 5G: record the actual iPhone; the Moto row is `not run`, or an ADR amends it |
| Optional NVDA lane | W1-514 | Windows PC; upgrades registry entries to `tested-real`; non-blocking |
| npm publish of `core`, `css`, `contracts`, `react`, `vanilla`, new `vue` | After G5 | Confirm `@ramoslabs` scope and credentials; this plan never publishes |
| PR opening and merges to `main` | Every stream | Executors push feature branches; owner opens PRs and merges |
| Native-picker visual acceptance | G3E | Risk 7 |
| ADR amendments if proposed | G1, W1-515 | Owner approves |
| Release sign-off | G5 | Manifest signer |

Resolved by the auditor, no owner action: `packages/testing/lint` (a `./lint` subpath of the private `testing` package, ADR-002 and ADR-010) and the minimal `SJForm` context (named in ADR-014 and ADR-007, with its own minimal contract).

### 10.3 What proceeds before the devices are used

Everything except W1-512 and W1-513 (and the iPhone leg of W1-502b): M0 to M4, all automatable M5 items, G0 to G4. The first device session receives complete VoiceOver scripts, input packs, pinned builds and a drafted manifest; sign-off is data collection, not a build task.

---

STATUS: REVISION-1-FOR-AUDIT
