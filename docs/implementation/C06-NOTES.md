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

## W1-C06.c: SJDisclosure Vue adapter

Branch `feature/m4-c06-vue`. Owned: `packages/vue/src/disclosure/{SJDisclosure,index,disclosure.test,ssr.test}.ts`. Shared files touched: `packages/vue/src/index.ts` (barrel export) and `packages/vue/src/index.test.ts` (expected export list). The `./disclosure` entry in `package.json` `exports` already existed.

### Decisions
- Flat component over `createDisclosureParts` and `useSJStore` (shared runtime, `disclosureFields`). Props `open/defaultOpen/disabled/name/id/summary/classes`; `summary` is prop-or-slot (slot wins), default slot is the panel; emits `update:open` and `openChange`. Attrs and `class`/`style` go to the root `<details>`.
- The vnode carries only the INITIAL `open` (what SSR emits); the live state is written to the property after updates (`onVnodeUpdated`) and by the `open` corrective effect (controlled rejection, forced commit through the store's `resync`). `onVnodeMounted` deliberately does not sync: it would run before `onMounted` and erase a pre-hydration native open.
- Pre-hydration (audit SHOULD-1): `onMounted` calls `native('open', el.open)` when it differs from the view (test hydrates server markup the user opened).
- `closePeers` (audit MUST-1) is built from the DOM: returns when `runtime.supports.detailsName` is true; else collects `details[name]` in the root's own root node, runs `peersToClose` and sets `open = false` on the returned elements (their own `toggle` reports). Note the default client runtime has `detailsName: false`, so the fallback is active unless `SJProvider` config sets `supports.detailsName`; it is harmless on native engines.
- Tests (14): markup, prop-or-slot, classes, uncontrolled and controlled (accept, reject), disabled, pre-hydration, `closePeers` on forced-false (uncontrolled, controlled programmatic, rejected, other names/unnamed untouched, native no-op), 1,000 mount/destroy retaining no store/listener/DOM, SSR.
## W1-C06.d: SJDisclosure React adapter

Branch `feature/m4-c06-react`. Owned: `packages/react/src/disclosure/{index.ts,disclosure.test.ts}`. Shared files touched (checkbox-adapter precedent): `packages/react/src/index.ts` (barrel line) and `packages/react/src/index.test.ts` (barrel key list). The `./disclosure` subpath export already existed.

### Shape
- `SJDisclosure.Root` (`<details>`), `.Trigger` (`<summary>`), `.Content` (`<div>`), plus flat `SJDisclosureRoot/Trigger/Content` (ADR-002). Prop-or-slot: `summary` renders the trigger, `children` the content; without `summary`, children are explicit parts. `classes` per part concatenates after the library class.
- State via the shared `useMachine` with `disclosureFields`; `open` is both rendered (SSR markup, hydration) and kept in step by a layout effect that writes `el.open` only when the VIEW changed (so a queued native toggle is never undone by an unrelated render). The corrective `open` effect of a rejected controlled change sets the property after commit.

### Decisions
- **Pre-hydration (SHOULD-1).** In the first layout effect, `native('open', el.open)` is called when the element differs from the view. A controlled owner that rejects it gets the element corrected by the same effect path.
- **closePeers.** Supplied to `createDisclosureParts`. Returns when `runtime.supports.detailsName` is true. Otherwise it queries `details[name]` in the element's root node (document or shadow root, the same scope native `name` uses), feeds `{id, name, open}` to `peersToClose`, and sets `open = false` on the returned elements; their own `toggle` then reports. Works for controlled, programmatic and rejected opens because core calls it before the view comparison.
- **Supports.** `SJProvider` now detects `supports` (`detectSupports`, #119) unless an explicit `supports` is given (forced run), so `closePeers` switches on the detected `supports.detailsName`: native engines return early, fallback engines close peers.
- No `aria-expanded`/`aria-controls` on the summary; reduced motion is CSS-only (nothing in the adapter).

### Proof
`disclosure.test.ts` (31 tests): naming, structure, prop-or-slot, classes, ownership, uncontrolled/controlled (accept, reject, outside prop change), pre-hydration (three cases), disabled, closePeers on forced-false `detailsName` (basic, outside-group, controlled, rejected, programmatic, close-does-not-touch, native engine no-op), SSR (no document, ids), StrictMode (one callback, one pre-hydration report), 1,000 mount/unmount retention (stores, listeners, nodes, live hosts). A seeded mutation (fallback disabled) fails four tests.

### Bytes
Core `disclosure` module 0.939 KiB gzip (1,997 B raw) against the 3 KiB ceiling; the adapter adds no ceiling of its own (`adapter:react` is reported only).
## W1-C06.e: SJDisclosure vanilla adapter

Branch `feature/m4-c06-vanilla`. Owned: `packages/vanilla/src/disclosure/{index,disclosure.test}.ts` and this section. No shared file touched (`./disclosure` was already in the vanilla `exports` map; the barrel stays empty).

### Decisions

- **API.** `mountDisclosure(host, details, props)` returns the runtime `Instance` plus live `trigger` / `content` accessors. Props are the core props plus plain-text `summary`, `content` and `classes {root, trigger, content}` (appended after the library class through the getters' consumer argument). `define(host, name = 'sj-disclosure', registry)` is explicit and idempotent; its light-DOM children become the panel and are handed back on disconnect.
- **Prop-or-slot.** An existing `<summary>` and panel child are adopted untouched (the SSR / slot form); missing ones are created and removed on destroy. A `summary` / `content` prop, when defined, is written as a text node.
- **`open` is a property.** `details.open` is written only when it differs from the view, so the adapter's own writes cause a `toggle` equal to the view, which the core handler ignores. The `open` effect (rejected controlled change) sets the property.
- **Owned exclusive fallback.** The adapter supplies `DisclosureContext.closePeers`: it returns at once when `runtime.supports.detailsName` is true; otherwise it collects `details[name]` from the element's root node, runs `peersToClose`, and sets `open = false` on each result. The peers' own `toggle` then reports, so `onOpenChange` fires for them as native does. Covered for uncontrolled, programmatic opens of a controlled member, owner-accepted and owner-rejected opens.
- **Initial state is prop-driven (Fable SHOULD-1 / ruling 2).** `initialSnapshot(open ?? defaultOpen ?? el.open)`: with neither prop the element's own `open` is the initial state (a consumer's `<details open>` stays open, nothing to report).
- **Pre-hydration report (C06.a SHOULD-1).** When the element came with a `<summary>` (server markup) and its `open` differs from the view at mount, the first patch leaves it alone and `attach` calls `native('open', el.open)`: uncontrolled (`defaultOpen`) keeps the user's state and fires `onOpenChange`; a controlled owner gets the request and, if it rejects, the `open` effect resyncs the DOM. A bare `<details>` has no pre-script history, so its default is the view. On a fallback engine a pre-opened named member also closes its peers once.
- **Detection.** `closePeers` reads `ctx.runtime.supports.detailsName` at call time; `createHost` runs `detectSupports(defaultView)` at the first mount (unless `supports` was explicit), so the fallback switches on the detected value (test: a fake view with and without `HTMLDetailsElement.prototype.name`).
- **No `aria-expanded`/`aria-controls`/`role`**, no pointer or touch listener (so no `touch-action` part), no animation (CSS-only under reduced motion). Listeners: `toggle` on the root and `click` on the summary, both with the instance signal.

### Measured

`node packages/testing/size/cli.js`: core `disclosure` 0.939 KiB gzip (1,997 B) against its 3 KiB ceiling; the shared vanilla runtime row is unchanged (the adapter itself is not a ceiling row).

### Tests

`disclosure.test.ts` (20 tests): anatomy and text-only, slot adoption, prop-or-slot update, `classes`, uncontrolled and controlled (rejection corrected, no feedback loop), disabled, `name`, initial state (element open kept) and pre-hydration (defaultOpen kept, controlled resynced, agreeing), signalled listeners and none after destroy, 1,000 mount/destroy cycles, `closePeers` on a forced-false `detailsName` (plain, programmatic controlled, accepted controlled, native engine and unnamed no-ops), `define()` (no import-time registration, idempotent, children moved in and handed back). The DOM double fires an async `toggle` on every `open` change, as a browser does.

### Follow-ups

- Real-browser proof of the fallback and of pre-hydration belongs to `.f` (forced-false run, hydrate spec).

## W1-C06.f: SJDisclosure conformance

Branch `feature/m4-c06-disclosure-conformance`. Files: `packages/testing/specs/disclosure/**` (the single conformance layout of G3A ruling (c); `specs:check` green), the four package scripts (`test:e2e:disclosure`, `parity:disclosure`, `visual:disclosure`, `voiceover:disclosure`, port `SJ_DISCLOSURE_PORT` 4206), `status: "beta"` in `disclosure.contract.json` and `registry.json` (ADR-010). Shared or neighbouring edits, listed per the ownership rule: `packages/css/src/disclosure.css` and its test (defect 1), `packages/react/src/disclosure/index.ts`, `packages/vue/src/disclosure/SJDisclosure.ts` and their tests (defect 2). The e2e workflow picks the job up from the specs dir (`scripts/e2e-components.mjs`).

### Layout and counts
- Fixtures: the five contract fixtures (`closed`, `open`, `disabled`, `exclusive-group` as three members of `name="faq"`, `long-title`) plus the hydration cases. The host mounts a single disclosure or a list of members (an exclusive group); events are `open:<bool>` or `m<i>:open:<bool>`.
- L2 + parity: 14 scenarios x 3 adapters x 2 paths (`native`, `fallback:all`) x 3 engines = **252 executed cells** (`parity:disclosure` PASS, 0 missing, 0 invalid, 0 undeclared; the floor lanes `chromium-114`, `firefox-125`, `ios-17-safari`, `android-floor` are declared not-run with the ADR-013 reasons). Scenarios: `open`/`close` as a controlled prop, `toggle` both ways by pointer, Enter and Space, the inert `disabled` fixture, controlled `open` (reject then accept), and four exclusive-group scenarios (pointer, controlled member, programmatic open, rejected open). `fallback:all` forces every capability false, `detailsName` included; the single-key path `fallback:detailsName` would be identical because the component reads no other capability.
- Hydration (real SSR, `createSSRApp` / `hydrateRoot` / vanilla adopt): 5 cases x 3 adapters + 2 follow-ups x 3 + markup and upgrade checks = 23 tests per engine. Each toggles the `<details>` natively BEFORE hydration, then asserts the pre-hydration report and the final state: uncontrolled `defaultOpen` closed by the user (report `[false]`, stays closed), controlled `open` that rejects (report `[false]`, element put back open), controlled closed that rejects an open, no prop (report `[true]`, stays open), and no toggle (no report). Same nodes survive, no mismatch or recoverable error.
- ARIA: one shared YAML per contract fixture (5), plus toggle, controlled-prop, parts-markup, "no `aria-expanded`/`aria-controls`/`aria-labelledby`/`role` on any part, before and after a toggle" (`aria-disabled` only on the disabled summary), title-stable, 4 seeded regressions; CDP AX tree on Chromium (`DisclosureTriangle`, `expanded` true/false, `disabled`, `focusable`). Playwright's tree flattens a `<details>` to `group: <text>` and shows the panel text only while open, so the snapshot carries the state through the text (regex-anchored, so a closed snapshot fails on an open panel) and `expanded` itself comes from CDP.
- axe (`target-size` enabled by name, 8 states x 3 adapters x 3 engines, zero untriaged, no triage entry needed), 2.4.13 on summary (closed, and disabled which stays reachable), 2.5.8 (24 px floor, 44 px design target, one target for a single disclosure, three for a group), native marker hidden (computed `list-style`, `display`, and the title sitting exactly at the padding so no marker precedes it), reduced motion (positive control: without the preference the chevron has a duration and a transition starts on toggle; under `reduce` duration is 0 and no animation runs), forced colors (disabled trigger and chevron equal a `GrayText` probe, enabled trigger is not `GrayText`, chevron is `CanvasText` and open and closed differ by rotation, not colour), RTL (title at the inline start, inline end free for the chevron, chevron turn flipped). Seeded failures for axe, marker, reduced motion and forced colors.
- Bundle (`bundle.test.ts`), SSR determinism (`ssr.test.ts`, jsdom: DOM-less render, pre-toggled hydration without warnings, three-root graphs), conformance bookkeeping and the VoiceOver hook (`voiceover.js` renders the three `atAssertions` ids from the contract keyboard map and actions into both lanes; actual speech and results are blank for the human).
- Visual: 12 scenes (closed, open, disabled, focus closed/open, long title, group, RTL closed/open, forced colors closed/open/disabled); candidates only (`node specs/disclosure/visual/cli.js candidates`), baselines need human review.
- Skips: 24, all the CDP AX-tree tests on Firefox and WebKit, issue #49, owner SrRamos.

### Exclusive groups under `fallback:all` (Fable ruling)
Every engine Playwright launches (Chromium 156, Firefox 157, WebKit 27.2) has native `<details name>`, and none can be configured without it (the Blink flag and the Firefox pref were tried and do not turn grouping off; a detached tree still groups). So on both paths the engine closes the peers itself, and what differs is the code that runs. The group-scan probe (`open.ts`, installed before page scripts) counts `querySelectorAll('details[name…')`, which is exactly how the owned fallback finds its peers and which native grouping never does:
- `native` (real detection, `supports.detailsName` true): the four group scenarios assert the peers close AND the probe count is 0, i.e. the fallback was not invoked.
- `fallback:all` (forced-false `detailsName`): the same four scenarios (a controlled member whose owner first rejects then accepts, a programmatic `details.open = true`, a rejected open, a plain pointer open) assert the peers close, the per-member `openChange` events, and probe count >= 1, i.e. the fallback ran on every opening toggle.
- Two seeded tests judge a native run as a fallback run and the reverse; both must report. They fail without the probe, so the probe distinguishes the paths.
The limit, stated plainly: on these engines the fallback finds nothing left to close (the browser got there first), so its WRITE path (`open = false` on a still-open peer) is exercised only by the adapter unit tests (jsdom has no native grouping: Vue 14, React 34, vanilla 22 tests incl. controlled, programmatic and rejected opens). A real-engine run of the write path needs a browser without `details name` (Chromium 114-119, Firefox 125-129, Safari 17.0-17.1): that is the `chromium-114` / `firefox-125` floor lanes, declared not-run per ADR-013.

### ADR-001 and Safari 17.2 (reconciliation, issue #92)
ADR-001's table says `<details name>` is native from Safari 17.2 and the owned fallback covers 17.0-17.1. The frozen contract schema takes integer majors only, so the contract says `nativeFrom.safari: 18` / `fallbackUntil.safari: 17` (the conservative reading; issue #92, the G3C schema amendment, sets 17.2 / 17.1). The two statements do not conflict at runtime: the fallback is chosen by capability (`supports.detailsName` from `detectSupports`, a property check on `HTMLDetailsElement.prototype.name`), never by version, so Safari 17.2+ uses the native path and 17.0-17.1 the fallback whatever the contract's integer says; only generated docs and the floor lane's version labels see the granularity. Real-engine evidence: WebKit 27.2 (Playwright's build; `browser.version()` recorded in the `engine evidence` test annotation) reports `supports.detailsName = true` and, with no adapter involved, a bare `<details name="g">` pair closes the peer when the other opens; Chromium 156 and Firefox 157 do the same. That is evidence for WebKit 27.2, not for Safari 17.2, which no available device runs; the claim for 17.2 therefore rests on the ADR and the capability check (and `ios-17-safari` stays not-run).

### Bugs found and fixed
1. **RTL chevron pointed sideways** (`packages/css/src/disclosure.css`, found in the Firefox/WebKit RTL candidates). The glyph is a logical corner (`border-inline-end` + `border-block-end`), which is the bottom-LEFT corner in RTL, but `rotate` is physical, so closed showed `<` and open `>`. The turn now flips with the direction through `--sj-disclosure-turn` (1, or -1 under `:dir(rtl)`, with a `[dir='rtl']` fallback in an `@supports not selector(:dir(rtl))` block for Chromium before 120). Physical borders would have fixed it too but `sj/logical-properties` forbids them. Tests: two in the css suite (LTR/RTL values, an rtl island in an ltr page) and the e2e RTL spec on three engines.
2. **Dev hydration errors when the user toggles before hydration** (React and Vue adapters). `open` legitimately differs from the server markup, which React 19 reports as "A tree hydrated but some attributes ... didn't match" (`console.error`, a red overlay in frameworks) and Vue 3.5 as "Hydration attribute mismatch ... Hydration completed but contains mismatches". The mount-time report already reconciles the state, so the warning was a false positive on the exact scenario the component supports. React: `suppressHydrationWarning` on the `<details>` (it covers that element's own attributes, not descendants). Vue: `data-allow-mismatch="attribute"` on the `<details>`; it is emitted unconditionally because Vue reads it from the SERVER markup, so gating it on a dev flag would make a prod-rendered server and a dev client disagree. Cost: 28 bytes of markup, and attribute mismatches on that one element are no longer reported in dev. Tests in both adapters and in the e2e hydration and jsdom SSR specs.

### Findings that are not defects, recorded
- **Vanilla adoption with neither `open` nor `defaultOpen`** (`no prop opened before hydration`): the element's own state IS the initial state (a consumer's `<details open>`), so the adapter reports nothing, while React and Vue report `[true]`. Deliberate in `.e`; the hydrate spec carries a per-adapter expected report (`vanillaReport`). With `defaultOpen` or a controlled `open` vanilla reports like the others.
- **A `toggle` event still queued when the adapter attaches** is delivered to it on top of the mount-time report: a controlled owner that rejects was asked twice for the same request (`open:true` twice) in an unlucky timing (seen once in a loaded parallel run when the spec did not wait). It needs a user click within a frame of hydration; an uncontrolled member should dedupe (the second report equals the view). The spec waits 100 ms after the pre-hydration click so it measures the contract, not the race. A real fix belongs in core's toggle handler (ignore a report equal to the last one reported while the view is unchanged), which is G1 territory; follow-up.
- The visual scenes are flex items that shrink to content, so a plain `<details>` there hides the chevron's end position; the scenes use a token-width frame (`calc(var(--space-32) * 3)`).
- Forced-colors emulation in Playwright Chromium resolves `GrayText` to a dark red in screenshots; the checks compare against a `GrayText` probe, so they are unaffected.

### Open questions
- Baselines (`visual/baselines/`) need human review of the candidates (12 scenes x 3 engines x 2 dpr), including the forced-colors scenes whose palette is the emulation's.
- Real VoiceOver lanes (macOS and iOS Safari) are the human step; the expected speech wording ("disclosure triangle", "expanded"/"collapsed") is the protocol's best guess and the recorded actual speech decides.
- The fallback write path on a real engine without `details name` waits for the per-release floor lanes (see above).
