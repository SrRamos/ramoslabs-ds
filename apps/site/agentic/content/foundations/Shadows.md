---
id: shadows
title: Shadows
group: foundations
storybookTitle: Foundations/Shadows
summary: Three indigo-tinted two-layer elevation levels plus a focus ring, with shadow meaning height and never state
---

Every floating surface picks one of three heights, each a soft two-layer shadow tinted with brand indigo instead of hard black. A shadow says one thing only: this surface sits above another. Add a focus ring at `--shadow-focus` and that is the entire system.

## The elevation ladder

Flat on the page, raised, overlay, floating. The taller a surface reads, the higher it sits, and `lg` is the ceiling every surface stays within.

- On the page: no shadow.
- Raised: `--shadow-sm`.
- Overlay: `--shadow-md`.
- Floating, the ceiling: `--shadow-lg`.

## Three levels, plus a ring

- `--shadow-sm`, Raised: buttons and resting cards. A whisper of lift that separates an element from the page.
- `--shadow-md`, Overlay: dropdowns, popovers, menus. Content that opens over the current view and closes again.
- `--shadow-lg`, Floating, the ceiling: modals, sheets, command palettes. The highest surface. If something must feel higher, add a scrim, not more blur.
- `--shadow-focus`, Focus ring: a two-tone ring, a white gap inside an indigo edge, paired with `:focus-visible` to show keyboard position. Accessibility, never decoration.

## Two layers, tinted indigo

Real shadows are two things at once: a crisp contact shadow close to the object, and a soft ambient shadow far from it.

- Near layer: short offset, tight blur. The crisp contact shadow that grounds the object.
- Far layer: long offset, wide blur, negative spread. The soft ambient shadow that gives height.
- Both, tinted indigo: the two combined and tinted. This is `--shadow-md`.

Tinting both with indigo lets the shadow belong to the surface instead of staining it.

## Shadow is height

A shadow says one thing: this surface sits physically above another.

Rule: pick one of the three elevation levels for a surface and keep it fixed for the surface's whole life. Why: a constant elevation reads as real, physical height, so hover, press, and selection stay legible in their own channel, color.

- ✓ Recommended: fix each surface at one level, then carry hover, press, and selection in color and state layers. Color answers "what is happening to this control", shadow answers "how high does this surface sit".
- ✕ Avoid: swelling a dramatic shadow on hover, usually paired with a `translateY` lift. It fakes physics the surface does not have and collides with the rule against transform-based hover.

State feedback lives in color. Hover, press, and selection ride on color and state layers rather than elevation. See Patterns / Interactive for the state-layer model.

## In the dark, tint carries height

As a surface rises it can take a stronger indigo tint. In dark themes a drop shadow nearly vanishes against a dark background, so a lighter, more tinted surface is the clearer signal. Prefer tint in the dark, shadow in the light, and the two can combine. Height reads from lightness, not from ink.

## Token reference

Four tokens, the whole system. The scale stays closed: `lg` is the top, and hover reuses the resting shadow.

| Token | Role | Value |
| --- | --- | --- |
| `--shadow-sm` | Raised, buttons and resting cards | 0 1px 2px rgba(79, 70, 229, .06), 0 1px 3px rgba(15, 23, 42, .04) |
| `--shadow-md` | Overlay, dropdowns and popovers | 0 2px 4px -1px rgba(79, 70, 229, .06), 0 8px 16px -4px rgba(79, 70, 229, .10) |
| `--shadow-lg` | Floating ceiling, modals and sheets | 0 4px 8px -2px rgba(79, 70, 229, .06), 0 16px 32px -8px rgba(79, 70, 229, .12) |
| `--shadow-focus` | Focus ring, pairs with :focus-visible | 0 0 0 2px #ffffff, 0 0 0 4px #4f46e5 |

## Sources

Material 3 elevation and tonal elevation: level count and the surface-tint approach. Tobias Ahlin, layered smooth shadows: stacking soft box-shadow layers for a natural falloff. Apple Human Interface Guidelines, Materials: soft, minimal shadows for depth. Exact rgba layer values are specific to this system's tokens, and reading `lg` as an absolute ceiling is a house rule.
