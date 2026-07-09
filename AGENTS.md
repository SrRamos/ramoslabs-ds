# RamosLabs Design System, agent guide

You are an AI coding agent building UI in a repo that consumes this design system.
Read this before you write components, choose colors, or set spacing. It tells you what
the system is, how to install it, and the rules your output must satisfy.

## What this is

RamosLabs DS is a mono-indigo, taxonomy-first design system. Tokens are the single source
of truth. Color, spacing, typography, radius, shadow, and motion are defined once as
design tokens and compiled to CSS variables and TypeScript. The brand primary is Indigo
600 (`#4f46e5`); the action accent is the primary. Violet is a decorative accent only, never used for interactive or action affordances.

The system ships two things today:

- `@ramoslabs/tokens`: the token package (CSS variables, TypeScript values, and flat JSON).
- Documentation: foundations (color, type, spacing, radius, shadow, motion, responsive)
  and patterns (interactive, accessibility, forms, tables, modals, mobile-first,
  persuasion, voice and tone, AI content).

Components are not shipped yet. They land in the `@ramoslabs/vue` package under the `SJ`
prefix in a future release. Until then, build with the tokens and the documented patterns.

## Consume tokens

`@ramoslabs/tokens` is published to npm under the public `@ramoslabs` scope. Install it with
`bun add @ramoslabs/tokens` (or npm / pnpm / yarn). If you cannot install it, get the token
names and values one of two ways:

- Read the served flat map from the deployed site: `WebFetch ${SITE_URL}/tokens.json` (names to
  resolved values), or `${SITE_URL}/tokens.css` for the CSS variable declarations.
- Or build the package from source in the monorepo: `bun run --filter @ramoslabs/tokens build`,
  which emits `dist/tokens.css`, `dist/tokens.ts`, and `dist/tokens.json`.

Import the CSS variables once at your app entry, then reference them everywhere:

```css
@import '@ramoslabs/tokens/css';

.card {
  padding: var(--space-4);
  color: var(--color-slate-900);
  background: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
```

Typed values are available from the package root when you need them in TS:

```ts
import { colorIndigo600 } from '@ramoslabs/tokens'
```

The flat token map (name to resolved value) is `@ramoslabs/tokens/json`.

### The one hard rule

Never hardcode a color, spacing, typography, radius, shadow, or motion value. Always read
the token (`var(--color-...)`, `var(--space-...)`, and so on). A raw hex or px in your CSS
is a defect. The JSON source is authoritative; the CSS and TS are always generated from it.

## Component convention

Components use the `SJ` prefix (for example `SJButton`, `SJInput`, `SJState`). When the
Vue library ships, import from `@ramoslabs/vue` and reuse an existing `SJ` component before
you build a new one. Do not reinvent a primitive the system already owns.

## The Framing Rule

The docs frame every guideline as `✓ Recommended` and `✕ Avoid`, each with a `Rule:` and a
`Why:`. Keep that framing when you reason about a choice: state the rule, state the reason,
then apply it. Do not restyle it as generic "do and don't" advice.

## Accessibility floors, WCAG 2.1 AA minimum

- Text contrast at least 4.5:1. Large text and UI components at least 3:1.
- Muted text has a floor: never lighter than `#64748b` (slate 500) on white. Slate 400 or
  lighter fails on white and is not allowed for text.
- Every interactive element is keyboard reachable, with a visible focus state. Never remove
  the focus outline without an equivalent replacement.
- Never carry meaning by color alone. Pair it with text, an icon, or a shape.

## Machine-readable sources, and how to fetch them

The deployed site (`https://design.ramoslabs.com`) serves:

- `/llms.txt`: concise index of every page with its live docs URL.
- `/llms-full.txt`: one self-contained document. Every page inlined plus the full token
  table. Fetch this first when you need the whole system in context.
- `/registry.json`: machine-readable registry. Token totals by category, the pattern list
  with URLs, and a components array (empty until the Vue library ships).
- `/tokens.json`: the flat DTCG token map.

To pull the system into your working context, `WebFetch` the URL and read it:

```
WebFetch https://design.ramoslabs.com/llms-full.txt
WebFetch https://design.ramoslabs.com/registry.json
```

Start with `llms.txt` to find the right page, or `llms-full.txt` when you want everything.
Use `registry.json` when you need structured token or pattern data rather than prose.

## License and attribution

RamosLabs Design System is free to use under the MIT License. Use, copy, modify, and
distribute it, including commercially. Keep the copyright and license notice, and credit
RamosLabs.

© 2026 RAMOS SOLUTIONS S.A.S. RamosLabs is a product of RAMOS SOLUTIONS S.A.S.
Website: https://ramoslabs.com. The `registry.json` `license`, `copyright`, and
`attribution` fields carry these terms in machine-readable form.
