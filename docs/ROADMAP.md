# RamosLabs Design System — Roadmap: npm publish → Astro site → Cloudflare Pages

This is the consolidated delivery plan for shipping the two remaining artifacts of the
RamosLabs DS: the npm package and the public documentation site. It records the decisions,
their rationale, and the execution sequence.

## Decisions & rationale

1. **Site lives on `design.ramoslabs.com`** — a dedicated subdomain, not a path under
   `ramoslabs.com`. Cloudflare Pages attaches custom domains to *hostnames*, not paths; a
   path (`/design`) would require a fragile Worker reverse-proxy in front of the apex.
   Subdomains are also the design-system convention (polaris.shopify.com,
   spectrum.adobe.com, primer.style). The marketing paths `/visible` and `/servicio` are
   commercial lines for customers; the DS is developer/agent infrastructure and belongs on
   its own host.
2. **Migrate the docs site Storybook → Astro.** The DS today is *tokens + documentation*
   (`@ramoslabs/vue` is empty; there is a single `.stories`). Storybook is being used only
   as a Markdown renderer and routes every doc as `?path=…` over one SPA, so crawlers see a
   single HTML page — poor for SEO and AI-SEO. A static Astro build emits **one real HTML
   file per page with a clean URL**, self-hosts fonts (performance ~100), and gives full
   brand control so the site itself exemplifies the DS.
3. **Publish the npm package first (dogfooding).** Ship `@ramoslabs/tokens` to npm before
   the migration so the Astro site — and the world — consumes it as a real dependency, and
   the README's `bun add @ramoslabs/tokens` becomes true.

**Core requirements that must survive the migration:** SEO, AI-SEO, agentic-ready,
performance on top.

---

## Phase 0 — Publish `@ramoslabs/tokens` to npm (FIRST)

Only `@ramoslabs/tokens` publishes. `@ramoslabs/vue` is empty (`0.0.0`, scaffold only) — not
published yet.

**Verified state:** logged in to npm as `srramos`; default registry `registry.npmjs.org`
(public); `@ramoslabs/tokens` name is available; `package.json` already has
`publishConfig.access: "public"`, a `prepack` build (Style Dictionary), and `files: ["dist"]`
(npm always also includes `README.md` + `LICENSE`, both present); version `0.1.0` matches the
CHANGELOG.

**Human-only blockers:**
- The npm **org `@ramoslabs` does not exist yet** (or `srramos` is not a member) —
  `npm org ls ramoslabs` returns 403. Publishing a scoped package requires the org.
  → Create it at https://www.npmjs.com/org/create (`ramoslabs`, free plan = unlimited public
  packages), with `srramos` as owner. Verify with `npm org ls ramoslabs`.
- **2FA/OTP:** `npm publish` will prompt for a one-time code if 2FA is on. The final publish
  is run by a human (or with `--otp=…`).
- Publishing is outward-facing and effectively irreversible (permanent version; unpublish
  restricted after 72h) — explicit confirmation before the real command.

**Steps:**
1. Commit this roadmap.
2. Automatable/safe: `bun run --filter @ramoslabs/tokens build` (verify `dist/` emits
   `tokens.css/.js/.d.ts/.json`); `cd packages/tokens && npm publish --dry-run` (inspect the
   tarball: `dist/**` + `README.md` + `LICENSE` + `package.json`, no `src/`/`node_modules`);
   confirm CHANGELOG and the `v0.1.0` tag.
3. Human: `cd packages/tokens && npm publish --access public [--otp=…]`.
4. Verify: `npm view @ramoslabs/tokens`; clean `bun add @ramoslabs/tokens` in a temp dir.
5. Update `AGENTS.md`/README where they say "not published yet".

---

## Phase 1 — Migrate the docs site to Astro

- **Astro 5, `output: 'static'`, no adapter.** `site: 'https://design.ramoslabs.com'`,
  `trailingSlash: 'always'`, `integrations: [vue(), sitemap(), agentic()]`, no `base`.
- **New `apps/site/`** replaces `apps/storybook` as the public site. **Storybook is kept**
  (future component harness for `@ramoslabs/vue`) but **removed from deploy**.
- **Pages are plain `.astro`, not MDX, not content collections.** The 19 MDX pages are
  bespoke HTML+CSS with no Storybook coupling (no `<Canvas>`/`<Story>`), so the port is
  nearly mechanical. Routes mirror clean URLs: `index.astro` (Introduction, `group:'root'`
  → `/`), `foundations/colors.astro` → `/foundations/colors/`, etc.
- **CSS port:** each `<style>{…}</style>` body → `<style is:global>` (in a static MPA it is
  bundled only into that page; Astro *scoped* styles do **not** reach `set:html` and would
  break the code blocks). `className`→`class`;
  `dangerouslySetInnerHTML={{__html:x}}` → `<Fragment set:html={x} />` (8 pages); drop React
  imports, `useEffect`, `<Meta>`.
- **Single data source + SEO:** `src/data/pages.ts` (migrated manifest + `summary` + clean
  `path`) feeds SEO, nav, and the agentic script. `src/components/BaseHead.astro` emits
  title, meta description, canonical, OpenGraph (`og.png`), Twitter card, JSON-LD.
  `src/layouts/BaseLayout.astro` is a two-column shell (sidebar + main), near-zero JS,
  on-brand via tokens; replicate the global footer from `DocsContainer.tsx`.
- **Fonts (performance):** self-host via `@fontsource-variable/*` (Red Hat Display, Rubik,
  Roboto) with preload of the two critical faces; Material Symbols as a subsetted local
  `@font-face`, non-blocking. Delete the Google `<link>`s in `preview-head.html` and the
  inline `@import` in `Introduction.mdx`.
- **Agentic pipeline (preserve 100%):** convert `build-agentic.mjs` into an Astro
  `astro:build:done` integration reading `site`/`outDir` from config; rewrite `docsUrl()` →
  clean `pageUrl()` (trailing slash); emit `llms.txt`, `llms-full.txt`, `registry.json`,
  `robots.txt`, `AGENTS.md`, `tokens.json` into `dist/`; drop the obsolete `<title>` rewrite.
  Sitemap via `@astrojs/sitemap`. `public/` holds `_headers`, `_redirects`, `og.png`,
  favicon. **Add a `tokens.json` rule to `_headers`** (`application/json` + CORS) — missing
  today.
- **TokenPicker** (the only JS island): `@astrojs/vue`, page `foundations/color-picker.astro`
  with `<TokenPicker client:visible />`; editorial content lifted from
  `TokenPicker.stories.ts`.

**De-risked sequence:** scaffold → port Colors end-to-end → wire agentic+sitemap+headers →
deploy dry-run to a preview branch + `curl -I` the agent files → port the remaining 18
(foundations then patterns; careful with the 8 `set:html` pages) → TokenPicker page →
cutover.

**Gotchas:** no MDX; scoped styles don't reach `set:html` → use `is:global`;
`trailingSlash:'always'` must be consistent across canonical/OG/sitemap/llms or CF Pages
issues 3xx; single base URL from `site`; Introduction is `/`; only TokenPicker ships JS;
`registry.json.components` stays `[]` (accurate).

---

## Phase 2 — Cloudflare Pages + `design.ramoslabs.com`

- `wrangler.toml`: `pages_build_output_dir = "apps/site/dist"`; build
  `bun install && bun run build --filter=site`; `NODE_VERSION=22`.
- Create the Pages project `ramoslabs-ds` connected to Git (dashboard — needs the account),
  production branch `main`.
- DNS + custom domain `design.ramoslabs.com` via the Cloudflare API (CNAME to the
  `*.pages.dev` target + attach domain) once the project exists.
- Set `site: 'https://design.ramoslabs.com'` and rebuild the agentic layer with the final URL.

**Verify:** the domain serves the site; `curl -I` the four agent files + `tokens.json` →
200 + correct Content-Type + CORS; `llms.txt` links clean `design.ramoslabs.com` URLs;
Lighthouse in prod.

---

## Later (out of scope, noted)

- `ramoslabs.com` does not consume the DS or use the brand color — a separate task; the
  Astro site becomes the reference implementation it should match.
- `SJ` components in `@ramoslabs/vue` (empty today) — a future release, where Storybook
  regains its value as a component harness.
