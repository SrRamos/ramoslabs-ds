# Deploy — RamosLabs Design System

The deployed site is the **static Astro build** (`apps/site`), served by a Cloudflare
**Workers static-assets** project (the successor to Cloudflare Pages — no server code, assets
only). It renders one real HTML file per clean URL and serves the agent-facing files from the
site root so AI agents can `WebFetch` them:

- `llms.txt` — concise index
- `llms-full.txt` — full self-contained document
- `AGENTS.md` — onboarding for agents that build UI on this DS
- `registry.json` — machine-readable token + pattern registry
- `tokens.json` — the flat DTCG token map

Target: Worker `ramoslabs-ds`, production domain https://design.ramoslabs.com
(also reachable at the `*.workers.dev` subdomain).

## How the site is assembled

A single Astro build produces everything:

```
bun install
bun run build --filter=site        # turbo builds @ramoslabs/tokens first (^build), then astro build
```

`astro build` (`apps/site`) renders every page to `apps/site/dist/**` at clean URLs;
`@astrojs/sitemap` writes `sitemap-index.xml`; and the `ramoslabs-agentic` integration runs on
`astro:build:done`, writing `llms.txt`, `llms-full.txt`, `registry.json`, `robots.txt`,
`tokens.json`, and `AGENTS.md` into `dist/` using the production URL from Astro's `site` config.

`public/_headers` and `public/_redirects` are copied verbatim into `dist/` and are honored by
Workers static assets (same format as Pages). `_headers` sets `Content-Type` +
`Access-Control-Allow-Origin: *` for the agent files (including `tokens.json`) and a long
immutable cache for `/fonts/*`.

`wrangler.toml` declares the assets-only Worker:

```toml
name = "ramoslabs-ds"
compatibility_date = "2026-07-08"

[assets]
directory = "./apps/site/dist"
```

There is no `main` — nothing but static assets is deployed.

---

## Path A — Git-connected Workers Build (recommended)

Cloudflare rebuilds and redeploys on every push to the production branch. The Worker
`ramoslabs-ds` is connected to `SrRamos/ramoslabs-ds` (production branch `main`). Configure its
build in the dashboard → the `ramoslabs-ds` Worker → **Settings → Build**:

- **Build command:** `bun install && bun run build --filter=site`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** (repo root, blank)
- **Version control:** production branch `main`

Env (Settings → Variables, only if the build cannot find bun): `BUN_VERSION` = `1.3.5`.
Cloudflare otherwise detects bun from `bun.lock` / `packageManager`.

> The first git build failed because `wrangler.toml` was a **Pages** config
> (`pages_build_output_dir`), which `wrangler deploy` (Workers) does not understand. It is now
> a Workers static-assets config, so a push to `main` (or a manual "Retry deployment") builds
> and deploys cleanly.

Then, in the Worker → **Settings → Domains & Routes**, add the custom domain
`design.ramoslabs.com`.

---

## Path B — Manual deploy via Wrangler

Run from your machine (needs YOUR Cloudflare account).

1. Authenticate once: `bunx wrangler login` (interactive) or
   `export CLOUDFLARE_API_TOKEN=<token with Workers Scripts: Edit>`.
2. Build locally: `bun install && bun run build --filter=site`.
3. Validate then deploy:
   ```
   bunx wrangler deploy --dry-run   # reads apps/site/dist, no upload
   bunx wrangler deploy             # deploys the assets-only Worker
   ```

---

## Verification (after either path)

Expect HTTP 200 and the correct content-type on each:

```
BASE=https://design.ramoslabs.com   # or the *.workers.dev subdomain
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

- Path A (dashboard: build settings, custom domain, retry deployment).
- Path B step 1 (`wrangler login` or `CLOUDFLARE_API_TOKEN`).

Everything else (`wrangler.toml`, `_headers`/`_redirects`, the build) is committed and needs no
account.
