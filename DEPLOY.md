# Deploy — RamosLabs Design System

The deployed site is the **Astro static build** (`apps/site`). It renders one real HTML
file per clean URL and serves the agent-facing files from the site root so AI agents can
`WebFetch` them:

- `llms.txt` — concise index
- `llms-full.txt` — full self-contained document
- `AGENTS.md` — onboarding for agents that build UI on this DS
- `registry.json` — machine-readable token + pattern registry
- `tokens.json` — the flat DTCG token map

Target: Cloudflare Pages, project `ramoslabs-ds`, production domain https://design.ramoslabs.com
(also reachable at https://ramoslabs-ds.pages.dev).

## How the site is assembled

A single Astro build produces everything:

```
bun install
bun run build --filter=site        # turbo builds @ramoslabs/tokens first (^build), then astro build
```

`astro build` (`apps/site`):
- renders every `src/pages/**/*.astro` to `dist/**` as static HTML at clean URLs;
- `@astrojs/sitemap` writes `sitemap-index.xml`;
- the `ramoslabs-agentic` integration (`apps/site/agentic/integration.ts`) runs on
  `astro:build:done` and writes `llms.txt`, `llms-full.txt`, `registry.json`, `robots.txt`,
  `tokens.json`, and `AGENTS.md` into `dist/` using the production URL from Astro's `site`
  config (also refreshing the committed copies at the repo root).

`public/_headers` and `public/_redirects` are copied verbatim to the build root. `_headers`
sets `Content-Type` + `Access-Control-Allow-Origin: *` for the agent files (including
`tokens.json`) and a long immutable cache for `/fonts/*`.

---

## Path A — Git-connected Pages (recommended)

Cloudflare rebuilds on every push to the production branch. Dashboard steps REQUIRE the
Cloudflare account.

1. Merge the feature branch to `main` (production branch).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Authorize GitHub and select repo `SrRamos/ramoslabs-ds`.
4. Configure the build:
   - Project name: `ramoslabs-ds`
   - Production branch: `main`
   - Framework preset: None (Astro is driven by the command below)
   - Root directory: (repo root, blank)
   - Build command:
     ```
     bun install && bun run build --filter=site
     ```
   - Build output directory:
     ```
     apps/site/dist
     ```
5. Environment variables (Production):
   - `NODE_VERSION` = `22`
   - Cloudflare detects `bun` from `bun.lock` / `packageManager` (`bun@1.3.5`). Add
     `BUN_VERSION` = `1.3.5` only if a build cannot find bun.
   - `SITE_URL` is optional; `astro.config.ts` defaults `site` to
     `https://design.ramoslabs.com`. Set `SITE_URL` only to build under a different origin.
6. Save and Deploy. First build provisions `https://ramoslabs-ds.pages.dev`.
7. Add the custom domain `design.ramoslabs.com` (Pages → Custom domains). The DNS record can
   be created via the Cloudflare API once the project exists.

---

## Path B — Manual direct upload via Wrangler

Run from your machine without the Git integration (needs YOUR Cloudflare account).

1. Authenticate once: `bunx wrangler login` (interactive) or
   `export CLOUDFLARE_API_TOKEN=<token with Pages: Edit>`.
2. Build locally: `bun install && bun run build --filter=site`.
3. Deploy: `bunx wrangler pages deploy apps/site/dist --project-name ramoslabs-ds`
   (or a bare `bunx wrangler pages deploy` — `wrangler.toml` supplies
   `pages_build_output_dir = apps/site/dist`).

---

## Verification (after either path)

Expect HTTP 200 and the correct content-type on each:

```
BASE=https://design.ramoslabs.com   # or https://ramoslabs-ds.pages.dev
curl -sSI $BASE/llms.txt       | grep -i 'content-type'   # text/plain; charset=utf-8
curl -sSI $BASE/llms-full.txt  | grep -i 'content-type'   # text/plain; charset=utf-8
curl -sSI $BASE/registry.json  | grep -i 'content-type'   # application/json; charset=utf-8
curl -sSI $BASE/tokens.json    | grep -i 'content-type'   # application/json; charset=utf-8
curl -sSI $BASE/AGENTS.md      | grep -i 'content-type'   # text/markdown; charset=utf-8
curl -sSI $BASE/registry.json  | grep -i 'access-control-allow-origin'   # *
curl -sS  $BASE/ -o /dev/null -w '%{http_code}\n'         # 200 (Introduction, real HTML)
```

Confirm `llms.txt` links point at clean `$BASE/...` URLs and `sitemap-index.xml` resolves.

## What requires the Cloudflare account

- Path A steps 2–7 (dashboard: connect repo, configure build, set env, deploy, custom domain).
- Path B step 1 (`wrangler login` or `CLOUDFLARE_API_TOKEN`).

Everything else (build config, `_headers`/`_redirects`, `wrangler.toml`) is committed and
needs no account.
