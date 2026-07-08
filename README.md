# RamosLabs Design System

A standalone, framework-first design system. Tokens are the single source of truth:
they live as DTCG JSON in `@ramoslabs/tokens` and are compiled to CSS variables and
TypeScript. Nothing hardcodes a color, spacing, radius, or shadow value; everything
reads from the generated tokens.

## Stack

- Bun workspaces plus Turborepo for the monorepo.
- Style Dictionary v5 for token compilation (strict DTCG: `$value` and `$type`).
- Storybook 10 with the Vue 3 Vite framework for documentation.
- TypeScript, Node 22.

## Layout

```
packages/
  tokens/   @ramoslabs/tokens   DTCG JSON source, compiled to CSS + TS + JSON
  vue/      @ramoslabs/vue       Vue 3 component library (SJ prefix), empty scaffold in F0
apps/
  storybook/                     Design system documentation
```

## Brand

Mono-indigo. The primary is Indigo 600 (`#4f46e5`); it is the single action accent.
Violet is a decorative accent only, never for interactive or action affordances.

## Commands

```bash
bun install              # install every workspace
bun run build            # turbo build: compiles tokens, then the vue lib
bun run typecheck        # type-check every workspace
bun run storybook        # start Storybook at localhost:6006
bun run build-storybook  # build the static Storybook

# Just the tokens:
bun run --filter @ramoslabs/tokens build
```

## How tokens flow

1. Edit the DTCG JSON in `packages/tokens/src/tokens/`.
2. Run the tokens build. Style Dictionary generates `dist/tokens.css`,
   `dist/tokens.ts`, and `dist/tokens.json`.
3. Consumers import `@ramoslabs/tokens/css` (variables) or the typed values from
   `@ramoslabs/tokens`.

The JSON is the source. The CSS and TS are always generated, never edited by hand.

## License

RamosLabs Design System is free to use under the [MIT License](./LICENSE): use, copy,
modify, and distribute it, including commercially. The one condition is attribution, keep
the copyright and license notice in copies, and credit RamosLabs.

© 2026 RAMOS SOLUTIONS S.A.S. RamosLabs is a product of RAMOS SOLUTIONS S.A.S.
Website: [ramoslabs.com](https://ramoslabs.com).
