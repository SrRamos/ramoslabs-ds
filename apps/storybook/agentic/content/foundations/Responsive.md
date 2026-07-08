---
id: responsive
title: Responsive
group: foundations
storybookTitle: Foundations/Responsive
summary: Mobile-first discipline, five min-width breakpoints, media vs container queries, intrinsic layout, and safe areas
---

Design for the content, not the device. Start from the smallest reasonable screen, let the content decide where it strains, and reach for a fixed breakpoint last. A layout keyed to a few famous device widths breaks the moment someone opens a split view, rotates a foldable, or reads at 200% zoom.

## Mobile first is a discipline, not a phone rule

The small screen first forces the hard question early: what is genuinely essential. What survives is the core; what a wider screen adds is progressive enhancement layered on a base that already works.

1. Base is the floor. Write the small-screen layout with no media query. That is the default every browser gets, and it must stand on its own.
2. Enhance upward. Each `min-width` query only adds: more columns, a sidebar that was stacked. Never subtract from wide to reach narrow.
3. Content sets the line. Add a breakpoint where the layout actually strains, when a line runs long or a card cramps, not where a popular phone happens to end.

## Five breakpoints, each a structural move

The system ships exactly five named tokens, all `min-width` thresholds. Below the first is the base, the no-query mobile layout.

| Token | Min width | Structural role |
| --- | --- | --- |
| `base` | 0 | The default. Single column, thumb-reachable, no media query. Everything enhances this |
| `--breakpoint-sm` | 576px | Large phones. Room for a two-up grid and side-by-side fields |
| `--breakpoint-md` | 769px | Tablets. The first real shift: a stacked shell becomes two panes, nav moves inline |
| `--breakpoint-lg` | 992px | Laptops. Persistent sidebars, three columns, the full desktop chrome |
| `--breakpoint-xl` | 1200px | Wide desktops. Cap line length and center the shell |
| `--breakpoint-2xl` | 1366px | Very wide. Add breathing room and max-widths, not more columns |

Rule: key page-shell breakpoints to the five named `min-width` tokens, and no others. Why: there is no `xs` because the base below `sm` needs no query to name it. A media condition cannot read a custom property, so the query carries the literal value, `@media (min-width: 769px)`, while the token stays the single source of that number.

- ✓ Recommended: one component that strains between two tokens: solve it with fluid sizing or a container query, so the scale stays at five.
- ✕ Avoid: inventing a sixth breakpoint for that one component. It fragments the scale and every reader now has an extra threshold to reason about.

## Media query or container query

A media query asks how wide the viewport is; right for the page shell, wrong for a component. A container query lets an element respond to its own container. Baseline since 2023.

- Media query, viewport level, `@media (min-width: 992px)`: asks about the whole viewport. Right for the page shell: global grid, top nav, where the sidebar lives. Home of capability and preference features: `prefers-color-scheme`, `prefers-reduced-motion`, `pointer`, `hover`. Keyed to the five breakpoint tokens.
- Container query, component level, `@container (min-width: 24rem)`: asks how much space this element was actually given. Right for reusable parts: cards, tiles, widgets. The parent opts in with `container-type`; children size to `cqw` units. The component becomes portable.

Rule: match the query to its scope: a media query against a token for the page shell, a container query for any part that must work in more than one slot. Why: a media query asks how wide the viewport is, which is what the shell responds to. A container query asks how much room an element was actually given.

- ✓ Recommended: for a capability or preference, dark mode, reduced motion, a coarse pointer, reach for a media query.
- ✕ Avoid: reaching for a container query there. A container knows only its own size, never color scheme, motion preference, or pointer type.

## The best breakpoint is the one you never wrote

Between the structural thresholds, layout should flow, not jump. Intrinsic layouts lean on what CSS already does: a grid that fits as many columns as comfortably fit, type and spacing that scale as a range. The result adapts at every width, with far fewer media queries.

- Intrinsic grid, one rule, no media query: `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`. Columns reflow on their own.
- Fluid type: `clamp(1.5rem, 3vw + 1rem, 2.75rem)` grows and shrinks smoothly, held between a floor and a ceiling. Use `clamp()`, `min()`, and `max()` for type, spacing, and measure.

Rule: reach for fluid sizing and an intrinsic grid before you write any breakpoint. Why: an auto-fit grid and clamped type adapt at every width, not just at the five thresholds, and with far fewer queries to keep in sync.

- ✓ Recommended: let the layout flow: `repeat(auto-fit, minmax(160px, 1fr))` for columns, `clamp()` for type and spacing.
- ✕ Avoid: stacking breakpoints to imitate that flow. It steps between thresholds and leaves more queries to maintain.

## Safe areas and notches

On modern phones the screen is not a clean rectangle. Notches, rounded corners, and the home indicator carve in, and a layout drawn to the physical edge can bury a primary action under a system gesture. Honor the insets for anything anchored to a screen edge, and add the inset to your spacing token rather than replacing it. Insets are unlocked by `viewport-fit=cover`; on a device with none, `env()` resolves to zero and spacing is unchanged.

Rule: honor the safe-area insets for anything anchored to a screen edge. Why: notches, rounded corners, and the home indicator carve into the screen, so a control drawn to the physical edge can land under a system gesture.

- ✓ Recommended: add the inset to your token: `calc(var(--space-4) + env(safe-area-inset-bottom))`. Where a device has no insets, `env()` resolves to zero and the spacing is unchanged.
- ✕ Avoid: replacing the token with `env()` alone, or drawing to the physical edge. Where there are no insets the spacing collapses to zero and the control can fall under system chrome.

Thumb-reach and target sizing for anchored controls live in Foundations / Spacing.

## Sources

Mobile-first and progressive enhancement: Wroblewski, Mobile First, and Marcotte, Responsive Web Design. Let content set breakpoints: web.dev responsive basics. Container queries, Baseline since 2023: MDN and web.dev. Intrinsic layouts: Jen Simmons. Fluid sizing and reflow: MDN clamp() and grid auto-fit / minmax. Safe areas: MDN env() and Apple HIG Layout. The five values and reading them as coarse structural ceilings are specific to this system's tokens.
