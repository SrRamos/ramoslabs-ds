# Contributing

Thanks for helping build the RamosLabs Design System. This is a documentation-first project:
most contributions are to the doctrine (the Storybook book) and the tokens, not to shipped
components.

## Run it locally

```bash
bun install
bun run storybook   # doctrine book at localhost:6006
```

Useful checks before you open a PR:

```bash
bun run typecheck   # type-check every workspace
bun run build       # turbo build: tokens, then the vue lib
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

The agentic layer is generated from a distilled copy of each book page. When you change doctrine
in a Storybook MDX page, you must update its distilled file and regenerate the artifacts:

1. Edit the source MDX in `apps/storybook`.
2. Update the matching distilled file in `apps/storybook/agentic/content/**` (same rule, token
   name, hex, ratio, px, or threshold, never invented or dropped).
3. Regenerate:

   ```bash
   bun run --filter storybook agentic:build
   ```

A doctrine change that skips step 2 or 3 ships an agentic layer that contradicts the book. See
`apps/storybook/agentic/CONTRACT.md` for the full distillation rules.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
