---
id: interactive
title: Interactive
group: patterns
storybookTitle: Patterns/Interactive
summary: The three-modality state model, the tonal indigo --state-* overlay, the pointer-only hover gate, and the two-tone --shadow-focus ring
---

Touch is the majority of every session, and a finger has nothing to hover with. So the press comes first, the keyboard gets a ring, and hover is a pointer-only garnish laid on top. One tonal indigo layer expresses all three, stepped through the `--state-*` scale.

## 1. Three inputs, one state each

Each input arrives its own way and reads its own signal. Build for all three, or you build for a mouse alone.

- Pointer: rests over a control without committing. That idle moment is hover, and it belongs to the pointer alone.
- Touch: no idle state. A finger commits on contact, so its signal is the press, fired the instant it lands.
- Keyboard: moves by Tab, commits with Enter or Space. Its signal is focus-visible, and without it the interface is unusable.

**Mobile first.** The press is the one state every device can make. Design `:active` first, add `:focus-visible` for keyboards, layer `:hover` for pointers. Never the reverse.

## 2. The state overlay

Every state is a color, never a jump in position. Filled deepens to indigo 700 on hover, 800 on press. The tonal button and card gain an indigo state layer instead. A single translucent indigo overlay, the mechanism Material 3 standardized, builds hover, press, and drag alike.

One overlay, four opacities:

- `--state-hover`: 0.08, pointer only
- `--state-focus`: 0.10, keyboard
- `--state-pressed`: 0.10, all inputs
- `--state-dragged`: 0.16, while dragging

```css
/* One indigo overlay, opacity driven by the --state-* scale.
   Works on any surface: button, card, list row. */
.control {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-sm); /* 6px */
}
.control::after {
    content: ''; position: absolute; inset: 0;
    background: var(--color-primary); opacity: 0;
    transition: opacity var(--duration-fast) var(--easing-out);
    pointer-events: none;
}
.control:active::after { opacity: var(--state-pressed); } /* every input */
```

**iOS caveat for custom controls.** On iOS Safari `:active` does not fire on a non-native control (a `div` or `span` with `role="button"`) unless that element carries `cursor: pointer` or an empty `ontouchstart` handler to arm it. Real `<button>` and `<a>` are unaffected, so prefer them.

## 3. Hover belongs to pointers

Wrap every hover rule in `@media (hover: hover) and (pointer: fine)`. It fires only where a pointer can actually rest over a control.

**The sticky hover bug.** A touchscreen has no pointer to move away, so it never clears an ungated hover. Tap one and the style sticks: buttons stay lit, cards freeze mid transition. The gate is the fix, not a nicety.

```css
/* Press works everywhere, so it lives at the top level. */
.control:active::after { opacity: var(--state-pressed); }

/* Hover is a pointer-only enhancement. */
@media (hover: hover) and (pointer: fine) {
    .control:hover::after { opacity: var(--state-hover); }
}
```

## 4. A ring you can always see

Style `:focus-visible`, not `:focus`: the ring shows for the keyboard and stays hidden after a plain click. A focus indicator has to clear 3:1 against whatever sits behind it, and one flat color cannot promise that. White dissolves on a light page; indigo dissolves on an indigo button. `--shadow-focus` is two-tone for exactly this reason, a white gap inside an indigo edge, so whichever layer meets the surface, the other one still reads.

An `outline` with `outline-offset` earns the same guarantee: the offset opens a transparent gap so the page shows through, and the outline rides just outside it. The real mistake is `outline: none` with nothing put back, or a single-color ring that fades into a matching surface.

**WCAG 2.2.** A focus indicator has to be visible (SC 2.4.7 Focus Visible, AA) and clear 3:1 against its adjacent colors (SC 1.4.11 Non-text Contrast, AA). SC 2.4.13 Focus Appearance (AAA) adds a floor: an area at least a 2px perimeter thick and a 3:1 change between the unfocused and focused states. The two-tone ring is 4px of indicator and one layer always crosses 3:1, so it clears all three on light and on brand.

```css
/* Do: keyboard-only ring, two-tone token, reads on any surface. */
.control:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus); /* 0 0 0 2px #fff, 0 0 0 4px #4f46e5 */
}
/* Also fine: an outline with an offset gap does the same job. */
.control:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
/* Don't: remove the outline with nothing put back, or ring in
   one color that vanishes into a surface of the same color. */
.control:focus-visible { outline: none; }
```

## 5. The rules

**Rule:** Design the press first, then the keyboard ring, then hover.
**Why:** the press is the one signal every device can make, so `:active` is the floor, `:focus-visible` the next layer, and hover the pointer garnish on top. Feedback built on hover alone leaves touch with nothing.

**Rule:** Wrap every hover rule in `@media (hover: hover) and (pointer: fine)`.
**Why:** a touchscreen has no pointer to move away, so an ungated hover sticks lit after a tap. The gate fires hover only where a pointer can rest.
- ✓ Recommended: hover lives inside the pointer gate, so it clears the moment the finger lifts.
- ✕ Avoid: an ungated `:hover` has no way to reset on touch, so the control freezes lit after a tap.

**Rule:** Signal every state with the tonal indigo overlay on the `--state-*` scale.
**Why:** one translucent layer expresses hover, press, and drag with a single rule, and color carries the meaning on every input.
**House rule:** in this design system shadow is reserved for elevation, never for state. Material 3 does raise cards and buttons on hover; RamosLabs keeps the shadow still on purpose, so one mechanism carries every state. This is a RamosLabs decision, not an M3 mandate.
- ✓ Recommended: deepen the tonal overlay for hover and press. The card holds its elevation.
- ✕ Avoid: lifting a card or swapping its shadow to signal hover. Here that spends elevation on a job the overlay already does.

**Rule:** Ring with `--shadow-focus` on `:focus-visible`, and keep the token two-tone.
**Why:** `:focus-visible` shows the ring for the keyboard and hides it after a plain click. A flat ring fades into a matching surface, so two tones keep one layer above 3:1 on any background.
- ✓ Recommended: `:focus-visible` with the two-tone `--shadow-focus`, so the ring reads on light and on brand.
- ✕ Avoid: styling `:focus` instead of `:focus-visible`, or a one-color ring that vanishes into a surface of the same color.

**Rule:** Gate transforms behind `prefers-reduced-motion` and let color carry the state without them.
**Why:** the overlay already tells the whole story, so a reduced-motion visitor loses no information when the scale or lift is dropped.

**Rule:** Give controls a 6px radius, `--radius-sm`, and pair each visual state with its ARIA.
**Why:** a shared radius keeps controls in one family, and a pill radius stays on chips rather than wide buttons. Screen readers need `aria-busy`, `aria-disabled` and friends to hear what the color shows.

## Sources

State layers after Material 3 (m3.material.io). The hover and pointer media features, `:focus-visible`, and `prefers-reduced-motion` per MDN. Immediate press feedback from Apple Human Interface Guidelines. Focus floors from WCAG 2.2: visible focus (SC 2.4.7), 3:1 non-text contrast against adjacent colors (SC 1.4.11), and focus appearance size and change (SC 2.4.13). The two-tone gap pattern follows GOV.UK focus styles and MDN `outline-offset`.
