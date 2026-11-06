---
id: spacing
title: Spacing
group: foundations
storybookTitle: Foundations/Spacing
summary: 4px base with an 8px rhythm, fourteen fixed steps, touch-target floors, and density rules
---

Space is picked once: a 4px base, an 8px rhythm, and 14 fixed steps. Every gap in the product is one of those steps. No 13px here, no 15px there.

## One base, an 8pt rhythm

The scale rests on a 4px base with an 8px primary beat. Four gives fine control for tight gaps; eight is the workhorse, because it divides cleanly across screen densities and renders crisp from a 1x phone to a 3x display, never landing on a half pixel. Spacing, component sizes, and line boxes all snap to the same beat.

## The scale

Fourteen steps, every value a multiple of 4px. Past `--space-6` the steps widen (skipping 7, 9, 11) because at larger sizes the eye needs a bigger jump. Tokens ship in `rem`, so spacing scales with the user's root font size.

| Token | rem | px | Typical use |
| --- | --- | --- | --- |
| `--space-0` | 0 | 0 | Reset, collapse a gap |
| `--space-1` | 0.25rem | 4px | Hairline gaps, icon-to-label |
| `--space-2` | 0.5rem | 8px | Tight inline spacing, chip padding |
| `--space-3` | 0.75rem | 12px | Compact input padding |
| `--space-4` | 1rem | 16px | Default padding, card interior |
| `--space-5` | 1.25rem | 20px | Roomy control padding |
| `--space-6` | 1.5rem | 24px | Gap between related components |
| `--space-8` | 2rem | 32px | Block separation, generous padding |
| `--space-10` | 2.5rem | 40px | Group separation |
| `--space-12` | 3rem | 48px | Section padding on mobile |
| `--space-16` | 4rem | 64px | Between-section rhythm |
| `--space-20` | 5rem | 80px | Large section breaks |
| `--space-24` | 6rem | 96px | Desktop section padding |
| `--space-32` | 8rem | 128px | Hero spacing |

## Touch targets are non-negotiable

Spacing is an accessibility contract. Three floors anchor the system:

- 24 by 24px: WCAG 2.2 floor (AA), the AA minimum.
- 44 by 44pt: Apple HIG target.
- 48 by 48dp: Material target.

On phones, add safe-area insets to edge-anchored bars so a sticky CTA never sits under the home indicator: `padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom))`.

- ✓ Recommended: size primary actions to the 44 to 48px range, and keep 24px as the hard floor for dense, secondary controls.
- ✕ Avoid: letting a tap target shrink to its visual glyph. A 20px icon with no added padding misses the floor; expand the hit area with padding or a pseudo-element so it reaches 44 to 48px while the glyph stays small.

## Density lowers whitespace, never the floor

Density is how tightly the same components pack. You step interior spacing down the scale, never invent off-scale values.

| Mode | Interior step | When to apply |
| --- | --- | --- |
| Comfortable (default) | `--space-4` / `--space-6` | Touch-first screens, marketing, reading, onboarding |
| Compact | `--space-2` / `--space-3` | Data tables, dashboards, admin tools, power-user views |

Rule: keep the 24px hit-area floor in every density mode, compact included. Why: density trims padding, not accessibility.

## Related, group, section: the semantic rhythm

The numeric scale says how much. The semantic tokens say what the space is for. Things that belong together sit closer than things that do not (the Gestalt law of proximity), so the space inside a group is always smaller than the space between groups, and that is smaller than the space between sections.

| Token | Maps to | Use |
| --- | --- | --- |
| `--space-related` | `--space-2`, 8 px | Between items that belong together: a label and its value, a title and its subtitle. |
| `--space-group` | `--space-6`, 24 px | Between groups inside one section or card: one metric row and the next, one form field and the next. |
| `--space-section` | `--space-12`, 48 px | Between sections of a page or major blocks of a flow. |

### ✓ Recommended: Spacing rhythm

**Rule:** Use `--space-related` inside a group and `--space-group` or `--space-section` around it. The space around a group is always larger than the space inside it.
**Why:** Proximity tells the eye what belongs together before it reads a word. When inner and outer spacing match, the groups blur and the layout looks like one long list.

### ✕ Avoid: Spacing rhythm

**Rule:** Do not use one spacing value for the gap inside a group and the margin around it.
**Why:** With equal spacing nothing is grouped and nothing leads. A card with 16 px everywhere is harder to scan than one with 8 px inside and 24 px between.

## The lint that checks it

The `sj/spacing-proximity` stylelint rule flags a rule whose `gap` and `margin` use the same `--space-*` token (inner equals outer). It reads one rule at a time, so it cannot compare a parent’s gap with a child’s margin declared in another selector, or a value reached through a custom property. Those cases stay with review and this page. A container’s own padding is not compared: edge padding equal to the gap is normal.

*Sources: NN/g, Proximity Principle in Visual Design; Interaction Design Foundation, Proximity principle. The semantic token names and the lint are DS conventions with no external source.*

Try it. Storybook: Patterns/Demos/Activity Card (the equal-spacing counter-example sits beside the recommended card).

## Sources

Touch-target floors: WCAG 2.2 SC 2.5.8 Target Size Minimum, 24px AA; Apple HIG 44pt; Material 48dp. The 8pt grid and density model after Material layout and density, and Refactoring UI numbered scales. Safe-area insets via CSS `env()`.
