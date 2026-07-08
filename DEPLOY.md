# Deploy — RamosLabs Design System

The deployed site is the Storybook static build. It also serves four agent-facing
files from the site root so AI agents can `WebFetch` them:

- `llms.txt` — concise index
- `llms-full.txt` — full self-contained document
- `AGENTS.md` — onboarding for agents that build UI on this DS
- `registry.json` — machine-readable token + pattern registry

Target: Cloudflare Pages, project `ramoslabs-ds`, URL https://ramoslabs-ds.pages.dev

## How the site is assembled

```
bun install
bun run build-storybook                     # Storybook build -> apps/storybook/storybook-static/
                                            #   also copies agentic-static/_headers and _redirects to the build root
bun run --filter storybook agentic:build    # writes the four agent files into storybook-static/
```

- `_headers` and `_redirects` live at `apps/storybook/agentic-static/`. Storybook's
  `staticDirs` (in `apps/storybook/.storybook/main.ts`) copies them to the build root on
  every build. Do not edit them inside `storybook-static/` — that dir is git-ignored and
  regenerated.
- `_headers` sets the correct `Content-Type` and `Access-Control-Allow-Origin: *` for the
  four agent files.

---

## Path A — Git-connected Pages (recommended)

Cloudflare rebuilds on every push to the production branch. Steps in the Cloudflare
dashboard REQUIRE your Cloudflare account (I cannot do these).

1. Push the branch to GitHub (already on `feature/ds-agentic-and-polish`; merge to `main`
   when ready, since production branch is `main`).
2. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
3. Authorize GitHub and select repo `SrRamos/ramoslabs-ds`.
4. Configure the build:
   - Project name: `ramoslabs-ds`
   - Production branch: `main`
   - Framework preset: None
   - Root directory: (leave as repo root, blank)
   - Build command:
     ```
     bun install && bun run build-storybook && bun run --filter storybook agentic:build
     ```
   - Build output directory:
     ```
     apps/storybook/storybook-static
     ```
5. Environment variables (Settings -> Environment variables, Production):
   - `NODE_VERSION` = `22`
   - Cloudflare Pages detects `bun` from `bun.lock` automatically and uses the version in
     `package.json` `packageManager` (`bun@1.3.5`). No extra bun env var is needed. If a
     build ever fails to find bun, add `BUN_VERSION` = `1.3.5`.
   - Optional: `SITE_URL` = `https://ramoslabs-ds.pages.dev` (the agentic generator falls
     back to this value, so it is only needed if you deploy under a different domain).
6. Save and Deploy. First build provisions https://ramoslabs-ds.pages.dev.

---

## Path B — Manual direct upload via Wrangler

Use this to deploy from your machine without the Git integration. You run these commands
(they need YOUR Cloudflare account; `wrangler login` is interactive).

1. Authenticate once (pick one):
   ```
   bunx wrangler login
   ```
   or set a scoped token in the environment:
   ```
   export CLOUDFLARE_API_TOKEN=<token with Pages: Edit permission>
   ```
2. Build locally:
   ```
   bun install
   bun run build-storybook
   bun run --filter storybook agentic:build
   ```
3. Deploy the built output:
   ```
   bunx wrangler pages deploy apps/storybook/storybook-static --project-name ramoslabs-ds
   ```
   The first run offers to create the `ramoslabs-ds` project if it does not exist. Config
   in `wrangler.toml` (`pages_build_output_dir`) lets you also run a bare
   `bunx wrangler pages deploy` from the repo root.

---

## Verification (after either path)

Expect HTTP 200 and the correct content-type on each:

```
curl -sSI https://ramoslabs-ds.pages.dev/llms.txt        | grep -i 'content-type'   # text/plain; charset=utf-8
curl -sSI https://ramoslabs-ds.pages.dev/llms-full.txt   | grep -i 'content-type'   # text/plain; charset=utf-8
curl -sSI https://ramoslabs-ds.pages.dev/registry.json   | grep -i 'content-type'   # application/json; charset=utf-8
curl -sSI https://ramoslabs-ds.pages.dev/AGENTS.md       | grep -i 'content-type'   # text/markdown; charset=utf-8
```

Confirm CORS and content:

```
curl -sSI https://ramoslabs-ds.pages.dev/registry.json | grep -i 'access-control-allow-origin'   # *
curl -sS  https://ramoslabs-ds.pages.dev/registry.json | head -c 200                              # valid JSON
curl -sS  https://ramoslabs-ds.pages.dev/ -o /dev/null -w '%{http_code}\n'                        # 200 (Storybook home)
```

If a content-type is wrong, the `_headers` file did not reach the build root: confirm
`staticDirs: ['../agentic-static']` is present in `apps/storybook/.storybook/main.ts` and
that `storybook-static/_headers` exists after the build.

## What requires your Cloudflare account

- Path A steps 2 to 6 (dashboard: connect repo, configure build, set env, deploy).
- Path B step 1 (`wrangler login` or providing `CLOUDFLARE_API_TOKEN`).

Everything else (build config, `_headers`/`_redirects`, `wrangler.toml`) is committed in
this repo and needs no account.
