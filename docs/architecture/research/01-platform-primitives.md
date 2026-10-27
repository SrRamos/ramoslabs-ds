# 01 — Platform primitives: 2026 baseline

**Research date:** 2026-10-27. Support statements are a snapshot, not a permanent browser-support policy. “Baseline newly available” means all core browser engines support a feature; it does not mean older supported browsers do. Baseline itself covers Chrome/Edge, Firefox, and Safari on desktop and mobile ([MDN Baseline glossary, updated 2026-08-27](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)).

## Decision summary

| Primitive | What it replaces | Support at research date | Required fallback / boundary |
|---|---|---|---|
| Popover API | Top-layer management, non-modal light dismiss, Escape handling, invoker wiring | Baseline across browsers since April 2024; Chrome/Edge 114, Firefox 125, Safari 17. MDN updated 2026-07-03. | Keep an explicit close button; do not use it as a modal substitute. For older engines, ordinary hidden content plus explicit open/close and outside-click/Escape handling. |
| CSS anchor positioning | JavaScript tethering, flipping, and overflow fallbacks | Baseline newly available since January 2026; core shipped in Chromium 125, Safari 26, Firefox 147. Individual properties have different floors. | Provide a readable static/default position; use small internal geometry fallback only when the product browser floor requires it. |
| `<dialog>` | Custom modal root, focus containment, inert background, Escape stack, return value | Baseline widely available; Chrome 37, Firefox 98, Safari 15.4. | Use native semantics as the primary path. For unsupported legacy engines, an explicitly supported non-native implementation is necessary; no silent visual-only fallback. |
| `closedby` | Dialog light-dismiss and close-request policy code | Limited availability: Chromium 134 and Firefox 141; Safari stable still absent in current MDN data (MDN updated 2026-08-24). | Default native modal behavior remains `closerequest`; implement outside-click through `requestClose()` when `closedby="any"` is required. |
| `inert` | `aria-hidden` plus tab-loop and pointer-blocking patches | Baseline since April 2023; Chromium 102, Firefox 112, Safari 15.5. | Prefer native modal dialog. If supporting older engines, remove descendants from tab order and accessibility exposure together; `aria-hidden` alone is insufficient. |
| Invoker Commands | Click handlers for built-in dialog/popover commands | Baseline newly available: Chromium 135, Firefox 144, Safari 26.2; cross-engine completion December 2025. | Attach equivalent idempotent click/command handlers where absent; never make hydration-dependent custom behavior the only path when plain HTML can work. |
| Customizable `<select>` | ARIA listbox used only to restyle a native select | Still limited/experimental in MDN guidance updated 2026-08-13; support for the complete feature family is not equivalent to isolated property support. | Classic `<select>` is the contract. Opt in only through `@supports(appearance: base-select)` and test rich option content independently. |
| `ElementInternals` / FACE | Manual form serialization, reset, disabled-fieldset, labels, validity, and default custom-element semantics | Broad modern support: Chromium 77, Firefox 93 (some form methods 98), Safari 16.4. | Use a real internal form control when no custom-element host is needed. For legacy FACE support, explicit hidden input/form callbacks are a compatibility path, not transparent equivalence. |
| `:user-invalid` | Hand-tracked “touched” state solely for error styling | Baseline since November 2023. | A touched/submitted data attribute can drive equivalent styles on older engines; native constraint validation remains intact. |
| View Transitions | Snapshot-based SPA/MPA transition orchestration | Same-document transitions Baseline since October 2025; individual Level 2/cross-document features have separate support. | The state update/navigation must work without the API; skip animation when absent or when reduced motion is requested. |
| `interestfor` | Hover/focus/long-press interest timers for hint popovers | Limited availability; Chromium support only in current MDN data, with Firefox/Safari absent. | Explicit click/focus behavior and accessible description remain mandatory; never require hover or interest to reach essential content. |

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

`closedby="any"` adds light dismiss, `closerequest` permits platform close requests, and `none` leaves only author controls. Its limited availability means backdrop dismissal cannot yet be delegated unconditionally ([MDN `closedBy`, 2026-08-24](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy)). The fallback should call `requestClose()` so pointer and Escape paths share the cancelable close-request pipeline ([WHATWG HTML dialog close request, living standard retrieved 2026-10-27](https://html.spec.whatwg.org/multipage/interactive-elements.html#dialog-request-close)).

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

## Recommendations for ARCHITECTURE.md

1. **Adopt a capability ladder per component: native semantics → native behavior enhancement → internal fallback.** A native `<button>`, `<select>`, `<input>`, or `<dialog>` remains in the accessibility tree in every tier. *Trade-off:* adapters and tests are more complex than one custom DOM implementation, but fallback behavior stays meaningful and less accessibility code is owned.
2. **Use `<dialog>.showModal()` for modal components and Popover for non-modal top-layer components.** Do not create a generic overlay that blurs this distinction. *Trade-off:* two behavioral paths are required, but modality, dismissal, and focus contracts remain comprehensible and native.
3. **Use CSS anchor positioning as the default positioning engine on the 2026 browser floor, behind component-level feature detection; retain deterministic geometry as a fallback only for browsers explicitly supported.** *Trade-off:* shipping both paths costs code and parity tests; dropping the fallback reduces bundle size but raises the minimum browser floor. Never import a positioning library.
4. **Do not make `closedby`, Invoker Commands, or `interestfor` hard prerequisites.** Detect each independently; invoke the same internal close/command operations in their absence. *Trade-off:* a small compatibility layer remains despite Baseline support, while older browsers retain equivalent operation.
5. **Make classic `<select>` the default single-select preset.** Offer customizable select styling only as progressive enhancement and reserve a custom listbox/combobox for capabilities native select cannot provide. *Trade-off:* less visual uniformity across old/mobile browsers, in exchange for native keyboard, autofill, forms, and touch UX.
6. **Use FACE/`ElementInternals` only in the vanilla custom-element adapter where native form participation adds value.** Keep the shared core independent of custom elements. *Trade-off:* one additional adapter and lifecycle callbacks, rather than coupling Vue/React rendering or SSR to custom-element registration.
7. **Use native constraint validation and `:user-invalid` for styling timing, but keep error text, relationships, and submission behavior in the field contract.** *Trade-off:* a small touched-state fallback is needed for older engines; native APIs alone do not satisfy accessible error identification.
8. **Keep View Transitions outside behavioral state machines.** A transition wrapper may observe a committed update and must be skipped for reduced motion or unsupported browsers. *Trade-off:* less cinematic control than coupling animation to state, but no animation can corrupt focus, hydration, or test determinism.
9. **Record native fallback rules and minimum feature versions in every component’s machine-readable contract.** Generate browser tests from those declarations. *Trade-off:* contract maintenance becomes release work, but support claims become executable instead of documentary folklore.

STATUS: DRAFT-COMPLETE