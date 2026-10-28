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
- Disabled uses `color-text-disabled` on `surface-hover` (WCAG 1.4.3 inactive exemption); meaning is carried by native/ARIA disabled and `cursor: not-allowed`, not color alone.
- Link anatomy gets no underline; it is a button-shaped link. Inline text links use consumer styles (WCAG 2.5.8 inline exemption).

## Follow-ups

- Hover shades have no `--state-hover` overlay use; if a later design wants overlays, the extractor needs color-mix support.
- The contrast CI step for other components needs no change: any `sj.variant` rule with `data-variant`/`data-tone` is picked up from `dist/index.css`.
