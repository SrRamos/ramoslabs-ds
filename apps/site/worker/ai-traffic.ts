// Classification of AI-related traffic for the private /metricas dashboard.
// Telemetry stores the raw user agent (blob4) and referer (blob5) of each event; this module
// turns them into "which AI bot" and "which assistant sent a human". Pure functions, no I/O.

export type BotKind = 'training' | 'search' | 'user';

export type AiBot = { token: string; vendor: string; kind: BotKind };

// Matched case-insensitively as a substring of the User-Agent. Keep in sync with robots.txt
// (apps/site/agentic/integration.ts AI_CRAWLERS). Google-Extended and Applebot-Extended are
// robots.txt tokens only and never appear in a User-Agent, so they are not listed. Claude-Web and
// anthropic-ai are retired from robots.txt but may still show up in older traffic.
export const AI_BOTS: AiBot[] = [
  { token: 'GPTBot', vendor: 'OpenAI', kind: 'training' },
  { token: 'OAI-SearchBot', vendor: 'OpenAI', kind: 'search' },
  { token: 'ChatGPT-User', vendor: 'OpenAI', kind: 'user' },
  { token: 'ClaudeBot', vendor: 'Anthropic', kind: 'training' },
  { token: 'Claude-SearchBot', vendor: 'Anthropic', kind: 'search' },
  { token: 'Claude-User', vendor: 'Anthropic', kind: 'user' },
  { token: 'Claude-Web', vendor: 'Anthropic', kind: 'user' },
  { token: 'anthropic-ai', vendor: 'Anthropic', kind: 'training' },
  { token: 'PerplexityBot', vendor: 'Perplexity', kind: 'search' },
  { token: 'Perplexity-User', vendor: 'Perplexity', kind: 'user' },
  { token: 'Applebot', vendor: 'Apple', kind: 'search' },
  { token: 'bingbot', vendor: 'Microsoft', kind: 'search' },
  { token: 'DuckAssistBot', vendor: 'DuckDuckGo', kind: 'user' },
  { token: 'MistralAI-User', vendor: 'Mistral', kind: 'user' },
  { token: 'CCBot', vendor: 'Common Crawl', kind: 'training' },
  { token: 'Bytespider', vendor: 'ByteDance', kind: 'training' },
  { token: 'Amazonbot', vendor: 'Amazon', kind: 'training' },
  { token: 'Meta-ExternalAgent', vendor: 'Meta', kind: 'training' },
  { token: 'cohere-ai', vendor: 'Cohere', kind: 'training' },
  { token: 'Diffbot', vendor: 'Diffbot', kind: 'training' },
];

export type Assistant = { name: string; domains: string[] };

// A visit counts as an assistant referral when the Referer host is one of these domains
// (or a subdomain of it). chat.openai.com is the legacy ChatGPT host.
export const ASSISTANTS: Assistant[] = [
  { name: 'ChatGPT', domains: ['chatgpt.com', 'chat.openai.com'] },
  { name: 'Perplexity', domains: ['perplexity.ai'] },
  { name: 'Claude', domains: ['claude.ai'] },
  { name: 'Gemini', domains: ['gemini.google.com'] },
  { name: 'Copilot', domains: ['copilot.microsoft.com'] },
];

export function classifyBot(ua: string): AiBot | null {
  const u = ua.toLowerCase();
  return AI_BOTS.find((b) => u.includes(b.token.toLowerCase())) ?? null;
}

export function classifyAssistant(referer: string): Assistant | null {
  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    ASSISTANTS.find((a) => a.domains.some((d) => host === d || host.endsWith('.' + d))) ?? null
  );
}

// SQL-literal safe by construction: tokens and domains are fixed constants above.
const likeAny = (column: string, needles: string[]) =>
  needles.map((n) => `${column} LIKE '%${n}%'`).join(' OR ');

/** Analytics Engine SQL: events whose user agent contains an AI bot token, by UA and event type. */
export function aiBotsSql(dataset: string, window: string): string {
  return `SELECT blob4 AS ua, index1 AS type, SUM(_sample_interval) AS n FROM ${dataset} WHERE ${window} AND (${likeAny(
    'blob4',
    AI_BOTS.map((b) => b.token),
  )}) GROUP BY ua, type ORDER BY n DESC LIMIT 500`;
}

/** Analytics Engine SQL: page views whose referer is an AI assistant domain. */
export function aiReferralsSql(dataset: string, window: string): string {
  const domains = ASSISTANTS.flatMap((a) => a.domains);
  return `SELECT blob5 AS referer, SUM(_sample_interval) AS n FROM ${dataset} WHERE index1 = 'page' AND ${window} AND (${likeAny('blob5', domains)}) GROUP BY referer ORDER BY n DESC LIMIT 500`;
}

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export type AiBotRow = {
  bot: string;
  vendor: string;
  kind: BotKind;
  total: number;
  byType: Record<string, number>;
};

export function summarizeAiBots(rows: Array<Record<string, unknown>>): AiBotRow[] {
  const out = new Map<string, AiBotRow>();
  for (const r of rows) {
    const bot = classifyBot(String(r.ua ?? ''));
    if (!bot) continue;
    const row = out.get(bot.token) ?? {
      bot: bot.token,
      vendor: bot.vendor,
      kind: bot.kind,
      total: 0,
      byType: {},
    };
    const n = num(r.n);
    const type = String(r.type ?? '');
    row.total += n;
    row.byType[type] = (row.byType[type] ?? 0) + n;
    out.set(bot.token, row);
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}

export type AiReferralRow = { assistant: string; n: number };

export function summarizeAiReferrals(rows: Array<Record<string, unknown>>): AiReferralRow[] {
  const out = new Map<string, number>();
  for (const r of rows) {
    const a = classifyAssistant(String(r.referer ?? ''));
    if (!a) continue;
    out.set(a.name, (out.get(a.name) ?? 0) + num(r.n));
  }
  return [...out.entries()].map(([assistant, n]) => ({ assistant, n })).sort((a, b) => b.n - a.n);
}
