# RamosLabs DS — MCP server

The design system ships a **Model Context Protocol (MCP)** server so any MCP-capable agent
(Claude Code, Cursor, Windsurf, …) gets the DS as typed, verifiable tools instead of scraping
HTML or fetching files. It runs inside the same Worker that serves the site
(`apps/site/worker/index.ts`), reads the same static assets (`tokens.json`, `llms-full.txt`,
`AGENTS.md`) via the `ASSETS` binding, and is **stateless, read-only, and needs no auth**.

- Transport: Streamable HTTP (JSON responses).
- Endpoint: `POST /mcp`.
- URLs:
  - `https://ramoslabs-ds.edwardramosp.workers.dev/mcp` — works from anywhere (no zone bot protection).
  - `https://design.ramoslabs.com/mcp` — the branded URL; reachable from local clients, and from
    cloud clients once the zone's Bot Fight Mode is relaxed (see below).

## Tools

| Tool | Purpose |
|---|---|
| `search_tokens(query, limit?)` | Find tokens by name or value substring. |
| `get_token(name)` | Exact token value + the `var(--…)` to use. Errors if it does not exist (never invent one). |
| `check_contrast(foreground, background)` | WCAG 2.x ratio + AA/AAA verdicts for normal/large text and UI. |
| `list_docs()` | Every documentation page title (foundations + patterns). |
| `get_doc(title)` | The full distilled doctrine for one page (read before implementing a pattern). |
| `lint_css(code)` | Flag raw hex/rgb/px/rem that should be tokens; suggests the matching token(s). |
| `get_agents_guide()` | The full `AGENTS.md` agent guide. |

## Connect it

**Claude Code:**
```
claude mcp add --transport http ramoslabs-ds https://ramoslabs-ds.edwardramosp.workers.dev/mcp
```

**Cursor / Windsurf / other MCP clients** — add to the MCP config:
```json
{
  "mcpServers": {
    "ramoslabs-ds": {
      "url": "https://ramoslabs-ds.edwardramosp.workers.dev/mcp",
      "transport": "http"
    }
  }
}
```

Then the agent has `search_tokens`, `check_contrast`, `lint_css`, etc. as first-class tools —
no WebFetch, no HTML interpretation, no invented values.

## Quick check

```
# tools/list
curl -s -X POST https://ramoslabs-ds.edwardramosp.workers.dev/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# check_contrast (primary on white → 6.29, AA)
curl -s -X POST https://ramoslabs-ds.edwardramosp.workers.dev/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_contrast","arguments":{"foreground":"#4f46e5","background":"#ffffff"}}}'
```

## Note on the branded URL and bot protection

`design.ramoslabs.com` sits on the `ramoslabs.com` zone, whose **Bot Fight Mode** blocks
server-side/cloud fetchers (that is why `WebFetch` to the agent files 403s from cloud IPs).
MCP clients running locally use a residential IP and pass; cloud-hosted agents may be blocked
on the branded URL. To make `design.ramoslabs.com/mcp` (and the agent files) reachable from
every client, in the Cloudflare dashboard → zone `ramoslabs.com` → **Security → Bots**: turn
**Bot Fight Mode off** and set any **"Block AI bots"** control to **Allow** (the DS welcomes
AI ingestion). Until then, use the `*.workers.dev` URL, which is never bot-blocked.

## How it is built and deployed

`wrangler.toml` declares `main = apps/site/worker/index.ts` plus the `ASSETS` binding over
`apps/site/dist`. Static assets are served directly for matching paths; only non-asset paths
(`/mcp`) invoke the Worker. It deploys with the same git-connected Workers Build as the site —
a push to `main` rebuilds and redeploys both. Validate locally with `bunx wrangler dev` and the
curl calls above against `http://localhost:8787/mcp`.
