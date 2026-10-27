# K1 notes: store, ids, runtime, effects (W1-101..104)

Branch `feature/m1-k1-store-ids-runtime-effects`. Sources: PLAN-WAVE-1 section 3 rows, ADR-003, ADR-011, ADR-013.

## Decisions where a row was ambiguous

- **Store shape (W1-101).** `createStore(initial, reduce, onEffects?)`; the reducer returns `{ state, effects? }`
  (ADR-003 "pure reducer ... -> { state, effects }"). A dispatch is a no-op, returning the same snapshot and
  notifying nobody, when the state is `Object.is`-equal and no effects were emitted. Effects without a state
  change still reach `onEffects` but do not notify subscribers (the snapshot did not change, so `useSyncExternalStore`
  must not re-render). `getServerSnapshot()` returns the initial state (stable). After `destroy()` the store is inert
  (dispatch returns the last snapshot, subscribe is a no-op); that is the reversible/idempotent cleanup of ADR-003.
  "Lazy creation" is the adapter's job (the factory is side-effect free, so StrictMode double creation is safe).
- **Effect versions.** ADR-003 says descriptors carry a `version` but not whose. The store counts non-no-op dispatches
  per instance and hands the number to `onEffects`; the queue stamps it. Stale = a newer effect with the same
  `type` + `target` exists in the same batch (superseded). The version is not an id, so the "no counters" rule of
  ADR-003 ids does not apply.
- **Phases.** The drain hook has two phases: `layout` (open, close, geometry, focus; React `useLayoutEffect`) and
  `passive` (type `announce`; `useEffect`), per the ADR-003 adapter sentence. One hook, `drain(host, phase)`.
- **Order.** `EFFECT_ORDER = open, close, geometry, focus, announce` (stable otherwise): "native open before focus".
- **No synchronous re-dispatch.** A re-entrant `drain` is a no-op and effects enqueued during a drain wait for the
  next one. The queue cannot see the store, so it does not throw; adapters must not dispatch from `run`.
- **Ids (W1-102).** `baseId(explicit, acquire, prefix)`, `partId`, `itemId(base, key)`, `encodeKey` (injective,
  `~hex~` escaping), `safeName`/`sanitizedMap` (`--` dashed ident, injective) for `anchor-name` and
  `view-transition-name`, and a pure `cssEscape`/`idSelector` (the global `CSS` is DOM and not available in core).
  IDREFs use the raw id (ADR-003 "IDREF attributes use raw ids").
- **Runtime (W1-103).** `createRuntime(config)` never sniffs the environment: `target: 'server'` (default) gives the
  fake scheduler, `'client'` the platform scheduler (timers resolved at call time). `supports` defaults all-false
  over the closed key list `SUPPORT_KEYS` (my proposal; ADR-013 has no key list yet, derived from the ADR-001
  fallback table). `serializeRuntime` is the server-to-client payload; `withSupports` applies real detection after
  hydration. Defaults when `lang`/`dir` are missing: `en`/`ltr`. The runtime does not import the store (the row's
  W1-101 dependency is satisfied by order only). The contract `runtime` provenance entry is the contracts stream's
  (W1-301); not touched here.

## Bytes (min + gzip level 9, esbuild, via `packages/testing/size/measure.js`)

| Module | gzip | raw | Ceiling |
|---|---|---|---|
| store | 282 B (0.275 KiB) | 384 B | 1 KiB (row exists, pass) |
| ids | 489 B | 859 B | none in ADR-011 / `budgets.json` |
| runtime | 723 B | 1,332 B | none |
| effects | 500 B | 780 B | none |

ids/runtime/effects have no ADR-011 row (they count inside the consumer fixtures). Together with store they total
about 2.0 KiB.

## Deviations and open items

- `bun run size` through Turbo reported `0 B` for every row because the `size` task is cached and its inputs do not
  include `packages/core/src` (root `turbo.json`, not mine). Direct `node packages/testing/size/cli.js` shows the real
  numbers (store 0.275 KiB). This is a gate hole to fix in `turbo.json` (add `../core/src/**` to `size` inputs).
- No budget rows for ids/runtime/effects; adding them is a `budgets.json` change (shared file, not made).
