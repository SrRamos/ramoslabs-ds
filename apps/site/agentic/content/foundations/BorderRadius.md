---
id: border-radius
title: Border Radius
group: foundations
storybookTitle: Foundations/Border Radius
summary: Eight radius steps, the 6px control signature, pill as accent only, and the concentric and squircle rules
---

A corner sets personality. Sharp reads technical, fully round reads playful, the considered middle reads premium. This system commits to one 6px signature on every control, a short ladder up to hero surfaces, and keeps the fully round pill as an accent, never a default.

## The radius scale

Eight tokens, each with a role. The four middle steps do almost all the work.

- `--radius-none`: 0. Square. Tables, full-bleed media, dividers.
- `--radius-xs`: 4px. Nested inner corners, tight inline elements.
- `--radius-sm`: 6px. Signature. Buttons, inputs, selects.
- `--radius-md`: 8px. Comfortable controls, small badges.
- `--radius-lg`: 12px. Cards, menus, popovers, dropdowns.
- `--radius-xl`: 16px. Modals, sheets, large surfaces.
- `--radius-2xl`: 20px. Hero panels, feature surfaces.
- `--radius-pill`: 9999px. Accent only. Chips, tags, avatars, toggles.

## The golden rule

The pill is an accent, not a default. Buttons are not pills. Scale the radius to the size and role of the surface.

Reserve `--radius-pill` for small, single-line elements where the round shape is the point: chips, tags, avatars, toggles, status badges. Every button, input, and select takes the 6px signature. Bigger surfaces earn bigger radii: a card is not shaped like a button, and a modal is not shaped like a card.

- Do: wide button at `--radius-sm`, the 6px signature. Calm, precise, unmistakably a control.
- Don't: the same button forced to a pill. The larger corners read as a toy, not a product.

## The law of concentric corners

Nest one rounded element inside another and the corners must stay concentric: parallel curves sharing a center, like a screen inside its housing.

```
inner radius = outer radius - padding
```

Example: an outer `--radius-xl` (16px) with 8px of padding gives an inner surface of `--radius-md` (16 minus 8), so the corners run parallel. Leaving the inner at the full 16px makes the arcs collide. Apple ships this rule as a first-class API: `ConcentricRectangle` and `containerShape` in SwiftUI.

## Continuous corners, when the browser allows

A plain CSS corner is a quarter circle: the curvature jumps from zero to maximum at a single point. A squircle eases the curvature in and out, reading as softer at the same nominal radius. The CSS `corner-shape` property brings it to the web, with `corner-shape: squircle` defined as `superellipse(2)`. Ship it as progressive enhancement inside an `@supports` query, so the base `border-radius` works everywhere and supporting browsers get the smoother curve for free.

`corner-shape` is new, landing first in recent Chromium. That is why it is an enhancement, not a requirement. Never gate layout, hit targets, or legibility on it.

## The scale at real size

A chip stays a pill because it is small and one line. A button takes the 6px signature. A card steps up to 12px, a modal to 16px.

- Chip: `--radius-pill`
- Button: `--radius-sm`, 6px
- Card: `--radius-lg`, 12px
- Modal: `--radius-xl`, 16px

## Token reference

| Token | Value | Role |
| --- | --- | --- |
| `--radius-none` | 0 | Square. Tables, full-bleed media, section dividers |
| `--radius-xs` | 4px | Nested inner corners, tight inline elements |
| `--radius-sm` | 6px | Signature control radius. Buttons, inputs, selects |
| `--radius-md` | 8px | Comfortable controls, small badges, compact containers |
| `--radius-lg` | 12px | Cards, menus, popovers, dropdowns |
| `--radius-xl` | 16px | Modals, sheets, large surfaces |
| `--radius-2xl` | 20px | Hero panels, feature surfaces |
| `--radius-pill` | 9999px | Accent only. Chips, tags, avatars, toggles, one-line status. Never wide buttons or cards |

## Sources

Material 3, Shape scale: shape as a role-based scale rather than one global radius; step values tuned to this brand. Vercel Geist: a 6px control radius on buttons and inputs. Apple SwiftUI: `RoundedRectangle(style: .continuous)` draws the squircle, and `ConcentricRectangle` with `containerShape` formalizes concentric nesting. CSS corner-shape draft: `squircle` equals `superellipse(2)`, support landing first in recent Chromium. The token mapping, the pill-as-accent reading, and the 6px signature are house rules.
