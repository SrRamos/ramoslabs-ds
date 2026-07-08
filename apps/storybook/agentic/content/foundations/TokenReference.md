---
id: token-reference
title: Token Reference
group: foundations
storybookTitle: Foundations/Token Reference
summary: How the 213 tokens are named, the two-tier primitive and semantic model, categories, and how to consume and author them
---

A token is the smallest unit of the language: one color, one step of space, one shadow, authored as data and published to CSS and TypeScript from a single source. There are 213 tokens across 2 tiers, 8 radius steps, and 3 elevation shadows.

The exhaustive table of every token name and value is auto-generated from `tokens.json` into `llms-full.txt`. This page distills the naming, categories, and consumption rules that govern that table.

## Tokens as a contract

Every token is authored as data, not CSS, in the W3C Design Tokens Community Group (DTCG) format: a JSON object with a reserved `$value` and a `$type` like `color` or `dimension`. One authored decision publishes to CSS, TypeScript, and native from the same source. The JSON is the contract. It runs in two tiers.

- Tier 1, Primitive: the raw palette. Eight color ramps of eleven shades each, plus pure white and black. These carry a value and nothing else, no role, no meaning. Product code rarely touches this tier directly. Naming is descriptive: `--color-indigo-600`.
- Tier 2, Semantic: the layer you build with. Each token names a role, not a hue, and aliases a primitive: `--color-primary`, `--color-text-body`, `--color-border`. This indirection makes the system themeable. Change one alias, and every consumer moves with it. Naming is intentional: role first, variant second.

Pipeline: hand-authored DTCG JSON under `packages/tokens/src/tokens/` (one file per category) to Style Dictionary (resolves aliases, applies transforms, formats each target) to generated `dist/tokens.css` (`:root` custom properties) and `dist/tokens.ts` (typed constants). Both carry a do-not-edit banner: they are build output, not source.

## Categories

- Primitive palette: eight ramps, `--color-indigo-*`, `--color-slate-*`, `--color-emerald-*`, `--color-green-*`, `--color-amber-*`, `--color-red-*`, `--color-blue-*`, `--color-violet-*`, each 50 through 950, plus `--color-white` and `--color-black`. Indigo is the brand ramp and single accent; slate carries text, surfaces, and borders; the four status ramps feed the feedback tokens; violet backs the secondary role.
- Semantic color: brand (`--color-primary*`, `--color-secondary*`), text (`--color-text-heading`, `-strong`, `-secondary`, `-body`, `-muted`, `-disabled`), surface and border (`--color-surface*`, `--color-background`, `--color-border*`, `--color-focus`), and feedback (`--color-success*`, `--color-warning*`, `--color-error*`, `--color-info*`, each with the strong/surface/border/text variants).
- Spacing: `--space-*`, one scale for margin, padding, and gap.
- Border radius: `--radius-*`, eight steps. `sm` at 6px is the signature control radius; `pill` is the fully rounded accent.
- Shadow: three elevation levels plus `--shadow-focus`. Each level is two soft, indigo-tinted layers. Shadow means height, never state.
- State layers: `--state-*`, interaction feedback as opacity, not elevation.
- Typography: `--font-family-*` (three families), `--font-weight-*` (eight weights), `--font-size-*` (ten steps), `--leading-*` (line height), `--tracking-*` (letter spacing).
- Motion: `--duration-*` (three) and `--easing-*` (five curves).
- Z-index: `--z-*`, a stepped stacking order.
- Breakpoints: `--breakpoint-*`, five minimum widths.

Borders are dividers, not control outlines. Rule: use `--color-border` and `--color-border-light` only to separate regions (dividers, table rows, card edges). Why: both sit near 1.2:1 against the surface, below the 3:1 floor WCAG 1.4.11 requires for the boundary of an interactive control. For the visible edge of an input, select, or checkbox, reach for a token that clears 3:1, for example `--color-text-muted` at `#64748b`, which is 4.55:1 on white. Never let a subtle border be the only thing marking a control's bounds.

State layers are opacity: each `--state-*` token is the opacity of an indigo overlay painted on a control. Numbers only, so the same layer works on any surface color. `--state-hover` 0.08 (gate with `@media (hover: hover)`), `--state-focus` 0.1 (focus-visible), `--state-pressed` 0.1 (active press, primary feedback on touch), `--state-dragged` 0.16.

## How to consume a token

Reference the variable, never the literal. Reach for the semantic tier first, because it carries the meaning and stays stable across themes. Drop to a primitive only when no semantic token fits. If you find yourself wanting a raw hex, that is the signal a semantic token is missing, not that you should hardcode.

```css
/* Yes: reference the semantic token */
.card {
    background: var(--color-surface);
    color: var(--color-text-body);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

/* No: a hardcoded value drifts from the system on the next theme change */
.card {
    background: #ffffff;
    border-radius: 12px;
}
```

## How to name a new token

1. Pick the tier. A raw value with no role belongs in primitive, named by description. A value that carries meaning belongs in semantic, named by role.
2. Name a semantic token role first, variant second: category, role, variant. So `color`, `text`, `secondary` becomes `--color-text-secondary`. Never encode the hue in the name.
3. Alias, do not copy. A semantic token points at a primitive with `{color.slate.600}`, so the value has one home. If two tokens share a value, both alias the same primitive.
4. Add a `$description` when the role is not obvious from the name. It becomes the comment in the generated CSS and the note in this reference.

## How a change propagates

A change starts in the JSON and ends on the screen without a single manual edit downstream. Edit the `$value` in `packages/tokens/src/tokens/`, run the Style Dictionary build, and the generated `tokens.css` and `tokens.ts` update together. Because every consumer references the variable, the new value reaches every product surface at once. Never edit the generated files: they carry a do-not-edit banner and the next build overwrites them.

- ✓ Recommended: consume `var(--token)` references and prefer the semantic tier; author new tokens in the JSON source, then rebuild; name semantic tokens by role, category first, hue never; alias a primitive instead of repeating a hex; add a `$description` for any non-obvious role.
- ✕ Avoid: hardcoding a hex, px, or raw integer that a token already covers; editing `dist/tokens.css` or `dist/tokens.ts` by hand; reaching for a primitive when a semantic token fits; encoding a color name into a semantic token; duplicating a value across tokens instead of aliasing.

## Sources

Design Tokens Community Group format specification: the open W3C standard defining a token as a JSON object with `$value` and `$type` and the alias syntax the semantic tier relies on. Style Dictionary: the build tool that reads the token source, resolves aliases, and formats the CSS and TypeScript outputs. Salesforce primitive and semantic token tiers: the two-tier model. Every token name, value, and description is quoted from this system's source JSON and generated CSS. The elevation ceiling and the pill-as-accent-only rule are house rules.
