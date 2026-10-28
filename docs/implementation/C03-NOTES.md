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
## .c Vue (SJSwitch, `packages/vue/src/switch/**`)

Branch `feature/m4-c03s-switch-vue`, stacked on `feature/m4-c03s-switch-core`. Files: `SJSwitch.ts` (render-function component), `index.ts`, `switch.test.ts` (jsdom), `ssr.test.ts` (node).

- **Shape.** One flat `SJSwitch`; no preset file: a single native control composes no primitives, so a preset would be a pass-through (ADR-002). Wiring: `useSJStore` (shared runtime, no local bridge) + `createSwitchParts`; `<label.sj-switch__root><input.sj-switch__control/><span.sj-switch__thumb/><span.sj-switch__label/></label>`.
- **API.** Props from the generated `SJSwitchProps` plus `label` and `classes` (`root|control|thumb|label`, appended after the library class). Label = default slot, else `label` prop. `checked` is `default: undefined` (Vue would otherwise cast absent to `false` and make every instance controlled). Events: `update:checked` (`v-model:checked`) and `checkedChange({ checked })`. `inheritAttrs: false`: `class`/`style` go to the root, every other attr to the `<input>` (so `aria-label`, `aria-describedby`, `autofocus` land on the control); library-owned attrs still win.
- **Controlled rejection.** The change handler calls `native('checked', next)` then `nextTick(commit)`: a rejecting owner never re-renders, so nothing else would run `reconcile()`; the host executes the corrective `checked` effect as `input.checked = value`.
- **Bug found and fixed: Vue mirrors `checked` into the HTML attribute** (`patchProp` calls `patchAttr` for `checked`), so after a toggle `form.reset()` restored the latest state, unlike a bare input. The vnode now carries only the initial value (what SSR emits; the reset default) and the live state is written to the property in `onVnodeMounted/Updated`. A `form.reset()` fires no `change`, so a `reset` listener (instance `AbortController` signal, W1-006 rule 5) re-syncs the model afterwards. Tested against a bare input.
- **Tests (19).** markup/attrs/classes/slot; uncontrolled; `v-model:checked`; rejection correction (single and repeated); disabled (native, no `aria-disabled`); FormData equals a bare `<input type=checkbox>` for off/on/custom value/disabled/no name/long label/after toggle/after reset; SSR (deterministic id, `checked`, `data-state`, no `aria-checked`); 1,000 mount/click/unmount cycles: 1,000 stores created and destroyed, 0 listeners left, DOM empty.
- **Boundary lint (W1-006):** `eslint src/switch` clean (store only through `../runtime`, no CSS import, listener has the signal). `vue-tsc` clean.
- **Shared file touched:** `packages/vue/package.json` devDependency `jsdom: 26.1.0` (same pin as `packages/testing`) for the DOM tests; `bun.lock` regenerated.
- **Barrel:** `packages/vue/src/index.ts` is a hand-written stub (not generated); not edited. The subpath `@ramoslabs/vue/switch` already exists in `exports` and the vite entries. Orchestrator: add `export * from './switch/index'` when the barrel is wired.
- **Bytes (min+gzip):** `dist/switch/index.js` 1,212 B gzip / 3,006 B raw, excluding the shared store/runtime chunk and core (`core/switch` is 0.746 KiB separately; `adapter:vue` row reports 1.325 KiB for the runtime fixture). Not wired into `budgets.json` (not mine).
- **Follow-up (affects React/vanilla):** any adapter that lets the framework write `checked` as an attribute, or a `form.reset()`, can desync the model; the .d/.e streams should run the same reset and submit tests.

## .f Conformance (SJSwitch, `packages/testing/specs/switch/**`)

Branch `feature/m4-c03s-switch-conformance` (merge of .a + .b .c .d .e as they stood, then .f work in its own commits: adapter fixes, specs, barrels). Run: `bun run --filter @ramoslabs/testing test:e2e:switch` (3 engines, `retries: 0`), then `parity:switch`; node-side checks run in `bun run test`.

- **What reuses what.** The L2 executor (`runSequence`/`runInert`), `deriveSpec`/`l2Plan`, `detectSupports`/`applyPath`/`injectionProblems`, the parity generator, the a11y collectors/verdicts/triage, the visual capture/site/baseline code, `size` rows, the SSR graph helpers, `warmEngines`, and the css package's `buildCss`. New: only a Switch host page (`host/`, because the stock host is wired to the probe) and the specs.
- **L2/L6.** 3 engines x 3 adapters x paths x 7 scenarios (2 sequences x pointer/Space, inert `disabled`, controlled `checked`, label click). Result: 294 declared cells, 126 executed and passed, 168 declared `not run` with the ADR-013 reason (floor lane, iOS 17, Android floor), 0 missing, 0 invalid (`parity:switch` PASS). **Paths:** the contract has `support: []`, so there is no capability fallback to force; the matrix runs `native` and `fallback:all` (every capability false, proven by reading the adapter runtime back) rather than the 12 probe paths. Decision, not an ADR amendment.
- **Form equality (critical).** `form.e2e.ts`: FormData entries, checked/defaultChecked/`checked` attribute/`:checked`/`:disabled`, and a real `requestSubmit()` navigation to `/echo`, switch vs a bare `<input type=checkbox>`, for 9 form fixtures x 10 operation sequences (click, Space, reset, click+reset+click...) x react, vue, vanilla and the `<sj-switch>` element. Seeded: hidden mirror input, attribute mirroring, stale model.
- **BUGS FOUND AND FIXED (both adapters, with tests).**
  1. **React:** after `form.reset()` the DOM returned to the default but the model kept the last state (`data-state` and thumb wrong; the next click went the wrong way). Fix: a form `reset` listener (instance AbortController, in an effect) re-syncs the model after the reset. Unit test in `react/src/switch/switch.test.ts`.
  2. **Vanilla (a):** the `checked` attribute was never written, so `defaultChecked: true` gave an input whose reset default was unchecked (differs from a bare input and from SSR). Fix: set `defaultChecked` once from the initial value. (b) Same stale-model-after-reset bug; fix: document-level signalled `reset` listener (covers a label placed in a form after mount). (c) A controlled owner that rejected a change was never corrected, because `ctx.native` does not schedule a commit when the store is unchanged; fix: the change handler re-patches via `instance.update(latest)`. Unit tests in `vanilla/src/switch/switch.test.ts`.
  Vue's earlier fix was verified by the same suite; no change.
- **ARIA.** One YAML per contract fixture (`snapshots/`), identical for every adapter and engine; CDP AX tree on Chromium (non-Chromium skipped, `#49 owner: SrRamos`, the existing CDP issue); no `aria-checked`/`aria-disabled`/`aria-labelledby`; label text constant across state (evidence constraint `changing-switch-label`); 4 seeded regressions fail.
- **axe/WCAG.** axe with `target-size` enabled in 5 states x 3 adapters x 3 engines, 2.4.13, 2.5.8 (>= 44 px), forced-colors (borders on track and thumb, position carries state), RTL mirroring. Triage file untouched (empty). **axe limitation, not a finding:** for the span-wrapped label (Vue, vanilla) axe reports `incomplete color-contrast` with `messageKey: pseudoContent` (it will not resolve a background under the root's `::before`); the spec accepts it only when the measured label/background ratio is >= 4.5:1.
- **SSR/hydration.** Node server render with DOM globals hidden; jsdom hydration with the SSR graph helpers (stock `runSsrDeterminism` demands IDREF edges, a native label-wrapped input has none by design); real browser hydration in development builds (no mismatch, every server node kept, markup identical, then toggle/reset/submit). Vanilla has no server render (ADR-002); its pre-existing-markup path is the `<sj-switch>` upgrade test.
- **Bundle.** Core row via `runSize` within 1 KiB; per-adapter one-component fixtures import only the Switch and the shared runtime: react 1,981 B, vue 1,442 B, vanilla 1,368 B gzip (core and peers external).
- **VoiceOver hook.** `voiceover.js` renders every contract `atAssertions` id and the keyboard/actions into both lanes (macOS, iPhone) with the ADR-013 4 fields, blanks for the human fields; an id without a template fails. W1-505 can import `renderVoiceOverPack`.
- **Visual.** 9 scenes (off/on/disabled/focus/long label/RTL/forced colors) in `scenes.js`; `visual.mjs candidates` writes candidate PNGs, **no baseline is approved**: `baselines/` is empty, `check` reports `not run`, a human must review and run `update`. Look at forced-colors on first review: the transparent 44 px control shows a circular outline around the track under forced colors (visible, harmless, but check it is intended).
- **Shared files touched.** `packages/testing/package.json` (3 scripts), `packages/testing/vitest.config.ts` (include `specs/**/*.test.ts`), `packages/vue/src/index.ts` and `packages/react/src/index.ts` (barrel export). The vanilla barrel is not changed: every vanilla component exports `define`, so `export *` would collide; consumers use `@ramoslabs/vanilla/switch`.
- **Follow-ups.** Wire `test:e2e:switch` and `parity:switch` into `.github/workflows/e2e.yml` (not mine); CI port is `SWITCH_PORT` (4193). Human visual review. Real VoiceOver lane (pending-real-test).

## G3A CSS and contrast fixes (branch `feature/g3a-switch-css-contrast`)

- **MUST-3.** `.sj-switch__control` is centred on the block axis (`inset-block-start: 50%; translate: 0 -50%`), like the track and knob, so the focus ring and 44 px hit area stay over the visible control when the label wraps. Geometry test (180 px box, long label, root taller than 88 px): the input rect contains the track and thumb rects. Seeded: restoring `inset-block-start: 0` fails that test (checked); the fix passes.
- **SHOULD-2.** `extractUiPairs(css)` (`packages/testing/contrast/css.js`) reads `background-color` fills from `@layer sj.state` rules keyed on `[data-state]` for a part or its pseudo-element (disabled rules skipped, 1.4.11 inactive exemption; raw colours throw). `checkContrastMatrix({ css })` checks each at 3:1 on all three surfaces (ids `switch/root::before/<state>/ui-on-<surface>`). The in-test literal track-vs-surface checks in `switch.test.js` are replaced; knob-on-track stays there (not on the page). Seeded weak off-track and on-track fills fail (css.test.js, switch.test.js, contrast.test.js). C03c gets the check for free.

# C03c.a: SJCheckbox contract + core

Branch `feature/m4-c03c-checkbox-core`. Files: `packages/contracts/contracts/checkbox.contract.json`,
`packages/core/src/checkbox/{index,reducer,checkbox.test}.ts`, regenerated `src/generated/checkbox/**` (core and the three
adapters' `types.ts`), `"./checkbox"` in `packages/core/package.json` exports (the only shared-file edit, mirrors `./switch`).
Same shape as the switch golden; this section lists only the differences.

## Getters API (frozen)

```ts
reducerEvents: readonly ['toggle', 'setIndeterminate', 'clearIndeterminate']
reduce(state: CheckboxState, e): CheckboxState                       // machine form, four positions
reduce(state: CheckboxSnapshot, e): Reduction<CheckboxSnapshot, never>
initialSnapshot(checked = false, indeterminate = false)              // { state, checked, indeterminate }
checkboxFields                                                       // both fields, for createControlled
harness                                                              // controlled operations on `checked`
checkboxBaseId(explicit, acquire, prefix = '')
createCheckboxParts({ view, native, getProps, id }): {
  ids: { control }
  getRootProps()       // <label>   sj-checkbox__root
  getControlProps()    // <input>   type=checkbox, checked, indeterminate, name?, value?, disabled?, onChange
  getIndicatorProps()  // <span>    sj-checkbox__indicator (box and check/dash glyph, CSS .b)
  getLabelProps()      // <span>    sj-checkbox__label (anatomy part, G3A SHOULD-6)
}
CheckboxProps { checked?, defaultChecked?, indeterminate?, defaultIndeterminate?, disabled?, name?, value?, id?,
                onCheckedChange?(checked), onIndeterminateChange?(indeterminate) }
```

All parts carry `data-part`, `data-state` (`unchecked | checked | indeterminate`, indeterminate wins) and `data-disabled`, protected
from consumer override. Adapter obligations:
- `indeterminate` is a **DOM property with no attribute**. The control getter emits it as a prop; React must apply it through a ref after
  commit (never render it as an attribute), Vue and vanilla set `el.indeterminate`. `reconcile()` yields effects
  `{ type: 'checked' | 'indeterminate', target: 'control', value }`; the host sets `el.checked` / `el.indeterminate` after commit.
- No `role`, no `aria-checked`, no hidden input, no FACE (ADR-014). The browser exposes native `indeterminate` as `mixed`.
- SSR cannot render `indeterminate` (no attribute): the property is set at mount/hydrate. `data-state="indeterminate"` is server-rendered,
  so CSS can paint the dash before hydration; AT sees `mixed` only after hydration. .f must assert this explicitly.

## Decisions
- **`indeterminate` is controlled** (`state.controllable: ["checked", "indeterminate"]`, props `indeterminate` / `defaultIndeterminate`,
  event `indeterminateChange`). Why: ADR-003's pipeline treats every contract-controllable field alike, a tri-state parent checkbox
  ("select all") derives it from its children, so the owner must be able to hold or release it; it is also the only way a rejected
  clear is corrected (`reconcile` effect `indeterminate`).
- **User activation clears indeterminate like a native input.** The change handler computes `next = !view().checked`, calls
  `native('checked', next)`, and, only if `view().indeterminate`, `native('indeterminate', false)`. Both are requests: a controlled owner
  that keeps `indeterminate=true` is corrected post-commit (effect `indeterminate`), exactly as a rejected `checked`.
- **Four machine positions**: `unchecked`, `checked`, `mixed-unchecked`, `mixed-checked`; `checked` and `indeterminate` are derived from
  the position. Native `checked` and `indeterminate` are independent (a native click on `checked && indeterminate` gives neither), and the
  reducer cannot read a controlled field, so the position must carry both bits. First attempt (two states plus an orthogonal flag) failed
  the W1-308b harness: `setIndeterminate` changed the snapshot while the machine projection did not, which the harness treats as a no-op
  that must keep the reference. Contract actions: `toggle` from all four positions, `setIndeterminate` / `clearIndeterminate` between
  the unmixed and mixed positions; every self-transition is a missing row (reference kept).
- The reducer reads `state` only; `contract/reducer-controlled-field` passes.
- `support[]` empty (same reasoning as switch: `appearance` and `accent-color` are inside the ADR-001 floor). `liveRegions: []`.
- `atAssertions` adds `manual-speech-mixed-state` (VoiceOver script must read "mixed"). `atSupport` rows reference the existing
  `at-support/checkbox.json` entries; the NVDA group-description issue (12718) is a CSS/fieldset concern for a later group component, not
  referenced here. Added WCAG 1.3.1 (label association).
- No `required` / `readOnly` / `form` props (not in the plan row; submit equivalence needs only name, value, checked, disabled).
- **Status stays `draft`.** Getters are frozen by this task, but `beta` needs fixtures and parity green (ADR-010 status meanings), which is
  .f. Promote with the .f PR (or earlier if the orchestrator reads "getters frozen" as sufficient).

## Proof
- `checkbox.test.ts`: 26 tests, including fast-check invariants (checked agrees with machine position under random event sequences, store
  form projects onto machine form, toggle clears indeterminate and is an involution on checked, set/clear idempotent and never touch
  checked, getters pure over random props).
- Seeds that fail: reducer reading `state.indeterminate` -> `contract/reducer-controlled-field`; `mixed-checked` + `toggle` staying mixed -> 3
  unit tests; a wrong table row -> `codegen.test.js` "SJCheckbox: reducer events equal contract actions"; a state-less no-op (the first two-state design) -> the W1-308b harness "did not reuse the state reference"; W1-308b
  auto-discovers `harness` and passes.

## Bytes (min+gzip, `node packages/testing/size/cli.js`)
| Module | gzip | raw | Ceiling |
|---|---|---|---|
| core/src/checkbox | 0.908 KiB | 2,433 B | 3 KiB (contract `budgets.gzipKiB`, PLAN 6.2), pass |

## Follow-ups
- .b CSS: indicator part paints box, check and dash (`data-state`), `appearance: none` input in the hit area, forced-colors visible.
- Adapters: apply `indeterminate` as a property (React ref), run `reconcile()` after commit and execute both effect types.
- .f: submit equivalence vs a bare `<input type=checkbox name value>` for unchecked/checked/indeterminate/disabled, SSR note above.

# C03c.b: SJCheckbox CSS (`packages/css/src/checkbox.css`)

Branch `feature/m4-c03c-checkbox-css`, from origin/main (7389670). Files: `packages/css/src/checkbox.css`,
`packages/css/test/checkbox.test.js` (27 tests), `packages/css/test/template.test.js` (checkbox added to the real-contract
list, as switch is). Same structure as the switch golden (C03s.b); this section lists only the differences.

## Structure (ADR-008, ADR-009, ADR-014)
- The **native `<input>` is the focus target**: `appearance: none`, transparent, sized to `--sj-target` (44 px, 24 px compact on
  fine pointers), centred on the 44 px slot with `translate: 0 -50%` (G3A MUST-3 pattern, asserted on a wrapping label).
- The **box is `.sj-checkbox__indicator`** (20 px, `--space-5`), centred in the 44 px slot at the start edge (12 px in).
- **Boundary and field.** The box's own fill is the 1 px boundary: `slate-500` when unchecked, `primary` when checked or
  indeterminate. `::before` is the white field inset by the hairline (sj.component, so it is not a page fill).
- **Glyphs.** `::after` is drawn with borders, not background: the check is an L (`rotate: 45deg`), the dash is one
  `border-block-start`. Borders survive forced colors; backgrounds do not.
- Logical properties throughout; RTL mirrors the box inset without `:dir()`.

## Contrast through the extractor
- `extractUiPairs` reads `background-color` fills in `sj.state` keyed on `[data-state]`. The box fills are exactly those:
  nine ids (`checkbox/indicator/{unchecked,checked,indeterminate}/ui-on-<surface>`), each at 3:1 on all three surfaces.
  Disabled fills are skipped (1.4.11 inactive exemption), as for the switch.
- **Why the boundary is a fill, not a border.** The extractor reads no `border-color` outside `sj.variant`. A 1 px slate
  border would be invisible to it. Drawing the boundary as the box fill keeps it on the page through the extractor.
  The white field inside is in `sj.component` and is not a page fill (its contrast against the surface is not a
  requirement; the boundary is).
- **Not checked by the extractor:** the glyph on the primary fill (white on primary, 6.3:1), read from computed styles in
  `checkbox.test.js` (`checked glyph meets 3:1`). Extending `extractUiPairs` to read `border-color` in `sj.state` would
  move this into the matrix; not done here (the testing package is not owned by this stream).

## Forced colors
- `.sj-checkbox__indicator` gets `hairline solid CanvasText`; `::after` gets `border-color: CanvasText`. The state is carried by
  the glyph (check, dash, empty box), not by colour. Test: unchecked, checked and indeterminate screenshots differ.
- Seeded: removing the forced-colors box border fails the forced-colors test.

## Checks (all green)
- `npm run lint` (stylelint W1-202 rules), `prettier --check` on the css package, `vitest run` (css suite 123 tests).
- Anatomy: `cssParts('checkbox')` equals the contract's `root`, `control`, `indicator`, `label`; `checkStylesheets` clean.
- Seeds that fail: unchecked boundary to `slate-300` (extractor, 1.4.11); checked fill to `slate-300` (extractor); control pinned
  to the top edge on a wrapping label (geometry); forced-colors border removed (forced colors).

## Follow-ups
- `extractUiPairs` reading `border-color` in `sj.state` (then the glyph-on-fill and any future outline box can be extracted).
- Adapters (.c/.d/.e): `indeterminate` is a property, not an attribute; `data-state="indeterminate"` is server-rendered so the
  dash paints before hydration.
- .f: visual baselines for the forced-colors and RTL scenes (human review), VoiceOver `mixed` announcement.
# C03c.c: SJCheckbox Vue adapter

Files: `packages/vue/src/checkbox/{SJCheckbox,index}.ts`, `checkbox.test.ts`, `ssr.test.ts`; barrel `src/index.ts` and `index.test.ts`.
Flat component over `createCheckboxParts` and the shared `useSJStore` (no local bridge), same shape as the SJSwitch golden.

- **Models**: `v-model:checked` and `v-model:indeterminate` (props present = controlled, absent = uncontrolled; `defaultChecked`,
  `defaultIndeterminate`); events `update:*` plus `checkedChange` / `indeterminateChange`. `classes` has `root | control | indicator | label`;
  label by prop or default slot (slot wins).
- **`indeterminate` is never a vnode prop.** The adapter strips `checked` and `indeterminate` from the control getter's output and writes
  both DOM properties in `onVnodeMounted` / `onVnodeUpdated` (`syncProps`), so the property is applied after mount and on every change.
  Corrective effects `checked` / `indeterminate` (controlled rejection) are executed by the host after commit.
- **`checked` attribute** carries the initial value only (as switch), so `form.reset()` matches a bare input. A `reset` listener (abort
  signal, removed on unmount) re-syncs `checked` after the reset. A native reset leaves `indeterminate` untouched, so the handler
  re-asserts the DOM's flag when the reducer's `toggle` (which leaves the mixed positions) would have cleared it.
- SSR: `data-state="indeterminate"` is server-rendered, no `indeterminate` attribute (asserted in `ssr.test.ts`); the property appears at mount.
- Tests: markup, `classes`, attrs, uncontrolled, controlled accept and reject, one commit per accepted change, disabled, form-data
  equivalence with a bare checkbox (incl. reset on and off defaults), indeterminate (property not attribute, click clears like a bare
  input, rejected clear corrected, reset), 1,000 mount/destroy cycles with a 60_000 timeout.
- Bytes (`node packages/testing/size/cli.js`): core checkbox 2433 B gzip (ceiling 3 KiB); the Vue adapter is reported, not gated.
- Shared-file edits: `src/index.ts` and `index.test.ts` only (`package.json` exports and `vite.config.ts` already listed `./checkbox`).
# C03c.d: SJCheckbox for React

Branch `feature/m4-c03c-checkbox-react` (from main after #73). Files: `packages/react/src/checkbox/{index,checkbox.test}.ts`, the barrel
`packages/react/src/index.ts` and its test (the brief asked for both). Same shape as the switch golden; differences only.

## API
`SJCheckbox = { Root, Control, Indicator, Label }` plus flat `SJCheckboxRoot/Control/Indicator/Label` (ADR-002). `classes={{ root, control,
indicator, label }}`, prop-or-slot `label`. Controlled `checked` / `indeterminate` with `onCheckedChange({ checked })` /
`onIndeterminateChange({ indeterminate })` (generated payload types), uncontrolled `defaultChecked` / `defaultIndeterminate`.

## Decisions
- **`indeterminate` is a property, never rendered.** `getControlProps` emits it; Control strips it before `createElement('input')`, and Root
  applies `el.indeterminate = view.indeterminate` in a layout effect with no deps (after mount and every commit, so first paint is already
  mixed and a native click that cleared it is re-applied when the owner keeps it). The corrective effect `indeterminate` also writes the
  property; `checked` writes `el.checked`. Both go through `useMachine`'s own post-commit resync (no forced render, #64).
- `form.reset()`: native reset restores `checked` only (the HTML reset algorithm leaves `indeterminate` alone), so the switch's reset listener
  re-syncs `checked` and nothing else; a test asserts `indeterminate` survives a reset.
- SSR cannot render the property: markup has `data-state="indeterminate"` (CSS paints the dash before hydration) and no `indeterminate`
  attribute, no `role`, no `aria-checked`; a test asserts all three. AT sees `mixed` only after hydration (as noted in C03c.a, .f to assert in a browser).
- Initial snapshot: `initialSnapshot(defaultChecked ?? checked ?? false, defaultIndeterminate ?? indeterminate ?? false)`.

## Proof
39 tests with the barrel test: naming, structure (no role / aria-checked / indeterminate attribute), classes, protected attributes, refs,
uncontrolled (click clears indeterminate and reports both; plain click reports no indeterminate), controlled indeterminate (property follows prop
across updates, rejection corrected, accepting select-all owner), reset (both defaults, indeterminate untouched, listener removed), controlled
checked (rejection, accepting, outside change), disabled, form markup equal to a bare checkbox (9 cases), SSR, StrictMode, 1,000-cycle retention.

## Bytes (esbuild --minify, gzip -9, react external; switch measured the same way for comparison)
| Entry | gzip | raw |
|---|---|---|
| `react/src/checkbox` alone (core, runtime external) | 1,284 B | 2,823 B |
| `react/src/checkbox` with core and shared runtime inlined | 4,855 B | 11,754 B |
| switch, same method (alone / inlined) | 1,159 B / 4,612 B | 2,330 B / 10,799 B |
No ADR-011 ceiling applies to an adapter entry.

## Follow-ups
- .f: real-DOM hydration (property set at hydrate), `FormData` equality including after `form.reset()`, VoiceOver "mixed".
# C03c.e: SJCheckbox vanilla adapter

Branch `feature/m4-c03c-checkbox-vanilla` (from main, `.a` merged). Files: `packages/vanilla/src/checkbox/{index,checkbox.test}.ts`. No shared files touched (`./checkbox` already in `exports`; the vanilla barrel stays empty because every vanilla component exports `define`).

- API: `mountCheckbox(host, labelEl, props) -> Instance` (+ `.control`), `define(host, name = 'sj-checkbox', registry)`. Same shape as the switch golden: root `<label>` > `<input type=checkbox>`, indicator `<span>`, label `<span>` (plain text via `setText`); no FACE, no `role`, no `aria-checked`, no hidden input.
- **`indeterminate` is a property.** `applyProps` skips `checked` and `indeterminate`; `patch` writes `input.indeterminate = view.indeterminate` on mount and on every patch (so an outside clobber is repaired), and effect `indeterminate` sets it after a rejected controlled clear. Initial: `indeterminate ?? defaultIndeterminate`. It is never an attribute (test asserts `hasAttribute('indeterminate') === false`).
- **Form state equals a bare checkbox.** `defaultChecked` is written once from the initial value (reset default); the live state is the property. `indeterminate` does not affect FormData (tested vs a bare input).
- **`form.reset()`.** Same signalled document-level `reset` listener as the switch. Per HTML, reset restores `checked` and leaves `indeterminate` alone; the handler reads both input properties first, then reports differences. Reading first matters: a dispatch re-patches synchronously and would overwrite the other property (first attempt lost the indeterminate value this way; test seeds it).
- `<sj-checkbox>`: attributes `checked`, `indeterminate` (initial only, read at connect), `disabled`, `name`, `value`, `label`, `id`; accessors `checked` and `indeterminate` read the input. To drive a tri-state parent, use `mountCheckbox` with controlled `indeterminate`.
- Tests (22): switch suite adapted plus indeterminate on mount/every patch/never attribute, `defaultIndeterminate` and activation clearing it, controlled rejected clear, submit equivalence with indeterminate, reset (checked restored, indeterminate kept, model follows), 1,000-cycle retention (0 listeners, 0 children), element lifecycle. Seed: dropping the per-patch property write fails 4 tests.
- Bytes: see the reply (adapter alone, min+gzip, core and runtime external). No ADR-011 ceiling for adapter entries.
- Follow-up .f: real-browser FormData equality incl. reset and indeterminate, `mixed` in the AX tree.
