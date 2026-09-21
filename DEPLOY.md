# Deploy — RamosLabs Design System

The deployed site is the **static Astro build** (`apps/site`), served by a Cloudflare
**Worker** (`main = apps/site/worker/index.ts`) with a static-assets binding. Beyond serving the
assets, the Worker adds an **MCP server at `POST /mcp`** and writes cookieless, no-PII server-side
usage telemetry to **Cloudflare Analytics Engine**. It renders one real HTML file per clean URL
and serves the agent-facing files from the site root so AI agents can `WebFetch` them:

- `llms.txt` — concise index
- `llms-full.txt` — full self-contained document
- `AGENTS.md` — onboarding for agents that build UI on this DS
- `registry.json` — machine-readable token + pattern registry
- `tokens.json` — the flat DTCG token map
- `tokens.css` — the compiled CSS variables (for agents that cannot install from npm)
- `skill.md` — the Claude Code agent skill

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
`tokens.json`, `tokens.css`, and `AGENTS.md` into `dist/` using the production URL from Astro's
`site` config.

`public/_headers` and `public/_redirects` are copied verbatim into `dist/` and are honored by
Workers static assets (same format as Pages). `_headers` sets `Content-Type` +
`Access-Control-Allow-Origin: *` for the agent files (including `tokens.json` and `tokens.css`)
and a long immutable cache for `/fonts/*`.

`wrangler.toml` declares the Worker and its static-assets binding:

```toml
name = "ramoslabs-ds"
main = "./apps/site/worker/index.ts"
compatibility_date = "2026-07-08"

[assets]
directory = "./apps/site/dist"
binding = "ASSETS"
run_worker_first = true          # Worker runs first to log cookieless usage, then serves the asset

[[analytics_engine_datasets]]    # cookieless, no-PII server-side telemetry
binding = "ANALYTICS"
dataset = "ramoslabs_ds"
```

The Worker (`apps/site/worker/index.ts`) serves the static assets via the `ASSETS` binding,
answers `POST /mcp` (the MCP server), and writes usage telemetry to Analytics Engine — which
feeds `/stats.json` and the unlisted `/metricas` dashboard. Static-asset paths are served
directly; only non-asset paths (e.g. `/mcp`) run Worker logic.

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

**Client analytics (optional).** The site loads GA4 + Microsoft Clarity behind an opt-out
consent banner. Their IDs are public, build-time variables read from the environment
(with committed defaults); set them in Settings → Variables to override:

- `PUBLIC_GA4_ID` — the GA4 measurement id (`G-…`).
- `PUBLIC_CLARITY_ID` — the Microsoft Clarity project id.

If a variable is absent (and no default is set) the corresponding tracker simply does not load.

**Server telemetry secrets (optional).** The `[[analytics_engine_datasets]]` binding needs no
secret to *write*. To let `/metricas.json` read aggregates back, set both as **secrets** (this
repo is public — never commit them):

```
bunx wrangler secret put CF_ACCOUNT_ID
bunx wrangler secret put CF_ANALYTICS_TOKEN   # scope: Account Analytics: Read
```

Without them, `/metricas.json` returns npm downloads only (`usage: null`). See `docs/ANALYTICS.md`.

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
curl -sSI $BASE/tokens.css     | grep -i 'content-type'   # text/css; charset=utf-8
curl -sSI $BASE/AGENTS.md      | grep -i 'content-type'   # text/markdown; charset=utf-8
curl -sSI $BASE/skill.md       | grep -i 'content-type'   # text/markdown; charset=utf-8
curl -sSI $BASE/registry.json  | grep -i 'access-control-allow-origin'   # *
curl -sS  $BASE/ -o /dev/null -w '%{http_code}\n'         # 200 (Introduction, real HTML)

# MCP server (POST, JSON-RPC): expect a 200 with the 7 tools listed.
curl -sS $BASE/mcp -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"name"' | wc -l   # 7
```

Confirm `llms.txt` links point at clean `$BASE/...` URLs and `sitemap-index.xml` resolves.

## What requires the Cloudflare account

- Path A (dashboard: build settings, custom domain, retry deployment).
- Path B step 1 (`wrangler login` or `CLOUDFLARE_API_TOKEN`).

Everything else (`wrangler.toml`, `_headers`/`_redirects`, the build) is committed and needs no
account.
