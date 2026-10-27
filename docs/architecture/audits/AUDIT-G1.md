# AUDIT G1: kernel and runtimes (W1-009, W1-101..115, W1-120..122)

Auditor: ds-fable. Date: 2026-10-27. Subject: `main` at `b63a075` (read-only; local `main` fast-forwarded to `origin/main`, no edits). Scope: PLAN-WAVE-1 section 3 rows W1-101..115 and W1-120..122, W1-009 as G1 precondition, the G1 pass condition (plan line 229), the three orchestrator decisions in `evidence/kernel-sizes.md`, and the ten stream notes.
Method: (1) every row's acceptance cell read against its ADR text (ADR-001..007, 011, 013) and the code under `packages/core/src/{store,ids,runtime,effects,merge,controlled,collection,focus,typeahead,overlay,live,kinds,number}` and `packages/{react,vue,vanilla}/src/runtime`; (2) `TURBO_FORCE=1 bun run gate` run by me; (3) `node packages/testing/size/cli.js` run by me and compared byte for byte with the W1-113 report; (4) 16 seeded probes against core and one each against the React and vanilla bridges (scripts under my scratchpad, nothing written to the repo); (5) test inventory (fast-check files, retention, StrictMode, SSR) read from the suites.

## Verdict: FAIL, four numbered MUSTs

The kernel is in good shape: every ADR-011 ceiling holds with no amendment needed, core reads no globals, the three runtimes prove zero retention over 1,000 cycles, ADR-003/006 invariants are under fast-check in fourteen core suites, the controlled pipeline has its four fixtures, the parity oracle runs 29 fixtures plus a 2,000-run property, and W1-009 is complete. Four defects block M4: two bridges silently delay effect-only dispatches, the tier-1 dialog close desynchronises the overlay stack when a consumer prevents `cancel`, the vanilla live region is visible, and the G1 condition "SSR determinism" (W1-114) was never delivered. All four are small; a file-level re-check suffices, no new round.

## Gate and ceilings

`TURBO_FORCE=1 bun run gate`: exit 0 (lint, format, typecheck, test, build, size, contracts, evidence, honesty). Size CLI output matches the W1-113 table exactly:

| Row | gzip | ceiling | used |
|---|---|---|---|
| store | 282 B | 1 KiB | 27 % |
| overlay | 2,365 B | 4 KiB | 58 % |
| collection + focus + typeahead | 1,581 B | 3 KiB | 51 % |
| live | 333 B | 1 KiB | 33 % |
| kinds + number | 1,711 B | 2 KiB | 84 % |
| fixture (unused component) | 0 B | 0 | pass |

No ceiling missed, no ADR-011 amendment required or proposed; I concur. Rows are measured without a `NODE_ENV` define, so dev strings are included: the numbers are conservative. The `size` task is `cache: false` (#11), closing K1's open item.

## Status per task

| Task | Status | Verified how |
|---|---|---|
| W1-009 | **Done** | Manifest schema carries every ADR-013 field (specVersion, sourceRevision, toolVersions, environmentMatrix, caseTotals with notApplicable reasons, axeScope, visualBaselineRevision, atResults with per-AT `test_status`, evidenceRegistrySnapshot, knownUpstreamIssues, performanceTraces, bcdDatasetVersion, signer, date); status enum `run | not run | unavailable` with `reason` on atResult and environment. Issue-log template has every ADR-006 field (minimal repro, expected and actual speech, versions, retest result). Devices registry: six rows, all `not run` with reasons |
| W1-101 store | Pass | 282 B; no-op dispatch returns the same reference and notifies nobody; deduped subscribe; idempotent destroy; 1,000 create/destroy in the suite; no module state. NICE-1 on dedupe semantics |
| W1-102 ids | Pass | Pure functions; `cssEscape` matches CSSOM on my vectors (`1a`, `-`, `a b`, `:r1:`, `-1x`); `encodeKey` and `safeName` injective (seeded `~`/`_`). NICE-2 |
| W1-103 runtime | Pass | No `navigator`/`document` read anywhere in `core/src` (grep, non-test); server default all-false and fake scheduler; `serializeRuntime`/`withSupports`; contract schema lists `runtime` provenance. SHOULD-1 on the client default, SHOULD-2 on the key list |
| W1-104 effects | Pass | Seeded: stale (same type+target, older version) dropped, missing target dropped, re-entrant drain is a no-op, `EFFECT_ORDER` open < close < geometry < focus < announce; fast-check suite |
| W1-105 merge | Pass | Seeded: consumer `aria-*` the library does not set is kept, owned keys win, warning sink; fast-check "no spread overrides owned keys". NICE-5 |
| W1-115 controlled | Pass | The four fixtures exist by name (overlay never copied, getProps at derive and transition, corrective effect without re-dispatch, dev throw on switch) plus a determinism property. SHOULD-4 (reducer context), NICE-4 |
| W1-106a collection | Pass | Successor property test; seeded "removed not in prev" returns first enabled survivor; no `compareDocumentPosition` |
| W1-106b focus | Pass with SHOULD-3 | Strategy table matches ADR-006; both-strategies throws; `aria-activedescendant` written only for a mounted element; one `focus({preventScroll})` plus one `scrollIntoView`. Seeded: `native-roving` and `native` focus the container, not the active item |
| W1-107 typeahead | Pass | Seeded: repeated-char cycling, diacritics kept (`é` matches Éclair, `e` does not), composition and `keyCode 229` ignored, 500 ms buffer on the injected scheduler; bytes inside the 3 KiB row |
| W1-108 placement | Pass | Pure evaluator; parser rejects `span-*`, `flip-start`, unknown tokens; no rAF; `native: true` makes add/request no-ops. Open: NICE-6 (L6 lane) |
| W1-109 behavior | **MUST-2** | Escape order, nesting, dismissal and `listboxMount` verified by seed; tier 2 with prevented `cancel` keeps the entry; tier 1 with prevented `cancel` drops it |
| W1-110 parity | Pass | 29 versioned fixtures through fallback and independent reference, 2,000-run property, seeded divergence; L6 browser lane not scripted (NICE-6) |
| W1-111 live | Pass | 333 B; nothing exists before `attach`; dedupe, `alert` only by option, active-descendant text dropped; seeded |
| W1-112a kinds | Pass | Table generated from `kinds.contract.json` with drift guard; seeded: no `maxlength` on any kind, `otp` done/go, form-owner hints `[next, next, done]` |
| W1-112b number | Pass | Seeded 17 cases across de/en/es/fr/pt and Arabic-Indic: all canonical; `-` only when signed; `+` rejected; leading zeroes kept; no `parseFloat` |
| W1-113 report | Pass | Bytes reproduced exactly; graphs match; decisions ruled below |
| W1-114 SSR runner | **MUST-4** | `packages/testing/ssr` does not exist; no commit on `main`; S-TEST was unblocked when W1-120..122 merged |
| W1-120 React | **MUST-1**, SHOULD-1 | uSES bridge, stable identities, layout/passive drains, StrictMode and SSR suites, 1,000 cycles with `gc()` and WeakRefs. Seeded: an effect-only dispatch runs nothing until a later state-changing commit |
| W1-121 Vue | Pass, SHOULD-1 | `shallowRef` replaced only on change, `markRaw`, effect scope disposed, post watcher keyed on snapshot and a `tick` so effect-only dispatches drain (suite line 58), 1,000 cycles, fast-check sequences |
| W1-122 vanilla | **MUST-1**, **MUST-3**, SHOULD-1 | One `AbortController`, every listener signalled, post-patch microtask, 1,000 cycles with `gc()`. Seeded: effect-only dispatch not drained; live node depends on an undefined class |

## Rulings on the three orchestrator decisions (kernel-sizes.md)

**(a) Adapters depend on `@ramoslabs/core` as a regular, unbundled dependency: ACCEPTED.** Verified: all three `package.json` carry `"@ramoslabs/core": "workspace:*"` in `dependencies`; React and vanilla build with `tsc` (no bundling) and their `dist` imports core by specifier; Vue's Vite config marks `/^@ramoslabs\/core(\/.*)?$/` external. Amend the ADR-002 table: "runtime deps" for vue, react and vanilla becomes "peer `<framework>`; `@ramoslabs/core` (regular dependency, never bundled: builds mark it external)". Add one sentence to ADR-011 that adapter rows exclude core by construction.

**(b) Inline dev-only guard `typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`, no shared helper: ACCEPTED** as the repository convention, recorded in ADR-002 "Consequences" (it is a packaging rule). Two merged files already deviate: `react/src/runtime/dev.ts` exports `isDev()` and `vanilla/src/runtime/index.ts` defines `const dev = () => …`; by the proposal's own measurement neither folds, so their message strings ship. NICE-7: inline them.

**(c) The ten `supports` keys: ACCEPTED WITH ONE CHANGE (SHOULD-2).** Row by row against the Section 2 table: Popover/dialog/inert/FACE → `popover` (native on the floor; the key exists for forced-false parity, ADR-013 L6); `:user-invalid` → `userInvalid`; anchor positioning core → `anchorPositioning`; `position-area`, `position-try-order`, `position-visibility` → no key, see below; `dialog.requestClose()` → `dialogRequestClose`; Invoker Commands → `invokerCommands`; `<details name>` → `detailsName`; View Transitions same-document → `viewTransitions`; `Intl.Locale.getWeekInfo()` → `weekInfo`; `scheduler.yield()` → `schedulerYield`; `focus({focusVisible})` → `focusVisible`; `Intl.Segmenter`, customizable `<select>`, cross-document transitions, `interactive-widget` → correctly no key. Three detections the ADRs name are absent: `closedby` (ADR-005 step 7 "detected independently"), `popover="hint"` and `interestfor` (ADR-005 step 1 "optional detected enhancements"). They are not read by any G1 module, so they are added as keys the day a component first branches on them, never ad hoc. The change that is required now is the meaning of `anchorPositioning`: the per-property floors differ (core 125/147/26, `position-area` 129/147/26, `position-try-order` 125/148/26, `position-visibility` 125/147/26.2) and K4 itself notes that the scheduler takes one boolean. Define the key in ADR-013 as "true only when every anchor property the contracts emit (`anchor-name`, `position-area`, `position-try-fallbacks`, `position-try-order`, `position-visibility`) passes `CSS.supports`", so Chromium 125-128 and Firefox 147 take the fallback. Record the closed list and this definition in ADR-013.

## Findings

### MUST (G1 blockers)

- **MUST-1. React and vanilla bridges never drain an effect-only dispatch.** ADR-003: effects drain after the committed DOM; K1 decided that a dispatch with effects but an unchanged state reaches `onEffects` without notifying subscribers and left the drain to the adapter. Vue handles it (`tick` bumped in `onEffects`). React's `onEffects` only enqueues; with no re-render there is no commit and no drain. Vanilla's `onEffects` only enqueues; `schedule()` runs from the store listener, which fires only on change. Seeded through the built packages: a reducer returning `{ state: s, effects: [{ type: 'focus', target: 't' }] }` runs nothing after `dispatch`; the effect executes only after a later state-changing dispatch (and an `announce`-only dispatch, the "end of list" case, likewise). Correction: vanilla, call `schedule()` inside the store's `onEffects` callback (one line). React, bump a `useReducer` tick from `onEffects` when `store.getSnapshot()` is the reference uSES already rendered (or unconditionally; the extra render is cheap and only on effect-bearing dispatches), so a commit and the layout/passive drains follow. Add the seeded case to both suites (Vue's line 58 is the model).
- **MUST-2. Tier-1 dialog close desynchronises the stack when `cancel` is prevented.** `behavior/index.ts` `close()`: after `el.requestClose()` it runs `finish(el)` unconditionally. `requestClose()` fires a cancelable `cancel` synchronously; a consumer preventing it (unsaved-changes pattern) leaves the dialog open. Seeded: `close()` returns true, `entries` is empty, `onClose` fires with the opener as restore target while the modal is still open; the later native `close` event then finds no entry, so focus is never returned (ADR-005 step 7 "both route to the same internal close operation", ADR-006 focus return). Tier 2 already checks `defaultPrevented`. Correction: add `open?: boolean` to `OverlayEl`; after `requestClose()`, `if (el.open !== false) return false;` before `finish`; seeded test with a fake whose `requestClose` keeps `open: true`.
- **MUST-3. The vanilla live region is visible.** `domLiveHost` sets only `className = 'sj-sr-only'`; no package defines that class (grep over `packages/css/src`: nothing), so every announcement renders as visible text at the end of `<body>` for a second. React and Vue inline a hidden style and need no stylesheet, which is the right reading of ADR-002 ("adapters never import CSS") and ADR-006. Correction: export one `HIDDEN_STYLE` string from `core/src/live` and apply it in all three hosts (vanilla keeps the class as a hook); this also answers R2's open question: inline, not a class.
- **MUST-4. W1-114 is not delivered.** The G1 pass condition reads "SSR determinism"; W1-114 is inside the 101..115 range this audit covers; its precondition (K1 and W1-120..122 merged) has been met since #30. `packages/testing/ssr` does not exist. Correction: deliver W1-114 (render twice, compare ids and the full IDREF graph on all three adapters, vanilla with the injected `idFactory`, multiple roots with different `idPrefix`), or the owner amends the plan to move "SSR determinism" into G2, with the amendment in `CHANGELOG-PLAN-R1.md` before G1 is recorded as passed. M4 waits for G2 as well, so the amendment changes no dates.

### SHOULD (required before the first M4 component merges)

- **SHOULD-1. The client default scheduler is the fake one.** `createRuntime()` defaults `target` to `'server'`; `SJProvider` in React and Vue without `target`, both outside-provider fallbacks, and `createHost(createRuntime())` in vanilla therefore run on the client with a scheduler whose timers never fire: the live region never clears (dedupe then blocks every repeated announcement for the page's lifetime), the typeahead buffer never resets, and vanilla effects never drain. ADR-003 says "`scheduler` uses platform timers" in production. Correction: React and Vue providers and fallbacks create their runtime with `target: 'client'` (their effects never run on the server; the server render reads nothing from the scheduler); vanilla `createHost` throws in development when `runtime.scheduler` has `advance` (a fake). Keep `createRuntime()` itself server-default for SSR determinism.
- **SHOULD-2.** The `anchorPositioning` definition and the three deferred enhancement keys, as ruled in (c).
- **SHOULD-3. `createFocus().apply()` focuses the container for `native-roving` and `native`.** Seeded: with `b` active, `apply(container)` calls `container.focus()` and never `b.focus()`. For `native-roving` the active radio must receive focus (the browser owns arrows, the kernel still has to land focus on the item it marked `data-active`); for `native` the kernel should not call `focus()` at all. Correction: target `el ?? container` for `native-roving` (no tabindex writes), skip the focus call for `native`; table test per strategy.
- **SHOULD-4. Reducers cannot see controlled values.** ADR-003 writes the reducer as `(state, event, context)`; the store's `Reducer` is `(state, event)`. Controlled props live only in `view()`, so a reducer that branches on a controllable field (`open`, `value`, `active`) branches on stale state. Nothing prevents an M4 author from doing that. Correction: state the rule where component authors read it (K1b-NOTES and the plan's `.a` row): a reducer never reads a field listed in `fields`; the prop getter computes the next value from `view()` and submits `request(field, next)`; add a seeded contract-lint case to W1-307 (a reducer transition on a `controllable` field fails).
- **SHOULD-5. Three corrective-effect version conventions.** React stamps `version + 0.5`, Vue `++version`, vanilla the last store version (so a same-batch reducer effect of the same type and target and the corrective both run; equal versions never supersede). The number belongs to K1: export `correctiveVersion(last)` (or document "last + 1") and use it in all three, with the supersession case seeded once in `effects`.

### NICE

- **NICE-1.** `subscribe(l)` twice then one unsubscribe drops `l` (Set dedupe); either document that identity dedupe is also unsubscribe dedupe or refcount.
- **NICE-2.** `itemId(base, 1)` equals `itemId(base, '1')`; document that keys are compared as strings.
- **NICE-3.** `createRuntime({ supports: { popover: undefined } })` yields a non-boolean; drop `undefined` entries when merging.
- **NICE-4.** `controlled.reconcile()` reads `this.view()`; destructuring throws. Use the closure.
- **NICE-5.** `mergeProps` replaces a consumer array of handlers (Vue `onClick: [a, b]`) with the library handler silently; chain each or warn.
- **NICE-6.** The native L6 lane for placement parity is not scripted (K4 open item): the reference evaluator is certified against spec text only. Belongs to W1-309/W1-311; record it in the W1-110 cell.
- **NICE-7.** Inline the two dev-guard helpers (React `isDev`, vanilla `dev`) per ruling (b).
- **NICE-8.** `apply()` in `focus` never clears `data-active` on `release()`; harmless before unmount, but a reused element keeps the attribute.

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| MUST-1 | MUST | `react/src/runtime/machine.ts`, `vanilla/src/runtime/index.ts` | Force a commit / `schedule()` from `onEffects`; seeded effect-only test |
| MUST-2 | MUST | `core/src/overlay/behavior/index.ts` | After `requestClose()`, return without `finish` while `el.open !== false` |
| MUST-3 | MUST | `vanilla/src/runtime/index.ts`, `core/src/live` | Shared `HIDDEN_STYLE`, inlined by all three hosts |
| MUST-4 | MUST | `packages/testing/ssr/**` or `CHANGELOG-PLAN-R1.md` | Deliver W1-114 or amend G1/G2 with owner approval |
| SHOULD-1 | SHOULD | React/Vue providers and fallbacks, vanilla `createHost` | Client default `target: 'client'`; dev throw on a fake scheduler in vanilla |
| SHOULD-2 | SHOULD | ADR-013, `core/src/runtime` | Define `anchorPositioning` as the conjunction; list the deferred keys |
| SHOULD-3 | SHOULD | `core/src/focus/index.ts` | `native-roving` focuses the active item; `native` no focus call |
| SHOULD-4 | SHOULD | K1b-NOTES, plan `.a` row, W1-307 | Rule: reducers never read controllable fields; lint seed |
| SHOULD-5 | SHOULD | `core/src/effects`, three bridges | One corrective-version rule owned by K1 |
| NICE-1..8 | NICE | as listed | as listed |

Re-audit trigger: MUST-1..3 applied with their seeded tests, MUST-4 delivered or amended, SHOULD-1 applied; a file-level check of the five touched files plus one run of `bun run test` suffices for G1 PASS. SHOULD-2..5 may land with the first M4 component PR.

G1-AUDIT DONE

## Orchestrator note

MUST-4 (W1-114) was delivered in PR #34 (`packages/testing/ssr`), merged after this audit pulled `main` at `b63a075`. It is therefore resolved by delivery, not by plan amendment. The re-audit is asked to verify it (render twice, ids and the full IDREF graph on all three adapters, vanilla with the injected `idFactory`, multiple roots with different `idPrefix`).
