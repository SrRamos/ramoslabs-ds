# RamosLabs component library: wave 1 implementation plan

Status: draft for audit. Source of truth: [ARCHITECTURE.md](ARCHITECTURE.md) (CERTIFIED 2026-10-27, 14 ADRs) and [BRIEF.md](BRIEF.md).
Scope: the eleven components of Section 4 plus everything they need (kernel, CSS, contracts, test infrastructure, certification).
Date: 2026-10-27.

## 0. Owner decisions applied

| # | Decision | Effect on this plan |
|---|---|---|
| D1 | Keep the floor: Chromium 114 / Firefox 125 / Safari-iOS 17 (ADR-001 option B) | Geometry fallback, close tiers, `:user-invalid` fallback, `<details name>` fallback, and the real floor lane all stay in scope. No task assumes anchor positioning. |
| D2 | The real-device AT lane is mandatory before wave-1 certification; the owner provides an iPhone on the floor iOS (17) and a mid-range Android (ADR-013, risk 5) | Every task tagged `[DEVICE]` waits for hardware. Everything else, including generating the device scripts, checklists, result templates and the evidence manifest, proceeds now (Section 6). |

Conventions used below.

- **Test layers** are the six of ADR-013: L1 unit/invariant, L2 interaction (Playwright x 3 engines x adapter), L3 axe plus WCAG 2.2 named gates, L4 real-AT manual, L5 visual regression, L6 parity matrix (native path and each forced-false fallback). **PR gates** (PRG) means the per-PR list in ADR-013 "Gates": bytes/tree-shaking (ADR-011), SSR/hydration IDREF comparison, contract validation plus registry regeneration, build-time contrast, no skipped test without issue and owner.
- **Models:** `haiku` mechanical scaffolding and edits; `sonnet` implementation; `fable` audit gates only (never implements).
- Git follows the user workflow: one `feature/<slug>` branch and one worktree per parallel stream, rebased on updated `main` often, pushed autonomously. Opening a PR or merging needs the owner. This plan runs no git commands itself.
- No prior-brand names or prefixes appear in any file produced under this plan (BRIEF constraint 1). The final lint in W1-307 includes a deny-list scan.
- Barrel files, `exports` maps and registry data are **generated or pre-stubbed** (W1-005, W1-304) so parallel tasks never edit the same shared file.

---

## 1. Milestone overview and dependency order

```
M0 foundation --+--> M1 core kernel ----------+
                +--> M2 CSS layer ---+        |
                +--> M3 contracts +  |        v
                     + test infra -+-+--> G2   G1
                                             \   |
                                              v  v
                                  M4 components (groups A..E, one gate each)
                                              |
                                              v
                                  M5 certification (G6 then device sign-off G7)
```

M0 gates M1, M2 and M3. M1, M2 and M3 run in parallel after G0 (M3 needs only the kinds table of W1-109 for one equivalence check). M4 starts when G1 and G2 pass. Groups inside M4 follow kernel-proving order: A (styling, native) then B (fields, live region) then C (roving focus) then D (overlay) then E (SJSelect, the highest-risk composite). M5 preparation tasks start as soon as the harness exists (end of M3), well before M4 ends.

---

## 2. M0 Repo foundation

Current state (read from the repo): bun@1.3.5 plus Turbo monorepo; `packages/tokens` working; `packages/vue` is a 0.0.0 scaffold with peer `vue ^3.4.0`; `apps/site` has the Astro site, `worker/index.ts` (MCP: `search_tokens`, `get_token`, `check_contrast`, `list_docs`, `get_doc`, `lint_css`, `get_agents_guide`), and `lint:css` only; **no root lint, format, test script, no CI workflow, no commit hooks**; `.github/` holds only assets.

Root script names are fixed here so that tasks need not edit one another's files: `lint`, `format:check`, `format`, `typecheck`, `test`, `test:e2e`, `build`, `size`, `contracts:check`, `gate` (runs all of lint, format:check, typecheck, test, build, size, contracts:check).

| ID | Goal | Files / packages | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-001 | Root lint and format toolchain: ESLint flat config (TS strict, import boundaries scaffold), Prettier config, stylelint root config reusing the site's rules; sole owner of root `package.json` scripts and `turbo.json` | root `eslint.config.js`, `.prettierrc`, `.stylelintrc`, root `package.json`, `turbo.json` | none | `bun run lint` and `bun run format:check` exit 0 on a clean tree and non-zero on a seeded violation; both run through Turbo per package (CONTRIBUTING gate rule: lint is not done until format check passes too) | PRG | sonnet |
| W1-002 | Unit test runner: Vitest workspace with per-package configs, jsdom-free by default (core must not need DOM, ADR-002), coverage report | `vitest.workspace.ts`, `packages/*/vitest.config.ts` | W1-001 (script names only) | `bun run test` runs in every package; a core test that touches `document` at import fails (ADR-002 side-effect-free rule); fast-check available as devDependency (ADR-013 L1) | L1 | sonnet |
| W1-003 | CI workflow: jobs `gate` (lint, format check, typecheck, unit, build, size), later extended by W1-314; frozen lockfile; Node 22 and bun 1.3.5 | `.github/workflows/ci.yml` | W1-001, W1-002 (names) | Workflow passes on the scaffold; fails on a seeded lint, format, type or test error; no job uses `continue-on-error` (ADR-013: flaky is failure, no skip without issue and owner) | PRG | haiku |
| W1-004 | Commit hooks: pre-commit runs lint-staged (eslint, prettier, stylelint on staged files); commit-msg enforces conventional commits; hooks installed by `bun install` | `lefthook.yml` (or `.husky/`), root `package.json` devDependencies via W1-001 owner | W1-001 | A commit with a format violation or a non-conventional message is rejected locally; hooks add no runtime dependency (ADR-002 principle 3) | PRG | haiku |
| W1-005 | Package scaffolds per ADR-002: `css`, `core`, `contracts`, `testing` (private), `react`, `vanilla`; raise `vue` peer to `>=3.5.0` (ADR-002 decided). Pre-stub `core` subpath `exports` for every kernel module and every wave-1 component entry (ADR-002 "one ESM entry per component") | `packages/{css,core,contracts,testing,react,vanilla}/**`, `packages/vue/package.json` | W1-001 | Each package builds, typechecks, lints; `core` has zero `dependencies`; `contracts` has no JS behavior; peer ranges `react >=18`, `vue >=3.5.0`; single lockstep version number with changesets config (ADR-002 consequences) | PRG | haiku |
| W1-006 | Dependency-direction lint: `core` may not import `vue`, `react`, or touch `window`/`document` at module scope; adapters never import CSS; presets import only public primitives (ADR-004 CI check) | `packages/testing/lint/boundaries.*`, eslint config entry | W1-005 | Seeded violations for each of the four rules fail `bun run lint`; clean tree passes (ADR-002, ADR-004) | L1, PRG | sonnet |
| W1-007 | Size-budget harness: pinned bundler, minified+gzip and raw bytes per entry, import-graph dump, fixture "unused component in a fixture importing another = 0 KiB JS"; budget table as data, revisable only by ADR | `packages/testing/size/**`, `budgets.json` | W1-005 | `bun run size` reports every ADR-011 row (1, 3, 8, 4, 3, 1, 2 KiB, framework adapters reported separately); a seeded oversize module fails; report includes raw bytes and import graph (ADR-011) | PRG | sonnet |
| W1-008 | Required new tokens in `packages/tokens` first: touch target size (44 px), focus ring width and offset, control text minimum (16 px), overlay sizing caps, scroll-margin, hairline (ADR-009, risk 11) | `packages/tokens/src/tokens/**` | none | Tokens exist in DTCG JSON and appear in generated CSS/TS/JSON; no raw value is used downstream; `bun run --filter @ramoslabs/tokens build` passes; contrast tool in `check_contrast` still passes (ADR-009) | PRG | sonnet |
| W1-009 | Evidence scaffolding: `docs/architecture/evidence/` with clean-room notes template (ADR-004), dated AT issue log template, release evidence-manifest schema, floor-device registry | `docs/architecture/evidence/**` | none | Templates contain every field named in ADR-013 (evidence manifest) and ADR-006 (AT issue log: minimal repro, speech output, versions, retest result) | none | haiku |

**Gate G0 (fable):** M0 PASS before any M1, M2 or M3 task starts. See Section 4.

---

## 3. M1 Core kernel (`@ramoslabs/core`)

Each module is a separate entry (`packages/core/src/<module>/`), written test-first against the property harness. No module-scope side effects, no DOM globals (ADR-003). Every kernel task also runs W1-007 for its ceiling.

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-101 | Snapshot store: `getSnapshot`/`subscribe`/`dispatch`/`destroy`; stable identity, no-op dispatch returns same snapshot, deduped subscribe, idempotent destroy, lazy creation, reversible cleanup; no module-scope stores | `core/src/store/**` | W1-002, W1-007 | <= 1 KiB min+gzip (ADR-011); 1,000 create/destroy cycles retain 0 stores/listeners (ADR-011 gate, ADR-003); StrictMode-style double invocation safe (ADR-003) | L1 | sonnet |
| W1-102 | Ids: base id plus suffixes (`-label -hint -error -trigger -panel`), item ids from consumer keys not positions, sanitized map for `anchor-name`/`view-transition-name`, `CSS.escape` helper, `idPrefix` | `core/src/ids/**` | W1-002 | Same input gives same ids regardless of mount order or filtering; no counters, random, time or array index in id derivation (ADR-003); IDREFs use raw ids while anchor names use the sanitized map | L1 | sonnet |
| W1-103 | Runtime: `createRuntime(config)` with locale, dir, idPrefix, idFactory, density, `supports`, scheduler; deterministic defaults (server all-false `supports`, fake scheduler); `SJProvider` contract type | `core/src/runtime/**` | W1-101 | Two runtimes in one process are isolated; server defaults equal serialized client values; no read of `navigator` or `document.documentElement` (ADR-003 runtime object); fallback-with-warning outside a provider | L1 | sonnet |
| W1-104 | Effects: versioned descriptors `{type,target,version}`, post-commit drain queue, stale-version and missing-target drop, no synchronous re-dispatch, native-open-before-focus ordering | `core/src/effects/**` | W1-101 | Invariants hold under fast-check sequences including stale effects and removed targets (ADR-003, ADR-013 L1); queue exposes the single drain hook adapters call after commit | L1 | sonnet |
| W1-105 | Prop-merge utility: attribute precedence (library ARIA/role/ids win; `class`/`style` concatenate), consumer-then-library handlers with `defaultPrevented` cancellation, dev warning on overriding semantic invariants | `core/src/merge/**` | W1-002 | A consumer spread cannot override role, ids, IDREFs or state-derived `aria-*` (ADR-004); `preventDefault()` cancels the library handler; table-driven tests cover each precedence rule | L1 | sonnet |
| W1-106 | Collection and focus kernel (3 KiB shared): data-first collection, key-to-id map, registration, deterministic successor on removal (focus never to `<body>`), roving and activedescendant strategies (one per composite), `data-active` in every composite, one `focus({preventScroll})` plus one `scrollIntoView({block:'nearest'})`, focus scope and return with opener reference and connected/visible/enabled/non-inert check | `core/src/collection/**`, `core/src/focus/**` | W1-101, W1-102, W1-104 | <= 3 KiB (ADR-011); the strategy table of ADR-006 is encoded and a component declaring both strategies throws; every active id resolves to an owned element and resets before unmount (ADR-006); successor property test over random removals (ADR-013 L1) | L1 | sonnet |
| W1-107 | Typeahead and IME inside the focus kernel (separate sub-entry so non-typeahead components pay 0 bytes): Unicode normalize, trim/collapse, locale case folding, cycling prefix match, diacritics kept; composition guards via `isComposing` plus a session flag; `beforeinput` for editable, `keydown` for non-editable | `core/src/typeahead/**` | W1-106, W1-103 | Prefix typeahead next-match and wrap deterministic across runs (ADR-012); no filtering or accept during composition (ADR-006); Android `keyCode 229` path covered by a `beforeinput` fixture; typeahead never reuses a ranker (ADR-012); bytes counted inside the 3 KiB kernel total or within the 8 KiB complex ceiling, whichever the measurement shows (ADR-011) | L1 | sonnet |
| W1-108 | Overlay and geometry kernel (4 KiB shared): contract-vocabulary placement parser (`position-area`, `position-try-fallbacks`, `position-try-order`, `position-visibility`), candidate evaluator in declaration order, read-compute-write scheduler (fallback-only, commit-ordered), keyboard-viewport handling via `visualViewport` | `core/src/overlay/placement/**` | W1-101, W1-103, W1-104 | Evaluator output (candidate, offset, visibility) is a pure function of rectangles; the scheduler never uses an independent `requestAnimationFrame` racing the queue (ADR-005 step 4); never runs when native anchor positioning is supported (ADR-005 step 3); the compiled `position-area` subset is explicit, no inference from Baseline (ADR-001 table) | L1 | sonnet |
| W1-109 | Overlay behavior half: nested stack synced from native `toggle`/`close`, opener reference, Escape order per HTML algorithm, close-request tiers (`requestClose()` >= Safari 18.4 / Chromium 134, else cancelable `cancel` plus `close()`), capture-phase `pointerdown` dismissal with `composedPath()` exclusion installed only when native light dismiss is absent, static `listboxMount` flag by `any-pointer` class | `core/src/overlay/behavior/**` | W1-108, W1-106 | The five ADR-005 step-5 rules are fixture dimensions: popover-over-modal closes first, nested `auto` keeps ancestor chains, modal from popover above it, `hint` never closes `auto`; both close tiers reach one internal close operation (ADR-005 step 7); no user-agent sniffing, no `aria-owns` workaround (ADR-005 step 8). Combined overlay (108 plus 109) <= 4 KiB (ADR-011) | L1 | sonnet |
| W1-110 | Placement parity oracle: feed identical rectangle fixtures to the CSS-vocabulary compiler output (reference evaluator) and the fallback; assert identical candidate, offset, visibility | `core/src/overlay/__parity__/**`, `testing/parity-geometry/**` | W1-108 | Parity suite passes over a versioned fixture set including flip-block, flip-inline, named `@position-try`, most-height order, anchors-visible (ADR-005 step 2) | L1, L6 | sonnet |
| W1-111 | Live-region registry (1 KiB, client-only, excluded from SSR): persistent shared `status`/`alert` nodes per runtime document, dedupe, polite default, never a duplicate of an active-descendant move | `core/src/live/**` | W1-103 | <= 1 KiB (ADR-011); SSR render emits no live-region markup (ADR-006); dedupe test; urgent `alert` only via explicit option; registry keyed to runtime, no module scope (ADR-003) | L1 | sonnet |
| W1-112 | Field-kinds resolver and number parser (2 KiB): `resolveKind(kind, ctx)` pure over a typed table (hand-authored now, generated in W1-304), form-owner `enterkeyhint` computation, locale-aware owned parser (both separators, grouping rule, signed amount accepting `-` and `−`), no `parseFloat`, no `maxlength` ever emitted | `core/src/kinds/**` | W1-002, W1-103 | Every row of the ADR-007 table resolves exactly; textarea kinds excluded from position computation and always `enter`; parser tested both directions per locale including de, en, es, fr, pt, ar-numerals fixture; leading zeroes preserved for postal/reference/tax-id; `maxlength` never emitted for phone, amount, reference, tax, card, OTP; <= 2 KiB (ADR-007, ADR-011) | L1 | sonnet |
| W1-113 | Kernel measurement report: prototype sizes vs ADR-011 ceilings, raw bytes, import graphs; if any ceiling is missed, a draft ADR amendment citing the measurement (no ceiling rises more than 50% without design review) | `docs/architecture/evidence/kernel-sizes.md` | W1-101 to W1-112 | Report lists measured vs ceiling per module (ADR-011 "Revision measurement", Q2); amendments are proposals only and go to G1 | PRG | sonnet |
| W1-114 | SSR determinism harness: render each kernel-using fixture twice (server then client) and compare ids and IDREF relationships; framework-neutral runner reused by adapters | `testing/ssr/**` | W1-102, W1-103 | Same ids and IDREF graph server vs client; multiple roots with different `idPrefix` never collide (ADR-003, ADR-013 PR gate) | L1, PRG | sonnet |

**Gate G1 (fable):** M1 PASS required before M4. Kernel budgets measured or amended by ADR (W1-113).

---

## 4. M2 CSS layer (`@ramoslabs/css`)

M2 depends on M0 only (needs W1-008 tokens) and runs in parallel with M1 and M3.

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-201 | CSS build: `@layer sj.reset, sj.base, sj.component, sj.variant, sj.state;` declaration file, per-component files plus a full file, `sideEffects` set only here, tokens imported via `@ramoslabs/tokens/css`, documented layer order | `css/src/**`, `css/package.json`, `css/README.md` | W1-005, W1-008 | Layer order is the ADR-009 string verbatim; unlayered consumer CSS overrides every `sj.*` rule in a fixture; consumer-reset caveat (risk 9) documented; no adapter imports CSS (ADR-002) | PRG | sonnet |
| W1-202 | Token-only stylelint rule: reject raw hex, raw px (except documented hairline/zero tokens), non-token durations, `outline: none` without replacement, remote `@import` and `@font-face` URLs | `testing/lint/stylelint-sj.*` | W1-001, W1-008 | Seeded violations fail; clean CSS passes; scan of all packages finds no remote font import (ADR-009, BRIEF defects) | PRG | sonnet |
| W1-203 | Build-time contrast matrix: every `variant x tone x size` text/background pair >= 4.5:1, UI and focus pairs >= 3:1, computed from tokens, in light and forced-colors fallbacks; token change that breaks a pair fails the build | `testing/contrast/**` | W1-008 | Fails on a seeded token change; report names pair, ratio, and token (ADR-009, ADR-013 PR gate); muted text never below slate-500 on white (AGENTS.md floor) | PRG | sonnet |
| W1-204 | Shared base styles: focus ring (>= 2.4.13 area, 3:1 change contrast, drawn from `data-active` as well as `:focus-visible`), 44 px touch target helpers, density `touch`/`compact`, 16 px control text on touch, `prefers-reduced-motion`, `forced-colors`, logical properties and RTL, `contain` rules that never clip focus rings | `css/src/base/**` | W1-201, W1-008 | Computed indicator area and contrast assertions in a probe fixture (ADR-013 3 / 2.4.13); touch targets >= 44 px with 24 px absolute floor (ADR-008, 2.5.8); motion collapses under reduced-motion (ADR-009) | L3, L5 | sonnet |
| W1-205 | Component CSS authoring guide plus generator for `sj-<component>__<part>` class and `data-part`/`data-state`/`data-active`/`data-disabled`/`data-invalid` naming, checked against contracts once W1-301 exists | `css/src/_template/**`, `css/CONTRIBUTING.md` | W1-201 | Template compiles; class naming matches the contract `anatomy[].part` (ADR-002 naming rule, ADR-009) | PRG | haiku |

---

## 5. M3 Contracts, schema, wiring and test infrastructure

M3 depends on M0. Tasks W1-308 to W1-313 build the shared spec runner that every component then reuses (ADR-013: one spec drives every layer).

| ID | Goal | Files | Depends on | Acceptance criteria | Layers | Model |
|---|---|---|---|---|---|---|
| W1-301 | `contract.schema.json` v1 per the ADR-010 example (anatomy, state, actions, keyboard, focus, kinds, runtime, nativeFallback, overlay, support, a11y, events, fixtures, budgets); validator CLI | `contracts/contract.schema.json`, `contracts/scripts/validate.*` | W1-005 | The ADR-010 sample validates; each required field removed fails with a precise path; `$schema` URL `https://design.ramoslabs.com/schema/contract.v1.json` (ADR-010) | PRG | sonnet |
| W1-302 | Schema shake-out contracts first: `SJButton` and `SJSwitch` drafts (risk 6), then adjust the schema | `contracts/button.contract.json`, `contracts/switch.contract.json` | W1-301 | Both validate; any schema change needed is made before any composite contract is written (ADR risk 6); a written list of schema gaps found is committed | PRG | sonnet |
| W1-303 | `kinds.contract.json` plus `kinds.schema.json` from the ADR-007 table | `contracts/kinds.contract.json`, `contracts/kinds.schema.json` | W1-301 | Every ADR-007 row present with all columns; unknown fields rejected; `otp-alnum`, `amount-signed`, `cc-exp*` rows carry their notes (ADR-007) | PRG | sonnet |
| W1-304 | Codegen: finite-state table, keyboard maps, ARIA attribute tables, `kind` union type, barrel files; **equivalence check** that each reducer's allowed events equal the contract `actions`; kinds resolver table generated from `kinds.contract.json` and compared to the W1-112 table | `contracts/scripts/codegen.*`, generated `core/src/**/generated/**` | W1-301, W1-303, W1-112 | Generated outputs are deterministic and committed-clean in CI; an unknown `kind` is a type error (ADR-007); reducer/contract mismatch fails CI (ADR-010 consumers); keyboard map consumed by code and tests from one source (ADR-006) | L1, PRG | sonnet |
| W1-305 | `registry.json` generated from contracts; drift check; site serves `/schema/contract.v1.json`; `llms*.txt` list components | `apps/site/**`, `contracts/scripts/registry.*`, root `registry.json` | W1-301 | PR job fails on schema violation or registry drift (ADR-010); `components` array lists name, status, anatomy, roles, keyboard, kinds, support floor, doc links; the `$schema` URL resolves in the site build (ADR-010 release gate) | PRG | sonnet |
| W1-306 | MCP tools `get_component`, `list_components`, `get_kind` in the worker, read-only, size-capped like `lint_css` | `apps/site/worker/index.ts` | W1-305 | Tool list advertises the three tools; responses derive from the generated registry only (no invented values); unknown name returns a clear not-found; worker tests added (ADR-010, AGENTS.md MCP section) | L1 | sonnet |
| W1-307 | Contract-driven lint rules: unknown `kind`, preset using internals, raw values, missing label; plus the prior-brand deny-list scan across the tree; `lint_css` rules in the worker reference contract parts and data-attributes | `testing/lint/**`, `apps/site/worker/index.ts` (section owned by this task only) | W1-301, W1-306 | Each rule has a failing and passing fixture (ADR-010 Lint); `lint_css` flags a nonexistent `data-` axis; deny-list scan fails on a seeded term and passes on the tree (BRIEF constraint 1) | PRG | sonnet |
| W1-308 | Spec runner: derive semantic actions from a contract's `actions`, `keyboard`, `focus`, `fixtures`; reducer harness (L1) with fast-check model-based sequences incl. disabled/removed items, controlled rejection, duplicate registration, stale effects | `testing/spec/**` | W1-301, W1-101, W1-104 | A probe contract with three fixtures generates and runs actions; an injected reducer defect is caught by the sequence generator; same spec file consumed by L1 and L2 (ADR-013 option B) | L1 | sonnet |
| W1-309 | Interaction harness: Playwright on Chromium, Firefox, WebKit; host pages per adapter (vue, react, vanilla); the same semantic actions executed; `supports` map injection (real detection plus each capability forced false); `toMatchAriaSnapshot()` YAML per state; CDP `getFullAXTree` on Chromium; CDP IME composition | `testing/e2e/**` | W1-308, W1-114 | Probe runs on 3 engines x 3 adapters; assertions are on focus target and IDREF validity, not byte-identical DOM; forced-false runs recorded as a distinct `path` (ADR-013 L2, L6) | L2, L6 | sonnet |
| W1-310 | A11y gates: axe in every state with zero untriaged violations and `target-size` enabled; named WCAG 2.2 checks 2.4.11, 2.4.13, 2.5.7, 2.5.8 per PR; 3.3.7, 3.3.8, 3.2.6 per release | `testing/a11y/**` | W1-309 | Each of the seven criteria has a pass fixture and a seeded-failure fixture (ADR-013 L3 table); untriaged violation fails; triage file requires issue and owner | L3 | sonnet |
| W1-311 | Text-safety test: markup-like consumer strings through labels, hints, errors, option text on each adapter render as text with no element injection; vanilla adapter uses text nodes only | `testing/text-safety/**` | W1-309 | Test passes on probe, fails on a seeded `innerHTML` use (ADR-002 text safety, ADR-013 L2, risk 10) | L2 | haiku |
| W1-312 | Visual regression harness: hermetic, production font files with `font-display: block`, baselines per `engine x platform x DPR`, mandatory human review, no "update all" command | `testing/visual/**` | W1-309 | Baseline update requires per-file review flag; run is byte-stable twice in a row; no remote fonts loaded (ADR-013 L5, ADR-009) | L5 | sonnet |
| W1-313 | Parity matrix generator: rows `component / scenario / action / browser / adapter / path`, report of executed/passed/failed/not-applicable with reasons | `testing/parity/**` | W1-309 | Matrix is generated from run results, never hand-edited; missing adapter or path cell fails the report (ADR-013 L6, evidence manifest case totals) | L6 | haiku |
| W1-314 | CI extension: PR jobs for bytes (W1-007), contracts and registry drift (W1-301/305), contrast (W1-203), SSR (W1-114), e2e matrix for affected components, a11y, visual diff review, skip-without-issue check | `.github/workflows/ci.yml`, `.github/workflows/e2e.yml` | W1-003, W1-307 to W1-313 | Each gate listed in ADR-013 "Gates, every PR" has a job; seeded failure for each turns CI red; affected-component selection works from changed paths | PRG | haiku |

**Gate G2 (fable):** M2 plus M3 PASS before M4. The probe component must run through every layer L1 to L3, L5, L6 on all adapters.

---

## 6. M4 Components

### 6.1 Per-component task template

Every component C has six tasks. IDs: `W1-C<nn>.a` to `.f` where `<nn>` is the Section 4 number.

| Sub | Goal | Files | Depends on | Common acceptance (every component) | Model |
|---|---|---|---|---|---|
| .a | Contract plus core: `<c>.contract.json`, reducer, finite-state table, prop getters, unit and invariant tests, byte ceiling | `contracts/<c>.contract.json`, `core/src/<c>/**` | G1, G2 | Contract validates and codegen equivalence passes (ADR-010); reducer is pure, effects are descriptors (ADR-003); getters pure functions of snapshot and props (ADR-004); core entry within its ADR-011 ceiling; `support[]` has `nativeFrom`/`fallbackUntil` for each feature used (ADR-001) | sonnet |
| .b | CSS: `css/src/<c>.css` | `css/src/<c>.css` | .a (anatomy), W1-204 | Token-only (W1-202 passes); contrast matrix passes for all `variant x tone x size` (ADR-009); visible focus per 2.4.13; works under forced-colors and RTL | sonnet (haiku for Switch, Disclosure, State once Button is the golden) |
| .c | Vue adapter: flat `SJ<C>Root` etc. components plus the preset built only from exported primitives | `vue/src/<c>/**` | .a | `shallowRef` plus `markRaw` bridge, effects drained in `watch(...,{flush:'post'})` (ADR-003); ids from `useId`; preset imports only public primitives (ADR-004 CI check); tree-shaken one-component fixture within the derived total (ADR-011) | sonnet |
| .d | React adapter: namespace object plus flat exports | `react/src/<c>/**` | .a | `useSyncExternalStore` with `getServerSnapshot`; effects in `useLayoutEffect`/`useEffect` per ADR-003; StrictMode double invocation leaves 0 retained listeners (ADR-003, ADR-011) | sonnet |
| .e | Vanilla adapter: `mount/update/destroy`, optional `sj-<c>` custom element (light DOM, explicit `define()`), one `AbortController` per instance | `vanilla/src/<c>/**` | .a | No import-time registration (ADR-002); text nodes only (ADR-002); FACE via `attachInternals()` only where form participation needs it (ADR-014); 1,000 mount/destroy cycles retain nothing (ADR-011 gate) | sonnet |
| .f | Conformance: shared spec fixtures, L2 on 3 engines x 3 adapters, ARIA snapshots, axe and WCAG gates, SSR/hydration IDREF check, forced-false runs, bundle fixture, visual baselines (human review), AT script generation hook | `testing/specs/<c>/**` | .b, .c, .d, .e | PRG all green; parity matrix has no empty cell (ADR-013 L6); `a11y.atAssertions` from the contract are rendered into the W1-505 manual AT script for this component (ADR-013 L4); every skip carries issue and owner | sonnet (fixture data: haiku) |

Within one component, .b .c .d .e run in parallel after .a. Interface freeze of the getters in .a is the sync point.

### 6.2 Components in kernel-proving order

| Group | # | Component | Kernel parts proven | Component-specific acceptance criteria (beyond the template) |
|---|---|---|---|---|
| A | C01 | `SJButton` (+ icon button, link variant) | Styling layer, contrast gate, target size, prop-merge | Axes `data-variant`, `data-tone`, `data-size` map to tokens in `sj.variant` (ADR-009); target >= 44 px touch, >= 24 px floor (ADR-008); disabled semantics keep focusability rules documented in the contract; icon button requires accessible name or fails lint (ADR-010 lint); link variant renders an `<a>` (ADR-001 principle 1) |
| A | C03 | `SJSwitch`, `SJCheckbox` | Native-first, form participation | Rendered over a real `<input>` (native wins, ADR-001 principle 1, ADR-014); value and form state identical to a bare input in submit tests; Space toggles and role correct per APG; no FACE in React/Vue (ADR-014); custom visuals pass forced-colors |
| B | C02 | `SJField` + `SJInput` (kinds) + minimal `SJForm` owner context | Field kinds, IDREFs, form-owner `enterkeyhint`, live-region errors | Label, hint, error ids `-label/-hint/-error`; `aria-describedby` and `aria-invalid` derived; `aria-errormessage` only where tested (ADR-014); every ADR-007 kind row resolves in a rendered input (L2 reads attributes); form owner computes `next/done/go/send/search` and textarea kinds are excluded (ADR-007); `:user-invalid` timing with Chromium 114-118 touched-state fallback forced-false run (ADR-014, ADR-001); 3.3.7 prior values retained or offered (ADR-013 table); error announced once via the live-region registry (ADR-006); no `type="number"` for identifier kinds, no `maxlength` (ADR-007); core <= 3 KiB, fixture <= 6 KiB (ADR-011). Note: `SJForm` is not in the Section 4 list; it ships only as the minimal owner context ADR-014 names, flagged in G3B |
| B | C11 | `SJState` (empty / loading / error) | Live-region registry, messaging conventions | Three empty kinds (first-use, no-results, cleared) are distinct variants with distinct copy slots (BRIEF); loading and result counts use polite `status`, only errors needing interruption use `alert` (ADR-006); registry excluded from SSR output (ADR-006); no color-only meaning (AGENTS.md) |
| C | C04 | `SJRadioGroup` | Roving focus, collection, RTL | Roving tabindex per ADR-006 table; arrow keys follow DOM order and reverse in RTL (ADR-006, ADR-009 logical); removal of the focused radio moves focus deterministically, never to `<body>` (ADR-006); native `<input type=radio>` underneath |
| C | C05 | `SJTabs` | Collection, successor, keyboard map generation, automatic/manual activation | Keyboard map generated from the contract (ADR-006, ADR-010); automatic vs manual activation both tested; Home/End and RTL; tab removed while active selects a deterministic successor; `tabpanel` linked by ids from the base id (ADR-003); core <= 3 KiB (ADR-011) |
| C | C06 | `SJDisclosure` (accordion) | Native `<details>` ladder, reduced motion | Built on `<details>`; exclusive groups use `<details name>` with owned fallback on Chromium 114-119, Firefox 125-129, Safari 17.0-17.1 (ADR-001 table, Section 4); forced-false run covers fallback; animation skipped under reduced motion (ADR-009); `summary` keyboard behaviour native |
| D | C07 | `SJDialog` | `showModal()` path, opener stack, close tiers, `inert` | Modal uses `showModal()` only, never `show()` (ADR-005 step 1); explicit close control always rendered (ADR-005 step 6); focus returns to opener when connected/visible/enabled/not inert, else declared fallback (ADR-006); both `requestClose()` and `cancel`+`close()` tiers pass the same close fixtures (ADR-005 step 7); background inert natively; open <= 100 ms p95 (ADR-011, measured in M5); 2.4.11 focus not obscured with sticky header fixture (ADR-013) |
| D | C08 | `SJPopover` | Placement contract, geometry parity, Escape/nesting | Non-modal via Popover `auto`; no focus trap (ADR-006); native CSS placement above each property floor and geometry fallback below it (ADR-005 step 3), each run in L6; popover-over-dialog and dialog-from-popover Escape order fixtures (ADR-005 step 5); fixture <= 8 KiB (ADR-011); `position-visibility` handled |
| D | C09 | `SJTooltip` | Focus/hover/Escape rules, manual popover stack, touch policy | Shows on focus and hover, dismissed by Escape, hoverable, persistent while hovered or focused (ADR-006); `popover="manual"` with engine stack, `hint` only as detected enhancement (ADR-005 step 1); on touch the content is reachable without hover via visible text or disclosure (ADR-006, ADR-008); 1.4.13 style behaviours in L2; fixture <= 8 KiB |
| E | C10 | `SJSelect` (native preset + custom listbox compound) | Active-descendant, typeahead, IME, `listboxMount`, native-on-touch equivalence | Native `<select>` preset is default; on `(any-pointer: coarse)` the native control is rendered when equivalence holds, with accessible name, value and form state identical (ADR-008 rule 3); custom compound needs a `customRequires` capability (filtering or richOptions) (ADR-008 rule 2); select-only combobox: DOM focus on trigger plus `aria-activedescendant`, `data-active` indicator (ADR-006); `listboxMount` from the static flag keyed on `any-pointer` (ADR-005 step 8); typeahead and IME fixtures incl. CDP composition and Android `beforeinput` path (ADR-006, ADR-013 L2); custom listbox fixture <= 16 KiB (ADR-011); core <= 8 KiB complex ceiling |

Task IDs for the table are then `W1-C01.a` to `W1-C11.f` (66 tasks, all follow the template).

### 6.3 Group audit gates

| Gate | After | Fable checks |
|---|---|---|
| G3A | C01, C03 | Contract schema survived real use (ADR-010); Button golden accepted as reference for CSS and adapters; contrast and target-size gates really fail on seeded breakage |
| G3B | C02, C11 | All ADR-007 rows verified in rendered DOM; `SJForm` scope confirmed as minimal; live-region behaviour; SSR/hydration; 3.3.7 |
| G3C | C04, C05, C06 | Focus kernel invariants; RTL; `<details name>` fallback parity; no component declaring two strategies |
| G3D | C07, C08, C09 | Overlay parity (CSS vs geometry); Escape ordering fixtures; close tiers; size totals match ADR-011 derived sums |
| G3E | C10 | Full ADR-005 step 8 and ADR-008 coverage; native-on-touch equivalence; typeahead and IME; the 16 KiB fixture |

A group gate must PASS before the next group's `.a` tasks start only where it adds a kernel part; C-group tasks that do not depend on the gated group's findings may start earlier (Section 8).

---

## 7. M5 Certification

Items tagged `[DEVICE]` need owner hardware or lab access. Everything untagged runs immediately after M3 plus the components it covers; most of it can be built before M4 ends.

| ID | Goal | Depends on | Acceptance criteria | Model |
|---|---|---|---|---|
| W1-501 | Reference-library size evidence (Q1): comparable select, dialog and tabs builds, min+gzip, tree-shaken, same bundler, versions and licences recorded in `evidence/` with clean-room notes | W1-007, W1-009 | Informational only; no ADR-011 change without an ADR (ADR-004 Sizes, Q1); no third-party code copied or imported | sonnet |
| W1-502 | Performance harness: scripted scenarios for the five ADR-011 interaction gates, 30+ iterations after warm-up, trace capture (LoAF on Chromium only, labelled), control/candidate protocol; runs on desktop now, on devices later | G1, C07, C10 | Runs reproduce within stated variance twice; Chromium LoAF never reported as three-engine result (ADR-011 Rules); environment fields recorded | sonnet |
| W1-503 | Floor lane automation: pinned Chromium 114 and Firefox 125 binaries in CI, same interaction suite, runs per release and on every change to a fallback-bearing component; Safari 17 / iOS 17 lane documented as `[DEVICE]` | W1-309, G2 | Suite green on both pinned engines; emulation or patched WebKit is not used as substitute and the report says so (ADR-013 Real floor lane) | sonnet |
| W1-504 | Floor-device registry and setup guide: record device model, OS 17.x build, auto-update disabled; same for the Android floor device and Chrome version | W1-009 | Registry validates against the evidence-manifest schema (ADR-013, risk 5); guide states that iOS cannot be downgraded after update | haiku |
| W1-505 | AT protocol packs, generated per component from `a11y.atAssertions` and `actions`: for each of the P1 and P2 matrices (ADR-013 L4, Section 2) a script of every key or gesture, expected speech, space for actual speech, focus before/after, reading order, state changes, pass/fail; plus the dated AT issue log | G2, W1-009 | Pack exists for all 11 components before M4 completes; format matches the ADR-013 L4 field list; user-agent-keyed workarounds are rejected by the log template (ADR-006) | sonnet |
| W1-506 | Physical input scenario packs for kinds (keyboard, minus/decimal, Enter label, autofill, paste, caret, deletion, IME, leading zeroes, rotation) generated from `kinds.contract.json`, iOS Safari and Android Chrome | W1-303, C02 | One scenario per kind row per ADR-007 certification list; result sheet columns defined; Q3 (focus zoom) has an explicit scenario | haiku |
| W1-507 | Guidepup regression net for NVDA (Windows runner) and VoiceOver (macOS runner) on the P1 flows; labelled as regression net, not certification | G2 | Runs in CI nightly or on demand; output stored as artifacts; never counted as L4 pass (ADR-013 L4) | sonnet |
| W1-508 | Evidence manifest generator: spec version, source revision, tool versions, environment matrix, case totals with not-applicable reasons, axe scope, visual baseline revision, AT result log, upstream issues, performance traces, BCD dataset version, signer, date | W1-009, W1-313 | Manifest validates against the schema and is reproducible from artifacts; documented as an internal record, not an external WCAG certification (ADR-013) | sonnet |
| W1-509 | Licence and provenance gate: lockfile-verified pinned devDependencies; check that no behavioral runtime dependency exists in any published package (`dependencies` empty except `tokens` for css and adapters as ADR-002 table); clean-room notes present | W1-005 | Gate fails on a seeded runtime dependency or unpinned devDependency; passes on the tree (ADR-013 release gate, ADR-004, risk 8) | haiku |
| W1-510 | BCD support-claims regeneration against the recorded dataset version; `support[]` claims in contracts checked against it | W1-305 | Mismatch between a contract `nativeFrom` and the dataset fails the check; version recorded in the manifest (ADR-001 Decision) | sonnet |
| W1-511 | Release-candidate dry run: all automated gates over the full wave, parity report, evidence manifest in draft with every `[DEVICE]` row marked pending | all M4 | All ADR-013 "every PR" and automatable "every release" gates green; manifest lists each pending device row explicitly | sonnet |
| **G6** | fable audit of the dry run | W1-511 | PASS means "complete except real-AT sign-off" | fable |
| W1-512 `[DEVICE]` | iOS 17 iPhone: VoiceOver on Safari for all P1 packs; physical input packs (Section W1-506); floor-lane interaction suite; perf gates on that device | G6, owner device | Every pack complete and logged; failures raise issues, not silent skips (ADR-013) | owner executes; sonnet triages |
| W1-513 `[DEVICE]` | Mid-range Android: TalkBack on Chrome for all P1 packs; physical input packs; floor suite; perf gates | G6, owner device | Same as W1-512; select-only combobox result recorded for APG 2855 lead | owner executes; sonnet triages |
| W1-514 | Desktop AT runs: NVDA with Chrome and Firefox, JAWS with Chrome or Edge, VoiceOver with Safari on macOS (ADR-013 L4 P1 matrix) | G6, owner (see Section 10) | Same protocol; exact builds recorded | owner executes; sonnet triages |
| W1-515 | Q3 and Q4 resolution: focus-zoom outcome; `listboxMount` result per pointer class; ADR amendment draft if a mapping flips (only on dated P1 evidence, ADR-005 step 8) | W1-512, W1-513 | Decision recorded with evidence refs; no user-agent sniffing introduced (ADR-005) | sonnet |
| W1-516 | Final evidence manifest: complete, signed, dated; known upstream issues listed with corrected wording (risk 2) | W1-512 to W1-515 | Manifest has zero pending rows; every failed case is fixed or recorded as a tracked known issue with an owner | sonnet |
| **G7** | fable final audit plus owner certification | W1-516 | Wave-1 certified only after PASS and owner sign-off | fable plus owner |

---

## 8. Audit gates (summary)

fable audits and never implements. A gate FAIL returns a numbered MUST list; fixes are tasks in the failing milestone; the gate re-runs.

| Gate | Blocks | Pass condition |
|---|---|---|
| G0 | M1, M2, M3 | W1-001 to W1-009 done; seeded-failure proof for each quality gate; CI green; no runtime dependency in `core`; scaffolds match ADR-002 table; no prior-brand terms |
| G1 | M4 | Kernel modules meet or formally amend ADR-011 ceilings; invariants (ADR-003, ADR-006) hold under fast-check; overlay parity oracle passes (ADR-005); SSR determinism passes (ADR-003) |
| G2 | M4 | Schema, codegen equivalence, registry drift, MCP, lint, and the probe component through L1 to L3, L5, L6 on all adapters (ADR-010, ADR-013); CSS gates fail on seeded breakage (ADR-009) |
| G3A to G3E | next group (see Section 6.3) | Per-group criteria above; each audit reads the contract, the code and the evidence, not the executor's summary |
| G4 (optional early) | none | A sample audit of 505/506 packs for completeness against ADR-013 L4; can run while M4 is in progress |
| G6 | device lane | Everything automatable green; packs complete; manifest drafted |
| G7 | certification | Real-AT and device results complete, manifest signed; owner approval |

---

## 9. Parallelization map

Rule: a stream owns a set of directories; no two streams in the same phase share a file. Shared files (`package.json` exports, barrels, `registry.json`, `ci.yml`) are either pre-stubbed in W1-005, generated in W1-304, or owned by exactly one task as noted. Each stream is one git worktree and one `feature/<slug>` branch.

**Phase P0 (M0).** Order: W1-001 first (it owns root scripts). Then in parallel: S1 W1-002 (vitest files), S2 W1-003 (`.github/workflows/ci.yml`), S3 W1-004 (hooks), S4 W1-005 (new packages), S5 W1-008 (tokens), S6 W1-009 (docs/evidence). Then W1-006 and W1-007 (both under `packages/testing/**` in different subfolders) in two streams. No overlap.

**Phase P1 (after G0).** Six streams run at once:

| Stream | Tasks | Owns |
|---|---|---|
| K1 | W1-101, W1-102, W1-103, W1-104 (sequence) | `core/src/{store,ids,runtime,effects}` |
| K2 | W1-105, W1-111 | `core/src/{merge,live}` |
| K3 | W1-106, W1-107 (after K1 W1-101/102/104) | `core/src/{collection,focus,typeahead}` |
| K4 | W1-108, W1-109, W1-110 (after K1 W1-101/103/104, K3 W1-106 for 109) | `core/src/overlay` |
| K5 | W1-112 | `core/src/kinds` |
| S-CSS | W1-201 to W1-205 | `packages/css` |
| S-CON | W1-301, W1-302, W1-303, W1-305, W1-306 | `packages/contracts`, `apps/site` (W1-306 owns the MCP block of the worker; W1-307 later owns the lint block) |
| S-TEST | W1-308 to W1-313 (308 first) | `packages/testing/**` subfolders (one per task) |

W1-304 (codegen) waits for W1-112 and W1-301/303. W1-113 and W1-114 close M1. W1-314 comes last in M3 (sole owner of workflows after W1-003).

**Phase P2 (M4).** Within a component: .b, .c, .d, .e in four worktrees after .a. Across components, parallel when they touch distinct directories (they do: each component has its own subfolders, all barrels are generated):

- Wave A: C01 and C03 in parallel (two 6-task streams). C01 is the golden for CSS and adapter structure; C03 starts adapters once C01.c/.d/.e freeze the layout (two to three days of lead is enough; the plan only requires that C03.c/.d/.e start after C01's equivalents pass review).
- Wave B: C02 and C11 in parallel. C11 needs W1-111 and a live-region consumer; C02 needs W1-112.
- Wave C: C04, C05, C06 in parallel (C06 has no collection dependency; it may start with Wave B).
- Wave D: C07 first (opener stack and close tiers), then C08 and C09 in parallel (C09 needs the manual popover stack from the overlay kernel only, not C08's code).
- Wave E: C10 starts after C08 (listbox over overlay) and C05 (collection in practice); its `.a` may begin earlier against G1 since C10 uses the same kernel.
- M5 prep (W1-501, 502, 504, 505, 506, 507, 508, 509, 510) runs in parallel with all of M4 in separate worktrees; they touch `evidence/`, `testing/perf`, `testing/at`, `.github/workflows/release.yml` only.

Sync cadence: every stream rebases on `main` before each push and after each merged sibling; a contract schema change (W1-301 revision) is a broadcast event that all streams must rebase on before continuing.

---

## 10. Risks, containment, and what needs the owner

### 10.1 Risks and containment

| Risk (ADR-reference) | Containment in this plan |
|---|---|
| Provisional byte and p95 ceilings are wrong (ADR-011, risk 3, Q2) | W1-007 harness exists before the first kernel module; W1-113 measures; changes only by ADR with the 50% rule; G1 enforces |
| Contract schema churns after composite contracts exist (risk 6) | W1-302 builds Button and Switch contracts first; schema frozen at G2; changes after G2 are a broadcast rebase |
| Fallback matrix cost (risk 1, ADR-013) | Forced-false `supports` runs for breadth (W1-309); real floor lane only per release and on fallback changes (W1-503); affected-component CI selection (W1-314) |
| Geometry fallback drifts from CSS policy (ADR-005) | Parity oracle W1-110 plus per-component L6 paths; G3D audits it |
| AT evidence ages (risk 2) | Dated log (W1-009), packs rerun on every RC (W1-505), no permanent claims; only WebKit 289338 and APG 2855 are cited, with softened wording |
| Devices arrive late or are updated (risk 5, D2) | `[DEVICE]` tasks isolated to M5 tail; everything else proceeds; W1-504 states pinning rules; owner action in 10.2 |
| Floor drift (risk 4) | Floor is a single registry (ADR-001); BCD check W1-510; revisit at major release, not in wave 1 |
| Token gaps tempt raw values (risk 11) | W1-008 lands in M0 before CSS; W1-202 rejects raw values |
| Consumer resets beat layers (risk 9) | Documented in W1-201 and tested with an unlayered override fixture |
| Injection in vanilla adapter (risk 10) | W1-311 text-safety test on every adapter, run for every component |
| Licence or provenance slip (risk 8) | W1-009 clean-room notes, W1-509 gate, W1-501 evidence references concepts only |
| Native-on-touch fragments visual identity (risk 7) | Equivalence tests; design acceptance of platform pickers is an owner item |
| Executor drift: a model quietly adds a runtime dependency or invents a token | Lint boundaries (W1-006), licence gate (W1-509), token-only stylelint (W1-202), registry-derived MCP answers (W1-306), fable audits at every gate |
| Parallel streams collide | Pre-stubbed exports, generated barrels, single-owner files, rebase cadence (Section 9) |
| Plan size (66 component tasks plus 60 infrastructure tasks) exceeds a focused session each | Template tasks are sized to one session: .a and .f are the largest; if either exceeds one session the executor splits at the getters freeze or at the spec fixture and records the split in the task note |

### 10.2 What needs the owner

| Item | When needed | Detail |
|---|---|---|
| **iPhone on iOS 17** (floor) | W1-512, floor lane, kinds packs | Device pinned to its OS with auto-update disabled; iOS cannot be downgraded afterwards (risk 5). Note the ADR-011 gate names iPhone 15; an iPhone 15 shipped with iOS 17, so a single device can serve both roles if its model matches. If not, an ADR amendment records the actual device |
| **Mid-range Android** | W1-513 | Chrome at the floor-compatible version, TalkBack on. The ADR-011 gate names Moto G Power 5G (2024); if the device differs, amend the gate device by ADR |
| **Desktop AT environments** | W1-514 | D2 as worded covers mobile only. The P1 matrix also needs NVDA (Windows plus Chrome and Firefox), JAWS (licence plus Chrome or Edge) and VoiceOver on a Mac. Please confirm who provides the JAWS licence and a Windows machine, or choose a hosted service (D2 option B) for these |
| **npm publish** of `@ramoslabs/core`, `css`, `contracts`, `react`, `vanilla`, and a new version of `vue` | After G7 | The `@ramoslabs` scope exists for tokens; confirm the scope allows the new packages and that publish credentials are used by the owner only. This plan never publishes |
| **PR opening and merges to `main`** | Every stream | Executors push feature branches autonomously; the owner opens PRs and merges (user workflow) |
| **Sign-off of platform-picker visual acceptance** | G3E | Risk 7: design approval that native pickers on touch are acceptable |
| **ADR amendments** | If G1 or W1-515 propose them | Ceiling or `listboxMount` changes are ADRs, approved by the owner |
| **Approval of the two additions** | G0 | (1) a private `packages/testing/lint` for rules (ADR-002 lists `testing` as private; no new published package); (2) `SJForm` ships only as the minimal owner context ADR-014 implies |
| **Release sign-off (G7)** | End | Final evidence manifest signer |

### 10.3 What can proceed before the devices arrive

Everything except W1-512, W1-513 and the device column of W1-502/503: all of M0 to M4, all automatable M5 items (501, 502 on desktop, 503 on desktop floor engines, 504 to 511), and G0 to G6. The device lane starts only after G6, so the first device session receives complete scripts, templates, pinned builds and a drafted manifest, and the final real-AT sign-off becomes a data-collection task, not a build task.

---

STATUS: DRAFT-FOR-AUDIT
