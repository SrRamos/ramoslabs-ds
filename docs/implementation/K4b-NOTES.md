# K4b notes: W1-109 overlay behavior

Branch `feature/m1-k4b-overlay-behavior`. Code: `packages/core/src/overlay/behavior/**`; `overlay/index.ts` now also exports it.

## API (`createOverlayStack(opts)`)

`sync(el, kind, open, {opener, advanced})` mirrors native `toggle`/`close` (idempotent), `close(el)`, `escape(e?)`,
`dismiss(composedPath)`, `install(doc)`, `register(key, el, kind)` + `apply(effect)` (executes the `open` effect from
`controlled.reconcile()`), `entries`/`top`. Also `anyPointerClass(matches)` and `listboxMount(flag, cls)`.
Kinds: `modal` (showModal), `auto`, `hint`, `manual` (engine-controlled, tooltips).

## Ambiguities resolved

| Question | Resolution | Basis |
|---|---|---|
| Who closes on Escape? | Platform closes modal and `auto`/`hint` when `supports.popover`; the engine closes only the topmost entry when it is `manual`, or non-modal with no popover support (and calls `preventDefault`). Order is stack (open) order | ADR-005 steps 1, 5 |
| Nesting | `parent` = topmost stack entry that contains the element or its opener; closing an entry removes its descendants (innermost first), only the entry's opener is restored | step 5 ("only ancestor chains") |
| Both tiers, one close operation | Tier 1 `requestClose()` (when `supports.dialogRequestClose` and the method exists), tier 2 cancelable `cancel` then `close()`; a prevented `cancel` keeps it open. Both then run the same `finish`, idempotent with the later `close` event | step 7 |
| Light dismiss | `install` is a noop when `supports.popover`; else capture `pointerdown`, closes top-down auto/hint entries until one contains the target or whose opener is the target. Modals and `manual` are never pointer-dismissed | step 6 |
| `listboxMount` | pure function of a static flag and the class from `anyPointerClass(matches)` (`(any-pointer: coarse)`); no UA sniffing, no `aria-owns` | step 8 |
| Opener | passed by the adapter (core reads no `document.activeElement`); restore uses `restoreTarget` (opener, then declared fallback, none if `advanced`) | ADR-006 |
| `Event` | a local type declaration; tier 2 builds the event lazily at close time, injectable via `cancelEvent` | core reads no DOM globals at import |

## Size (`node packages/testing/size/cli.js`)

overlay row: **2.298 KiB gzip** (5049 B raw), ceiling 4 KiB; placement alone was 1.444 KiB, so behavior adds about 0.85 KiB.

## Follow-ups

- Tests use structural fakes; a real-browser lane (`toggle` ordering, `requestClose`) is an L2/L6 task.
- Adapters must call `sync` on `toggle` (newState) and dialog `close`, pass the opener at open, and call `escape`/`install` themselves.

## G1 fixes

- MUST-2: `OverlayEl` gains `readonly open?: boolean`. Tier 1 `close()` reads it after `requestClose()`; while the element is still open (a consumer prevented `cancel`) it returns false, keeps the stack entry and fires no `onClose`, so the later native `close` event still finds the entry and restores focus. The check is `open === true` (not `!== false`) so structural fakes without `open` keep working; a real dialog always reports a boolean. Seeded test: a fake whose `requestClose` leaves `open: true`.
- Size after G1 fixes (`node packages/testing/size/cli.js`): overlay 2.319 KiB gzip (ceiling 4 KiB), store 0.275 KiB, collection+focus+typeahead 1.569 KiB, runtime 0.869 KiB (reported).
