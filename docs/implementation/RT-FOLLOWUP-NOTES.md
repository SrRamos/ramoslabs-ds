# RT follow-up notes: controlled resync and lazy live region

Branch `feature/m4-runtime-controlled-live`. Found while building SJSwitch (C03s) and SJButton (C01).
Scope: `packages/{react,vue,vanilla}/src/runtime/**` only. Sources: ADR-003 (controlled pipeline, adapters), ADR-006 (live regions), K1/K1b notes.

## 1. Controlled resync (rejected change)

Problem: a controlled owner that does not accept a change leaves the store and props untouched, so no render/commit happens and the commit-time `reconcile()` (the only producer of the corrective native effect) never runs. The native control keeps the rejected value.

Fix, per adapter, in the `request`/`native` wrappers the runtime hands out. `Controlled.request/native` return `false` exactly when the field is controlled (nothing dispatched); on `false` the runtime checks, after the owner had its chance to update, whether a commit followed, and if not forces one:
- React (`machine.ts`): a commit counter bumped in the layout effect; on `false`, a microtask compares the counter and calls the existing `bump()` only if no commit happened (so an accepting owner costs zero extra renders). The unmount flag (`alive`, set in the effect, so StrictMode's simulated unmount is safe) stops late bumps.
- Vue (`store.ts`): same idea with a commit counter and `nextTick`; calls `commit()` (reconcile + drain) if the owner's re-render did not.
- Vanilla (`index.ts`): `ctx.request/native` call `schedule()` on `false`; the existing flush reconciles. (Vanilla had the same gap; it was hidden whenever something else scheduled a flush.)

Tests: `packages/react/src/runtime/controlled-live.test.ts` (rejecting owner, accepting owner with exact render counts, uncontrolled no forced render, unmount safety, each in and out of StrictMode), `packages/vue/src/runtime/controlled-live.test.ts`, and the `RT follow-ups (vanilla)` block in `packages/vanilla/src/runtime/runtime.test.ts`. Each was checked to fail with the fix removed.

Behaviour change: the old React test asserted the correction "waits for the next commit"; the correction now arrives right after the rejected report (that is the fix).

## 2. Lazy live region

Problem: `registry.attach` calls `host.create('status')` immediately, so each DOM host appended a hidden div on first mount even if nothing ever announces. Core `live` is not in this task's ownership, so the laziness is in the three default DOM hosts: `create()` returns a node whose element is inserted on its first `setText` (the registry's announce calls `setText('')` first and sets the text in a later task, so the region still exists before its content changes). Removed on `dispose()` / vanilla `host.destroy()`; after dispose a stale node is inert (React/Vue). Custom `liveHost` options are unchanged.

Tests: vanilla (non-announcing mount/destroy leaves body unchanged; first announce creates exactly one; destroy cleans), React and Vue host-level equivalents, and the three old "G1 MUST-3" style tests now call `setText`.

Risk to note: some screen readers prefer a live region present well before first use; we create it one task before the text lands. Eager creation can be restored per host if QA finds a miss.

## 3. Follow-ups once this merges (not done here, component dirs not owned)

- Remove the forced render in `packages/react/src/switch/` (C03s.d): the `useReducer` `commit()` and the `native` wrapper around `m.native`; use `m.native` directly.
- Remove the no-op `liveHost` in `packages/vanilla/src/button/` (C01.e), and any equivalent in other vanilla tests/components that only existed to avoid the body node.

## Bytes (min + gzip, `node packages/testing/size/cli.js`)

See the final reply for the before/after of the runtime chunks.
