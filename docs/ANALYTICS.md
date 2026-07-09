# RamosLabs DS — usage analytics

How we measure the impact and adoption of the design system. The whole approach is
**cookieless, no-PII, and adds zero client-side load** — no analytics beacon, no consent
banner. Everything is measured server-side in the Worker or read from public APIs.

Why server-side and not a JS beacon: a client beacon only sees browsers that run JS. This DS
is consumed by **agents, MCP clients, curl, and bots** as much as by people — a beacon would
miss exactly the traffic we most want to see. Measuring in the Worker captures all of it.

## What we measure

| Signal | Where | How |
|---|---|---|
| **Page views** | Cloudflare Analytics Engine | The Worker runs on every request (`run_worker_first`) and records a `page` event for each HTML GET. |
| **Agent-file fetches** | Cloudflare Analytics Engine | A `agent_file` event for each GET of `llms.txt`, `llms-full.txt`, `tokens.json`, `registry.json`, `skill.md`, `AGENTS.md`, `robots.txt`, `stats.json`. This is the AI-adoption signal. |
| **MCP usage** | Cloudflare Analytics Engine | An `mcp` event per JSON-RPC message, tagged by method. `initialize` ≈ a new connection (the transport is stateless HTTP); `tools/call:<tool>` counts which tools agents actually use. |
| **Token downloads** | npm public API | `@ramoslabs/tokens` download counts (day/week/month). Surfaced live at `/stats.json` and as a README badge. |
| **Repo interest** | GitHub | Clones/views via the GitHub traffic API (not yet wired; read on demand). |

Each Analytics Engine data point carries, with no PII: the event `type` (index), request
`path`, a `detail` (filename or MCP method/tool), and coarse context — User-Agent, referer,
country, and Cloudflare colo.

## Where the data lives

- **Analytics Engine** dataset `ramoslabs_ds` (binding `ANALYTICS` in `wrangler.toml`). Query
  it with the [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)
  or GraphQL. Counts are `SUM(_sample_interval)` (Analytics Engine samples under load).
- **Workers Logs** (`[observability] enabled = true`) for debugging and log-based views.
- **`/stats.json`** — **public**, cookieless, edge-cached. Returns **npm download counts only**
  (data that is already public on npm). Linked from `/agents/` and `llms.txt`. It deliberately
  does **not** expose server-side usage aggregates.
- **`/metricas`** — an **unlisted internal dashboard** (standalone page, not a DS nav entry;
  `noindex`, excluded from the sitemap, not in `llms.txt` or `robots.txt`). It reads
  **`/metricas.json`**, an unlisted same-origin feed that returns npm downloads **plus** the
  Analytics Engine aggregates (page views, agent-file fetches, MCP tool calls, top pages).
  Security is by obscurity: the route is simply not advertised. Add real auth (e.g. Cloudflare
  Access) if you need it locked down.

## Enabling the live dashboard

`/metricas` shows npm downloads out of the box. To light up the server-side aggregates, give
the Worker read access to Analytics Engine:

1. Create an API token with **Account Analytics: Read** at
   [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
2. This repo is **public**, so set both as **secrets** (never commit them):
   ```bash
   bunx wrangler secret put CF_ACCOUNT_ID
   bunx wrangler secret put CF_ANALYTICS_TOKEN
   ```
3. Redeploy. `/metricas.json` will start returning the `usage` object and the dashboard fills in.

Without these, `/metricas.json` returns `usage: null` and the dashboard shows a setup hint —
nothing breaks. `/metricas.json` is edge-cached for 5 minutes to avoid running the SQL query on
every visit. **Never paste a token into chat, a commit, or an issue** — if one leaks, roll it in
the API-tokens dashboard and set a fresh one.

## Example queries

Top pages in the last day:

```sql
SELECT blob2 AS path, SUM(_sample_interval) AS views
FROM ramoslabs_ds
WHERE index1 = 'page' AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY path ORDER BY views DESC LIMIT 20
```

Most-used MCP tools this week:

```sql
SELECT blob3 AS detail, SUM(_sample_interval) AS calls
FROM ramoslabs_ds
WHERE index1 = 'mcp' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY detail ORDER BY calls DESC
```

Agent-file fetches by file:

```sql
SELECT blob3 AS file, SUM(_sample_interval) AS hits
FROM ramoslabs_ds
WHERE index1 = 'agent_file' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY file ORDER BY hits DESC
```

(Column mapping: `index1` = type; `blob1` = type, `blob2` = path, `blob3` = detail,
`blob4` = user-agent, `blob5` = referer, `blob6` = country, `blob7` = colo; `double1` = 1.)

## Privacy

No cookies, no fingerprinting, no personal data, no cross-site tracking. We store coarse,
aggregate request metadata to understand adoption of a public, MIT-licensed design system.
The DS welcomes AI ingestion, and this measurement respects the same principle.
