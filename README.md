# RamosLabs Design System

A mono-indigo, taxonomy-first design system that ships the decisions, not a bundle you import.

[![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg)](./LICENSE)
[![Built with Storybook](https://img.shields.io/badge/docs-Storybook_10-ff4785.svg)](https://storybook.js.org/)
[![Tokens: Style Dictionary](https://img.shields.io/badge/tokens-Style_Dictionary_v5-0b0d0e.svg)](https://styledictionary.com/)

## What this is

RamosLabs DS is documentation-first. It is a guide and a doctrine for building a solid design
system the RamosLabs way, not a component library you install and forget. The thesis: it ships
the decisions. You get a UI system you own, not a black-box dependency you pull in.

Tokens are the single source of truth. Color, spacing, typography, radius, shadow, and motion
are defined once as design tokens and compiled to CSS variables and TypeScript. Nothing
hardcodes a value; everything reads from the generated tokens.

The brand is mono-indigo. Indigo 600 (`#4f46e5`) is the single action accent. Violet is a
decorative accent only, never used for interactive or action affordances.

## The agentic layer

The build generates a machine-readable layer so AI coding agents can consume the whole system
over HTTP. The documentation site serves:

- `llms.txt`: a concise index of every page with its live docs URL.
- `llms-full.txt`: one self-contained document with every page inlined plus the full token
  table. Fetch this when you want the entire system in context.
- `registry.json`: a structured registry. Token totals by category, the pattern list with URLs,
  and a components array (empty until the Vue library ships).
- `AGENTS.md`: onboarding for an agent that builds UI consuming this design system.

An agent pulls the system into context with a single `WebFetch` against these URLs. See
[`AGENTS.md`](./AGENTS.md) for the full agent workflow.

## What is inside

```
packages/
  tokens/   @ramoslabs/tokens   DTCG JSON source, compiled to CSS + TS + JSON
  vue/      @ramoslabs/vue       Vue 3 component library (SJ prefix), scaffold only
apps/
  storybook/                     The doctrine book + the agentic layer generator
```

The Storybook book holds the doctrine: foundation pages (color, type, spacing, radius, shadow,
motion, responsive, helpers, and a token reference) plus an introduction, and nine pattern pages
(interactive, accessibility, forms, tables, modals, mobile-first, persuasion, voice and tone, and
AI content).

`@ramoslabs/vue` is an empty scaffold today. SJ components are planned for a future release, not
shipped. Build with the tokens and the documented patterns until then.

## Stack

- Bun workspaces plus Turborepo for the monorepo.
- Style Dictionary v5 for token compilation (strict DTCG: `$value` and `$type`).
- Storybook 10 with the Vue 3 Vite framework for the documentation.
- TypeScript, Node 22.

## Getting started

```bash
git clone https://github.com/SrRamos/ramoslabs-ds.git
cd ramoslabs-ds
bun install

bun run storybook        # start the doctrine book at localhost:6006
bun run build-storybook  # build the static site
bun run typecheck        # type-check every workspace
bun run build            # turbo build: compiles tokens, then the vue lib
```

Tokens only:

```bash
bun run --filter @ramoslabs/tokens build
```

## Using the design tokens

`@ramoslabs/tokens` is a real workspace package, but its `dist/` output is generated and
git-ignored, and the package is not yet published to npm. `bun add @ramoslabs/tokens` does not
work for an external consumer today. Until it is published, you consume tokens one of two ways:

1. Build from source in this monorepo (`bun run --filter @ramoslabs/tokens build`), which
   produces `dist/tokens.css`, `dist/tokens.ts`, and `dist/tokens.json`.
2. Read the token names and values from the served `tokens.json` (or `tokens.css`) that the
   documentation site publishes.

Once the package is available in your project, import the CSS variables once at your app entry,
then reference them everywhere:

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

Typed values are available from the package root for TypeScript, and the flat token map is
`@ramoslabs/tokens/json`.

The one hard rule: never hardcode a color, spacing, typography, radius, shadow, or motion value.
Always read the token (`var(--color-...)`, `var(--space-...)`, and so on). A raw hex or px in
your CSS is a defect.

## How tokens flow

1. Edit the DTCG JSON in `packages/tokens/src/tokens/`.
2. Run the tokens build. Style Dictionary generates `dist/tokens.css`, `dist/tokens.ts`, and
   `dist/tokens.json`.
3. Consumers read `@ramoslabs/tokens/css` (variables) or the typed values from
   `@ramoslabs/tokens`.

The JSON is the source. The CSS and TS are always generated, never edited by hand.

## Roadmap

These are planned, not commitments with dates:

- Publish `@ramoslabs/tokens` to npm so consumers can install it directly.
- Ship SJ components in `@ramoslabs/vue`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, the branch and PR convention, and the
house content rules (token-first, WCAG AA floors, the Framing Rule, and the doctrine sync step).

## License

RamosLabs Design System is free to use under the [MIT License](./LICENSE): use, copy, modify, and
distribute it, including commercially. The one condition is attribution: keep the copyright and
license notice in copies, and credit RamosLabs.

## Credits

(c) 2026 RAMOS SOLUTIONS S.A.S. RamosLabs is a product of RAMOS SOLUTIONS S.A.S.
Website: [ramoslabs.com](https://ramoslabs.com).
