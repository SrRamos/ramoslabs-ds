# 01 — Platform primitives: 2026 baseline

**Research date:** 2026-10-27. Support statements are a snapshot, not a permanent browser-support policy. “Baseline newly available” means all core browser engines support a feature; it does not mean older supported browsers do. Baseline itself covers Chrome/Edge, Firefox, and Safari on desktop and mobile ([MDN Baseline glossary, updated 2026-08-27](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)).

## Decision summary

| Primitive | What it replaces | Support at research date | Required fallback / boundary |
|---|---|---|---|
| Popover API (`auto` / `manual`) | Top-layer management, non-modal light dismiss, close requests, invoker wiring | Baseline across browsers since April 2024; Chrome/Edge 114, Firefox 125, Safari/iOS 17 ([MDN, 2026-07-03](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover)). | Keep an explicit close button; never use Popover as a modal substitute. Below the floor, ordinary hidden content plus explicit open/close and outside-click/Escape handling. |
| `popover="hint"` | Subordinate hover/focus hint stacks | Chromium 133–151 and Firefox 149–153 shipped older inconsistent behavior; current behavior is full in Chromium 151 (2026-07-28) and Firefox 153 (2026-07-21); Safari/iOS has no stable support ([BCD `popover.hint`, dataset retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/html/global_attributes.json); [web-features entry, 2026-07-21](https://web-platform-dx.github.io/web-features-explorer/features/popover-hint/)). | Tooltips use `popover="manual"` plus engine-controlled show/hide. `hint` is only a detected enhancement; no semantics depend on it. |
| CSS anchor positioning | JavaScript tethering, flipping, and overflow fallbacks | Core: Chromium 125, Safari/iOS 26, Firefox 147; Baseline newly available 2026-01-13. Property floors differ ([MDN `position-anchor`, 2026-10-20](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-anchor)). | Static readable position plus the owned deterministic geometry fallback on the proposed Safari/iOS 17 floor; CSS-only above each property's floor. |
| `<dialog>` | Custom modal root, focus containment, inert background, native close-watcher stack, return value | Baseline widely available; Chrome 37, Firefox 98, Safari/iOS 15.4 ([MDN, 2026-10-02](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)). | Native semantics are primary. A non-native legacy implementation is a separate explicit support decision, never a visual-only fallback. |
| `closedby` | Dialog light-dismiss and close-request policy code | Chromium 134, Firefox 141; Safari/iOS preview only ([BCD `HTMLDialogElement`, retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLDialogElement.json)). | Three tiers: native `closedby`; otherwise outside-click via `requestClose()` (Chromium 134 / Firefox 139 / Safari-iOS 18.4); otherwise fire a cancelable `cancel` event and call `close()` only when not prevented. |
| `inert` | `aria-hidden` plus tab-loop and pointer-blocking patches | Baseline since April 2023; Chromium 102, Firefox 112, Safari/iOS 15.5 ([MDN, 2025-10-22](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert)). | Prefer native modal dialog. Older engines need tab order, pointer, and accessibility-tree exclusion together; `aria-hidden` alone is insufficient. |
| Invoker Commands | Click handlers for built-in dialog/popover commands | Chromium 135, Firefox 144, Safari/iOS 26.2; Baseline completion 2025-12-12 ([MDN, 2026-01-19](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)). | Attach equivalent idempotent handlers below the floor. `request-close` has a separate floor: Chromium 139 / Firefox 144 / Safari-iOS 26.2. |
| Customizable `<select>` | ARIA listbox used only to restyle a native select | `appearance: base-select`: Chromium 135 (2025-04-01), Safari/iOS 27 (2026-09-14), Firefox 149 behind flags. `::picker(select)` and `<selectedcontent>`: Chromium 135 / Safari-iOS 27, Firefox none unflagged ([BCD `appearance.base-select`, retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/css/properties/appearance.json); [MDN `selectedcontent`, 2026-07-04](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/selectedcontent)). | Classic `<select>` is the portable contract. Enhancement requires support for the complete used feature family, not only `base-select`. |
| `ElementInternals` / FACE | Manual serialization, reset, disabled-fieldset, labels, validity, and custom-element semantics | Chromium 77, Firefox 93 (some form methods 98), Safari/iOS 16.4 ([MDN, 2026-09-28](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)). | Use a real internal form control when no custom-element host is needed; hidden input/form callbacks below the floor are not transparent equivalence. |
| `:user-invalid` | Hand-tracked touched state solely for error styling | Chromium 119 (2023-10-31), Firefox 88, Safari/iOS 16.5; Baseline late October 2023 ([MDN, 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:user-invalid)). | A touched/submitted data attribute below the floor; native constraint validation remains intact. |
| View Transitions, same-document | SPA snapshot transition orchestration | Chromium 111, Safari/iOS 18, Firefox 144; Baseline October 2025 ([MDN `ViewTransition`, 2026-06-19](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition)). | State updates work without the API; skip animation below the floor or for reduced motion. |
| View Transitions, cross-document (`@view-transition`) | MPA navigation transition orchestration | Chromium 126, Safari/iOS 18.2, Firefox none ([MDN `@view-transition`, 2026-04-20](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition)). | Navigation never depends on it; same-origin opt-in is an enhancement only. |
| `interestfor` | Hover/focus/long-press interest timers for hint popovers | Chromium 142 (2025-10-28) only; BCD marks it experimental and not on a standards track, with the HTML proposal still unsettled ([BCD `HTMLButtonElement.interestForElement`, retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLButtonElement.json)). | Explicit click/focus behavior and accessible description are mandatory. No machine-readable contract field may depend on `interestfor`. |

Sources for the table: [Popover attribute, MDN 2026-07-03](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover); [MDN `position-anchor`, 2026-10-20](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-anchor) and [Firefox 147 developer release notes, 2026-01-13](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/147); [MDN `<dialog>`, 2026-10-02](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog); [MDN `closedBy`, 2026-08-24](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy); [MDN `inert`, 2025-10-22](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert); [MDN Invoker Commands, 2026-01-19](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API); [MDN customizable select, 2026-08-13](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select); [MDN ElementInternals, 2026-09-28](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals); [MDN `:user-invalid`, 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:user-invalid); [MDN ViewTransition, 2026-06-19](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition); [MDN InterestEvent, 2025-12-11](https://developer.mozilla.org/en-US/docs/Web/API/InterestEvent).

## Findings and gaps

### Popover API

The API supplies top-layer presentation, declarative invokers, `beforetoggle`/`toggle`, and `auto`, `hint`, or `manual` dismissal behavior. Popovers are always non-modal; MDN explicitly directs modal use cases to `<dialog>` ([Popover API, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)). Therefore it replaces overlay bookkeeping, not dialog semantics, positioning, an accessible name, or component-specific keyboard navigation.

The `auto` state supplies light dismiss; `manual` deliberately does not. A menu/listbox still needs its APG keyboard model, and a tooltip still needs a non-hover route and correct description semantics ([HTML popover attribute, MDN 2026-07-03](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover); [APG menu pattern, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/menubutton/)).

### CSS anchor positioning

The module associates positioned elements with anchors and provides try-fallbacks for overflow and conditional hiding ([CSS anchor positioning guide, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning)). This is the native path for tethered overlays, but “the family is Baseline” must not be read as uniform support for every property: for example, MDN dates `position-try-order` cross-engine availability to February 2026 rather than January ([MDN `position-try-order`, 2026-09-16](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-try-order)).

Anchor positioning does not replace logical collision requirements such as maximum size, viewport padding, writing-mode correctness, or avoiding a detached anchor. Those policies remain component contracts; CSS is one implementation of them.

### `<dialog>` and `closedby`

`showModal()` makes outside content inert, places the dialog in the top layer, provides modal close-request behavior, and manages focus; authors must still choose initial focus with `autofocus`, label the dialog, and provide an explicit close mechanism ([MDN `<dialog>`, 2026-10-02](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)). MDN currently warns not to put `tabindex` on `<dialog>` itself; a static-content initial-focus target should instead follow the tested APG/native pattern rather than copying older examples blindly.

`closedby="any"` adds light dismiss, `closerequest` permits platform close requests, and `none` leaves only author controls. Its limited availability means backdrop dismissal cannot yet be delegated unconditionally ([MDN `closedBy`, 2026-08-24](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy)). The compatibility path has three tiers: native `closedby`; otherwise `requestClose()` when present, so pointer and Escape paths share the cancelable close-request pipeline; otherwise explicitly dispatch a cancelable `cancel` event and invoke `close()` only if it was not prevented. `requestClose()` itself is unavailable below Chromium 134, Firefox 139, and Safari/iOS 18.4, while `cancel`/`close()` date to the original dialog implementations ([BCD `HTMLDialogElement`, retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLDialogElement.json); [WHATWG dialog close request, living standard updated 2026-10-26](https://html.spec.whatwg.org/multipage/interactive-elements.html#dialog-request-close)).

### `inert`

`inert` removes a subtree from tab order, hit testing, and the accessibility tree; it does not visually hide content ([MDN `inert`, 2025-10-22](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert)). It is appropriate for explicitly disabled interaction regions and non-modal overlays. It should not be added redundantly around a native modal dialog merely to imitate modality, because the browser already provides it and manual restoration can strand page regions.

### Invoker Commands

`commandfor` connects a button by ID and `command` invokes built-in dialog/popover actions or author-defined `--*` commands. Built-in commands can work before JavaScript loads; custom commands still require a listener ([MDN Invoker Commands, 2026-01-19](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)). Component engines should observe resulting native state/events rather than maintaining a second open-state source of truth.

### Customizable `<select>`

The feature preserves `<select>`, `<option>`, and `<optgroup>` while adding a button, optional `<selectedcontent>`, `::picker(select)`, and `appearance: base-select`. In unsupported browsers the enhanced markup falls back to classic select rendering ([MDN customizable select, 2026-08-13](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)). This makes it the preferred progressive-enhancement route for single-value selection, but not yet a justification to delete classic-select tests.

Rich option content affects accessible names and submitted values; MDN notes that selected-content cloning and `textContent` extraction can surprise authors. Mobile rendering also differs from the OS picker when the customizable mode is enabled. Consequently search, asynchronous options, multi-select with complex interaction, and virtualized huge lists remain separate component problems rather than assumed native-select capabilities.

### `ElementInternals`, FACE, and validation

A form-associated custom element sets `static formAssociated = true` and uses `attachInternals()`; `ElementInternals` exposes labels, form value, constraint validation, and default ARIA semantics ([MDN ElementInternals, 2026-09-28](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)). These APIs are useful for the vanilla adapter, not a reason to force every framework component into a custom-element host. Default internals semantics can be overridden by author ARIA attributes, so the engine still needs explicit accessible-name tests ([MDN `ariaLabel`, 2025-04-25](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaLabel)).

`:user-invalid` matches after interaction or a submission attempt, avoiding error styling on pristine required controls; it does not replace validation messages or `aria-invalid` when custom validation exists ([MDN `:user-invalid`, 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:user-invalid)).

### View Transitions

Same-document transitions snapshot old/new visual states while the DOM update itself remains the source of truth; cross-document transitions require same-origin navigation and opt-in ([MDN View Transition API, 2026-09-28](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)). They must not delay state commit, alter reading order, or become required for focus restoration. The API exposes `skipTransition()` and lifecycle promises, enabling explicit cancellation and deterministic tests ([MDN ViewTransition, 2026-06-19](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition)).

### `interestfor`

Interest invokers aim to standardize hover/focus interest for popovers, but the API remains limited availability ([MDN InterestEvent, 2025-12-11](https://developer.mozilla.org/en-US/docs/Web/API/InterestEvent)). Even where implemented, a tooltip pattern requires Escape dismissal and non-interactive content; essential information cannot be tooltip-only ([APG tooltip pattern, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)). Treat `interestfor` as an optional reduction in trigger code, not an accessibility engine.

## Revision 1: explicit support floor and composition rules

### Proposed browser floor

Adopt the **Popover floor: Chromium/Edge 114, Firefox 125, Safari/iOS 17**, with no commitment to older engines. This is the oldest coherent set with native non-modal top-layer behavior, dialog, `inert`, FACE, and `:user-invalid`. It is a support floor, not a claim that every newer feature exists there ([MDN Popover, 2026-07-03](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover); BCD support dataset retrieved 2026-10-27).

Consequences are explicit:

- Geometry fallback remains mandatory for Safari/iOS 17–25, Chromium 114–124, and Firefox 125–146. Raising the floor to Safari/iOS 26 / Chromium 125 / Firefox 147 removes that fallback but excludes roughly two iOS generations and is rejected for the initial library.
- Invoker Commands, customizable select, View Transitions, `hint`, and `interestfor` are enhancements; classic markup and owned handlers carry the floor.
- Dialog close fallback uses `requestClose()` only from Safari/iOS 18.4; Safari/iOS 17–18.3 uses the cancelable-`cancel` + `close()` tier.
- Native customizable select is disabled on the floor; classic `<select>` remains the preset. Safari/iOS 27 support does not make the complete family portable.
- Every component contract records `nativeFrom` and `fallbackUntil` per feature so tree-shaking and the release floor lane in research 07 use the same numbers.

*Trade-off:* the geometry and close compatibility layers stay in the bundle and test matrix. In exchange, the library does not abandon Safari/iOS 17 users or pretend Baseline-2026 is equivalent to its actual installed base.

### Anchor property floors used by the contract

`position-area` has that name only from Chromium 129 (Chromium 125–130 used `inset-area` and the old name was removed in 131); `position-try-order` reaches Firefox 148, later than the Firefox 147 core; `position-visibility` reaches Safari/iOS 26.2 ([MDN `position-area`, 2026-10-20](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-area); [MDN `position-try-order`, 2026-09-16](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-try-order); [MDN `position-visibility`, 2026-07-26](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-visibility)). Compile only the exact supported subset; never infer these from the core Baseline date.

### Invoker and Popover composition details

The built-ins shipping with Invoker Commands are `show-modal`, `close`, `toggle-popover`, `show-popover`, and `hide-popover`; `request-close` arrives separately at Chromium 139 / Firefox 144 / Safari-iOS 26.2 ([BCD `HTMLButtonElement.command`, retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLButtonElement.json)). `commandfor` and `popovertarget` resolve IDs only in the same tree/shadow root. The vanilla custom-element adapter assigns `commandForElement` and `popoverTargetElement` element references when composing across roots ([WHATWG Popover target attributes, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#popover-target-attributes)).

Popover does not trap focus. Showing honors `autofocus`; hiding restores the previous invoker only when focus is inside the hiding popover ([WHATWG popover focusing and hide algorithms, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#popover-focusing-steps)). `ToggleEvent.source` (Chromium 140 / Firefox 145 / Safari-iOS 26.5) can identify the invoker where supported, but the engine retains its own opener reference on the floor.

### Top-layer nesting and Escape order

The engine follows the HTML close-watcher/top-layer algorithms rather than implementing a parallel global stack ([WHATWG Popover algorithms and dialog close-request steps, living standard updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html); [WHATWG dialog algorithms, updated 2026-10-26](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)):

1. An `auto` popover above a modal dialog closes first on Escape; the dialog's own close request does not fire in that step.
2. With nested `auto` popovers, hiding preserves only ancestor/invoker-related popovers in the same chain.
3. A modal dialog opened from a popover enters the top layer above it. Popovers outside the dialog's ancestor chain close; a popover that actually contains the dialog can remain as its ancestor.
4. A `hint` does not close an `auto`; an `auto` shown above a `hint` can be downgraded to `hint`, and the two lists have separate subordination rules. Because `hint` support is skewed, the manual tooltip path implements the declared stack itself.
5. `dialog.show()` is non-modal and does not put the dialog in the top layer or make the page inert. It still runs the popover hiding algorithm based on DOM ancestry; it is not a substitute for `showModal()`.

These rules are fixture dimensions for select-in-dialog and menu-in-popover tests, not incidental browser behavior.

## Recommendations for ARCHITECTURE.md

1. **Adopt a capability ladder per component: native semantics → native behavior enhancement → internal fallback.** A native `<button>`, `<select>`, `<input>`, or `<dialog>` remains in the accessibility tree in every tier. *Trade-off:* adapters and tests are more complex than one custom DOM implementation, but fallback behavior stays meaningful and less accessibility code is owned.
2. **Use `<dialog>.showModal()` for modal components and Popover for non-modal top-layer components.** Do not create a generic overlay that blurs this distinction. *Trade-off:* two behavioral paths are required, but modality, dismissal, and focus contracts remain comprehensible and native.
3. **Use CSS anchor positioning above each property's floor and the deterministic geometry fallback on the proposed Safari/iOS 17 floor.** *Trade-off:* shipping both paths costs code and parity tests; dropping the fallback requires raising the floor to Safari/iOS 26 / Chromium 125 / Firefox 147 and is rejected for the initial release. Never import a positioning library.
4. **Do not make `closedby`, Invoker Commands, or `interestfor` hard prerequisites.** Detect each independently; invoke the same internal close/command operations in their absence. *Trade-off:* a small compatibility layer remains despite Baseline support, while older browsers retain equivalent operation.
5. **Make classic `<select>` the default single-select preset.** Offer customizable select styling only as progressive enhancement and reserve a custom listbox/combobox for capabilities native select cannot provide. *Trade-off:* less visual uniformity across old/mobile browsers, in exchange for native keyboard, autofill, forms, and touch UX.
6. **Use FACE/`ElementInternals` only in the vanilla custom-element adapter where native form participation adds value.** Keep the shared core independent of custom elements. *Trade-off:* one additional adapter and lifecycle callbacks, rather than coupling Vue/React rendering or SSR to custom-element registration.
7. **Use native constraint validation and `:user-invalid` for styling timing, but keep error text, relationships, and submission behavior in the field contract.** *Trade-off:* a small touched-state fallback is needed for older engines; native APIs alone do not satisfy accessible error identification.
8. **Keep View Transitions outside behavioral state machines.** A transition wrapper may observe a committed update and must be skipped for reduced motion or unsupported browsers. *Trade-off:* less cinematic control than coupling animation to state, but no animation can corrupt focus, hydration, or test determinism.
9. **Record native fallback rules and minimum feature versions in every component’s machine-readable contract.** Generate browser tests from those declarations. *Trade-off:* contract maintenance becomes release work, but support claims become executable instead of documentary folklore.

STATUS: REVISION-1