# AUDIT: PLAN-WAVE-1.md (round 1)

Auditor: ds-fable. Date: 2026-10-27. Subject: `docs/architecture/PLAN-WAVE-1.md` at commit `8125804` (STATUS: DRAFT-FOR-AUDIT).
Reference: `ARCHITECTURE.md` CERTIFIED 2026-10-27 (14 ADRs), `BRIEF.md`, the repo tree at the same commit.
Method: every task's acceptance criteria were traced to the ADR text; every "Depends on" cell was checked against the files each task owns; the parallelization map was checked for same-file edits; ADR-011 and ADR-013 were read line by line against the plan; the repo was inspected for the facts the plan asserts about the current state. Only the plan is audited; no git, no edits to the plan.

## Verdict: NOT-APPROVED

Five MUSTs. The plan is well structured and almost everything in ADR-011 and ADR-013 is present (see (d)), but it omits three kernel-level deliverables that every adapter task consumes, tells one stream to start before its inputs exist, and lets parallel streams edit four shared files. The two additions in (e) fit the existing ADRs; no new ADR is needed. Fix the MUSTs and re-audit; the SHOULDs can be folded into the same revision.

---

## (a) Acceptance criteria: traceability and verifiability

**Traceable.** 55 of 58 infrastructure tasks and all six template sub-tasks cite the ADR they satisfy, and the citation matches the ADR text (checked individually; the byte numbers, the `@layer` string, the WCAG list, the kinds rules, the close-tier versions and the `<details name>` version tuples all match). Component-specific criteria in 6.2 match ADR-005 steps 1, 5, 6, 7, 8, ADR-006, ADR-007, ADR-008 rules 2 and 3, ADR-011 derived totals and ADR-014.

**Not traceable or not decidable.**

- **MUST-4.** W1-107: "bytes counted inside the 3 KiB kernel total or within the 8 KiB complex ceiling, whichever the measurement shows". This criterion cannot fail. ADR-011's rationale places typeahead inside the collection + focus kernel ("a primitive core plus typeahead and active-id bookkeeping"), so the ceiling is the 3 KiB one. Correction: replace with "the typeahead sub-entry counts toward the 3 KiB collection + focus ceiling; if the measurement misses, W1-113 drafts the ADR amendment; the task does not pass by reclassifying the bytes".
- **MUST-5.** W1-305 names "root `registry.json`" and a "drift check" against it. No root `registry.json` exists: the file is generated at site build by `apps/site/agentic/integration.ts` (`buildRegistry`, `components: []`) together with `llms.txt` and `llms-full.txt`. As written the task would create a second registry and its drift criterion has no reference. Correction: W1-305 makes `apps/site` depend on `@ramoslabs/contracts` (workspace, dev), `buildRegistry` fills `components` from the contracts, the drift check in CI compares the built `registry.json` against a fresh generation from the contracts, and the `$schema` file is emitted by the same integration. Files: `apps/site/agentic/integration.ts`, `apps/site/package.json`; no root file.
- **SHOULD-12.** Three citations point at numbering that does not exist: W1-004 "ADR-002 principle 3", C01 and C03 "ADR-001 principle 1". The principles are Section 1.2 of ARCHITECTURE.md (3 = zero runtime dependencies, 1 = native-first). Correct the three cells to "Section 1.2 principle n" (C01/C03 may add ADR-008 rule 1).
- **SHOULD-2.** W1-203 asserts build-time contrast "in light and forced-colors fallbacks". Forced-colors uses system colors chosen by the user; no ratio can be computed from tokens. Correction: the build-time matrix is light theme only (as ADR-009 states); forced-colors becomes an L3/L5 probe fixture under `forced-colors: active` emulation in W1-204 and in each `.b`.
- **SHOULD-4.** W1-502 "the five ADR-011 interaction gates". Two of the five have no wave-1 subject: the editable combobox filter at 1,000 items (SJCombobox is wave 2) and fixed-size virtual scroll at 10,000 rows (no virtualized component in wave 1). Correction: W1-502 scripts three scenarios (roving step on C04/C05, overlay open on C07/C08, 1,000 mount/destroy on every component) and the manifest records the other two as not-applicable with that reason (ADR-013 case totals require the reason).

Everything else in (a) is decidable: each criterion names a fixture, a seeded failure, a number, or a file that a reviewer can open.

## (b) Dependency order

The task tables are internally consistent (no task lists a dependency that is defined later in its own milestone, and every kernel task depends on the store before using it). The defects are in what the narrative claims about the tables and in what no table contains.

- **MUST-1. Three ADR-003 deliverables have no owning task, and tasks that need them are scheduled before M4.**
  1. *Adapter runtime bridges.* ADR-003's bridge table (React `useSyncExternalStore` with `getServerSnapshot`, Vue `shallowRef` + `markRaw` in an effect scope, vanilla `mount/update/destroy` with one `AbortController`), the per-framework `SJProvider` (W1-103 delivers only the core contract type), and the post-commit effect drain (`useLayoutEffect`/`useEffect`, `watch(...,{flush:'post'})`, post-patch microtask) are not built by any task. W1-114 "render each fixture server then client", W1-309 "host pages per adapter", G2 "probe through every layer on all adapters" and every `.c/.d/.e` consume them. Under the P2 map, C01 and C03 run in parallel, so two streams would each write `react/src/runtime/**`.
  2. *Controlled/uncontrolled pipeline.* ADR-003 "one request/commit pipeline": `getProps()` read at derive and transition time, controlled props overlaid in the derived view, native events reporting actual native state, corrective post-commit native effect when controlled `open` stays true after native Escape, dev throw on ownership switch after mount. W1-308 tests "controlled rejection" but nothing implements the overlay. C05, C07, C08 and C10 are controllable; each `.a` would invent it.
  3. *Probe component.* W1-308, W1-309 and G2 all refer to "the probe" (contract, core, CSS, three adapters); no task creates it.

  Correction: add to M1 `W1-115` controlled/uncontrolled pipeline (`core/src/controlled/**`, depends W1-101, W1-105; criteria: the four ADR-003 rules above as fixtures); add `W1-120/121/122` adapter runtimes (`react/src/runtime/**`, `vue/src/runtime/**`, `vanilla/src/runtime/**`, depends W1-101, W1-103, W1-104, W1-115; criteria: the bridge row of ADR-003 per framework, `SJProvider` per framework with the fallback-plus-warning, 1,000 mount/destroy retains nothing, StrictMode double invocation safe); add to M3 `W1-316` probe component (`testing/probe/**`: `probe.contract.json`, a two-state reducer, `probe.css`, one component per adapter; depends W1-120 to W1-122, W1-301, W1-201). G1 covers W1-115 and W1-120 to W1-122; G2 requires W1-316 through L1 to L3, L5, L6. Template `.c/.d/.e` gain "depends on W1-12x" and "uses the shared runtime, never a local bridge" (lint rule in W1-006: adapters may import the store only through `<pkg>/src/runtime`).

- **MUST-2. S-TEST cannot start at G0.** Section 1 says "M1, M2 and M3 run in parallel after G0 (M3 needs only the kinds table of W1-109 for one equivalence check)" and Section 9 lists S-TEST among the "six streams [that] run at once". The tables say otherwise: W1-308 depends on W1-101 and W1-104; W1-309 on W1-114, which depends on W1-102 and W1-103; and (MUST-1) on the adapter runtimes. The cross-milestone input for codegen is W1-112, not W1-109 (W1-109 is overlay behaviour). An executor following Section 9 would build the reducer harness against a store that does not exist. Correction: rewrite the Section 1 sentence as "M2 and S-CSS, S-CON start at G0; W1-304 waits for W1-112; S-TEST starts when K1 (W1-101 to W1-104), W1-114 and W1-120 to W1-122 are merged"; optionally split W1-308 into 308a (contract to semantic-action derivation, pure data, starts at G0) and 308b (reducer harness, after K1). Fix Section 9 P1 accordingly and list W1-304, W1-307, W1-113, W1-114, W1-314 and W1-316 as rows with their owners (they are missing from the table).

- **SHOULD-3.** W1-205 "checked against contracts once W1-301 exists" is a real dependency not in its "Depends on" cell. Add "W1-301 (contract check only; template may land earlier)".
- **SHOULD-4 (second half).** Section 9 says M5 prep including W1-502 "runs in parallel with all of M4", but W1-502 depends on C07 and C10. Split: 502a harness and trace capture (after G1, parallel with M4), 502b scenarios (after C07, C10).
- **SHOULD-1.** Section 6.3 "a group gate must PASS before the next group's `.a` tasks start only where it adds a kernel part" is not decidable: no component adds a kernel part (all kernel parts are M1). State the rule as data: G3A hard-blocks every later `.b/.c/.d/.e` (Button is the golden); G3D blocks C10 `.c/.d/.e` (listbox over the proven overlay); G3B, G3C, G3E block only G6. Everything else proceeds on its table dependencies.

## (c) Parallelization map: same-file edits

- **MUST-3. Four shared files are edited by parallel streams; one directory has three writers.**
  1. *Root `package.json` in P0.* W1-001 is "sole owner of root scripts", but W1-002 (vitest, fast-check), W1-004 (lefthook plus the `prepare` script so hooks install on `bun install`) and W1-005 (`@changesets/cli`) each add root devDependencies while running in parallel. Correction: W1-001 adds every P0 devDependency up front (eslint, prettier, stylelint, vitest, fast-check, lefthook, @changesets/cli, typescript already present) and the `prepare` script; 002/004/005 then touch no root file. Add to Section 9: "`bun.lock` is never merged by hand; after a rebase run `bun install` and commit the regenerated lockfile".
  2. *`packages/css` full file in P2.* W1-201 ships "per-component files plus a full file"; every `.b` must add its `@import` to the full file, so eleven parallel streams edit it. Correction: W1-201 generates the full file from a glob of `css/src/*.css` at build time (committed output regenerated, or uncommitted `dist` only).
  3. *`budgets.json` in P2.* W1-007 holds "the budget table as data"; every `.a` must add its row. Correction: `budgets.json` holds only the shared-kernel rows (store, overlay, collection, live, kinds, 0 KiB fixture); component ceilings are read from each contract's `budgets` block (ADR-010 already defines `budgets.gzipKiB` and `shared[]`), so a component adds no shared file.
  4. *`packages/testing/package.json`.* W1-309 (playwright), W1-310 (axe), W1-507 (guidepup) each add devDependencies; 309 and 310 are sequential, 507 runs in parallel with M4 and with any `.f` fix-up in `testing/`. Correction: W1-005 declares the full `testing` devDependency set at scaffold time.
  5. *`packages/testing/lint/`.* Written by W1-006 (P0), W1-202 (S-CSS, P1) and W1-307 (S-CON, P1); 202 and 307 are parallel, and W1-307's "raw values" rule duplicates W1-202's. Correction: subfolders `testing/lint/{boundaries,stylelint,contract}/`, one owner each; W1-307 drops "raw values".

- **SHOULD-11.** W1-304 writes `core/src/**/generated/**`, inside the module directories that K1 to K5 own in the same phase. Different files, but the same directories, and committed generated files conflict on every rebase. Correction: generated output lives in `core/src/generated/<module>/` (and `<adapter>/src/generated/`), owned by W1-304 only; Section 9 adds "generated files are regenerated after rebase, never merged".
- The rest of the map holds: K1 to K5 own disjoint `core/src/` directories; S-CSS owns `packages/css`; S-CON owns `packages/contracts` and the worker file in sequence (305 then 306 then 307); S-TEST uses one subfolder per task; M4 components own distinct subfolders and barrels are generated; M5 prep touches `evidence/`, `testing/perf`, `testing/at`, `release.yml`. **NICE-7:** W1-509 and W1-510 also need a home (`testing/licence/`, `testing/bcd/`) and W1-314 "sole owner of workflows" should read "sole owner of `ci.yml` and `e2e.yml`" since `release.yml` is written by M5 prep.

## (d) ADR-011 and ADR-013 presence

**ADR-011 byte ceilings: all present.** Store 1 KiB (W1-101), simple primitive 3 KiB (template `.a`, explicit in C02 and C05), complex 8 KiB (C10), overlay + geometry 4 KiB combined (W1-108 + W1-109), collection + focus 3 KiB (W1-106; see MUST-4 for W1-107), live-region 1 KiB (W1-111), kinds 2 KiB (W1-112), unused component 0 KiB (W1-007), adapters reported separately (W1-007). Derived totals: Popover 8 (C08), Tooltip 8 (C09), Select 16 (C10), Input 6 (C02). Revision measurement and the 50 % rule (W1-113, 10.1). Raw bytes and import graph (W1-007). **NICE-5:** Dialog has no fixture total; state 3 + 1 + 4 = 8 KiB, or declare overlay placement and behaviour as separate artifacts so Dialog pays only the behaviour half (this needs an ADR-011 amendment, so prefer the former).

**ADR-011 interaction gates: present with two gaps.** Roving step, overlay open (C07 and W1-502), 1,000 mount/destroy (W1-101, template `.e`, `.d`). Combobox filter and 10,000-row virtual scroll: see SHOULD-4 (record as not-applicable). **SHOULD-10:** template `.c` (Vue) lacks the retention criterion that `.d` and `.e` carry; add "1,000 mount/destroy retain nothing; effect scope disposed".

**ADR-011 rules: one gap.** "Pointer Events with declared `touch-action`; passive non-canceling listeners; direct listeners; observers disconnected" has no check anywhere in the plan. **SHOULD-5:** W1-006 adds two lint rules (an adapter `addEventListener` without the instance `AbortController` signal; a `wheel`/`touch*`/`pointer*` listener that is neither `passive` nor calls `preventDefault`), and template `.e` gains "every listener carries the instance signal; `touch-action` declared on every pointer-handling part".

**ADR-013 layers and gates: all present.** L1 (W1-002, W1-308, fast-check adversarial cases), L2 three engines x three adapters, IDREF and focus assertions, text-safety, ARIA snapshots, CDP AX tree and IME (W1-309, W1-311), L3 axe with `target-size` plus the seven named WCAG 2.2 gates with PR versus release timing (W1-310), L4 P1/P2 packs with every field of the ADR list, Guidepup as regression only (W1-505, W1-507, W1-512 to W1-514), L5 hermetic with production fonts and no update-all (W1-312), L6 matrix with `path` and forced-false runs (W1-309, W1-313). Per-PR gates each have a CI job (W1-314). Per-release: P1 AT, physical input packs, parity report, control/candidate, licence/provenance, BCD regeneration, evidence manifest with every field (W1-506, W1-313, W1-502, W1-509, W1-510, W1-508). Real floor lane with pinned 114/125 and no emulation (W1-503). D2 device tasks isolated (W1-512, W1-513). **SHOULD-6:** two ADR-013 sentences have no task: "stable branded browsers" for release runs, and "retries diagnose but never certify". Add to W1-511: the release suite runs on branded channels where Playwright offers them (`chrome`, `msedge`; Firefox via a branded `executablePath`; WebKit stays the Playwright build and the manifest says so) with `retries: 0`, and W1-309 sets `retries: 0` for any run that feeds the manifest.

## (e) The two additions

**(1) Private `packages/testing/lint`.** ADR-002 lists `@ramoslabs/testing` as "spec runner, fixtures (private, unpublished), dev only". ADR-002 consequences require "dependency direction enforced by lint" and ADR-010 requires "the contract drives ESLint/stylelint rules" without naming a home. The plan already puts two other CI tools there (W1-007 size, W1-203 contrast). A lint subfolder of the private testing package adds no published package, no runtime dependency (W1-509 guards it) and no new decision. **Verdict: fits ADR-002 and ADR-010; no new ADR.** Conditions: it is a subpath of `@ramoslabs/testing` (`./lint` export), not a separate workspace package; and the ADR-002 table's Role cell for `testing` is widened by one editorial line ("spec runner, fixtures, lint rules, size and contrast tooling") recorded in the architecture changelog at G0, so the certified document and the repo agree.

**(2) Minimal `SJForm` owner context.** ADR-014 already decides it: "The form owner (`SJForm` context) supplies `enterkeyhint` position and tracks entered values for 3.3.7", and ADR-007 computes `enterkeyhint` "by the form owner". It is a named part of the certified architecture, not an addition; only Section 4's component list omits it. **Verdict: fits ADR-014 and ADR-007; no new ADR.** Conditions: (i) scope is exactly the two ADR-014 duties (Enter position from field order with textarea kinds excluded, retained values offered for 3.3.7) plus the context plumbing; no validation orchestration, no submission handling beyond the native `<form>`; (ii) because it is exported as `SJ*`, ADR-010 and BRIEF constraint 7 require a contract: a minimal `form.contract.json` (anatomy root = `form`, no state machine, `runtime`, `props`, `events`) so registry, MCP and lint know it; (iii) Section 4 of ARCHITECTURE.md gains one editorial line under item 2 ("plus the `SJForm` owner context of ADR-014") in the changelog at G3B. The plan's G3B check "`SJForm` scope confirmed as minimal" stays.

## (f) Tasks too large for one session

The plan's own containment ("the executor splits at the getters freeze") is a fallback, not a plan. Pre-split these now so the parallelization map and the gates can name the halves.

- **SHOULD-8.** C03 covers two components (SJSwitch, SJCheckbox: two contracts, two reducers, two ADR-011 ceilings) and C02 covers three (SJField, SJInput, SJForm) in one six-task set. Split C03 into C03s (Switch, the golden for native-input components) and C03c (Checkbox, after C03s `.a`, sharing CSS); split C02.a into a1 (SJForm context + SJField: ids, IDREFs, error announcement) and a2 (SJInput: kinds in a rendered input, `:user-invalid` fallback). State the ceilings per component: SJField 3 KiB, SJInput 3 KiB, SJForm context inside SJField's 3 KiB; ADR-011's "SJInput 6 KiB" fixture does not say whether SJField is inside it, so the plan must say which fixture it measures (recommend: SJInput alone = 6 KiB; SJField + SJInput + SJForm fixture reported in W1-113 and taken to an ADR amendment only if it matters). Split C10.a into a1 (native `<select>` preset plus the touch equivalence test) and a2 (custom listbox compound).
- **SHOULD-9.** W1-106 is two modules (collection: registration, key-to-id, successor; focus: strategies, `data-active`, scope and return). Split into 106a `core/src/collection/**` and 106b `core/src/focus/**` (after 106a). W1-112 is a table resolver plus a six-locale number parser: split into 112a `resolveKind` + `enterkeyhint` and 112b parser. W1-309 is a runner, three host pages, a `supports` injector, ARIA snapshots, CDP AX tree and CDP IME: split into 309a runner + host pages + action executor, 309b `supports` injection and forced-false paths, 309c ARIA snapshots + CDP AX + IME. W1-109 is large but single-purpose; keep it, but W1-113 and G1 should receive it last.
- W1-005 (six scaffolds plus every pre-stubbed export plus changesets) is mechanical and acceptable for haiku if MUST-3 moves the devDependency lists into W1-001 and W1-005 itself.

## Findings index

| ID | Severity | Where | One-line correction |
|---|---|---|---|
| MUST-1 | MUST | M1, M3, template | Add W1-115 controlled pipeline, W1-120/121/122 adapter runtimes, W1-316 probe; wire G1, G2, `.c/.d/.e` |
| MUST-2 | MUST | §1, §9 P1 | S-TEST starts after K1 + W1-114 + runtimes; codegen input is W1-112; add missing rows |
| MUST-3 | MUST | §9 P0/P2, W1-001/005/007/201/307 | Root devDeps in W1-001; glob-built css full file; component budgets from contracts; testing devDeps in W1-005; lint subfolders |
| MUST-4 | MUST | W1-107 | Typeahead bytes count toward the 3 KiB kernel; miss goes to W1-113 |
| MUST-5 | MUST | W1-305 | Fill `components` in `apps/site/agentic/integration.ts` from contracts; no root registry |
| SHOULD-1 | SHOULD | §6.3 | Gate blocking as data: G3A blocks later adapters, G3D blocks C10 adapters, others block G6 |
| SHOULD-2 | SHOULD | W1-203 | Build-time contrast light only; forced-colors as emulated fixture |
| SHOULD-3 | SHOULD | W1-205 | Declare W1-301 dependency |
| SHOULD-4 | SHOULD | W1-502, §9 | Three applicable gates, two not-applicable with reason; split 502a/502b |
| SHOULD-5 | SHOULD | W1-006, `.e` | Lint for listener signal, passive listeners, `touch-action` |
| SHOULD-6 | SHOULD | W1-511, W1-309 | Branded channels on release, `retries: 0` for manifest runs |
| SHOULD-7 | SHOULD | W1-304, `.c/.d` | Generated types file per component; `classes` per-part overrides and prop-or-slot in presets |
| SHOULD-8 | SHOULD | C02, C03, C10 | Pre-split; state per-component ceilings and the Field + Input fixture |
| SHOULD-9 | SHOULD | W1-106, 112, 309 | Pre-split as listed |
| SHOULD-10 | SHOULD | template `.c` | Add retention and effect-scope criteria |
| SHOULD-11 | SHOULD | W1-304, §9 | Generated output under `src/generated/`, regenerate never merge |
| SHOULD-12 | SHOULD | W1-004, C01, C03 | Cite Section 1.2 principles, not ADR principles |
| NICE-1 | NICE | §8 | Gate numbering skips G5 (G0, G1, G2, G3A-E, G4, G6, G7); renumber or reserve |
| NICE-2 | NICE | §10.1 | Infrastructure task count is 58 (9 + 14 + 5 + 14 + 16), not 60 |
| NICE-3 | NICE | §2 current state | Root already has `lint` and `typecheck` Turbo scripts; `apps/storybook` exists and is unmentioned (Turbo lint will include it; W1-312 may reuse or must exclude it) |
| NICE-4 | NICE | §0 D1 | "ADR-001 option B" is the owner table's option A; cite both |
| NICE-5 | NICE | C07 | State the Dialog fixture total (3 + 1 + 4 = 8 KiB) |
| NICE-6 | NICE | W1-504, W1-114 | Android Chrome pin method (sideloaded floor APK, Play auto-update off); vanilla SSR run with injected `idFactory` |
| NICE-7 | NICE | §9 M5 prep, W1-314 | Homes for W1-509/510; "sole owner of `ci.yml` and `e2e.yml`" |
| NICE-8 | NICE | W1-204 | Add ADR-005 step 9 `dvh`/`svh` and ADR-008 48 dp check, no overlapping hit areas |

Re-audit trigger: a revision that resolves MUST-1 to MUST-5 and states which SHOULDs were applied or declined with a reason.

PLAN-AUDIT-1 DONE
