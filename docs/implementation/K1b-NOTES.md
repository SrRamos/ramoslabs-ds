# K1b notes: controlled pipeline, live-region registry (W1-115, W1-111)

Branch `feature/m1-k1b-controlled-live`. Code: `packages/core/src/{controlled,live}`. Spec: ADR-003 "Controlled/uncontrolled",
ADR-006 "Live regions" (ARCHITECTURE.md l.271-277, l.526-529), ADR-011 live-region row (1 KiB).

## W1-115 design
`createControlled({ store, getProps, fields })` wraps a K1 store. `fields` maps a state key to `{ prop, onChange?, toEvent, native?, target? }`.
- `view()`: state with controlled props overlaid; memoized, same reference while state and controlled values are unchanged.
  Reducer state never receives a controlled value (`request` while controlled only calls `onChange`; no dispatch).
- `request(field, next)` / `native(field, actual)`: read `getProps()` at call time. Uncontrolled: dispatch `toEvent(next)` then notify.
  `native` additionally records the actual native state apart from the desired state.
- `reconcile()` (adapter calls it post-commit): returns `{ type: field.native, target, value: desired }` for each natively-reported
  field whose actual state differs from the view (controlled `open` still true after native Escape). It never dispatches; the
  adapter enqueues the descriptors into the K1 effect queue (`open` type, version-stamped there).
- `mount()` locks ownership per field; later a controlled<->uncontrolled switch throws in development (inline dev guard, K2 convention).

Resolved ambiguity: ADR-003 does not say who enqueues the corrective effect; `reconcile` returns descriptors so the pipeline stays
independent of the queue and adapters decide when the post-commit hook runs (React layout effect, Vue post watcher, vanilla microtask).

**Reducer rule (G1 SHOULD-4, 2026-10-27).** The store's `Reducer` is `(state, event)`; controlled props live only in `view()`. A reducer never reads a field listed in the controlled `fields`; the prop getter computes the next value from `view()` and submits `request(field, next)`. Branching on a controllable field (`open`, `value`, `active`) in a reducer reads stale state. Contract lint (`contract/reducer-controlled-field`, `packages/testing/lint/contract`) flags a direct mention of a contract `state.controllable` name in `core/src/<slug>/reducer.ts`; it is textual, so aliased or computed access is not detected.

## W1-111 design
`createLiveRegistry(scheduler)` is host-agnostic: the adapter's `LiveHost.create(role)` makes the persistent node and `attach(host)` is
called only after mount, so the server emits no markup (announce before attach returns false). One `status` node at attach, `alert`
created lazily and only for `{ urgent: true }`. Dedupe: an identical text per role is dropped until the region clears (1 s after
write); a clear-then-set on `scheduler.soon` makes announcements reliable. Active-descendant: `announce(..., { activeDescendant: true })`
is dropped, and text equal to the last `noteActive(text)` is dropped. The "per document" lifetime is the adapter's: one registry
per runtime/document (no module-scope WeakMap, per brief).

## Bytes (gzip level 9, minified)
| Module | gzip | raw | Ceiling |
|---|---|---|---|
| live | 333 B | 539 B | 1 KiB, pass |
| controlled | 693 B | 1,181 B | none in ADR-011 |

## Follow-ups
- W1-120..122 call `mount()` after first commit and `reconcile()` post-commit.
- Seeded-defect coverage for these two lives in W1-308b (reducer harness).

## G1 fixes

- NICE-4: `createControlled` builds the object as `self` and `reconcile()` calls `self.view()`, so destructured methods work (seeded test destructures `native` and `reconcile`; it threw before).
