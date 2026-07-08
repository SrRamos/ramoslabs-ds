---
id: introduction
title: Introduction
group: root
storybookTitle: Introduction
summary: What the RamosLabs DS is, its three-tier taxonomy, naming scheme, and single token source of truth
---

The RamosLabs Design System is a taxonomy book, not a component bundle. One indigo accent, one token contract, and the rules that turn them into a UI library you own.

The whole system in four numbers:

- 213 design tokens
- 3 taxonomy tiers
- AA contrast floor
- 1 accent color

## Three tiers, one direction

- Tier 1, Foundations: the token contract. Color, type, space, radius, shadow, motion. Start here. References primitives.
- Tier 2, Patterns: recipes built from foundations. States, forms, accessibility, voice. References foundations.
- Tier 3, Components: SJ and W UI, built only from patterns and foundations. References patterns and foundations.

The one rule: a tier may reference the tier below, never above. That single constraint keeps the system coherent as it grows.

## The name tells you where it lives

- `SJ` prefix: shared, domain-free UI. `SJButton`, `SJInput`. Built only from tokens and patterns. No business logic.
- `W` prefix: app-specific widget. `WEventCard`, `WCheckoutSummary`. Composes SJ components and holds the domain logic.
- `--token`: the value contract. `var(--color-primary)`, `var(--space-6)`. The only source of color, space, and type. Never a raw hex.

## Authored once, compiled everywhere

The pipeline: `tokens.json` (DTCG) to Style Dictionary to CSS variables plus TypeScript. Change a token once and every surface that references it updates in step. The DTCG JSON is the contract; nothing downstream is edited by hand.

```css
/* app entry, once */
import '@ramoslabs/tokens/css';

/* then build against the contract */
.sj-card {
    background: var(--color-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}
```

## Sources

Built on the W3C Design Tokens spec, Atomic Design, and WCAG 2.1.
