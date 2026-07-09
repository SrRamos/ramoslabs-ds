/**
 * RamosLabs DS — Worker entry.
 *
 * Serves the static Astro site (via the ASSETS binding) AND a Model Context Protocol
 * (MCP) server at POST /mcp, so any MCP-capable agent gets the design system as typed,
 * verifiable tools instead of scraping HTML. Stateless Streamable HTTP (JSON responses),
 * read-only, public. All data is read from the same static assets the site serves
 * (tokens.json, llms-full.txt, AGENTS.md), so the tools can never drift from the site.
 */

// Cloudflare Analytics Engine — cookieless, no-PII, server-side usage telemetry.
// writeDataPoint is synchronous and non-blocking (no added response latency).
interface AnalyticsEngineDataset {
  writeDataPoint(event: { indexes?: string[]; blobs?: (string | null)[]; doubles?: number[] }): void
}

interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> }
  // Optional so local `wrangler dev` (and any build without the binding) still runs.
  ANALYTICS?: AnalyticsEngineDataset
  // Set these two to let /stats.json read aggregates back from Analytics Engine.
  // CF_ACCOUNT_ID is a plain var; CF_ANALYTICS_TOKEN is a secret (Account Analytics: Read).
  // Absent → /stats.json still returns npm downloads, and the dashboard shows a setup hint.
  CF_ACCOUNT_ID?: string
  CF_ANALYTICS_TOKEN?: string
}

// The Analytics Engine dataset name (must match wrangler.toml [[analytics_engine_datasets]]).
const AE_DATASET = 'ramoslabs_ds'

// Files that exist to be consumed by agents/tools. We count a GET to one of these as an
// "agent_file" hit — the adoption signal that is distinct from a human page view, and that
// a client-side JS beacon would miss entirely (agents and curl run no JS).
const AGENT_FILES = new Set([
  '/llms.txt',
  '/llms-full.txt',
  '/tokens.json',
  '/registry.json',
  '/skill.md',
  '/AGENTS.md',
  '/robots.txt',
])

type ReqMeta = { ua: string; referer: string; country: string; colo: string }

function reqMeta(request: Request): ReqMeta {
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {}
  return {
    ua: (request.headers.get('user-agent') ?? '').slice(0, 256),
    referer: (request.headers.get('referer') ?? '').slice(0, 256),
    country: String(cf.country ?? ''),
    colo: String(cf.colo ?? ''),
  }
}

// Fire-and-forget. No cookies, no PII, no client JS. A safe no-op when the binding is absent.
// Schema: index = event type (for accurate per-type sampling); blobs = the dimensions we
// slice by; doubles[0] = 1 (a countable event). Query with SUM(_sample_interval) via the
// Analytics Engine SQL/GraphQL API.
function logEvent(env: Env, type: string, path: string, detail: string, meta: ReqMeta) {
  if (!env.ANALYTICS) return
  try {
    env.ANALYTICS.writeDataPoint({
      indexes: [type],
      blobs: [type, path, detail, meta.ua, meta.referer, meta.country, meta.colo],
      doubles: [1],
    })
  } catch {
    /* telemetry must never break a response */
  }
}

const SERVER_INFO = { name: 'ramoslabs-ds', version: '0.1.0' }
const SUPPORTED_PROTOCOL = '2025-06-18'
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MAX_BODY_BYTES = 262144 // 256 KB cap on the POST body
const MAX_LINT_INPUT = 50000 // 50 KB cap on lint_css input
const MAX_FINDINGS = 200

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
}

// --- asset-backed data, cached per isolate ---------------------------------------
let _tokens: Record<string, string> | null = null
let _agents: string | null = null
let _llmsFull: string | null = null
let _valueIndex: Map<string, string[]> | null = null // normalized value -> token names

async function readAsset(env: Env, origin: string, path: string): Promise<string> {
  const res = await env.ASSETS.fetch(new Request(new URL(path, origin).href))
  if (!res.ok) throw new Error(`asset ${path} -> ${res.status}`)
  return res.text()
}

async function tokens(env: Env, origin: string) {
  if (!_tokens) {
    _tokens = JSON.parse(await readAsset(env, origin, '/tokens.json'))
    _valueIndex = new Map()
    for (const [name, value] of Object.entries(_tokens!)) {
      const k = normalizeValue(String(value))
      const arr = _valueIndex.get(k) ?? []
      arr.push(name)
      _valueIndex.set(k, arr)
    }
  }
  return _tokens!
}
async function agentsGuide(env: Env, origin: string) {
  if (!_agents) _agents = await readAsset(env, origin, '/AGENTS.md')
  return _agents
}
async function llmsFull(env: Env, origin: string) {
  if (!_llmsFull) _llmsFull = await readAsset(env, origin, '/llms-full.txt')
  return _llmsFull
}

function normalizeValue(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Split llms-full.txt into real page sections. Each page the generator emits is
// `# <Title>` immediately followed by a `Source: <url>` line, which distinguishes a page
// header from any `#`-prefixed line inside a distilled body.
function pageSections(full: string): Array<{ title: string; text: string }> {
  return full
    .split(/\n(?=# )/)
    .map((chunk) => {
      const lines = chunk.split('\n')
      const title = lines[0].replace(/^# /, '').trim()
      const hasSource = lines.slice(1, 4).some((l) => /^Source:\s*https?:\/\//.test(l.trim()))
      return { title, text: chunk.trim(), hasSource }
    })
    .filter((s) => s.hasSource)
    .map(({ title, text }) => ({ title, text }))
}

// --- WCAG contrast ----------------------------------------------------------------
function parseHex(input: string): [number, number, number] | null {
  let h = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg)
  const b = parseHex(bg)
  if (!a || !b) return null
  const l1 = relLuminance(a)
  const l2 = relLuminance(b)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// --- tools ------------------------------------------------------------------------
const TOOLS = [
  {
    name: 'search_tokens',
    description:
      'Search the RamosLabs design tokens by name or value substring (case-insensitive). Returns matching token names and their resolved values. Use before writing any color, spacing, typography, radius, shadow, or motion value.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring to match against token name or value, e.g. "primary", "space", "#4f46e5".' },
        limit: { type: 'number', description: 'Max results (default 50).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_token',
    description: 'Get one token by exact name (with or without the leading "--"). Returns its resolved value, or an error if it does not exist. Never invent a token; verify it here.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Token name, e.g. "color-primary" or "--space-6".' } },
      required: ['name'],
    },
  },
  {
    name: 'check_contrast',
    description: 'Compute the WCAG 2.x contrast ratio between two hex colors and report the AA/AAA verdicts for normal and large text. Uses the exact relative-luminance formula.',
    inputSchema: {
      type: 'object',
      properties: {
        foreground: { type: 'string', description: 'Foreground hex color, e.g. "#4f46e5".' },
        background: { type: 'string', description: 'Background hex color, e.g. "#ffffff".' },
      },
      required: ['foreground', 'background'],
    },
  },
  {
    name: 'list_docs',
    description: 'List every RamosLabs DS documentation page (foundations and patterns) by title. Use get_doc to read one.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_doc',
    description: 'Get the full distilled doctrine for one documentation page by title (e.g. "Colors", "Modals", "Form Elements"). Read the relevant page before implementing a pattern; do not improvise it.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string', description: 'Page title, e.g. "Modals". Case-insensitive, partial match allowed.' } },
      required: ['title'],
    },
  },
  {
    name: 'lint_css',
    description:
      'Scan a CSS/style snippet for raw hard-coded values (hex/rgb colors, px/rem lengths) that should be design tokens. Returns each offending value with the token to use when one matches exactly. The DS rule: never hardcode a value, always read the token.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'The CSS or inline-style snippet to lint.' } },
      required: ['code'],
    },
  },
  {
    name: 'get_agents_guide',
    description: 'Return AGENTS.md — the full RamosLabs DS agent guide: what it is, how to install/consume tokens, the hard rules, the accessibility floors, and the naming convention.',
    inputSchema: { type: 'object', properties: {} },
  },
]

async function callTool(name: string, args: Record<string, unknown>, env: Env, origin: string) {
  const text = (t: string) => ({ content: [{ type: 'text', text: t }] })
  const json = (o: unknown) => text(JSON.stringify(o, null, 2))

  switch (name) {
    case 'search_tokens': {
      const q = String(args.query ?? '').toLowerCase()
      const limit = Math.max(1, Math.min(500, Number(args.limit) || 50))
      const all = await tokens(env, origin)
      const hits = Object.entries(all)
        .filter(([n, v]) => n.toLowerCase().includes(q) || String(v).toLowerCase().includes(q))
        .slice(0, limit)
        .map(([n, v]) => ({ token: `--${n}`, value: String(v) }))
      return json({ query: q, count: hits.length, tokens: hits })
    }
    case 'get_token': {
      const key = String(args.name ?? '').replace(/^--/, '')
      const all = await tokens(env, origin)
      if (!Object.prototype.hasOwnProperty.call(all, key)) return { ...text(`No token named "--${key}". Use search_tokens to find the right one; do not invent a value.`), isError: true }
      return json({ token: `--${key}`, value: String(all[key]), css: `var(--${key})` })
    }
    case 'check_contrast': {
      const fg = String(args.foreground ?? '')
      const bg = String(args.background ?? '')
      const ratio = contrastRatio(fg, bg)
      if (ratio == null) return { ...text('Both foreground and background must be hex colors like "#4f46e5".'), isError: true }
      const r = Math.round(ratio * 100) / 100
      return json({
        foreground: fg,
        background: bg,
        ratio: r,
        normalText: { AA: ratio >= 4.5, AAA: ratio >= 7 },
        largeText: { AA: ratio >= 3, AAA: ratio >= 4.5 },
        uiAndGraphics: { AA: ratio >= 3 },
        verdict: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large only' : 'Fail',
      })
    }
    case 'list_docs': {
      const pages = pageSections(await llmsFull(env, origin)).map((s) => s.title)
      return json({ count: pages.length, pages })
    }
    case 'get_doc': {
      const want = String(args.title ?? '').toLowerCase().trim()
      if (!want) return { ...text('Provide a page title.'), isError: true }
      const sections = pageSections(await llmsFull(env, origin))
      const match =
        sections.find((s) => s.title.toLowerCase() === want) ??
        sections.find((s) => s.title.toLowerCase().includes(want))
      if (!match) return { ...text(`No page matching "${args.title}". Call list_docs for the exact titles.`), isError: true }
      return text(match.text)
    }
    case 'lint_css': {
      let code = String(args.code ?? '')
      const inputTruncated = code.length > MAX_LINT_INPUT
      if (inputTruncated) code = code.slice(0, MAX_LINT_INPUT)
      await tokens(env, origin) // ensures _valueIndex is built
      const findings: Array<{ value: string; issue: string; suggestion: string }> = []
      const seen = new Set<string>()
      const suggestFor = (norm: string, fallback: string) => {
        const toks = _valueIndex?.get(norm)
        return toks && toks.length ? toks.map((t) => `var(--${t})`).join(' or ') : fallback
      }
      const scan = (re: RegExp, build: (raw: string) => { value: string; issue: string; suggestion: string }) => {
        for (const m of code.matchAll(re)) {
          if (findings.length >= MAX_FINDINGS) return
          const raw = m[0]
          if (seen.has(raw)) continue
          seen.add(raw)
          findings.push(build(raw))
        }
      }
      scan(/#[0-9a-fA-F]{3,8}\b/g, (raw) => ({
        value: raw,
        issue: 'raw color; the DS forbids hardcoded colors',
        suggestion: suggestFor(normalizeValue(raw), 'map to a --color-* role token (search_tokens)'),
      }))
      scan(/\b(?:rgb|rgba|hsl|hsla)\([^)]{0,120}\)/gi, (raw) => ({
        value: raw,
        issue: 'raw color function; use a token',
        suggestion: 'map to a --color-* role token (search_tokens)',
      }))
      scan(/\b\d*\.?\d+(?:px|rem)\b/g, (raw) => ({
        value: raw,
        issue: 'raw length; spacing/radius/type must come from a token',
        suggestion: suggestFor(normalizeValue(raw), 'use the nearest --space-* / --radius-* / --font-size-* token (search_tokens)'),
      }))
      return json({
        clean: findings.length === 0,
        count: findings.length,
        truncatedInput: inputTruncated,
        truncatedFindings: findings.length >= MAX_FINDINGS,
        rule: 'Never hardcode a color, spacing, typography, radius, shadow, or motion value. Always read the token.',
        findings,
      })
    }
    case 'get_agents_guide':
      return text(await agentsGuide(env, origin))
    default:
      return { ...text(`Unknown tool: ${name}`), isError: true }
  }
}

// --- JSON-RPC / MCP ---------------------------------------------------------------
function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

async function handleRpc(msg: any, env: Env, origin: string): Promise<object | null> {
  const { id, method, params } = msg ?? {}
  // A JSON-RPC message with no `id` is a notification — never respond to it.
  if (id === undefined) return null
  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion
      const protocolVersion =
        typeof requested === 'string' && SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'RamosLabs Design System tools. Look up tokens with search_tokens/get_token, verify color contrast with check_contrast, read doctrine with list_docs/get_doc, and lint styles with lint_css. Never invent a token, value, or rule; if it is not returned here, ask.',
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })
    case 'tools/call': {
      try {
        const out = await callTool(String(params?.name), (params?.arguments ?? {}) as Record<string, unknown>, env, origin)
        return rpcResult(id, out)
      } catch (e) {
        return rpcResult(id, { content: [{ type: 'text', text: `Tool error: ${(e as Error).message}` }], isError: true })
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

async function handleMcp(request: Request, env: Env, origin: string, meta: ReqMeta): Promise<Response> {
  // This transport does not open a server->client SSE stream on GET, so per the
  // Streamable HTTP spec, GET is Method Not Allowed. (Discovery is via llms.txt / docs/MCP.md.)
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST for MCP requests (JSON-RPC over Streamable HTTP).' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS', ...CORS },
    })
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify(rpcError(null, -32600, 'Request body too large')), {
      status: 413,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'Parse error')), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
  const messages = Array.isArray(body) ? body : [body]
  const responses: object[] = []
  for (const msg of messages) {
    // Count MCP usage by method, and tools/call by tool name. `initialize` is the closest
    // thing to a "new connection" on this stateless Streamable-HTTP transport.
    const method = String(msg?.method ?? '')
    if (method) {
      const detail = method === 'tools/call' ? `tools/call:${String(msg?.params?.name ?? '?')}` : method
      logEvent(env, 'mcp', '/mcp', detail, meta)
    }
    const r = await handleRpc(msg, env, origin)
    if (r) responses.push(r)
  }
  // Notifications only -> 202 Accepted, no body.
  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: CORS })
  }
  const payload = Array.isArray(body) ? responses : responses[0]
  return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', ...CORS } })
}

// Query the Analytics Engine SQL API. Returns the rows, or null when no read token is
// configured or the query fails — the caller degrades to npm-only in that case.
async function queryAE(env: Env, sql: string): Promise<Array<Record<string, unknown>> | null> {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) return null
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      { method: 'POST', headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` }, body: sql }
    )
    if (!res.ok) return null
    const j = (await res.json()) as { data?: Array<Record<string, unknown>> }
    return j.data ?? null
  } catch {
    return null
  }
}

const NPM_PKG = '@ramoslabs/tokens'

// Live npm download counts (day/week/month), edge-cached. Public adoption metric.
async function npmDownloads(): Promise<Record<string, number | null>> {
  const windows = ['last-day', 'last-week', 'last-month'] as const
  const entries = await Promise.all(
    windows.map(async (w) => {
      try {
        const res = await fetch(`https://api.npmjs.org/downloads/point/${w}/${NPM_PKG}`, {
          cf: { cacheTtl: 3600, cacheEverything: true },
        } as RequestInit)
        return [w, res.ok ? (((await res.json()) as { downloads?: number }).downloads ?? null) : null] as const
      } catch {
        return [w, null] as const
      }
    })
  )
  return Object.fromEntries(entries)
}

// Daily npm downloads for the last 30 days (a real time series for the trend chart).
async function npmSeries(): Promise<Array<{ day: string; downloads: number }>> {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/range/last-month/${NPM_PKG}`, {
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit)
    if (!res.ok) return []
    const j = (await res.json()) as { downloads?: Array<{ downloads: number; day: string }> }
    return j.downloads ?? []
  } catch {
    return []
  }
}

// Analytics Engine aggregates over the last 30 days. Null when no read token is configured.
async function usageAggregates(env: Env) {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) return null
  const W = `timestamp > NOW() - INTERVAL '30' DAY`
  const [byType, mcpByTool, topPages, agentFiles] = await Promise.all([
    queryAE(env, `SELECT index1 AS type, SUM(_sample_interval) AS n FROM ${AE_DATASET} WHERE ${W} GROUP BY type`),
    queryAE(env, `SELECT blob3 AS detail, SUM(_sample_interval) AS n FROM ${AE_DATASET} WHERE index1 = 'mcp' AND ${W} GROUP BY detail ORDER BY n DESC LIMIT 20`),
    queryAE(env, `SELECT blob2 AS path, SUM(_sample_interval) AS n FROM ${AE_DATASET} WHERE index1 = 'page' AND ${W} GROUP BY path ORDER BY n DESC LIMIT 15`),
    queryAE(env, `SELECT blob3 AS file, SUM(_sample_interval) AS n FROM ${AE_DATASET} WHERE index1 = 'agent_file' AND ${W} GROUP BY file ORDER BY n DESC LIMIT 15`),
  ])
  if (!byType) return null
  return { window: 'last-30-days', byType, mcpByTool: mcpByTool ?? [], topPages: topPages ?? [], agentFiles: agentFiles ?? [] }
}

// PUBLIC surface (linked from /agents/ and llms.txt): npm downloads only — data that is
// already public on npm. Server-side usage aggregates are deliberately NOT exposed here.
async function handleStats(env: Env, meta: ReqMeta): Promise<Response> {
  logEvent(env, 'agent_file', '/stats.json', 'stats.json', meta)
  const payload = {
    package: NPM_PKG,
    npm: { url: `https://www.npmjs.com/package/${NPM_PKG}`, downloads: await npmDownloads() },
    measurement:
      'npm downloads are public. Page, agent-file, and MCP metrics are collected server-side (Analytics Engine, cookieless) and are not exposed on this public endpoint.',
  }
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...CORS },
  })
}

// UNLISTED surface (not in nav, sitemap, llms.txt, or robots): full usage for the private
// /metricas dashboard. Same-origin only (no CORS), noindex, never cached at the edge.
async function handleMetrics(env: Env, url: URL): Promise<Response> {
  // 5-minute edge cache: don't re-run the Analytics Engine SQL query (or hit npm) on every
  // visit. Still unlisted + noindex; anyone who discovers the URL sees aggregates only.
  const cache = (globalThis as { caches?: { default: { match: (r: Request) => Promise<Response | undefined>; put: (r: Request, res: Response) => Promise<void> } } }).caches?.default
  const cacheKey = new Request(url.toString(), { method: 'GET' })
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) return hit
  }
  const [downloads, series, usage] = await Promise.all([npmDownloads(), npmSeries(), usageAggregates(env)])
  const payload = {
    package: NPM_PKG,
    npm: { url: `https://www.npmjs.com/package/${NPM_PKG}`, downloads, series },
    usage,
    measurement: 'Cookieless, no PII (aggregates only). Page/agent-file/MCP metrics from Cloudflare Analytics Engine (last 30 days).',
  }
  const res = new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
  if (cache) await cache.put(cacheKey, res.clone())
  return res
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const meta = reqMeta(request)
    const path = url.pathname

    if (path === '/mcp' || path === '/mcp/') {
      return handleMcp(request, env, url.origin, meta)
    }
    if (path === '/stats.json') {
      return handleStats(env, meta)
    }
    // Unlisted private dashboard data feed (see /metricas). Not advertised anywhere.
    if (path === '/metricas.json') {
      return handleMetrics(env, url)
    }

    // Count meaningful GETs server-side (no cookie, no client JS, agents and bots included).
    // Skip fonts, images, CSS/JS and other sub-resources, and the private dashboard itself,
    // to keep the dataset signal-dense.
    if (request.method === 'GET' && path !== '/metricas/' && path !== '/metricas') {
      if (AGENT_FILES.has(path)) logEvent(env, 'agent_file', path, path.replace(/^\//, ''), meta)
      else if (path === '/' || path.endsWith('/')) logEvent(env, 'page', path, '', meta)
    }

    // Static assets (served by the ASSETS binding, which also applies _headers/_redirects).
    return env.ASSETS.fetch(request)
  },
}
