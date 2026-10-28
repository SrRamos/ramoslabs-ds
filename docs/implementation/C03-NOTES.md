# C03 notes: SJSwitch (C03s.a contract + core)

Branch `feature/m4-c03s-switch-core`. Files: `packages/contracts/contracts/switch.contract.json`,
`packages/core/src/switch/{index,reducer,switch.test}.ts`, regenerated `src/generated/switch/**` and adapter `types.ts`.
Golden for native-input components: SJCheckbox (C03c) copies this shape and adds `indeterminate` as a property.

## Getters API (frozen)

Module `@ramoslabs/core/switch` (`packages/core/src/switch/index.ts`). The adapter owns the store and `createControlled`
(its bridge: `useSJStore`, `useMachine`, vanilla runtime); core supplies the reducer, the field description and pure getters.

```ts
// reducer / store wiring
reducerEvents: readonly ['toggle']
reduce(state: SwitchState, e): SwitchState                         // machine form (contract equivalence)
reduce(state: SwitchSnapshot, e): Reduction<SwitchSnapshot, never> // store form; no-op keeps the reference
storeReducer: Reducer<SwitchSnapshot, SwitchAction, never>
initialSnapshot(checked = false): SwitchSnapshot                   // { state: 'off'|'on', checked }
switchFields                                                       // pass as `fields` to createControlled
harness                                                            // W1-308b controlled operations

// getters
switchBaseId(explicit: string | undefined, acquire: () => string, prefix = ''): string
createSwitchParts({ view, native, getProps, id }): {
  ids: { control: string }
  getRootProps(consumer?: Props): Props      // <label>: class sj-switch__root, data-part, data-state, data-disabled
  getControlProps(consumer?: Props): Props   // <input>: id, class, type=checkbox, role=switch, checked, name?, value?, disabled?, data-*, onChange
  getThumbProps(consumer?: Props): Props     // <span>: class sj-switch__thumb, data-part, data-state, data-disabled
}
SwitchProps { checked?, defaultChecked?, disabled?, name?, value?, id?, onCheckedChange? }
```

Rules the adapters rely on:
- Every getter is `mergeProps(consumer, library, { part, protect })`: `role`, `id`, `type`, `checked`, `disabled` and the `data-part/state/disabled` attributes are library-owned (a consumer value is dropped with a dev warning); `class` concatenates (library first); consumer `onChange` runs first, `preventDefault()` cancels the library handler.
- `checked` is always emitted from `view().checked` (even uncontrolled), so React gets a controlled `<input checked onChange>` and Vue/vanilla set the `checked` property. Absent `name`/`value`/`disabled` are omitted so the native defaults (`on`) apply: the input's form state is the bare input's.
- `onChange` calls `native('checked', !view().checked)`; the next value comes from `view()`, never from the reducer (G1 SHOULD-4). Uncontrolled: dispatches `toggle`. Controlled: only `onCheckedChange(next)`; the reducer never sees it.
- A rejected controlled change is corrected by `reconcile()`: effect `{ type: 'checked', target: 'control', value }`. The adapter's host sets `input.checked = value` after commit (target `control` = the input).
- No keydown handler: Space on a focused native checkbox fires `change` itself (contract `keyboard.control.Space: toggle` is native). No `aria-checked`, no hidden mirror input, no FACE (ADR-014), no `aria-disabled` (native `disabled`).
- `ids.control` is the input id (an external `<label for>` works); root and thumb carry no id (decorative / wrapping label).
- Nothing reads `document`/`navigator`; getters are pure functions of `view()` and `getProps()`.

## Decisions
- **Snapshot is `{ state, checked }`.** `createControlled` needs `checked` as a state key, and the reducer lint forbids the reducer reading it (ADR-003 / G1 SHOULD-4). The reducer reads only `state` (machine position) and writes both. In controlled mode only `view().checked` is overlaid, so getters derive `data-state` from `checked`, never from `view().state`.
- **`reduce` has two forms** (machine name string, and snapshot). The contract equivalence check calls `reduce('off', {type})` expecting a bare state name; the W1-308b harness calls `reduce(snapshot, event)` expecting a Reduction. One function serves both so neither check is skipped. Tell C01/C03c: copy this overload shape if the snapshot is an object.
- `reducerEvents` is a literal, independent of the generated table, so the equivalence check compares two sources.
- `toEvent` is a plain `toggle` (the getter always submits the flip of `view().checked`).
- `support[]` stays empty: `appearance`, `accent-color`, `forced-colors` and `role=switch` on a checkbox are all inside the ADR-001 floor (Chromium 114, Firefox 125, Safari 17), so no `nativeFrom/fallbackUntil` row exists to record.
- Contract additions to the W1-302 draft: props `value` (default `on`) and `id`. Status stays `draft` (G3A promotes). Forced-colors visibility is a CSS (.b) criterion, to be asserted by the .f forced-colors fixture; core has no part in it (the native control paints under forced colors).

## Proof that the checks run (none skip) and fail on seeded breakage
- Contract equivalence: `codegen.test.js` "real component reducers > SJSwitch: reducer events equal contract actions" runs (the former skip is gone; the remaining skip there is button, C01). Seeded `reduce('on','toggle') -> 'on'` yields `reduce("on","toggle") returned "on", contract says "off"`.
- W1-308b: `spec/reducer/index.test.js` "switch: reducer satisfies its derived spec" runs via auto-discovery. The `harness` export enables the controlled request/native/prop/reconcile operations; a seeded kernel defect (controlled `request` also dispatching) is caught (`uncontrolled request gave "on", spec says "off"`), which can only fire through the controlled operations.
- Reducer lint: `contract:lint` scans `reducer.ts` (clean); the same file with `state.checked` reads reports `contract/reducer-controlled-field`.
- Seeded runs were a scratch script (not committed); the committed coverage is the three suites above plus `switch.test.ts` (reducer table agreement, fast-check toggle parity, getters, ownership, controlled rejection with `reconcile`).

## Submit equivalence (for .f)
Core has no DOM. The submit-equivalence test (form data of `SJSwitch` equals a bare `<input type=checkbox name value>` for off/on/disabled/long-label, in each adapter) belongs to the .f conformance task; the getters guarantee the attribute set is exactly a bare input's (asserted in `switch.test.ts`).

## Bytes (min+gzip, shared kernel excluded, `node packages/testing/size/cli.js`)
| Module | gzip | raw | Ceiling |
|---|---|---|---|
| core/src/switch | 0.746 KiB (~764 B) | 1,771 B | 1 KiB (contract `budgets.gzipKiB`), pass |

## Alignment notes for the sibling SJButton stream
- Same file convention: `reducer.ts` with `reducerEvents` + `reduce`; button has no controllable field, so the overload and `harness.controlled` are not needed (a bare state-name `reduce` suffices; the harness then skips controlled ops by design).
- Class names `sj-<component>__<part>`, `data-part`, `data-state`, `data-disabled`; `undefined` library values to remove consumer attributes.

## Follow-ups
- .b CSS: style `.sj-switch__control` (`appearance: none` input) and `.sj-switch__thumb`; keep the input in the hit area (44 px, 24 px floor) and visible under forced colors (do not rely on background colors only).
- Adapters (.c/.d/.e): `commit()` must run `reconcile()` and execute `checked` effects as `el.checked = value` on the control; React must not set both `checked` and `defaultChecked`.
