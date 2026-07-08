# @ramoslabs/tokens

Design tokens for the [RamosLabs Design System](https://ramoslabs.com). A mono-indigo,
token-first system: color, spacing, typography, radius, shadow, and motion are defined once
as DTCG JSON and compiled to CSS variables, typed values, and a flat JSON map.

## Install

```bash
npm install @ramoslabs/tokens   # or bun / pnpm / yarn
```

## Use

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

Typed values for TypeScript:

```ts
import { colorPrimary } from '@ramoslabs/tokens'
```

The flat token map (name to resolved value) is available at `@ramoslabs/tokens/json`.

## The one rule

Never hardcode a color, spacing, typography, radius, shadow, or motion value. Always read the
token. Indigo 600 (`#4f46e5`) is the single action accent; violet is a decorative accent only.

## Entry points

- `@ramoslabs/tokens` typed values (ES module + declarations).
- `@ramoslabs/tokens/css` the CSS custom properties.
- `@ramoslabs/tokens/json` the flat DTCG token map as JSON.

## License

MIT. (c) 2026 RAMOS SOLUTIONS S.A.S. See [LICENSE](./LICENSE).
