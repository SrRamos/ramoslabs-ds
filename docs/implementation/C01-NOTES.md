# C01 notes (W1-C01.a: SJButton contract + core)

Branch `feature/m4-c01a-button-core`. Owned: `packages/contracts/contracts/button.contract.json`, `packages/core/src/button/**`, regenerated codegen output. SJButton is the golden component: `.b/.c/.d/.e` and every later `.a` copy this layout.

## Layout (copy this)

- `core/src/button/reducer.ts`: `reducerEvents` + pure `reduce(state, { type })`. Discovered by codegen equivalence (`codegen.test.js`) and the W1-308b harness (`spec/reducer`, "real component reducers") with no registration. Both ran on it, not skipped (verified with the verbose reporter).
- `core/src/button/index.ts`: `createButton(getProps)` prop getters per part (frozen below) + axis vocabularies + re-export of `reduce`/`reducerEvents`.
- `core/src/button/button.test.ts`: L1 unit + fast-check invariants + contract-drift tests.

## Getters API (frozen)

All from `@ramoslabs/core/button`. Pure; no module or instance state (nothing to destroy, nothing retained: ADR-011 1,000 mount/destroy is trivially clean).

```ts
export const buttonVariants: readonly ['solid', 'soft', 'outline', 'ghost'];
export const buttonTones: readonly ['primary', 'neutral', 'success', 'warning', 'error', 'info'];
export const buttonSizes: readonly ['sm', 'md', 'lg'];
export type ButtonVariant | ButtonTone | ButtonSize;

export interface ButtonProps {
  variant?; tone?; size?;                 // data-variant/tone/size; unknown value -> default solid/primary/md
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';   // button element only; default 'button'
  href?: string; target?: string; rel?: string; // non-empty href selects the <a> element
  iconOnly?: boolean; label?: string;     // label -> aria-label; required with iconOnly
  id?: string;                            // adapter resolves with ids.baseId when it needs one
  onPress?: (payload: { originalEvent: ButtonEventLike }) => void; // adapter-injected emitter
}
export interface Button {
  element(): 'button' | 'a';
  getRootProps(consumer?: Props): Props;  // part "root", <button>
  getLinkProps(consumer?: Props): Props;  // part "link", <a>
  getIconProps(consumer?: Props): Props;  // part "icon", decorative span
}
export function createButton(getProps: () => ButtonProps): Button;
```

Adapter recipe: `const b = createButton(() => latestProps)`; per render `const bag = b.element() === 'a' ? b.getLinkProps(restAttrs) : b.getRootProps(restAttrs)`; spread `bag` on the element; wrap the icon slot in `getIconProps()`. `restAttrs` is every non-prop attribute the consumer passed. `getProps` is read on every call and again when the click fires, so Vue/React/vanilla can pass a stable accessor over the newest props.

Returned bags (all merged with `mergeProps`, ADR-004: consumer `class` appended, consumer handler first and `preventDefault()` cancels the library press, library-owned keys win with a dev warning):

| Part | Keys |
|---|---|
| root | `class sj-button__root`, `data-part=root`, `data-variant/tone/size`, `type`, `disabled` (true only), `data-disabled=true`, `data-icon-only=true`, `aria-label` (if `label`), `id` (if `id`), `onClick` |
| link | as root minus `type`/`disabled`; plus `href`, `target`, `rel` (`noopener noreferrer` when `target=_blank` and no rel). Disabled: `href/target/rel` removed, `role=link`, `aria-disabled=true`, `data-disabled=true` |
| icon | `class sj-button__icon`, `aria-hidden=true`, `data-part=icon` |

Protected (consumer cannot override): `disabled href type data-part data-variant data-tone data-size data-disabled data-icon-only` plus `role`, `id` and `aria-*` the library sets. Keys the library does not set are absent (never `undefined`), because `mergeProps` treats an owned key set to `undefined` as "delete the consumer value" (this was a real bug caught by a test: `aria-label`/`id` from the consumer were being dropped).

`onClick`: disabled -> `preventDefault()` only; otherwise calls `onPress({ originalEvent })`. Keyboard is native (Enter/Space on `<button>`, Enter on `<a>`), so no key handlers exist; the contract `keyboard` map documents it.

G3A follow-up: RECIPE outline/ghost now use `bg: 'transparent'` and expand across every surface like the CSS pairs (ids `outline/<tone>/<size>/text-on-<surface>`); `contrast.test.js` also builds `index.css` and runs the matrix on it. `extractUiPairs` (switch track) is described in C03-NOTES.

## Decisions and ambiguities

- **Stateless machine.** One state `idle`, one self-transition `press` that emits `press` (S-CON gap 5 convention). No store: nothing to snapshot, and nothing to retain. The reducer exists for the contract equivalence and the harness; the click handler is the runtime path. `state.controllable` is empty, so the "reducer never reads a controlled field" rule (G1 SHOULD-4) holds trivially; `lintReducers` already scans `reducer.ts`.
- **Link variant is a separate anatomy part `link`** (`a`, role `link`, native), not a variant of `root`: the schema has one element per part, and the keyboard differs (a link has no Space activation). ADR-009 hooks therefore are `sj-button__link`/`data-part=link`; `.b` must style `root` and `link` together. Source: PLAN 6.2 "link variant renders `<a>`".
- **Disabled link** drops `href` plus explicit `role=link` and `aria-disabled=true` (an anchor has no `disabled`); not focusable, consistent with a native-disabled button.
- **Native button, native `disabled`, no `aria-pressed`**: follows the registry `decision` for `button` (`at-support/button.json`, ADR-015); toggles are SJSwitch's job. Every AT ref in the contract points into `at-support/button.json` and resolves (`evidence:check`).
- **No `data-state`**: a single constant state carries no information.
- **Axes vocabulary** (4 variants x 6 tones x 3 sizes) is the contrast matrix's (`testing/contrast/matrix.js`, W1-203), and a core test pins it to the contract prop types.
- **Icon-only name**: new lint rule `contract/icon-only-name` (see below); the dev build also warns from the getter.

## Shared-file touches (outside my directories, minimal)

1. `packages/testing/lint/contract/source.js` (+ `source.test.js`): rule `contract/icon-only-name`. Source rule: a tag of a component whose contract has an `iconOnly` prop, used with `iconOnly`/`icon-only` (not literal `false`), must carry `label`/`aria-label`/`aria-labelledby`; visible content does NOT count (it is only an icon). Contract-data rule: a contract with `iconOnly` but no `label` prop fails. Seeded cases in `source.test.js`.
2. `packages/testing/spec/reducer/index.js` (+ test, new fixture `fixtures/state.reducer.js`): the harness header promises "a state or a Reduction", but it passed `mod.reduce` straight to `createStore`, so a bare-state reducer (the shape `checkReducerEquivalence` REQUIRES, since it compares `reduce()` to a state name) crashed with `ended in "undefined"`. The two conventions could not both be met. Fixed by normalizing at the two `createStore` call sites; a seeded wrong target on a bare-state reducer still fails.
3. `packages/testing/spec/derive/index.test.js`: the SJButton inline snapshot updated (new `link` fixture and `link` Enter trigger); the probe is meant to track the contract.
4. Codegen output regenerated for react/vue/vanilla `generated/button/types.ts` (new props).

## Budget

`budgets: { gzipKiB: 1.5, shared: ["merge"] }`. ADR-011's ceiling for a simple primitive is 3 KiB; the contract holds the button to half of it so growth is noticed. Measured by `node packages/testing/size/cli.js` (shared kernel externalized): see the bytes in the final report below.

## Follow-ups

- `.b` (CSS): style `.sj-button__root, .sj-button__link` (and `__icon`), 44 px target with 24 px floor, `data-icon-only` square target, `[data-disabled]` for both elements; `RECIPE` in the contrast matrix is the pairing.
- `.c/.d/.e`: adapter must supply `onPress` (Vue emit, React prop, vanilla CustomEvent `press`); vanilla needs `rel`/`aria-*` applied as attributes and removal of attributes that disappear between updates.
- `.f`: a `link-disabled` fixture is deliberately NOT in the contract: `deriveSpec` treats only the exact name `disabled` as inert (`spec/derive/index.js` INERT_FIXTURE), so L2 would press it and expect `press`. Widen that rule when `.f` needs it (disabled-link behavior is covered by core unit tests). Fixtures `default disabled long-label icon-only link` are named in the contract; atAssertions `manual-icon-only-name`, `manual-link-role-enter`, `manual-disabled-announced` need script text in the W1-505 VoiceOver script.

# C01.b notes (SJButton CSS, the golden CSS reference)

Branch `feature/m4-c01-button-css` (stacked on `feature/m4-c01a-button-core`). Files: `packages/css/src/button.css`, `packages/css/test/button.test.js`, `packages/testing/contrast/{css.js,css.test.js}` (+ `matrix.js`, `index.js`).

## Layout (copy this for every later component)

- `sj.component`: structure (inline-flex, gap, padding, radius, type, hairline transparent border, transition on color props from `--sj-duration-fast`, `--easing-out`), `min-*-size: var(--sj-target)` set here too because base only matches `a[href]` and a disabled link has no href; icon-only is `aspect-ratio: 1` with no inline padding.
- `sj.variant`: `data-size` (sm/md/lg; lg raises min block size with `max(target, space-12)`, never below the target), then per variant x tone: rest, `:hover` inside `@media (hover: hover)`, `:active`. Explicit rules, no local custom properties, so the extractor reads the real tokens.
- `sj.state`: `data-disabled` (both elements, wins over hover/active by layer), `forced-colors` (hairline `ButtonBorder` on root AND link, disabled `GrayText`). Focus ring, reduced motion: from `base/`, not redone (tests prove both reach the button).
- Root and link are always styled together through `:is(.sj-button__root, .sj-button__link)`; a test fails if a bare `.sj-button__root` selector appears.

## Contrast extractor (G2 NICE-1)

`checkContrastMatrix(tokens, { css })` now reads pairs from the built CSS (`extractPairs`, dependency-free brace parser). Reads only `@layer sj.variant`; flattens `@media`; understands `[data-variant]`, `[data-tone]`, `:hover`, `:active`; declarations `color`, `background-color`, `border-color` as `var(--color-*)` or `transparent` (anything else throws: tokens only). Cascade is constraint count then source order. Checked: text at 4.5:1 for rest/hover/active; `transparent` fill is evaluated on every surface; the border is checked at 3:1 only when it is the boundary (fill transparent or a surface token). A variant x tone any component CSS covers replaces its RECIPE entries; RECIPE stays the fallback for the rest (`PairResult.source` is `css` or `recipe`; css ids are `button/solid/primary/hover/text`). Disabled (text exempt) and focus rules are out of scope of the extractor. Button test also compares the real Chromium cascade against the extracted tokens for all 72 states (so the extractor cannot drift from the browser) and seeds weak fill, hover and border failures.

## Decisions

- Hover/active tokens are explicit shades (e.g. solid primary: `primary-dark`, `indigo-800`; soft: `*-100`, `*-200`; outline/ghost: tone surface, then `*-100`/`slate-200`); all pass 4.5:1 text.
- Outline fill is `transparent` (RECIPE said `color-surface`): same contrast on all three surfaces, and it works on any page color.
- **Target size layers (G3A NICE-6).** The component's own `min-*-size` in `button.css` is load-bearing only for the disabled link (38 px without it). Every other button target stays at 44 px without it, because `base.css` sets `min-block-size`/`min-inline-size: var(--sj-target)` on every `[data-part]` control. Removing only the component rule is therefore not caught by the css or L3 target-size gates (by design); forcing `min-*-size: 0` is, and fails both.
- Disabled uses `color-text-disabled` on `surface-hover` (WCAG 1.4.3 inactive exemption); meaning is carried by native/ARIA disabled and `cursor: not-allowed`, not color alone.
- Link anatomy gets no underline; it is a button-shaped link. Inline text links use consumer styles (WCAG 2.5.8 inline exemption).

## Follow-ups

- Hover shades have no `--state-hover` overlay use; if a later design wants overlays, the extractor needs color-mix support.
- The contrast CI step for other components needs no change: any `sj.variant` rule with `data-variant`/`data-tone` is picked up from `dist/index.css`.
---

# C01.c notes (SJButton for Vue)

Branch `feature/m4-c01-button-vue`, stacked on `feature/m4-c01a-button-core`. Owned: `packages/vue/src/button/**`. No shared-file touches (the Vue `./button` export and vite entry already existed).

## Layout (golden Vue adapter; copy this)

- `button/SJButton.ts`: the component (a render function in `.ts`, `defineComponent`, `inheritAttrs: false`). `button/index.ts`: public entry (`SJButton`, `SJButtonClasses`, plus the generated `SJButtonProps/Emits/Slots/PressPayload` types). `button/SJButton.test.ts`: the suite.
- ADR-002 naming: one flat component. SJButton has one interactive part (`root`/`link`) and a decorative icon, so there is no compound set and no separate preset; `SJButton` is the public primitive itself (the preset-from-public-primitives rule has nothing to apply to).
- Thin (ADR-004): `createButton(() => ({ ...props, onPress: (p) => emit('press', p) }))` once in `setup`; `props` is Vue's live reactive object, so the accessor sees the newest values at render and at click time. Render picks `element()`, passes `attrs` as `consumer` to `getLinkProps`/`getRootProps`, wraps the `icon` slot in `getIconProps()`.
- `classes` (ADR-004 per-part): `{ root, link, icon }`. `root`/`link` is appended after the consumer `class` via `normalizeClass` and then merged by `mergeProps` (library class first). `icon` is passed as the icon part's consumer class.
- Prop-or-slot: the default slot is the visible label; with no slot and not `iconOnly`, the `label` prop is rendered as the visible text too (and is the `aria-label`). `iconOnly` renders no text. `icon` slot only via slot (decorative).
- `press` is declared in `emits`, so a consumer `@press` is never in `attrs`; a consumer `@click` is, and runs first (`preventDefault()` cancels press).

## Decisions

- **No store, no `useSJStore`, no provider.** The core machine is stateless (C01.a): nothing to snapshot, subscribe or destroy, and no effects to drain. `useSJStore` would add a scope, a subscription and a `SJProvider` fallback warning for no behavior; the test proves 1,000 cycles produce no provider warning and every instance scope is inactive after unmount. The runtime is required only by stateful components.
- **Keyboard is native.** Pointer, Enter and Space on `<button>` and Enter on `<a>` all become `click`; the adapter adds no key handlers (a test pins that the only `on*` key is `onClick`, so Space cannot activate a link). Real key activation in browsers is the `.f` L2 job; the unit suite asserts the handler contract (click -> one `press` with `originalEvent`).
- **Tests run DOM-free** (custom `createRenderer` that records patched props and handlers, as in `runtime.test.ts`) plus `vue/server-renderer` for SSR; jsdom is not a dependency of `@ramoslabs/vue` and package.json is not mine.
- `bun run --filter @ramoslabs/core build` is needed once before the Vue tests resolve `@ramoslabs/core/button` (exports point at `dist`).
- Children are a flat array (no `null` placeholders), so SSR output has no `<!---->` or fragment markers.

## Proofs

Button/link/disabled link/icon-only/classes/attrs/slots, onPress ordering and stale-handler freshness, SSR (button, link, disabled link, icon-only, deterministic, no warnings), 1,000 mount/unmount cycles (scopes inactive, tree empty, no warning), fast-check over the axis vocabulary (unknown -> default).

## Bytes

See the final report (gzip of `dist/button/index.js`, shared kernel `merge` and core external).

## Follow-ups

- `.f`: L2 keyboard and form `type=submit` behavior in a real browser; Vue `./button` should be added to the SSR component wrappers if `.f` wants it.
- Barrel `packages/vue/src/index.ts` is still empty by design (its test asserts no keys); the entry is `@ramoslabs/vue/button`.
# C01.d notes (W1-C01.d: SJButton for React)

Branch `feature/m4-c01-button-react` (stacked on `feature/m4-c01a-button-core`). Code: `packages/react/src/button/{index.ts,button.test.ts}`. No shared-file touches. `@ramoslabs/core` must be built (`dist`) for react tests/typecheck, as for the other React tests.

## Layout (copy this)
- Names (ADR-002): `SJButton` is the prop-driven preset and also the namespace (`SJButton.Root`, `SJButton.Icon`); flat exports `SJButtonRoot`, `SJButtonIcon`. The preset uses only the two public primitives (ADR-004). `link` is not a separate React component: `Root` renders `<a>` or `<button>` from `createButton().element()` and picks `getLinkProps`/`getRootProps`.
- Props: contract props (generated types) + native attributes; `classes: { root, link, icon }` appended after the library class (`className` also appended); `icon` prop-or-slot (an `iconOnly` button may pass the icon as its child); `ref` via `forwardRef` to the real element (button, anchor or icon span). Remaining attributes (aria-*, data-*, onClick...) go to the getters as the consumer bag, so the ADR-004 merge rules apply (consumer onClick first, `preventDefault` cancels the press, protected keys win with a dev warning).
- `onPress`: payload `originalEvent` is the native `Event` (`SyntheticEvent.nativeEvent`), as the generated type states.

## Decisions
- **Stateless, no `useMachine`/store/provider.** The runtime bridge exists to own a store; the button has none (core notes: one constant state). Calling `createButton` per render is a few closures; it captures THIS render's props, and React attached the matching `onClick` in the same commit, so there is no ref, effect, subscription or listener of our own to dispose. Works outside `SJProvider`.
- No key handlers: Enter/Space on `<button>`, Enter on `<a>` are native clicks. Tests assert no `onKey*`/pointer/mouse handlers, and that a click presses.
- Hydration: the node test environment has no DOM (R1 limit), so tests prove (a) server markup equals the client props bag attribute for attribute, (b) StrictMode and plain SSR markup are identical, (c) no `document`. Real `hydrateRoot` against a DOM is left to L2 (.f).
- Retention: 1,000 StrictMode mount/click/unmount cycles with real `gc()`; at most 2 of 1,000 payload closures alive (fibers may defer).

## Bytes (min + gzip 9, esbuild, react and `@ramoslabs/core/*` external)
Adapter alone: 637 B gzip (1,166 B raw). Core `button` (size cli, shared merge kernel externalized): 0.904 KiB gzip against its 1.5 KiB ceiling (1,842 B is the raw size). Together 2,479 B gzip, under ADR-011's 3 KiB for a simple primitive.
## .e Vanilla adapter (W1-C01.e)

Branch `feature/m4-c01-button-vanilla` (stacked on `feature/m4-c01a-button-core`). Owned: `packages/vanilla/src/button/**`. Golden vanilla layout.

- API: `mountButton(host, container, props) -> { update, destroy, element }` (host = `createHost(createRuntime({ target: 'client' }), ...)`, client target required: the shared runtime's scheduler is a fake otherwise) and `defineSJButton({ name?, registry?, host? }) -> boolean` for the optional `<sj-button>`. `ButtonMountProps` = core `ButtonProps` + `text`, `icon` (both rendered as text nodes) + `attrs` (rest attributes, merged by `mergeProps`; `onClick` allowed).
- **No import-time registration**: the element class is built inside `defineSJButton` (reading `HTMLElement` then), so importing under node touches no browser global (tested). `define` is idempotent: returns `false` when the name is already registered. The default host is created lazily on first connect, per `define` call (closure, no module state) with a no-op live host, so a page of buttons does not get a live-region node appended for nothing.
- **Delegated click**: one `ctx.listen(container, 'click')` carries the instance signal; the control has zero listeners, so `<button>`/`<a>` swaps (when `href` toggles) cannot leak. `destroy` aborts it and removes the control; the element's `disconnectedCallback` destroys, `connectedCallback` re-mounts.
- **onPress** (vanilla form of the adapter-injected emitter): a bubbling `CustomEvent('press', { detail: { originalEvent } })` on the control, then the `onPress` prop. A consumer `onClick` that calls `preventDefault()` suppresses it; a disabled control only `preventDefault()`s. `onPress` is read through the newest props at click time.
- **FACE decision (ADR-014): none.** `<sj-button>` wraps a real `<button type=submit>` in light DOM (ADR-002, no shadow root). The form owner of a control is its nearest ancestor `<form>` through the tree, and a custom-element ancestor in between does not interrupt it, so submit/reset, `name`/`value` and `form=` behave as for a bare button with zero JS. FACE would add a second, redundant participant and an `attachInternals()` lifecycle; ADR-014 scopes it to custom controls that have no native control underneath. Source test forbids `attachInternals`.
- **touch-action**: none declared. The button has no pointer-handling part (activation is the native `click`; no pointerdown/move listeners), so the ADR-011 rule has nothing to attach to. A future press-and-hold variant must add it.
- **Text only**: the label and icon are `Text` nodes / `textContent`; `aria-label` is set via `setAttribute`. A source scan forbids `innerHTML|outerHTML|insertAdjacentHTML|attachShadow`. The element's initial child text is read once at connect (as text) and becomes the label unless a `text` attribute exists.
- Element attributes: `variant tone size disabled type href target rel label icon-only icon text`; `disabled="false"` / `icon-only="false"` are false. Events: listen for `press` on the element.
- Tests (node, no jsdom per ADR-002): a minimal DOM double, including the one native rule needed (a non-cancelled submit-button click fires `submit` on its form owner). Real-browser form submission, focus and keyboard are `.f` conformance (L2). 17 tests: button/link/disabled link/icon-only rendering, update + stale attribute removal + element swap, `onPress` semantics, form submit, destroy aborting every listener (live count 0), 1,000 cycles (0 listeners, 0 children), define idempotent and never at import, element lifecycle, no innerHTML.
- Shared-file touches: none. (Known runtime wart for the owner of `runtime/**`: `createHost` appends a live-region node to `body` on the first mount even for components that never announce; passing a `liveHost` avoids it.)
- Bytes: `packages/testing/size/cli.js`: core button 0.904 KiB gzip measured (ceiling 1.5 KiB; 1,842 B was the raw size); `adapter:vanilla` fixture 2,623 B gz (reported, includes runtime + this adapter).

# C01.f notes (W1-C01.f: SJButton conformance)

Branch `feature/m4-c01-button-conformance`. Owned: `packages/testing/specs/button/**`. Based on `feature/m4-c01a-button-core` with the OLD (pre-rebase) `.b .c .d .e` branches merged; the `.f` commits are separate so they can be replayed onto main.

## Layout
- `fixtures.js` the one fixture map (contract's five plus conformance-only `submit`). `matrix.ts` scenarios derived with `deriveSpec` (press keys come from the contract) and the parity declaration. `host/entry.ts` + `build.mjs` + `serve.mjs` + `playwright.config.ts` own host (real adapters, `supports` injected per path); reuses `visual/site.mjs` for tokens, built CSS and fonts.
- `button.e2e.ts` L2 matrix (rows `SJButton | adapter | scenario | action | path=`); `aria.e2e.ts` + `aria/*.yml`; `a11y.e2e.ts` (+ `a11y-triage.json`); `ssr.test.ts`; `conformance.test.ts`; `voiceover.js`; `visual/`.
- Commands: `bun run --filter @ramoslabs/testing test:e2e:button` then `parity:button`; `voiceover:button`; `visual:button`.

## Results (local, 3 engines)
- 660 Playwright tests passed, `retries: 0`: 378 matrix rows (21 scenario x action x 3 adapters x chromium/firefox/webkit x `native` and `fallback:all`), the rest ARIA (18 snapshots plus 9 seeded regressions), axe, 2.5.8, 2.4.13, forced-colors, each gate with a seeded failing case.
- Parity: 5292 cells, 378 executed and passed, 0 missing, 0 invalid; 1890 not-applicable and 3024 not-run, all carrying a reason.
- Real browser keyboard activation (Enter/Space on button, Enter on link, Space on link does nothing), pointer, and native form submission (submit button name/value in form data, `type=button` never submits) on every adapter. Real `hydrateRoot` (React) and `createSSRApp` hydration (Vue) in jsdom: no mismatch, server node kept, one `press` after hydration. Vanilla's client DOM equals the React and Vue server markup.

## Decisions
- **Forced-false runs.** SJButton has empty `support[]` and reads no capability. `native` and `fallback:all` run on every cell (the injected map is read back from each adapter's own runtime); the ten single-key paths are declared `not-applicable` with that reason, not run. Re-open if the button ever branches on a key.
- Disabled link behaviour stays in the core unit tests (see .b notes); `INERT_FIXTURE` rule not widened.
- axe `incomplete` for `icon-only` (`color-contrast`, `label-content-name-mismatch`) is reviewed in code (`REVIEWED_INCOMPLETE` in `a11y.e2e.ts`): the vanilla adapter renders icons as text, so the fixture's glyph is a non-text character. Moving it to `a11y-triage.json` needs a tracking issue and owner.
- **Visual:** 10 scenes (`visual/scenes.js`, markup built from the real core getters) exist and render; NO baselines are committed. `visual:button` reports NOT RUN until a human runs `node specs/button/visual/cli.js update --update <scene,...> --reviewer <name> --reason <text>`. The agent captured scenes only to look at them (not approval).
- **VoiceOver hook:** `voiceover.js` maps each contract `atAssertions` id to protocol text and renders the ADR-013 field list; unknown or missing ids throw. Actual speech and pass/fail stay blank; status text is the contract's own wording (`pending-real-test`).
- Bundle: asserted in `conformance.test.ts` against the contract ceiling (core button 0.904 KiB gzip vs 1.5 KiB).

## Shared-file touches
- `packages/testing/vitest.config.ts`: include `specs/**/*.test.ts`. `packages/testing/package.json`: scripts `test:e2e:button`, `parity:button`, `visual:button`, `voiceover:button`. No change to ci.yml, budgets or registries.

## Skips
None. No `skip`/`fixme` in `specs/button`.

## Follow-ups and open questions
- The e2e suites are not in `bun run gate` or `ci.yml` (same as the other Playwright suites); wiring a `test:e2e:button` job is the orchestrator's call.
- File an issue and owner for the icon-only axe review, and for human visual baselines (4 engine x DPR keys).
- Real VoiceOver pass (W1-505) is still pending; nothing here claims it.
