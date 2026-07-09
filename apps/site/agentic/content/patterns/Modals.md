---
id: modals
title: Modals
group: patterns
storybookTitle: Patterns/Modals
summary: The six accessibility requirements of a modal, native <dialog>.showModal() as the way to get them, dialog vs alertdialog, when not to use a modal, the Popover API, pitfalls, and the mobile bottom sheet
---

A modal steals the whole room: it stops the task, blanks the background, and traps the keyboard until the user answers. Reach for the native `<dialog>` with `showModal()` first, use it rarely, and never open one where a page, an inline message, or a popover would have done the job.

## 1. The six things a modal must do

An accessible modal dialog is a contract with the keyboard and the screen reader. The WAI-ARIA APG names six terms. Miss any one and the modal is broken for someone.

1. **It has an accessible name.** Point `aria-labelledby` at the visible title, or set `aria-label` when there is no visible title. Without a name it fails WCAG 4.1.2.
2. **Focus moves in on open.** When the dialog opens, focus lands on an element inside it, not the page behind. Use `autofocus` to place it deliberately.
3. **Tab cycles inside.** Tab off the last control wraps to the first, and Shift+Tab off the first wraps to the last. Focus never escapes to the inert page.
4. **Escape closes it.** The Escape key dismisses the dialog. This is the release valve that keeps the focus trap legal under WCAG 2.1.2.
5. **Focus returns to the trigger.** On close, focus goes back to the control that opened the dialog.
6. **The background is inert.** Everything behind the dialog leaves the tab order and the accessibility tree. A pointer, a Tab, and a screen reader all stop at the dialog edge.

## 2. The native element hands you all six

`<dialog>` opened with `.showModal()` gives you the whole contract for free and correctly: focus moves in, Tab is trapped, Escape closes, the background goes `inert`, and focus returns to the trigger on close. It renders in the top layer, so it sits above the page with no `z-index` fight, and it exposes a `::backdrop` to dim what is behind.

MDN: "While dialogs can be created using other elements, the native `<dialog>` element provides usability and accessibility features that must be replicated if you use other elements for a similar purpose."

The Cancel and Save buttons live in a `<form method="dialog">`, so activating either closes the dialog and reports its `returnValue` without a submit or a page reload. Ship a real close button too, because Escape alone is not a discoverable exit.

Three rules from MDN keep it honest: never open a modal with the `open` attribute (that makes a non-modal, no trap, no Escape, no inert), never put `tabindex` on the `<dialog>`, and always ship an explicit close button.

```html
<!-- Open with .showModal(), never the open attribute. -->
<button onclick="dlg.showModal()">Rename event</button>

<dialog id="dlg" aria-labelledby="dlg-title">
  <!-- method="dialog" closes on submit, no reload, sets returnValue -->
  <form method="dialog">
    <h3 id="dlg-title">Rename event</h3>
    <input autofocus value="Summer Rooftop Session">
    <button value="cancel">Cancel</button>
    <button value="save">Save name</button>
  </form>
</dialog>
```

**Animating opts you out of one guarantee.** web.dev warns that when you animate a dialog open or closed, the built-in focus return is lost and has to be restored by hand with event listeners. If you add motion, put the focus return back yourself, and honor `prefers-reduced-motion`.

## 3. dialog for content, alertdialog for consequences

`role="alertdialog"` tells assistive tech this dialog interrupts to demand a response, so it can treat it specially (a system alert sound, for instance). Use it for confirmations and destructive or irreversible actions. Use plain `dialog` for forms, selection, and content.

- role dialog: forms, pickers, multi-step content. Nothing is destroyed by opening it. Focus the first field or the primary control.
- role alertdialog: delete, cancel, wipe, anything irreversible. Requires `aria-describedby` on the message, and focus starts on Cancel.

An alertdialog carries every requirement from Section 1 plus two of its own: `aria-describedby` must point at the element holding the alert message, and the safest initial focus is the Cancel button, not the destructive one. Putting focus on Cancel makes the dangerous choice deliberate rather than one stray Enter away.

APG: "The alertdialog role enables assistive technologies and browsers to distinguish alert dialogs from other dialogs so they have the option of giving alert dialogs special treatment, such as playing a system alert sound." NN/g draws the same line: interrupt precisely when "there is a chance that users' work be lost or that an action may have destructive, irreversible consequences."

## 4. When not to use a modal at all

A modal charges a tax. NN/g: it demands immediate action, breaks the flow, makes the user lose their place, adds cognitive load, and hides relevant background. "Modal dialogs that are not directly related to users' goals are perceived as annoying and can diminish trust." Walk this ladder and stop at the first rung that fits.

1. **A separate page.** For anything complex or multi-step. GOV.UK's "one thing per page" default sends the user to another page instead of a modal, and their design system ships no modal component at all.
2. **Inline content.** A field failed validation? Show the error inline, next to the field. Help text, hints, and single-field errors belong in the page.
3. **A non-modal dialog.** When the user should keep working with the background, open a dialog with `show()` instead of `showModal()`. No trap, no inert, the page stays live.
4. **A popover.** Action menus, toasts, form suggestions, teaching hints. Lightweight, non-modal, light-dismiss.

**Never modal.** Newsletter and promo interrupts unrelated to the goal, high-risk checkout (NN/g advises against it explicitly), decisions that need information the user cannot see inside the modal, and single-field validation errors.

## 5. Popover for everything non-modal

The Popover API is the tool for overlays that must not steal the room. "Popovers created using the Popover API are always non-modal." They do not make the background inert, they do not trap focus, and the rest of the page stays interactive. MDN: "If you want to create a modal popover, a `<dialog>` element is the right way to go." A `popover="auto"` light-dismisses on Escape or an outside click and wires up with nothing but `popovertarget` on a button.

A popover opens in the top layer, so normal CSS cannot place it next to its trigger. Anchor it with CSS Anchor Positioning: put `anchor-name` on the trigger, then `position-anchor` plus the `anchor()` function on the popover. Inset properties (top, left, right, bottom) take `anchor()`; sizing (width, height) takes `anchor-size()`.

```css
.trigger { anchor-name: --menu; }
@supports (position-anchor: --a) {
  .menu {
    position: fixed;
    position-anchor: --menu;
    top: anchor(bottom);
    left: anchor(left);
    min-width: anchor-size(width);
    margin-top: 0.375rem;
  }
}
```

Anchor positioning is not in Firefox or Safari yet (2026), so keep the rules inside `@supports` and give a sensible fallback (a centered, usable popover) for browsers without it.

- Tooltip: a brief description on hover or focus over a control. Takes no focus of its own, holds no interactive content. Not a dialog.
- Popover: a light interactive layer. Background stays active, dismiss is light, focus is not trapped. Menus, toasts, pickers.
- Dialog, modal: interrupts. Background inert, focus trapped, needs an answer. Spend it rarely.

**Platform honesty.** `<dialog>` and `showModal()` are Baseline Widely available since March 2022, and `inert` since April 2023, both safe for production. The Popover API is Baseline Newly available since January 2025, so on an older browser base consider a fallback for popovers.

## 6. The pitfalls, and the WCAG nuance

The native element prevents most of these; a hand-built modal has to guard against all of them.

- **Trap:** focus escapes to the background. The native element inertizes the rest of the document for you; by hand you must set the `inert` attribute, not just `pointer-events`.
- **Trap:** focus never returns to the trigger, most often because the open or close was animated. Restore it in an event listener.
- **Trap:** no accessible name. Missing `aria-labelledby` or `aria-label` fails WCAG 4.1.2.
- **Trap:** close only on outside click, with no keyboard exit. Always ship an explicit close button plus Escape.
- **Trap:** opened with the `open` attribute, which produces a non-modal, no trap and no Escape and no inert. Use `.showModal()`.
- **Trap:** nesting modals. Prefer one dialog, or steps inside a single dialog.

**The trap is legal, on one condition.** A modal's focus trap does not violate WCAG 2.1.2 No Keyboard Trap as long as there is a way out. W3C: restricting focus "does not fail the requirements of this criterion, as long as the user knows how to 'untrap' the focus and leave that component." Escape or a Cancel button must always release it. A modal with no keyboard exit does fail 2.1.2.

## 7. On a phone, the modal becomes a sheet

On a phone a centered modal usually becomes a bottom sheet, a panel that rises from the bottom edge into the thumb's reach. What changes is only the presentation: position, anchor, and entry animation. The semantics do not move. A bottom sheet is still a modal `dialog` or `alertdialog`, and it owes every one of the six requirements. The same native `<dialog>` can present as a sheet through CSS while keeping `showModal()` and its guarantees.

**Do not trade a11y for the gesture.** Drag-to-dismiss is a pointer nicety, not a substitute for the keyboard. Every sheet still needs Escape and a visible close button, and the drag must have a keyboard equivalent. The presentation is in Patterns / Mobile First; the doctrine here travels with it unchanged.

## 8. The rules

**Rule:** Reach for the native `<dialog>` with `.showModal()` before building anything by hand.
**Why:** it delivers all six accessibility requirements correctly for free. A hand-built modal has to re-derive each one, which is where the bugs live.
- ✓ Recommended: open with `.showModal()`, close a form with `method="dialog"`, style the dim with `::backdrop`.
- ✕ Avoid: opening with the `open` attribute, which yields a non-modal with no trap, no Escape, and no inert.

**Rule:** Give every modal an accessible name and a real close button, and never put `tabindex` on the `<dialog>`.
**Why:** an unnamed dialog fails WCAG 4.1.2, and Escape alone is not discoverable. MDN calls a visible close button the most robust exit, and warns the dialog itself is not interactive.

**Rule:** Use `role="alertdialog"` for destructive or irreversible actions, with `aria-describedby` and initial focus on Cancel.
**Why:** the role lets assistive tech treat the interruption specially, and focusing Cancel makes the dangerous choice deliberate.
- ✓ Recommended: `alertdialog` with the message wired to `aria-describedby` and `autofocus` on Cancel.
- ✕ Avoid: a plain `dialog` for a delete, or `autofocus` on the destructive button so one Enter wipes the data.

**Rule:** Before opening a modal, try a page, an inline message, a non-modal dialog, or a popover first.
**Why:** a modal steals context and demands an immediate answer. Most content does not earn that cost, and an unrelated interruption erodes trust.

**Rule:** Keep the focus trap, but always leave a keyboard exit, and if you animate, restore the focus return by hand.
**Why:** the trap is legal under WCAG 2.1.2 only while the user can untrap with Escape or Cancel, and animating a dialog drops the automatic focus return.

**Rule:** Reserve the `--color-error` family for the destructive path and keep everything else mono-indigo; radius 6px on buttons, 12px on the dialog.
**Why:** red carries a single meaning, danger, so it stays out of chrome. The destructive fill uses red 600 (`#dc2626`) because red 500 clears only 3.76:1 under white text.

## Sources

The six requirements, roles, and keyboard model from the WAI-ARIA APG: Dialog (Modal) Pattern and Alert Dialog Pattern. The native element, `showModal()` vs `show()`, `::backdrop`, top layer, `method="dialog"`, the `open` and `tabindex` warnings, and Baseline support from MDN: `<dialog>`, `inert`, and the Popover API. The legal focus trap from WCAG 2.1 SC 2.1.2 No Keyboard Trap and the name/role floor from SC 4.1.2. The cost of interrupting from Nielsen Norman Group, Modal & Nonmodal Dialogs. The animation-breaks-focus-return caveat and focus-on-Cancel from web.dev, Building a dialog component. The one-thing-per-page stance from the GOV.UK Design System.
