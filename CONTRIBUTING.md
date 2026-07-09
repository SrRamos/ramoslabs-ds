# Contributing

Thanks for helping build the RamosLabs Design System. This is a documentation-first project:
most contributions are to the doctrine (the Astro docs site) and the tokens, not to shipped
components.

## Run it locally

```bash
bun install
bun run --filter site dev   # docs site (Astro) at localhost:4321
```

Storybook is kept as the component harness for the upcoming `@ramoslabs/vue` library
(`bun run storybook`), but it is no longer the published documentation site.

Useful checks before you open a PR:

```bash
bun run typecheck   # type-check every workspace
bun run build       # turbo build: tokens, the docs site, and Storybook
```

## Branch and PR convention

- Branch off an up-to-date `main`. Use `feature/<slug>`. Never commit to `main` directly.
- Keep PRs small and focused. One logical change per PR so review and merges stay trivial.
- Write a clear PR description: what changed and why.

## House content rules

Every contribution must follow these. They are the point of the system, not decoration.

- **Token-first.** Never hardcode a color, spacing, typography, radius, shadow, or motion value.
  Reference the token (`var(--color-...)`, `var(--space-...)`, and so on). A raw hex or px is a
  defect. Edit tokens as DTCG JSON in `packages/tokens/src/tokens/`; the CSS and TS are generated,
  never edited by hand.
- **WCAG AA floors.** Text contrast at least 4.5:1, large text and UI components at least 3:1.
  Muted text is never lighter than `#64748b` (slate 500) on white. Every interactive element is
  keyboard reachable with a visible focus state. Never carry meaning by color alone.
- **The Framing Rule.** Frame every guideline as `✓ Recommended` and `✕ Avoid`, each with a
  `Rule:` and a `Why:`. Do not restyle this as generic "do and don't" advice.
- **No em-dash or en-dash.** Use a comma, colon, or period. English throughout. State the current
  system as truth, no before/after or "previously" self-history.

## Keep the doctrine and its distilled files in sync

The agentic layer is generated from a distilled copy of each doc page. When you change doctrine
on a page, you must update its distilled file in the same change:

1. Edit the source page in `apps/site/src/pages/**/*.astro`.
2. Update the matching distilled file in `apps/site/agentic/content/**` (same rule, token
   name, hex, ratio, px, or threshold, never invented or dropped).
3. Rebuild: `bun run --filter site build` regenerates `llms.txt`, `llms-full.txt`,
   `registry.json`, and `robots.txt` via the Astro build integration.

A doctrine change that skips step 2 ships an agentic layer that contradicts the site. See
`apps/site/agentic/CONTRACT.md` for the full distillation rules.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
