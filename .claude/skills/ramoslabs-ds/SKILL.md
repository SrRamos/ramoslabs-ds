---
name: ramoslabs-ds
description: Build or review UI the RamosLabs Design System way — strictly from the DS's own sources, never inventing tokens, values, rules, or components. Use whenever you write or review CSS, styles, colors, spacing, typography, radius, shadow, motion, components, or UI copy in a project that consumes @ramoslabs/tokens or is asked to follow the RamosLabs DS (design.ramoslabs.com). Triggers: "RamosLabs DS", "@ramoslabs/tokens", "use the design system", "design tokens", "which token", "brand color", building/reviewing any component or screen for a RamosLabs project.
---

# RamosLabs Design System — operating procedure

You are building or reviewing UI that must follow the RamosLabs Design System (RamosLabs DS).
This skill is the procedure. It is **not** the source of truth and it does **not** list token
values — those live in the DS's served sources and in `@ramoslabs/tokens`.

## Prime directive: use only what the DS defines. Never invent.

- Never fabricate a token name, hex, px, ratio, breakpoint, radius, shadow, motion value,
  rule, pattern, or component. Every value and every rule you apply must be traceable to a
  DS source below.
- If something you need is **not** in the sources, do one of: (a) fetch the source that has
  it, (b) reuse an existing token/pattern that fits, or (c) stop and tell the user exactly
  what is missing and ask. Do **not** guess, approximate, or "reasonable-default" it.
- Do not restyle, rename, or paraphrase the DS's rules into your own words. Apply them as
  written.

## Step 1 — Load the authoritative sources (do this before writing UI)

**If the `ramoslabs-ds` MCP server is connected, prefer its tools** — they return structured,
verified data with no interpretation and no invention: `search_tokens`, `get_token`,
`check_contrast`, `list_docs`, `get_doc`, `lint_css`, `get_agents_guide`. Endpoint (Streamable
HTTP, no auth): `https://ramoslabs-ds.edwardramosp.workers.dev/mcp` (or `https://design.ramoslabs.com/mcp`).
If the MCP is not available, use the sources below.

The single source of truth, in priority order:

1. **The token package** — `@ramoslabs/tokens` (public npm). If the project can install it:
   `bun add @ramoslabs/tokens` (or npm/pnpm/yarn), then `@import '@ramoslabs/tokens/css';`
   once at the app entry. Typed values from the package root; the flat name→value map is
   `@ramoslabs/tokens/json`.
2. **The served, machine-readable layer** (fetch when you need specifics or cannot install).
   Base URL `https://design.ramoslabs.com`, files at the root:
   - `/AGENTS.md` — the agent guide (the rules in full).
   - `/llms.txt` — index of every doc page; pick the page you need.
   - `/llms-full.txt` — the whole system inlined + the full token table. Fetch this when you want everything in context.
   - `/registry.json` — structured tokens-by-category + the pattern list.
   - `/tokens.json` — the flat DTCG token map (name → resolved value). Look up the exact token here before you type any value.

   **If a fetch to `design.ramoslabs.com` returns 403 or a bot/challenge page** (the zone's
   bot protection can block server-side fetchers), fall back to the mirror on the Workers
   domain — same files, same paths: `https://ramoslabs-ds.edwardramosp.workers.dev/…`. For
   token values specifically, prefer installing `@ramoslabs/tokens` and reading
   `@ramoslabs/tokens/json`, which never depends on a network fetch.

When you need an exact color/spacing/etc., read it from `tokens.json` (or the installed
package). Do not recall values from memory, and if a source is unreachable, say so and ask —
do not fill the gap with an invented value.

## Step 2 — The hard contract (apply exactly, as written by the DS)

These are the DS's own invariant rules. Enforce them on everything you write:

- **Token-first.** Never hardcode a color, spacing, typography, radius, shadow, or motion
  value. Reference the token (`var(--color-...)`, `var(--space-...)`, and so on). A raw hex
  or px in your CSS is a defect. Tokens are authored as DTCG JSON in
  `packages/tokens/src/tokens/`; the CSS and TS are generated, never edited by hand.
- **Mono-indigo.** Indigo 600 (`#4f46e5`) is the single action accent — the only color that
  signals an interactive or action affordance. Violet is a decorative accent only, never for
  interactive/action affordances. Reach for a role token (`--color-primary`, etc.), never a
  raw hue.
- **WCAG 2.1 AA floors.** Text contrast at least 4.5:1; large text and UI components at least
  3:1. Muted text is never lighter than `#64748b` (slate 500) on white — slate 400 or lighter
  fails and is not allowed for text. Every interactive element is keyboard reachable with a
  visible focus state; never remove the focus outline without an equivalent replacement.
  Never carry meaning by color alone — pair it with text, an icon, or a shape.
- **Naming.** Components use the `SJ` prefix for shared, domain-free UI (`SJButton`,
  `SJInput`); `W` for app-specific widgets (`WEventCard`) that compose `SJ` components. Reuse
  an existing primitive before building a new one.
- **The Framing Rule.** When you document or justify a guideline, frame it as
  `✓ Recommended` and `✕ Avoid`, each with a `Rule:` and a `Why:`. Do not restyle it as
  generic "do / don't" advice.

## Step 3 — Build or review

- **Building:** compose from tokens and the documented patterns. For a pattern (forms,
  modals, tables, mobile-first, interactive states, accessibility, persuasion, voice & tone,
  AI content), read that page from the served docs first and follow it — do not improvise the
  pattern.
- **Reviewing:** flag every raw value that should be a token, every contrast/target/focus
  violation, every use of color-as-only-signal, and any pattern that departs from the
  documented one. Cite the token or rule that applies.

## Step 4 — Self-check before you finish

- No raw hex/px/rgb/hsl for color, spacing, type, radius, shadow, or motion — all via tokens.
- Every token name you used exists in `tokens.json` / the package (verify, don't assume).
- Contrast and target/focus floors met.
- Meaning never carried by color alone.
- You invented nothing: every value and rule traces to a DS source.

## What is NOT shipped yet (do not invent it)

Components are **not** shipped yet. `@ramoslabs/vue` is an empty scaffold; `SJ` components
land in a future release. Until then, build with the tokens and the documented patterns —
do not import or reference `SJ`/`W` components as if they exist, and do not invent a
component API. If the user needs a component, build it from tokens + the relevant pattern
page and name it per the `SJ`/`W` convention.

## License

RamosLabs DS is free to use under the MIT License. Keep the copyright and license notice and
credit RamosLabs. © 2026 RAMOS SOLUTIONS S.A.S. (https://ramoslabs.com).
