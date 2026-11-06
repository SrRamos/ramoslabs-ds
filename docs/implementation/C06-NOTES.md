# C06 notes: SJDisclosure (C06.a contract + core)

Branch `feature/m4-c06-disclosure-core`. Files: `packages/contracts/contracts/disclosure.contract.json`,
`packages/core/src/disclosure/{index,reducer,disclosure.test}.ts`, regenerated `src/generated/disclosure/**` in core, react, vue, vanilla.
Shape copies the C03 golden (switch/checkbox): `reducerEvents` + two-form `reduce`, `disclosureFields`, `harness`, pure getters.

## Getters API (frozen for .b to .e)
Module `@ramoslabs/core/disclosure`.
```ts
reducerEvents: ['open', 'close', 'toggle']
reduce(state: DisclosureState, e): DisclosureState                                    // machine form
reduce(state: DisclosureSnapshot, e): Reduction<DisclosureSnapshot, DisclosureEffect> // store form
initialSnapshot(open = false): { state: 'closed'|'open', open }
disclosureFields   // pass as `fields` to createControlled (open -> onOpenChange, native effect 'open', target 'root')
createDisclosureParts({ view, native, getProps, id }): {
  ids: { root, trigger: `${id}-trigger`, content: `${id}-panel` }
  getRootProps    // <details>: id, class, open, name?, data-part/state/disabled, onToggle
  getTriggerProps // <summary>: id, class, data-*, aria-disabled?, onClick
  getContentProps // <div>: id, class, data-*
}
peersToClose(selfId, members: { id, name?, open }[]): string[]   // owned exclusive fallback, pure
createDisclosureParts ctx.closePeers?: (rootId) => void   // adapter-supplied owned fallback
```
- **Native-first.** No `aria-expanded`, no `aria-controls`, no `role`, no keydown handler: `<summary>` exposes the expanded state and activates on Enter/Space natively. This follows the ADR-015 registry decision (`disclosure.json`, `mustNot: manual-aria-expanded-on-summary`).
- `open` is emitted from `view()` on the root (property/attribute the adapter applies); the `toggle` event reports actual state through `native('open', el.open)`. `toggle` also fires for programmatic changes, including the corrective effect, so the handler ignores a report equal to `view().open` (no double `onOpenChange`, no feedback loop). The next value is the element's own `open`, never read from the reducer (G1 SHOULD-4).
- Controlled rejection: `reconcile()` yields `{ type: 'open', target: 'root', value }`; the adapter sets `details.open = value` after commit.
- Disabled: `<details>` has no `disabled`. The trigger gets `aria-disabled="true"` plus `data-disabled`, and `onClick` calls `preventDefault()` (Enter/Space on a summary synthesize `click`). It stays focusable. Fixture `disabled` is the inert scenario (ADR-010).
- Protected (library-owned): root `id/open/name`, trigger `id/aria-disabled`, content `id`, and all `data-part/state/disabled`.

## Exclusive groups and the owned fallback (ADR-001, Section 2)
- Contract `support[]`: feature `details-name`, `nativeFrom {chromium 120, firefox 130, safari 18}`, `fallbackUntil {chromium 119, firefox 129, safari 17}`. The schema (frozen, G2) takes integer majors only, so Safari 17.2 cannot be written: `nativeFrom.safari = 18` is the conservative first full major and `fallbackUntil.safari = 17` covers 17.0-17.1 (it also names 17.2+, where the fallback is simply not selected). The fallback is chosen by capability (`runtime.supports.detailsName`), not by version, so the integer granularity affects only generated docs and the floor lane's version labels. A schema amendment for Safari minor versions is planned at G3C; then set 17.2 / 17.1.
- Mechanism (audit MUST-1): the root's `onToggle` getter calls `ctx.closePeers(rootId)` whenever `el.open` is true and `props.name` is set, BEFORE the comparison with the view. So controlled, programmatic and rejected opens all close peers; the reducer emits no effects. The adapter-supplied hook returns early when `supports.detailsName` is true, otherwise collects the `details[name]` members, runs `peersToClose(rootId, members)` and sets `open = false` on each (their own `toggle` then reports, so `onOpenChange` fires on each peer, as native does).
- `peersToClose` is pure and covered by a property test (at most one open member remains).
- The `.f` forced-false run (`detailsName: false`) proves the fallback end to end; `.c/.d/.e` own the effect handler.

## Decisions
- **Snapshot is `{ state, open }`**; reducer reads only `state` (lint `contract/reducer-controlled-field` clean).
- **Actions `open`, `close`, `toggle`.** `toggle` is the keyboard action (`keyboard.trigger.Enter/Space`); `open`/`close` are the idempotent absolute events used for native reports (`toEvent(next)`), so a repeated or out-of-order report cannot flip state.
- **No `aria-*` mirroring in `dom`**: actions record `dom.root.open`, as the checkbox does for `checked`.
- `runtime: ["idPrefix", "supports"]`. `evidence:check` (SHOULD-3) accepts `nativeOnTouch: true` when every interactive anatomy part is `native: true`, so no `nativeFallback` block is declared. `budgets.shared: [merge, ids]`. Props `open/defaultOpen/disabled/name/id`; slots `summary`, `default` (no name shared with a prop). Status `draft` (G3C promotes).
- WCAG list mirrors checkbox (no 2.3.3: AAA). Evidence refs are the five registry entries with matching `test_status`; `atAssertions` include a changed-expanded-state speech check because the registry notes NVDA/Chrome history (`nvda-chrome-a11ysupport-summary`).

## Bytes (min+gzip, shared kernel excluded, `node packages/testing/size/cli.js`)
| Module | gzip | raw | Ceiling |
|---|---|---|---|
| core/src/disclosure | 0.942 KiB | 1,989 B | 3 KiB (ADR-011 simple primitive; contract `budgets.gzipKiB: 3`), pass |

## Proof
- `disclosure.test.ts` (27 tests): table agreement, fast-check invariants (agreement with machine, store/machine projection, toggle twice identity, `closePeers` exactly on transition into open, purity), getters (no ARIA state, ids, ownership, disabled), native reporting (uncontrolled, ignored matching report, controlled accepting and rejecting with `reconcile`, ownership switch throws), drain order with stale supersede, `peersToClose` incl. property.
- Auto-discovered: contracts equivalence (`SJDisclosure: reducer events equal contract actions`), W1-308b reducer harness via `harness`, `contract:lint` on `reducer.ts`, `evidence:check` for the five refs.

## Deferred and open
- **Reduced motion (.b).** Native `<details>` content toggles with no animation unless CSS adds one; any height/opacity transition must use `--sj-duration-*` (collapsed to `0s` under `prefers-reduced-motion` by `base/motion.css`), and none is required. Core has no part. ADR-009.
- `.f`: the forced-false (`detailsName: false`) fixture must include a controlled group.
- `.c/.d/.e`: apply `open` as a property; React must not set both `open` and a default; run the `open` effect in the layout drain; a forced commit after a rejected controlled report (as the Switch React adapter does) is required for the corrective effect.
- `.c/.d/.e` (SHOULD-1): `<details>` works before hydration, so at mount report `native('open', el.open)` when it differs from the view; the .f hydrate spec toggles before hydrating. Implement `ctx.closePeers` from the DOM and `runtime.supports.detailsName`.

## W1-C06.b: SJDisclosure CSS

Branch `feature/m4-c06-css`. Owned: `packages/css/src/disclosure.css`, `packages/css/test/disclosure.test.js`, this section, and the `disclosure` entries added to the two real-contract lists in `packages/css/test/template.test.js` (registration step, as icon and state did). No other shared file touched: the build picks the file up by glob.

### Decisions

- **Root and trigger classes are the ones the getters emit.** Unlike SJState, core emits `sj-disclosure__root` and `sj-disclosure__trigger`, so the selectors are the plain `__root`/`__trigger`/`__content` names and the anatomy check needs no alias.
- **The stylesheet never sets `display` on the root or the content.** A closed `<details>` hides its panel through the UA (Chromium through the details slot). Setting `display` on the panel would override that collapse. The test checks `checkVisibility()`, not the panel's own `display`, because Chromium keeps the panel's own computed `display` at `block`.
- **Marker.** The native triangle is hidden (`list-style: none`, `::-webkit-details-marker`), and a border-drawn chevron on `summary::after` replaces it. Its colour is `currentColor`, so forced colours keep it; forced colours also set the border colour to `CanvasText` explicitly.
- **Open state is keyed on the root's native `open` attribute**, not on `data-state`. `data-state` only updates after an adapter reports back. A plain native click (before any script runs) should still turn the chevron, so `.sj-disclosure__root[open] > .sj-disclosure__trigger::after` is the selector. Test: a native click turns the chevron, with no script.
- **Exclusive groups.** The stylesheet has no rule keyed on `name`, so a group and a plain disclosure render identically (test: pixel-identical screenshots). The fallback that closes peers is script-side (C06.a `peersToClose`, adapters `.c/.d/.e`), so the CSS has nothing to add.
- **Disabled.** The trigger keeps `data-disabled` styling (inactive text colour, `not-allowed` cursor) and stays focusable, so the 2.4.13 ring still draws on it. `color-text-disabled` is exempt from the 4.5:1 check (WCAG 1.4.3 inactive), the same exemption the shared matrix makes.
- **Focus and target.** The summary is a `[data-part]` element, so `base/base.css` gives it the 44 px target and `base/focus.css` the ring. No focus rule is repeated here.
- **Reduced motion.** The chevron rotates with `--sj-duration-fast`. `base/motion.css` collapses the transition to `0s` under `prefers-reduced-motion` (the chevron is a `[data-part]::after`). The native open/close has no animation of its own.

### Measured

Built `dist/disclosure.css`: 3543 B raw, 1455 B gzip. ADR-011 has no CSS-specific ceiling. The core module's budget (`contract budgets.gzipKiB: 3`) is measured by `node packages/testing/size/cli.js` and is not affected by this file.

### Tests

`packages/css/test/disclosure.test.js` (20 tests): anatomy against the contract, stylelint, no raw values in source; native collapse and a native click without script; 44 px summary and 2.4.13 focus ring pixels; contrast on every surface (with a seeded weak chevron); open and closed chevron values, disabled colour and cursor; forced colours (chevron visible, seeded missing border style fails); RTL (title at the start, chevron at the end, mirrored); long-title wrap; name group pixel-identical to a plain group; reduced motion. The css package suite passes: 200 tests, 9 files; lint and `format:check` green.

### Follow-ups

- `.c/.d/.e` adapters must emit `data-state` and `data-disabled` (the getters already do). The chevron does not depend on `data-state`, so a missing adapter update cannot break the open look.
- SJDisclosure has no `.f` hydration evidence yet; `.f` owns the pre-hydration check.
