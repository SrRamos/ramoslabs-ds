# Content sources: answer pages

Evidence ledger for the four pages under `/answers/` (plus the `/answers/` index, which only
repeats their short answers). Rule for this branch: nothing is published without studies,
measured data, or reliable external references. Every factual statement on these pages carries a
`{ref:id}` marker in `apps/site/src/data/answers/*.json`; the build fails if a marker has no
reference or a reference is never cited. This file is generated from those JSON files, so it
cannot drift from the pages. It is the input for the `ds-fable` audit before anything is published.

Reference kinds:

- **external**: a third-party primary source (W3C, MDN, Node.js, Vite, Vue, React, Tailwind, Material
  repositories, the npm registry). Date is the source's own date or version; "accessed" is the day it
  was read for this review.
- **ds**: this repository, pinned to commit `71b8bac` (2026-09-21), so the cited text cannot change
  under the page. DS token values come from `packages/tokens`, never from memory.
- **measured**: something run and recorded on 2026-10-27. Contrast ratios come from the script that
  is printed on the pages (WCAG 2.2 formulas applied to the token values); the Vite test built a
  throwaway project against the published `@ramoslabs/tokens@0.1.0`.

## Verdict on the Material Web/Tailwind comparison

Kept, cut down, and re-scoped after audit round 1 (`AUDIT-content.md`, MUST-1): the page is about
Material Web (`@material/web`) only, says so in its title, summary and first paragraph, and dates the
"maintenance mode" quote (README wording as of 2026-10-27). The original draft made claims no official source in hand supports (licenses,
accessibility quality, AI tooling, "best fit", "when to choose"). Those are removed. What remains is a
table in which every cell cites a primary source, and the page states what it did not compare. The
Material column rests on the Material Web and Material Color Utilities repositories, because
`m3.material.io` is client-rendered and could not be read; no claim is made from the Material 3 spec site.
If `ds-fable` judges the Material column too thin, the page should be removed, not widened.

## What was removed from the first drafts (unsupported)

- Per-token "when to use" wording for strong, secondary and muted text (inferred, not in a source).
- "The DS sets WCAG 2.1 AA as its minimum": the current `AGENTS.md` says 2.2 AA; reworded.
- Material/Tailwind license rows, accessibility, bundle size, popularity, AI tooling rows.
- "Best fit", "When to choose each", "Where RamosLabs is not the right choice" (opinion, not data).
- "Tailwind default palette classes do not read tokens unless mapped" and "Material 3 color roles are
  typically generated from a source color" (replaced by the sourced wording from their own docs).
- "Tailwind arbitrary properties accept `var()` values" and the `[background:var(--color-surface)]`
  markup sample (audit SHOULD-1): Tailwind's page says "completely arbitrary CSS"; no Tailwind build was
  measured, so the sample is gone and the pages say so.
- Framework claims the DS Installation page makes for Svelte and Astro (not tested here).

## Correction made to existing DS content

`apps/site/agentic/content/foundations/Colors.md` published the body-text ratio as 10.36. Computing it with
the WCAG formula gives 10.3547, which rounds to 10.35. Corrected in that file (two places). The other
ratios used on these pages (17.85, 14.63, 7.58, 4.76, 6.29, 7.90, 5.62, 1.99, 1.48, 2.84, 2.56) match.

## Changes from audit round 1

- MUST-1: comparison page retitled "Material Web" (title, summary, `pages.ts`, nav), scope sentence added,
  maintenance-mode quote dated 2026-10-27. Slug unchanged.
- SHOULD-1: Tailwind arbitrary-property wording follows the cited page; unmeasured markup sample removed
  from the comparison and install pages.
- SHOULD-3: indigo page retitled "Does RamosLabs indigo (#4f46e5) meet WCAG contrast requirements?".
- SHOULD-4: `ds-install` and `ds-colors` now link the pinned source files at commit `71b8bac`.
- SHOULD-5: the Vite test is committed at `docs/distribution/measurements/vite-tokens/` and its three
  commands are printed on the install page.
- Not applied here (not requested): SHOULD-2 (`tw-home` for "utility-first"), NICE-1 to NICE-3.

## Known limits for the auditor

1. Vite's statement about injecting CSS through a style tag is from docs v8.3.4; the build test used 8.3.5.
2. The Vue, React, Material and Tailwind pages are undated or carry only a version; "accessed 2026-10-27"
   is the only date available for them.
3. SC 1.4.11 says nothing normative about focus rings; the page leans on the informative "Relationship
   with Focus Visible" text and on the 3:1 rule for UI components and states.
4. The two self-references (`#reproduce-the-numbers`) point at pages that return 404 until this branch is
   deployed, and the `measured-vite` link (`blob/main/docs/distribution/measurements/vite-tokens/`) 404s
   until this branch is merged to `main`. All other external URLs returned 200 on 2026-10-27.
5. No visual QA of the rendered pages in a browser was done. Build, JSON-LD parsing, marker/reference
   consistency, and link status were checked.

## Claims table

### Which token should I use for muted text?

`/answers/muted-text-token/`

| Page | Claim | Source | Source date |
|---|---|---|---|
| /answers/muted-text-token/ · Short answer | Use `--color-text-muted` (#64748b) for muted text on white. It measures 4.76:1 against `--color-surface` (#ffffff), above the 4.5:1 that WCAG requires for normal text. On the pale indigo `--color-primary-surface` it measures 4.26:1 and falls below that minimum, so use `--color-text-secondary` there. | [ds-tokens]; [measured]; [sc143] | 2026-09-21; 2026-10-27; updated 2026-09-06 |
| /answers/muted-text-token/ · Measured contrast of the six text roles | The six text roles are neutral slate tokens. The table gives each one measured against white (`--color-surface`). The last column states whether the ratio reaches the 4.5:1 minimum for normal text. The DS presents the first five as one neutral-hue text scale and `--color-text-disabled` as state only. | [ds-tokens]; [sc143]; [ds-colors] | 2026-09-21; updated 2026-09-06; 2026-09-21 |
| /answers/muted-text-token/ · Measured contrast of the six text roles (table) | `--color-text-heading` / #0f172a / 17.85:1 / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Measured contrast of the six text roles (table) | `--color-text-strong` / #1e293b / 14.63:1 / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Measured contrast of the six text roles (table) | `--color-text-body` / #334155 / 10.35:1 / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Measured contrast of the six text roles (table) | `--color-text-secondary` / #475569 / 7.58:1 / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Measured contrast of the six text roles (table) | `--color-text-muted` / #64748b / 4.76:1 / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Measured contrast of the six text roles (table) | `--color-text-disabled` / #cbd5e1 / 1.48:1 / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Where muted text stops working | Muted text clears the minimum on white and on the light gray surface, with a thin margin on the gray. It does not clear it on the indigo tint. | [measured]; [sc143] | 2026-10-27; updated 2026-09-06 |
| /answers/muted-text-token/ · Where muted text stops working (table) | `--color-surface` / #ffffff / 4.76:1 / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Where muted text stops working (table) | `--color-surface-secondary` / #f8fafc / 4.55:1 / Yes, barely | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · Where muted text stops working (table) | `--color-primary-surface` / #eef2ff / 4.26:1 / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/muted-text-token/ · The DS floor for muted text | Rule: muted text is never lighter than #64748b (slate 500) on white. Why: lighter slate values fall below 4.5:1; slate 400 (#94a3b8) measures 2.56:1 on white, below the 4.5:1 minimum. | [ds-agents]; [measured]; [sc143] | 2026-09-21; 2026-10-27; updated 2026-09-06 |
| /answers/muted-text-token/ · The DS floor for muted text | On `--color-primary-surface` use `--color-text-secondary` (#475569): it measures 6.78:1 there. | [measured] | 2026-10-27 |
| /answers/muted-text-token/ · Copyable CSS | Import the tokens once at the app entry, then reference the role token. Never hardcode the hex. | [ds-agents] | 2026-09-21 |
| /answers/muted-text-token/ · Reproduce the numbers | The ratios on this page come from the script below, which applies the WCAG relative-luminance and contrast-ratio definitions to the published token values. Run it in a project that has `@ramoslabs/tokens` installed; it prints 4.76 and 6.29. | [wcag22] | W3C Recommendation, 2024-12-12 |
| /answers/muted-text-token/ · FAQ | Which token should I use for muted text on a white background? Use `--color-text-muted` (#64748b). It measures 4.76:1 on white, above the 4.5:1 minimum for normal text. | [ds-tokens]; [measured]; [sc143] | 2026-09-21; 2026-10-27; updated 2026-09-06 |
| /answers/muted-text-token/ · FAQ | Can I use a lighter gray for muted text? Not on white under the DS rule: muted text is never lighter than #64748b. Slate 400 (#94a3b8) measures 2.56:1 on white, below 4.5:1. | [ds-agents]; [measured]; [sc143] | 2026-09-21; 2026-10-27; updated 2026-09-06 |
| /answers/muted-text-token/ · FAQ | What should I use for muted text on an indigo tinted background? Use `--color-text-secondary` (#475569). `--color-text-muted` measures 4.26:1 on `--color-primary-surface` (#eef2ff), below 4.5:1, while secondary text measures 6.78:1 there. | [measured] | 2026-10-27 |
| /answers/muted-text-token/ · FAQ | Is --color-text-disabled a good choice for less important text? No. It measures 1.48:1 on white and the DS reserves it for the disabled state, not readable text. | [measured]; [ds-colors] | 2026-10-27; 2026-09-21 |
| /answers/muted-text-token/ · FAQ | Does muted text pass on the light gray surface? Yes, with a thin margin: 4.55:1 on `--color-surface-secondary` (#f8fafc), against a 4.5:1 minimum. | [measured]; [sc143] | 2026-10-27; updated 2026-09-06 |
| /answers/muted-text-token/ · FAQ | Should I hardcode the muted gray value? No. Reference `var(--color-text-muted)` after importing `@ramoslabs/tokens/css` once; a raw hex in CSS is a defect under the DS rules. | [ds-agents] | 2026-09-21 |

### Does RamosLabs indigo (#4f46e5) meet WCAG contrast requirements?

`/answers/indigo-contrast-wcag/`

| Page | Claim | Source | Source date |
|---|---|---|---|
| /answers/indigo-contrast-wcag/ · Short answer | Yes for AA. `--color-primary` (#4f46e5) measures 6.29:1 on white: above the 4.5:1 minimum for normal text and the 3:1 minimum for UI components, and below the 7:1 of the Enhanced level. White text on `--color-primary-dark` (#4338ca) measures 7.90:1, which clears 7:1. | [ds-tokens]; [measured]; [sc143]; [sc1411]; [sc146] | 2026-09-21; 2026-10-27; updated 2026-09-06; updated 2026-09-06; updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · What WCAG asks for | The thresholds below are the ones used on this page. Large-scale text means at least 18 point, or 14 point bold. | [sc143] | updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · What WCAG asks for (table) | SC 1.4.3 Contrast (Minimum) / AA / 4.5:1 for text; 3:1 for large-scale text | [sc143] | updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · What WCAG asks for (table) | SC 1.4.6 Contrast (Enhanced) / AAA / 7:1 for text; 4.5:1 for large-scale text | [sc146] | updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · What WCAG asks for (table) | SC 1.4.11 Non-text Contrast / AA / 3:1 for UI components and states against adjacent colors | [sc1411] | updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings | Values from the source tokens; ratios computed with the script in the last section. | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings (table) | `--color-primary` #4f46e5 / `--color-surface` #ffffff / 6.29:1 / Yes / Yes / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings (table) | `--color-surface` #ffffff (button label) / `--color-primary` #4f46e5 / 6.29:1 / Yes / Yes / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings (table) | `--color-surface` #ffffff (button label) / `--color-primary-dark` #4338ca / 7.90:1 / Yes / Yes / Yes | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings (table) | `--color-primary` #4f46e5 / `--color-primary-surface` #eef2ff / 5.62:1 / Yes / Yes / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings (table) | `--color-indigo-300` #a5b4fc / `--color-surface` #ffffff / 1.99:1 / No / No / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · Measured indigo pairings (table) | `--color-primary` #4f46e5 / `--color-text-heading` #0f172a / 2.84:1 / No / No / No | [ds-tokens]; [measured] | 2026-09-21; 2026-10-27 |
| /answers/indigo-contrast-wcag/ · A primary button with a visible focus ring | `--shadow-focus` is a 2px white gap followed by a ring in #4f46e5. Against the white gap and the page the ring measures 6.29:1, above the 3:1 asked of UI components. The DS rule is to never remove the focus outline without an equivalent replacement. | [ds-tokens]; [measured]; [sc1411]; [ds-agents] | 2026-09-21; 2026-10-27; updated 2026-09-06; 2026-09-21 |
| /answers/indigo-contrast-wcag/ · Verify a pair with the MCP check_contrast tool | The DS MCP server exposes `check_contrast` among seven read-only tools, over Streamable HTTP with no authentication, at `https://design.ramoslabs.com/mcp`. Call it with a foreground and a background and read the verdicts it returns. | [ds-mcp] | 2026-09-21 |
| /answers/indigo-contrast-wcag/ · Reproduce the numbers | The ratios on this page come from the script below, which applies the WCAG definitions of relative luminance and contrast ratio to the published token values. Run it in a project that has `@ramoslabs/tokens` installed. | [wcag22] | W3C Recommendation, 2024-12-12 |
| /answers/indigo-contrast-wcag/ · FAQ | Is #4f46e5 accessible on a white background? For AA, yes: it measures 6.29:1, above 4.5:1 for text and 3:1 for UI components. It is below the 7:1 of AAA for text. | [measured]; [sc143]; [sc1411]; [sc146] | 2026-10-27; updated 2026-09-06; updated 2026-09-06; updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · FAQ | Can I use indigo 300 for text on white? No. `--color-indigo-300` (#a5b4fc) measures 1.99:1 on white, below both 4.5:1 and 3:1. | [measured]; [sc143]; [sc1411] | 2026-10-27; updated 2026-09-06; updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · FAQ | Which indigo should I use when AAA is required? Use `--color-primary-dark` (#4338ca): white text on it measures 7.90:1, which reaches 7:1. | [ds-tokens]; [measured]; [sc146] | 2026-09-21; 2026-10-27; updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · FAQ | Can I put white text on the primary button? Yes. White on `--color-primary` measures 6.29:1, which meets AA for text. | [measured]; [sc143] | 2026-10-27; updated 2026-09-06 |
| /answers/indigo-contrast-wcag/ · FAQ | Does the primary indigo have enough contrast for a focus ring? Yes by the numbers: 6.29:1 against white, above the 3:1 asked of UI components. The DS focus ring uses it. | [measured]; [sc1411]; [ds-tokens] | 2026-10-27; updated 2026-09-06; 2026-09-21 |
| /answers/indigo-contrast-wcag/ · FAQ | How can I check a color pair programmatically? Use the `check_contrast` tool on the DS MCP server, or run the script on this page against the token values. | [ds-mcp]; [wcag22] | 2026-09-21; W3C Recommendation, 2024-12-12 |

### How do I install the RamosLabs design tokens in Vue, React, or plain HTML?

`/answers/install-tokens-vue-react-html/`

| Page | Claim | Source | Source date |
|---|---|---|---|
| /answers/install-tokens-vue-react-html/ · Short answer | Install `@ramoslabs/tokens` from npm, import `@ramoslabs/tokens/css` once in your app entry, and reference tokens such as `var(--color-primary)` in CSS. Without npm, link `https://design.ramoslabs.com/tokens.css` from plain HTML. | [npm-tokens]; [ds-install]; [mdn-var]; [mdn-link] | 0.1.0 published 2026-07-08; 2026-09-21; last modified 2026-09-10; last modified 2026-05-20 |
| /answers/install-tokens-vue-react-html/ · Install the package | `@ramoslabs/tokens` is public on npm under the MIT license; 0.1.0 is its only version. The DS documents these four commands. | [npm-tokens]; [ds-install] | 0.1.0 published 2026-07-08; 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Install the package (table) | bun / `bun add @ramoslabs/tokens` | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Install the package (table) | npm / `npm install @ramoslabs/tokens` | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Install the package (table) | pnpm / `pnpm add @ramoslabs/tokens` | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Install the package (table) | yarn / `yarn add @ramoslabs/tokens` | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Why the import path works | The package defines subpath exports: the root for typed values, `./css` for the CSS variables, and `./json` for the flat map. Node resolves only the subpaths a package defines in `exports`. | [ds-pkg]; [node-exports] | 2026-09-21; Node.js v26.12.1 docs |
| /answers/install-tokens-vue-react-html/ · Why the import path works | Test result, showing a bundler resolving them too: a Vite 8.3.5 project that imported `@ramoslabs/tokens/css` and `colorIndigo600` from the published 0.1.0 built successfully, and the output CSS contained `--color-primary:#4f46e5`. In development, Vite injects imported `.css` files into the page through a style tag. To repeat the test, run the three commands printed in the measurement README: `bun install`, `bunx vite build`, then `grep -o 'color-primary:[^;]*' dist/assets/*.css`. | [measured-vite]; [vite-css] | 2026-10-27; docs v8.3.4 |
| /answers/install-tokens-vue-react-html/ · Vue 3 (Vite) | A Vue application is created with `createApp` and attached with `.mount()`. Add the CSS import to that entry file once, not per component. | [vue-app]; [ds-install] | undated docs page; 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · React | A React app renders into a root created with `createRoot`, usually once at startup. Put the same CSS import in that entry file. | [react-root]; [ds-install] | undated docs page; 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Plain HTML, no install | A stylesheet is attached with a `link` element whose `rel` is `stylesheet`. The DS serves its token stylesheet and the flat map at the site root; on 2026-10-27 both answered 200 with the right content types. | [mdn-link]; [measured-served] | last modified 2026-05-20; 2026-10-27 |
| /answers/install-tokens-vue-react-html/ · Typed values in TypeScript | The package root exports typed values such as `colorIndigo600`; the Vite test above imported it and built. For styling, keep using the CSS variables. | [measured-vite] | 2026-10-27 |
| /answers/install-tokens-vue-react-html/ · Tailwind CSS | Tailwind documents square-bracket arbitrary properties as a way to write completely arbitrary CSS. Once the CSS import above is in place, the RamosLabs variables are regular CSS custom properties that any CSS can read. This page did not measure a Tailwind build that emits them from arbitrary properties. | [tw-custom]; [ds-install] | docs v4.3; 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · Components | The `SJ` components are not shipped yet; until they land, build from the tokens and the documented patterns. | [ds-agents] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · FAQ | Do I need to import the token CSS in every component? No. Import it once at the app entry or root layout. | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · FAQ | Can I use the tokens with Tailwind? The tokens are regular CSS variables once the CSS is imported, and Tailwind documents arbitrary properties that take completely arbitrary CSS. This page did not measure a Tailwind build that reads them. | [ds-pkg]; [tw-custom] | 2026-09-21; docs v4.3 |
| /answers/install-tokens-vue-react-html/ · FAQ | Can I use the tokens without npm? Yes. Link `https://design.ramoslabs.com/tokens.css`; it answered 200 as `text/css` on 2026-10-27. | [mdn-link]; [measured-served] | last modified 2026-05-20; 2026-10-27 |
| /answers/install-tokens-vue-react-html/ · FAQ | Does it work in a Vite project? A Vite 8.3.5 build importing `@ramoslabs/tokens/css` from the published package succeeded and emitted the variables. | [measured-vite] | 2026-10-27 |
| /answers/install-tokens-vue-react-html/ · FAQ | Are the SJ components available to install? Not yet. They are planned for `@ramoslabs/vue`. | [ds-agents] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · FAQ | Can I hardcode a color or spacing value while I set up? No. The DS hard rule is to never hardcode a color, spacing, typography, radius, shadow, or motion value. | [ds-agents] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · How-to | Install the package: Run `bun add @ramoslabs/tokens`, or the npm, pnpm or yarn equivalent. | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · How-to | Import the CSS once: In the app entry, import `@ramoslabs/tokens/css` one time. | [ds-install] | 2026-09-21 |
| /answers/install-tokens-vue-react-html/ · How-to | Use a token: Reference variables such as `var(--color-primary)` and `var(--space-6)` instead of raw values. | [mdn-var] | last modified 2026-09-10 |
| /answers/install-tokens-vue-react-html/ · How-to | Optional: typed values: For TypeScript logic, import typed values from the package root, for example `colorIndigo600`. | [measured-vite] | 2026-10-27 |

### RamosLabs DS, Material Web, and Tailwind CSS: what each one ships

`/answers/ramoslabs-ds-vs-material-vs-tailwind/`

| Page | Claim | Source | Source date |
|---|---|---|---|
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · Short answer | RamosLabs DS ships tokens and documented patterns and no components yet. Material Web is a web-components library on Material 3, in maintenance mode according to its README as of 2026-10-27. Tailwind is a utility-first approach whose docs have you build reusable components yourself. All three expose design tokens as CSS variables. | [ds-agents]; [md-web]; [tw-utility]; [ds-pkg]; [md-theming]; [tw-theme] | 2026-09-21; undated README, main branch; docs v4.3; 2026-09-21; undated doc, main branch; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What each one ships | Every cell cites a primary source. External sources were read on 2026-10-27; Tailwind statements are from its v4.3 docs. The Material column describes Material Web (`@material/web`) only; the Material 3 specification site was not consulted, so this page makes no claim about Material Design as a whole. | none (no factual claim) | n/a |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What each one ships (table) | What is it? / A mono-indigo design system documented as tokens and patterns / Material Web is a library of Google's Material components; its README says it uses Material 3, "the latest version" / A utility-first approach: you combine single-purpose presentational classes in your markup | [ds-agents]; [md-web]; [tw-utility] | 2026-09-21; undated README, main branch; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What each one ships (table) | Ready-made components? / Not shipped yet; planned as `@ramoslabs/vue` with the `SJ` prefix / `@material/web` is a library of web components; its README says "MWC is in maintenance mode pending new maintainers" / Its docs describe building reusable components yourself, with a framework component, a template partial, or custom CSS | [ds-agents]; [md-web]; [tw-utility] | 2026-09-21; undated README, main branch; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What each one ships (table) | Tokens as CSS variables? / Compiled to CSS variables, typed values and flat JSON; `./css`, `./json` and the root are exported / On the web, design tokens are CSS custom properties / Theme variables defined with `@theme` are compiled into regular CSS variables | [ds-pkg]; [md-theming]; [tw-theme] | 2026-09-21; undated doc, main branch; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What each one ships (table) | How is color organized? / One action accent, Indigo 600 (#4f46e5); violet is decorative only / Color roles assigned to components, as `--md-sys-color-<token>`; each has an `on` token for content color with accessible contrast. Schemes can be generated from a single color with `material-color-utilities` / Importing `tailwindcss` includes a default theme with a color palette, type scale, shadows and fonts; you add colors as theme variables such as `--color-mint-500` | [ds-agents]; [md-color]; [md-utils]; [tw-theme] | 2026-09-21; undated doc, main branch; undated README, main branch; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · Using Tailwind with RamosLabs tokens | Import the RamosLabs CSS once. The variables then exist as regular CSS custom properties that any CSS can read. Tailwind documents square-bracket arbitrary properties as a way to write completely arbitrary CSS, and its own `var()` example is the arbitrary-value shorthand `fill-(--my-brand-color)`. Whether a given Tailwind build emits the DS variables in arbitrary properties was not measured here. | [ds-install]; [mdn-var]; [tw-custom] | 2026-09-21; last modified 2026-09-10; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What this means if you need components today | RamosLabs DS does not ship components yet. Material Web is a components library, flagged in maintenance mode by its own README as of 2026-10-27. Tailwind's docs expect you to build components from utilities. Check each project's current status before committing; these statements are dated 2026-10-27. | [ds-agents]; [md-web]; [tw-utility] | 2026-09-21; undated README, main branch; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · What was not compared | Licenses of the other two, accessibility quality, bundle size, popularity and AI tooling are not compared: no primary source was gathered for them, so this page makes no claim. The RamosLabs license is MIT. | [npm-tokens] | 0.1.0 published 2026-07-08 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · FAQ | Does RamosLabs DS include ready-made components? Not yet. They are planned as `@ramoslabs/vue` with the `SJ` prefix. | [ds-agents] | 2026-09-21 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · FAQ | Is Material Web still maintained? Its README states "MWC is in maintenance mode pending new maintainers". This is the README wording as of 2026-10-27. Check the repository for the current state. | [md-web] | undated README, main branch |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · FAQ | Does Tailwind ship components? Its docs describe building reusable components yourself from utilities. | [tw-utility] | docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · FAQ | Can I use RamosLabs tokens with Tailwind? The tokens are regular CSS variables once the CSS is imported, and Tailwind documents arbitrary properties that take completely arbitrary CSS. This page did not measure a Tailwind build that reads them. | [ds-pkg]; [ds-install]; [tw-custom] | 2026-09-21; 2026-09-21; docs v4.3 |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · FAQ | How does Material Web expose its tokens? As CSS custom properties; color tokens follow `--md-sys-color-<token>`. | [md-theming]; [md-color] | undated doc, main branch; undated doc, main branch |
| /answers/ramoslabs-ds-vs-material-vs-tailwind/ · FAQ | Is RamosLabs DS free to use? Yes, under the MIT license. | [npm-tokens] | 0.1.0 published 2026-07-08 |

**References for /answers/muted-text-token/**

- [ds-tokens] (ds) Source tokens: color.primitive.json and color.semantic.json (@ramoslabs/tokens). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/tree/71b8bac/packages/tokens/src/tokens>
- [ds-colors] (ds) Colors: the foundation page (roles and measured contrast pairings; source Colors.md). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/apps/site/agentic/content/foundations/Colors.md>
- [ds-agents] (ds) AGENTS.md: accessibility floors, the hard rule, and component status. RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/AGENTS.md>
- [wcag22] (external) WCAG 2.2: definitions of relative luminance and contrast ratio. W3C. W3C Recommendation, 2024-12-12; accessed 2026-10-27. <https://www.w3.org/TR/WCAG22/#dfn-relative-luminance>
- [sc143] (external) Understanding SC 1.4.3: Contrast (Minimum). W3C WAI. updated 2026-09-06; accessed 2026-10-27. <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- [measured] (measured) Contrast ratios computed from the token hex values with the script on this page (WCAG relative-luminance and contrast-ratio formulas), rounded to two decimals. RamosLabs DS. 2026-10-27. <https://design.ramoslabs.com/answers/muted-text-token/#reproduce-the-numbers>

**References for /answers/indigo-contrast-wcag/**

- [ds-tokens] (ds) Source tokens: color.primitive.json and color.semantic.json (@ramoslabs/tokens). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/tree/71b8bac/packages/tokens/src/tokens>
- [ds-agents] (ds) AGENTS.md: accessibility floors, the hard rule, and component status. RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/AGENTS.md>
- [ds-mcp] (ds) MCP server: tools, endpoints, and transport. RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/docs/MCP.md>
- [wcag22] (external) WCAG 2.2: definitions of relative luminance and contrast ratio. W3C. W3C Recommendation, 2024-12-12; accessed 2026-10-27. <https://www.w3.org/TR/WCAG22/#dfn-relative-luminance>
- [sc143] (external) Understanding SC 1.4.3: Contrast (Minimum). W3C WAI. updated 2026-09-06; accessed 2026-10-27. <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- [sc146] (external) Understanding SC 1.4.6: Contrast (Enhanced). W3C WAI. updated 2026-09-06; accessed 2026-10-27. <https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html>
- [sc1411] (external) Understanding SC 1.4.11: Non-text Contrast. W3C WAI. updated 2026-09-06; accessed 2026-10-27. <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- [measured] (measured) Contrast ratios computed from the token hex values with the script on this page (WCAG relative-luminance and contrast-ratio formulas), rounded to two decimals. RamosLabs DS. 2026-10-27. <https://design.ramoslabs.com/answers/indigo-contrast-wcag/#reproduce-the-numbers>

**References for /answers/install-tokens-vue-react-html/**

- [npm-tokens] (external) npm registry record for @ramoslabs/tokens (license MIT; 0.1.0 is the only version). npm. 0.1.0 published 2026-07-08; accessed 2026-10-27. <https://registry.npmjs.org/@ramoslabs/tokens>
- [ds-pkg] (ds) packages/tokens/package.json: the exports map (".", "./css", "./json"). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/packages/tokens/package.json>
- [ds-install] (ds) Installation: the install and import steps (source Installation.md). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/apps/site/agentic/content/Installation.md>
- [node-exports] (external) Node.js packages: "exports" and subpath exports. Node.js. Node.js v26.12.1 docs; accessed 2026-10-27. <https://nodejs.org/api/packages.html#subpath-exports>
- [vite-css] (external) Vite: Features, CSS (importing .css from JavaScript). Vite. docs v8.3.4; accessed 2026-10-27. <https://vite.dev/guide/features.html#css>
- [vue-app] (external) Vue: Creating a Vue Application. Vue. undated docs page; accessed 2026-10-27. <https://vuejs.org/guide/essentials/application.html>
- [react-root] (external) React: createRoot. React. undated docs page; accessed 2026-10-27. <https://react.dev/reference/react-dom/client/createRoot>
- [mdn-link] (external) MDN: the link element (rel="stylesheet"). MDN. last modified 2026-05-20; accessed 2026-10-27. <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link>
- [mdn-var] (external) MDN: var() CSS function. MDN. last modified 2026-09-10; accessed 2026-10-27. <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/var>
- [tw-custom] (external) Tailwind CSS: adding custom styles (arbitrary properties and values). Tailwind Labs. docs v4.3; accessed 2026-10-27. <https://tailwindcss.com/docs/adding-custom-styles>
- [ds-agents] (ds) AGENTS.md: accessibility floors, the hard rule, and component status. RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/AGENTS.md>
- [measured-vite] (measured) Build test: Vite 8.3.5 bundling an entry that imports "@ramoslabs/tokens/css" and { colorIndigo600 } from the published @ramoslabs/tokens@0.1.0; reproduction committed at docs/distribution/measurements/vite-tokens/. RamosLabs DS. 2026-10-27. <https://github.com/SrRamos/ramoslabs-ds/blob/main/docs/distribution/measurements/vite-tokens/README.md>
- [measured-served] (measured) HTTP check: GET https://design.ramoslabs.com/tokens.css returned 200 text/css, and /tokens.json returned 200 application/json. RamosLabs DS. 2026-10-27. <https://design.ramoslabs.com/tokens.css>

**References for /answers/ramoslabs-ds-vs-material-vs-tailwind/**

- [ds-agents] (ds) AGENTS.md: accessibility floors, the hard rule, and component status. RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/AGENTS.md>
- [ds-pkg] (ds) packages/tokens/package.json: the exports map (".", "./css", "./json"). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/packages/tokens/package.json>
- [ds-install] (ds) Installation: the install and import steps (source Installation.md). RamosLabs DS repository, commit 71b8bac. 2026-09-21. <https://github.com/SrRamos/ramoslabs-ds/blob/71b8bac/apps/site/agentic/content/Installation.md>
- [npm-tokens] (external) npm registry record for @ramoslabs/tokens (license MIT; 0.1.0 is the only version). npm. 0.1.0 published 2026-07-08; accessed 2026-10-27. <https://registry.npmjs.org/@ramoslabs/tokens>
- [tw-custom] (external) Tailwind CSS: adding custom styles (arbitrary properties and values). Tailwind Labs. docs v4.3; accessed 2026-10-27. <https://tailwindcss.com/docs/adding-custom-styles>
- [md-web] (external) material-web README: what @material/web is and its status. Material Components (GitHub). undated README, main branch; accessed 2026-10-27. <https://github.com/material-components/material-web/blob/main/README.md>
- [md-color] (external) material-web: color theming (color roles and --md-sys-color tokens). Material Components (GitHub). undated doc, main branch; accessed 2026-10-27. <https://github.com/material-components/material-web/blob/main/docs/theming/color.md>
- [md-theming] (external) material-web: theming (design tokens are CSS custom properties on the web). Material Components (GitHub). undated doc, main branch; accessed 2026-10-27. <https://github.com/material-components/material-web/blob/main/docs/theming/README.md>
- [md-utils] (external) material-color-utilities README. Material Foundation (GitHub). undated README, main branch; accessed 2026-10-27. <https://github.com/material-foundation/material-color-utilities>
- [tw-utility] (external) Tailwind CSS: styling with utility classes. Tailwind Labs. docs v4.3; accessed 2026-10-27. <https://tailwindcss.com/docs/styling-with-utility-classes>
- [tw-theme] (external) Tailwind CSS: theme variables. Tailwind Labs. docs v4.3; accessed 2026-10-27. <https://tailwindcss.com/docs/theme>
- [mdn-var] (external) MDN: var() CSS function. MDN. last modified 2026-09-10; accessed 2026-10-27. <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/var>
