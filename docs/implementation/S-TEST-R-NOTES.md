# S-TEST-R notes: W1-308b reducer harness

Modules: `packages/testing/spec/reducer/index.js` (`runReducerHarness`, `assertReducerHarness`, `replaySequences`, `l2Plan`, injectable `defaultKernel`), `discover.js` (`discoverReducers`). Fixture reducer plus contract in `spec/reducer/fixtures/`.

## What it does
- Input is `deriveSpec(contract)` (W1-308a). Reducer module convention is G-CODE's: `packages/core/src/<slug>/reducer.ts` exporting `reducerEvents` and `reduce(state, {type})` (a bare state or a `{state, effects?}` Reduction; the store's shape).
- Static: `reducerEvents` equals the contract action ids; `reduce` exists.
- Deterministic L1 replay of `spec.sequences` (the identical arrays `l2Plan(spec)` hands to L2, W1-309a): one spec feeds both layers (ADR-013 L1).
- Model-based fast-check sequences (default 150 runs, seed 0x5eed, reproducible; failures return a shrunk counterexample) over the REAL kernel: store, effect queue, collection, controlled. Operations: actions plus an unknown event, subscribe/unsubscribe (duplicate subscribe, double unsubscribe), drain per phase with missing targets, add/remove/disable items with a focused key (checked against an independent successor oracle), duplicate registration and stale or double unregister, destroy, and (when configured) controlled request/native/prop/reconcile in controlled and uncontrolled mode.
- Per-dispatch reducer rules: result equals the spec model, no input mutation, determinism, unknown events and unlisted pairs are no-ops with no effects, a no-op reuses the state reference, listeners fire iff the snapshot changed, effect versions grow, and each drain equals an oracle (stale superseded, missing targets dropped, `EFFECT_ORDER`).
- Seeded defects caught (tests): wrong target, state change on an unlisted pair, unknown event changes state or emits effects, fresh object on no-op, input mutation, non-determinism, missing or extra `reducerEvents`. Seeded kernel defects (via injectable kernel): successor ignoring disabled, stale unregister clobbering a newer registration, queue not dropping stale effects, controlled request dispatching.

## Auto-pickup
`index.test.js` "real component reducers" calls `discoverReducers()` for every `packages/core/src/<slug>/reducer.ts`, pairs `packages/contracts/contracts/<slug>.contract.json`, and runs the harness; none exist today (one skipped test). M4 reducers are covered with no registration. Optional export `harness` ({initial, project, items, targets, controlled}) enriches coverage; without it state is the machine state name and the controlled operations are skipped.

## Decisions
- `harness.project` maps reducer state to the contract state name (reducer state may be an object so the controlled pipeline can overlay it).
- A no-op must return the same state reference (store treats a fresh equal object as a change and notifies).
- Inert `disabled` scenarios are passed through (`l2Plan().scenarios`) for the L2 executor; the reducer has no disabled input in the contract, so L1 only covers disabled collection items. Follow-up if a reducer takes a `disabled` flag.
- `initial` is cloned per world so a mutating reducer cannot poison later runs.

## Bytes / shared files
Test-only; not shipped; no ADR-011 ceiling. No shared-file edits (`spec/index.js` barrel and `exports` untouched; consumers import `spec/reducer/index.js`).
