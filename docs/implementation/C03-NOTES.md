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

## .b CSS (`packages/css/src/switch.css`, branch `feature/m4-c03s-switch-css`)

Files: `packages/css/src/switch.css`, `packages/css/test/switch.test.js`. Built from `src/_template` and then authored.

### Structure (ADR-009, ADR-008, ADR-014)
- The **native `<input>` is the real control and the focus target**. It is `appearance: none`, transparent, sized to `--sj-target` (44 px) and absolutely placed over the track. It carries the shared focus ring from `base/focus.css`, so the ring is around the 44 px box.
- The **visible track is `.sj-switch__root::before`** (44 x 24 px, `--radius-pill`), and the **knob is `.sj-switch__thumb`**. The label root is the pointer target. No hit area is expanded through a pseudo-element.
- Logical properties throughout (`inset-inline-start`, `padding-inline-start`). The knob moves to the end edge when on, so RTL mirrors without `:dir()`. `:dir()` is not in the Chromium 114 floor.
- Knob travel is `calc(target-min - target-floor + space-1)` (24 px). The knob is `target-floor - space-2` (16 px) at `space-1` from the start edge.

### Decisions
- **No `sj.variant` block.** SJSwitch has no `variant x tone x size` axes, so the template's variant block is dropped. The W1-203 `RECIPE` does not cover the switch. Its drawn pairs are asserted in `switch.test.js` instead (track off/on and knob vs surface and vs track, all at least 3:1, and the track equals `color-slate-500` / `color-primary`). `packages/testing/contrast/matrix.js` was not edited (not owned by this stream).
- **Forced colors.** Backgrounds are dropped under `forced-colors: active`, so the track and knob get `border: hairline solid CanvasText`. The base focus rule already gives the input a ButtonBorder. State is carried by knob position as well as the native `checked` (not colour alone).
- **Disabled.** Track is `color-slate-300` (`text-disabled`, exempt from 1.4.11 as inactive). Cursor `not-allowed` on root and input.
- **Reduced motion.** Transitions use `--sj-duration-fast`, which `base/motion.css` collapses to `0s`.

### Checks (all green)
- `bun run lint` (stylelint W1-202 rules), `format:check`, full `TURBO_FORCE=1 bun run gate` (exit 0).
- Anatomy: `cssParts('switch')` equals `anatomy[].part` (`root`, `control`, `thumb`); `checkStylesheets` clean.
- Tests: 19 in `switch.test.js`, plus the full css suite (73 passing).
- Seeded breakage: removing the forced-colors border fails 2 tests (checked, then restored).

### Follow-ups
- The C03c `SJCheckbox` CSS (.b) needs its own native-input variant (checkbox looks, not a track); reuse the transparent-input-over-drawn-track structure, not the knob.
- W1-203's `RECIPE` could list the switch pairs once a shared switch recipe is wanted. Not required for `.b`.
# C03s.d notes: SJSwitch for React

Branch `feature/m4-c03s-switch-react` (stacked on `feature/m4-c03s-switch-core`). Files: `packages/react/src/switch/{index,switch.test}.ts`.

## API
`SJSwitch = { Root, Control, Thumb }` plus flat `SJSwitchRoot/Control/Thumb` (ADR-002, parts from contract `anatomy`). Root is the `<label>`, owns `useMachine` (shared runtime, no local bridge) and passes the getters and `classes` to parts through context; `Control` is the real `<input type=checkbox role=switch>`, `Thumb` a `<span>`. All three forward refs. Props are the generated `SJSwitchProps` (`onCheckedChange({ checked })`, payload object per the generated type; core's callback takes a bare boolean, Root adapts it).
- `classes={{ root, control, thumb }}` concatenates after the library class (and after a consumer `className`); `className` maps to the getters' `class` and back.
- Prop-or-slot: `label` prop with no children renders Control, Thumb and the label; otherwise children are the slot.
- Parts outside Root throw `SJSwitch.<Part> must be rendered inside SJSwitch.Root`.
- No FACE, no hidden mirror, no `aria-checked`/`aria-disabled`; `checked` is always emitted so React sees a controlled input.

## Decisions
- **Forced commit after every native report.** `reconcile()` runs only in the commit's layout effect (R1), and a rejected controlled change leaves the store untouched, so nothing would commit and the corrective effect (`checked`, target `control`) would never run. Root wraps `native` with a `useReducer` tick. Seeded: removing the tick fails the two corrective tests. The effect handler sets `input.checked = value` on the control ref (touched only in effects).
- `id`: explicit wins, else React `useId()` (prefix `''`, because `identifierPrefix` already applies the prefix; ADR-003 SSR ids).
- Initial snapshot: `defaultChecked ?? checked ?? false`. `checked`/`disabled`/`name`/`value`/`id` are added to the props bag only when defined, so "absent" means uncontrolled/native default.
- Tests run under react-test-renderer (no DOM, R1 convention): form-state equality is asserted as the control's `name/value/checked/disabled/type` markup equal to a bare `<input type=checkbox>` (7 cases) rather than a `FormData` (that belongs to .f with a real browser). Real hydration also belongs to .f / L2; here SSR is asserted (markup, no `document`, stable ids across renders, explicit id).

## Proof
27 tests: naming, structure, classes, protected attributes, refs, uncontrolled, controlled accepting / rejecting (corrective effect applies), prop change, disabled, form equality, SSR, StrictMode (one callback per change, corrective still applies), 1,000 StrictMode mount/toggle/unmount cycles with real gc (no retained nodes, every live host disposed, scheduler empty).

## Bytes (min + gzip 9, esbuild, react external)
| Entry | gzip | raw |
|---|---|---|
| `react/src/switch` alone (core and runtime external) | 1,839 B | 4,088 B |
| `react/src/switch` with core switch + shared runtime/kernel inlined | 4,667 B | 10,738 B |
No ADR-011 ceiling applies to an adapter component entry; the core part stays 0.746 KiB of its 1 KiB.

## Follow-ups
- .f: real-DOM hydration and `FormData` equality for off/on/disabled/long-label; Space toggling in a browser.
- Barrels (`packages/react/src/index.ts`) and `exports` already list `./switch`; the root barrel is not touched here (orchestrator).
## .e Vanilla adapter (C03s.e)

Branch `feature/m4-c03s-switch-vanilla` (stacked on `feature/m4-c03s-switch-core`). Files: `packages/vanilla/src/switch/{index,switch.test}.ts`. No shared files touched (the `./switch` export already existed).

- API: `mountSwitch(host, labelEl, props) -> Instance` (+ `.control`), `define(host, name = 'sj-switch', registry = customElements)`. The host comes from `createHost(createRuntime({ target: 'client' }))` (R3-NOTES, G1 fix). Vanilla adds one prop, `label` (plain text, a text node; markup is shown literally).
- Anatomy: the mounted element is the root `<label>`; children are `<input>`, thumb `<span>`, label `<span>`. Props are applied from `createSwitchParts` getters; `onChange` is attached once through `ctx.listen` (instance signal). Effect `checked`/`control` sets `input.checked` after commit (`reconcile()` corrects a rejected controlled change).
- **No FACE (ADR-014).** ADR-014 scopes `attachInternals()` to "a custom control [that] needs native form participation". Here the real `<input name value>` sits in the `sj-switch` light DOM (ADR-002, no shadow root), inside the user's `<form>`, so it participates natively and submits exactly like a bare checkbox. FACE would duplicate form state.
- `sj-switch` element: `connectedCallback` mounts a `<label>` inside it, `disconnectedCallback` destroys, `attributeChangedCallback` calls `update`. Attributes `checked` (initial/uncontrolled, read at connect only), `disabled`, `name`, `value`, `label`, `id`. `el.checked` reads the input. Change is observed through the native bubbling `change` event. `define()` builds the class inside the call (no `HTMLElement` reference at import) and is a no-op when the name is registered.
- `touch-action`: the adapter registers no pointer or touch handler (click on `<label>` and Space on the input are native), so no part needs the declaration. A test asserts the only listener is the one signalled `change`. If a future pointer-handling part is added, CSS (.b) must declare `touch-action`.
- Tests (14, node + a DOM double, since the repo has no jsdom): anatomy and text-only, uncontrolled/defaultChecked, controlled with rejection reconcile, disabled, form-entry equivalence to a bare checkbox (5 cases, plus after toggle), destroy aborts all listeners, no extra listeners, 1,000 cycles retain 0 listeners and 0 children, `define()` idempotent and not run at import, element lifecycle. innerHTML-style sinks throw in the double. The real-browser FormData equivalence and axe run belong to .f.
- Bytes (min+gzip, core excluded via esbuild `measure`): switch adapter 1,133 B gzip / 2,323 B raw with the runtime also external; 1,248 B / 2,662 B with the runtime tree-shaken in. Not covered by the size CLI (it reports only `adapter:vanilla` as a whole); no ADR-011 ceiling for adapters.
- Follow-up: .b CSS should size the label root as the 44 px hit target; `sj-switch` should be `display: contents` or inline-flex.
