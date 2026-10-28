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
