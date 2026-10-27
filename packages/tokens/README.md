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
  padding: var(--space-6);
  color: var(--color-text-body);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
```

In a bundler entry (Vite, etc.) the same file can be imported from JavaScript:
`import '@ramoslabs/tokens/css'`. Without npm, link the served copy:
`<link rel="stylesheet" href="https://design.ramoslabs.com/tokens.css">`.

Typed values for TypeScript:

```ts
import { colorPrimary } from '@ramoslabs/tokens'
```

The flat token map (name to resolved value) is available at `@ramoslabs/tokens/json`.

## The one rule

Never hardcode a color, spacing, typography, radius, shadow, or motion value. Always read the
token. Indigo 600 (`#4f46e5`) is the single action accent; violet is a decorative accent only.

## For AI assistants and agents

Build with exact values, never invented ones:

- [`llms.txt`](https://design.ramoslabs.com/llms.txt) index and [`llms-full.txt`](https://design.ramoslabs.com/llms-full.txt) full reference.
- MCP server (read-only, no auth): `https://design.ramoslabs.com/mcp`, tools `search_tokens`,
  `get_token`, `check_contrast`, `list_docs`, `get_doc`, `lint_css`, `get_agents_guide`.
  Claude Code: `claude mcp add --transport http ramoslabs-ds https://ramoslabs-ds.edwardramosp.workers.dev/mcp`
- Agent skill: [`skill.md`](https://design.ramoslabs.com/skill.md).
- Direct answers: [muted text token](https://design.ramoslabs.com/answers/muted-text-token/),
  [indigo WCAG contrast](https://design.ramoslabs.com/answers/indigo-contrast-wcag/),
  [install in Vue, React, HTML](https://design.ramoslabs.com/answers/install-tokens-vue-react-html/).

Docs: https://design.ramoslabs.com. Source: https://github.com/SrRamos/ramoslabs-ds.

## Entry points

- `@ramoslabs/tokens` typed values (ES module + declarations).
- `@ramoslabs/tokens/css` the CSS custom properties.
- `@ramoslabs/tokens/json` the flat DTCG token map as JSON.

## License

MIT. (c) 2026 RAMOS SOLUTIONS S.A.S. See [LICENSE](./LICENSE).
