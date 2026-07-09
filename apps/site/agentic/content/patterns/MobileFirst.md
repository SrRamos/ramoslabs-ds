---
id: mobile-first
title: Mobile First
group: patterns
storybookTitle: Patterns/Mobile First
summary: The desktop-to-mobile pattern map, bottom sheets from native <dialog>, thumb-zone and sticky CTAs, bottom nav and FAB, snackbars, the gesture-alternative rules, safe-area insets, and capability-not-user-agent activation
---

The same content does not deserve the same container. A modal is centered on desktop because a cursor reaches the middle of a wide screen without effort; a thumb on a 375px phone cannot. So the mobile equivalent of a centered modal is a bottom sheet anchored to the bottom edge, where the thumb already rests. This is a different container for the same content, kept operable by keyboard and announced correctly.

# Part 1: The map, every desktop pattern has a mobile home

## 1. The desktop to mobile map

Patterns that lean on a cursor, hover, and a wide screen are ergonomically hostile to a thumb. Steven Hoober's field study of 1,333 observations found 49% of people use a phone one-handed, with the thumb as the dominant actuator, and that grip changes "very often, sometimes every few seconds." The comfortable arc of the thumb covers the lower half of the screen; the top edge forces a regrip. Primary actions and navigation move down, anchored to the bottom edge, inside the safe area.

| Desktop pattern | Mobile replacement | Anchor source |
|-----------------|--------------------|---------------|
| Centered modal / dialog | Bottom sheet (dialog anchored to the bottom edge) | web.dev: at a small viewport the bottom margin goes to `0` and the dialog "transforms into an action sheet." |
| Hover menu / dropdown | Action sheet of options (a list-only bottom sheet) | Material modal bottom sheet: "present a set of choices while blocking interaction with the rest of the screen." |
| Hover tooltip | Tap to reveal, inline disclosure, or tap to a sheet | There is no reliable `:hover` on `pointer: coarse`. |
| Right click (context menu) | Long press, plus a visible overflow control | WCAG 2.5.1 lists "long press" as a valid single-pointer alternative. |
| Persistent left sidebar | Bottom navigation bar (3 to 5) or a drawer | Material: the navigation bar "lets people switch between UI views on smaller devices." |
| Hover to reveal actions | No such state. Make actions visible or reveal on tap | `pointer: coarse` does not fire hover. |
| Top toolbar of actions | Bottom app bar or a sticky bottom CTA | Thumb zone. |
| Toast, top of the screen | Snackbar anchored to the bottom | Material: "brief messages ... at the bottom of the screen." |

**How the map is switched on: by input capability, never by user agent.** Detect `@media (pointer: coarse)` and viewport width. A touchscreen laptop, an iPad with a trackpad, a phone in a desktop dock: none of these fit a substring match on `navigator.userAgent`, and all of them break it. The switch is a capability query combined with a width breakpoint.

# Part 2: The components, anchored to the bottom

## 2. Bottom sheet, the modal's mobile form

Material draws two variants. A standard bottom sheet "co-exists with the screen's main UI region and allows for simultaneously viewing and interacting with both regions," so it carries no scrim. A modal bottom sheet "present[s] a set of choices while blocking interaction with the rest of the screen," sits above a scrim, and is the direct replacement for a centered modal. iOS expresses the same idea as a sheet with resizable detents (medium and large snap points) and an optional grabber, treated here as an iOS convention.

**A bottom sheet is still a dialog.** Build the modal variant on the native `<dialog>` element and let the platform hand you most of the accessibility for free.

1. Open with `showModal()`. MDN: it "block[s] interaction with other UI elements, making the rest of the page inert." The browser applies `inert` to the rest of the document and implies `aria-modal="true"`.
2. Send focus to Cancel, not Confirm. Put `autofocus` on the cancel or close control so that "confirmation is deliberate and not accidental."
3. Escape is free. A dialog opened with `showModal()` "can be dismissed by pressing the Esc key." You do not wire it.
4. Give it an explicit close. MDN: "The most robust way to ensure that all users can close the dialog is to include an explicit button." The swipe and the grabber can never be the only way out.
5. Return focus on close. Native `<dialog>` restores focus to the trigger in most cases; with custom animation you restore it yourself.
6. Anchor to the bottom with CSS, not a new component. Set `inset: auto 0 0 0` so the sheet sits on the bottom edge, style the `::backdrop` for the scrim, and pad the bottom with `env(safe-area-inset-bottom)` so content clears the home indicator.
7. The drag handle is a real control. In Material the handle "will automatically receive and handle accessibility commands to expand and collapse." On web that means a genuine `<button>` the keyboard can operate to cycle snap points, sized to the 48px touch-target floor, not a decorative bar you can only drag.

**Bottom sheet or centered modal? Same component, one media query.**
- Bottom sheet when: the viewport is small (`pointer: coarse` or width at or below the breakpoint), the task is scoped and tied to context, or it is a list of actions or a short form where thumb reach matters. The standard variant when the user needs to keep seeing the content behind.
- Centered modal when: there is a cursor (desktop), or the dialog is genuinely blocking and critical (a destructive confirmation with forced focus), or content does not sit comfortably against the bottom edge.

**Do not duplicate the component.** It is the same `<dialog>` in both cases. Only the positioning changes by media query: centered on wide screens, anchored to the bottom on narrow ones. One accessibility contract, two layouts. See Patterns / Modals for the full dialog contract.

## 3. Thumb zone and the sticky bottom CTA

Hoober's field data: one-handed use 49% (67% right thumb, 33% left); cradling 36%; two-handed 15%, 90% of that in portrait. When cradling, the thumb is on the screen 72% of the time. Grip changes very often, sometimes every few seconds. The thumb owns the lower band; the top edge is the stretch zone. So the primary action lives at the bottom, pinned (sticky), full width or aligned to the dominant thumb.

**Target size: the legal floor is not the goal.** WCAG 2.5.8 (AA) sets the minimum at 24 by 24 CSS pixels, but that is a floor with exceptions, not a target. NN/g recommends interactive elements "at least 1cm by 1cm," because "the impact area of the typical thumb is an average of 2.5cm wide." Our rule for anything in the thumb zone: at least 44 to 48px tall, in line with Material's 48dp and NN/g's 1cm. Never the bare 24px for a primary action.

**Rule:** The primary action is a full-width control pinned to the bottom, at least 48px tall, in the thumb band.
**Why:** Hoober: the thumb comfortably covers the lower half, and grip shifts constantly. A bottom-pinned action is reachable regardless of the current grip.

**Rule:** Pad the sticky bar's bottom with `calc(base + env(safe-area-inset-bottom))`.
**Why:** MDN gives this exact pattern so "fixed app toolbar buttons are not obscured" by the home indicator.

## 4. Bottom navigation and the FAB

Material: a navigation bar "lets people switch between UI views on smaller devices" and holds three to five destinations (the component "does not support more than 5"). Each destination is a link or button with an accessible name, and the active one carries `aria-current="page"`. Use a bottom bar for three to five top-level destinations of equal weight that stay visible; use a drawer when there are more than five or the navigation is secondary or hierarchical. On desktop that same set becomes the persistent sidebar.

A FAB "represents the primary action of a screen," a single, unambiguous action like create or compose. Use it only when there is exactly one such action. Do not pair a FAB with a sticky bottom CTA: they compete for the same thumb band, so on any one screen they are usually mutually exclusive. Mark the active tab with `aria-current="page"` so a screen reader announces it as current, not by color alone. A FAB with an icon glyph carries an `aria-label`.

## 5. Snackbar, feedback in the thumb band

Material: snackbars "provide brief messages about app processes at the bottom of the screen" and "shouldn't interrupt the user experience." Only one shows at a time (a new one dismisses any previous), it may carry a single optional action such as undo or retry, and it is "the preferred mechanism for displaying feedback messages," with toast reserved for when a snackbar cannot be used. It replaces the desktop toast that lived in the top-right corner. On web: a region with `role="status"` (or `aria-live="polite"`) anchored to the bottom with `env(safe-area-inset-bottom)`; if it has an action, that action is a real `<button>` reachable by keyboard, never dependent on a swipe.

# Part 3: Touch rules, gestures, safe areas, activation

## 6. Gestures, and the rule that never bends

Swipe to delete, long press for a context menu, pull to refresh, drag on a sheet's snap points: all useful, all mobile-native. The non-negotiable rule: a gesture can never be the only path. There must always be an alternative that works with a single pointer and with a keyboard.

**Rule:** Any path-based or multipoint gesture has a single-pointer alternative.
**Why:** WCAG 2.5.1 Pointer Gestures (Level A): functionality using such gestures "can be operated with a single pointer without a path-based gesture" unless essential. A tap, click, or long press qualifies. Swipe to delete needs a visible Delete button.

**Rule:** Any dragging movement has a no-drag alternative.
**Why:** WCAG 2.5.7 Dragging Movements (2.2, Level AA): achievable "by a single pointer without dragging," for example tapping buttons to move items. The sheet's drag handle needs buttons or taps that expand, collapse, and close it.

**Rule:** Long press replaces right click only alongside a visible overflow control.
**Why:** long press is neither discoverable nor keyboard-operable. The same action must live in a visible "more options" menu.

**Rule:** Custom pull to refresh ships with a visible Refresh button.
**Why:** native browser scroll and the OS pull-to-refresh fall under the user-agent exception, but a gesture your own content interprets does not. If you build it, give the same action an explicit control.

Swiping is the shortcut, not the requirement: a swipe-to-delete row also exposes a Remove button that carries the same action, is at least 44px tall, and is keyboard-reachable. Style it in the brand indigo, not an alarm color, because destructive intent is carried by the label and the confirmation step, not by hue.

## 7. Safe-area insets, notch and home indicator

MDN defines `env(safe-area-inset-*)` as "the safe distance from the top, right, bottom, or left inset edge of the viewport, defining where it is safe to place content without risking it being cut off by the shape of a non-rectangular display." The four variables are `safe-area-inset-top`, `-right`, `-bottom`, and `-left`. They are `0` on a plain rectangular viewport and larger than zero around a notch or the home indicator, but only when the page opts in with `<meta name="viewport" content="viewport-fit=cover">`.

```css
/* MDN canonical sticky bottom bar */
footer {
  position: sticky;
  bottom: 0;
  padding: 1em 1em calc(1em + env(safe-area-inset-bottom, 0px));
}
```

**Rule:** Never pad a fixed edge with a bare constant. Use `calc(base + env(safe-area-inset-*, 0px))`.
**Why:** the `calc()` keeps your normal spacing on rectangular screens and adds only the device inset where one exists. The `0px` fallback keeps it correct on browsers that do not supply the variable. `env()` has been widely available since January 2020.

**Out of scope, not yet normative: the virtual keyboard.** Handling the on-screen keyboard resizing the viewport (the VirtualKeyboard API, `interactive-widget`, dynamic viewport units) is a live and shifting area not verified against a primary source for this page. Treat it as a follow-up, not a rule, and confirm current support before relying on it.

## 8. Enable the patterns on touch, without sniffing

Do not read `navigator.userAgent`. Detect the capability of the input and the size of the viewport. MDN's `pointer` media feature tests the primary pointer's accuracy: `coarse` is "a pointing device of limited accuracy, such as a finger on a touchscreen," `fine` is "an accurate pointing device, such as a mouse," and `none` is no pointer. Use `pointer` for the primary device and `any-pointer` for any device present.

```css
/* Capability, not user agent */
@media (pointer: coarse) {
  /* larger targets, touch patterns, no hover reveal */
}
@media (pointer: fine) {
  /* mouse density, hover affordances */
}
/* Switch container by capability OR width */
@media (pointer: coarse), (max-width: 640px) { /* sheet, bottom nav */ }
```

**Rule:** On `pointer: coarse`, assume no reliable hover. Reveal-on-hover patterns do not exist; make actions visible or reveal on tap.
**Why:** a touchscreen has no persistent hover state. Anything hidden behind `:hover` is unreachable by a finger, which is why the map has no mobile home for "hover to reveal."

**Rule:** Switch the container on `pointer: coarse` OR width at or below the breakpoint, so both phones and touch tablets are covered.
**Why:** width alone misses a small touch tablet; capability alone misses a narrow mouse window. The union of the two reliably picks the sheet-and-bottom-nav layout. `pointer` has been widely available since December 2018.

The whole detection surface is three signals: primary pointer accuracy (`pointer: coarse`), viewport width breakpoint, and hover availability (`any-hover: none`). No user-agent string appears anywhere in it.

## Sources

Steven Hoober, How Do Users Really Hold Mobile Devices? (UXmatters, 2013): 1,333 observations, 49% one-handed (67% right thumb), 36% cradling, 15% two-handed; thumb on screen 72% while cradling; grip changes very often. Aurora Harley, Touch Targets on Touchscreens (NN/g, 2019): at least 1cm by 1cm; typical thumb impact area averages 2.5cm. W3C Understanding WCAG: SC 2.5.1 Pointer Gestures (A), SC 2.5.7 Dragging Movements (2.2, AA), SC 2.5.8 Target Size Minimum (2.2, AA, 24px floor with exceptions). MDN Web Docs: the `<dialog>` element (`showModal()` makes the rest inert, Escape closes, `aria-modal`, `::backdrop`, explicit close button), CSS `env()` and safe-area insets with the sticky footer pattern (Baseline 2020), the `pointer` media feature coarse/fine/none (Baseline 2018). Adam Argyle, Building a dialog component (web.dev): accessible native dialog, focus on the cancel action, the mega dialog transforming into a bottom-anchored action sheet. Material Components (official docs): Bottom Sheet (standard vs modal, scrim, the 48dp accessible drag handle), Snackbar (bottom, one at a time, one optional action, preferred over toast), Floating Action Button (single primary action), Bottom Navigation (three to five destinations). Apple Human Interface Guidelines, Sheets and Action Sheets (resizable detents, the grabber, action sheets at the bottom on iPhone), referenced as iOS conventions. House rules layered on the cited guidance: the desktop-to-mobile mapping table and the "same component, one media query" position, the 44 to 48px thumb-zone floor, the FAB and sticky-CTA mutual-exclusion guidance, and the capability-OR-width activation rule. The virtual keyboard subsection is out of scope and not yet verified against a primary source.
