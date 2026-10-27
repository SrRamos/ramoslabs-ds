import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { atSupportMarkdown } from '../../../packages/contracts/scripts/at-wording.mjs';
import { pages, SITE, mdPathFor, type Page } from '../src/data/pages';
import { answerById, answerMarkdown } from '../src/data/answers';
import {
  buildComponents,
  buildKinds,
  slugOf,
  SCHEMA_FILES,
  type ContractJson,
  type DocLink,
  type KindsContractJson,
} from './registry';

// RamosLabs DS agentic layer, as an Astro integration.
// On `astro:build:done` it emits, into the build output (dist/):
//   llms.txt, llms-full.txt, registry.json, robots.txt, AGENTS.md, tokens.json, tokens.css,
//   schema/{contract,kinds,at-support}.v1.json (the `$schema` URLs the contracts declare)
// registry.json's `components` and `kinds` are generated from @ramoslabs/contracts (ADR-010).
// It also writes the committed copies at the repo root for versioning.
// The production URL comes from Astro's `site` config — the single source of truth,
// so page links in every artifact are clean, crawlable URLs.
//
// Sitemap generation is owned by @astrojs/sitemap (emits sitemap-index.xml).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agenticDir = __dirname;
const repoRoot = path.resolve(agenticDir, '..', '..', '..');
const contentDir = path.join(agenticDir, 'content');
const tokensJsonPath = path.join(repoRoot, 'packages', 'tokens', 'dist', 'tokens.json');
const tokensCssPath = path.join(repoRoot, 'packages', 'tokens', 'dist', 'tokens.css');
const tokensPkgPath = path.join(repoRoot, 'packages', 'tokens', 'package.json');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
const skillPath = path.join(repoRoot, '.claude', 'skills', 'ramoslabs-ds', 'SKILL.md');

// The contracts package is a dev workspace dependency; resolve it the way a consumer would.
const contractsDir = path.dirname(
  createRequire(import.meta.url).resolve('@ramoslabs/contracts/package.json'),
);

// Only non-interactive doc pages carry agent-facing prose; the color picker is an app feature.
const docPages = pages.filter((p) => !p.interactive);

// --- helpers -------------------------------------------------------------------
function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const text = stripBom(raw);
  if (!text.startsWith('---')) return { data: {}, body: text.trim() };
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { data: {}, body: text.trim() };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { data: {}, body: text.trim() };
  const data: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  const body = lines
    .slice(end + 1)
    .join('\n')
    .trim();
  return { data, body };
}

function baseUrl(site: string) {
  return site.replace(/\/+$/, '');
}

function pageUrl(site: string, page: Page) {
  // page.path is a clean path with leading + trailing slash ('/', '/foundations/colors/').
  return `${baseUrl(site)}${page.path}`;
}

type LoadedPage = Page & { body: string; present: boolean };

function loadPages(): LoadedPage[] {
  return docPages.map((page) => {
    // Answers pages are authored as reviewed JSON (src/data/answers); their body is derived.
    if (page.group === 'answers') {
      const answer = answerById(page.id);
      if (!answer) {
        process.stderr.write(`agentic warn: answer data missing for "${page.id}"\n`);
        return { ...page, body: '', present: false };
      }
      return { ...page, body: answerMarkdown(answer), present: true };
    }
    const filePath = path.join(contentDir, page.contentFile);
    if (!fs.existsSync(filePath)) {
      process.stderr.write(`agentic warn: content missing for "${page.id}": ${page.contentFile}\n`);
      return { ...page, body: '', present: false };
    }
    const { body } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
    return { ...page, body, present: true };
  });
}

type Tokens = {
  flat: Record<string, unknown>;
  byCategory: Record<string, number>;
  grouped: Record<string, Array<{ name: string; value: string }>>;
  total: number;
};

function loadTokens(): Tokens {
  const flat = JSON.parse(fs.readFileSync(tokensJsonPath, 'utf8')) as Record<string, unknown>;
  const byCategory: Record<string, number> = {};
  const grouped: Record<string, Array<{ name: string; value: string }>> = {};
  for (const [name, value] of Object.entries(flat)) {
    const category = name.split('-')[0];
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    (grouped[category] ??= []).push({ name, value: String(value) });
  }
  return { flat, byCategory, grouped, total: Object.keys(flat).length };
}

type Contracts = { components: ContractJson[]; kinds: KindsContractJson | null };

function loadContracts(): Contracts {
  const dir = path.join(contractsDir, 'contracts');
  const components: ContractJson[] = [];
  let kinds: KindsContractJson | null = null;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.contract.json')) continue;
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (file === 'kinds.contract.json') kinds = json as KindsContractJson;
    else components.push(json as ContractJson);
  }
  return { components, kinds };
}

// Site pages that document a component live at /components/<slug>/. None is invented: a
// component without a page gets no link.
function docLinksFor(site: string, components: ContractJson[]): Record<string, DocLink[]> {
  const out: Record<string, DocLink[]> = {};
  for (const c of components) {
    const slug = slugOf(c.name);
    out[slug] = pages
      .filter((p) => p.path === `/components/${slug}/`)
      .map((p) => ({ title: p.title, url: pageUrl(site, p) }));
  }
  return out;
}

function tokenTableMarkdown(tokens: Tokens) {
  const parts: string[] = [];
  for (const category of Object.keys(tokens.grouped)) {
    parts.push(`### ${category} (${tokens.grouped[category].length})\n`);
    parts.push('| Token | Value |');
    parts.push('| --- | --- |');
    for (const { name, value } of tokens.grouped[category]) {
      parts.push(`| \`--${name}\` | \`${value}\` |`);
    }
    parts.push('');
  }
  return parts.join('\n');
}

// --- artifact builders ---------------------------------------------------------
function buildLlmsTxt(site: string, resolved: LoadedPage[]) {
  const b = baseUrl(site);
  const bullets = (group: string) =>
    resolved
      .filter((p) => p.group === group)
      .map((p) => `- [${p.title}](${pageUrl(site, p)}): ${p.summary}`)
      .join('\n');

  return `# ${SITE.title}

> ${SITE.tagline}

A mono-indigo, taxonomy-first design system. Tokens are the single source of truth:
color, spacing, typography, radius, shadow, and motion values ship as CSS variables via
\`@ramoslabs/tokens\`. Never hardcode a raw value; read the token.

## For agents

${bullets('agents')}

## Answers

${bullets('answers')}

## Foundations

${bullets('foundations')}

## Patterns

${bullets('patterns')}

## Machine-readable

- [llms-full.txt](${b}/llms-full.txt): every page inlined, plus the full token table.
- [registry.json](${b}/registry.json): tokens, patterns, and components as JSON.
- Markdown pages: every documentation page also exists as Markdown at its URL with \`.md\` instead of the trailing slash (for example ${b}/foundations/colors.md), or request the normal URL with \`Accept: text/markdown\`.
- [tokens.json](${b}/tokens.json): the flat DTCG token map (name to resolved value).
- [stats.json](${b}/stats.json): live, cookieless usage — npm downloads for the token package.

## MCP server

An MCP (Model Context Protocol) server exposes the design system as typed tools —
\`search_tokens\`, \`get_token\`, \`check_contrast\`, \`list_docs\`, \`get_doc\`, \`lint_css\`,
\`list_components\`, \`get_component\`, \`get_kind\`, \`get_agents_guide\`. Streamable HTTP, read-only, no auth. Connect an MCP-capable agent to
\`${b}/mcp\`. Prefer these tools over fetching files: they are structured and never invented.

## Agent skill

A Claude Code skill that makes an agent build/review UI strictly by this system (never
inventing tokens, values, or rules) is at [skill.md](${b}/skill.md). Install it by copying it
to \`.claude/skills/ramoslabs-ds/SKILL.md\` in a project (or \`~/.claude/skills/…\` globally).

## Install

\`bun add @ramoslabs/tokens\` (public npm). Then \`@import '@ramoslabs/tokens/css'\`.

## License

Free to use under the MIT License. Keep the copyright and license notice, and credit
RamosLabs. ${SITE.copyright}. ${SITE.website}
`;
}

function buildLlmsFull(
  site: string,
  resolved: LoadedPage[],
  tokens: Tokens,
  components: ContractJson[],
) {
  const s: string[] = [];
  s.push(`# ${SITE.title}`, '');
  s.push(`> ${SITE.tagline}`, '');
  s.push('This is the complete, self-contained reference for AI agents building UI on the');
  s.push(
    'RamosLabs Design System. It inlines every documentation page and the full token table.',
    '',
  );
  s.push(
    `Free to use under the MIT License. Keep the copyright and license notice, and credit RamosLabs. ${SITE.copyright}. ${SITE.website}`,
    '',
  );
  s.push(
    "Install: `bun add @ramoslabs/tokens` (public npm), then `@import '@ramoslabs/tokens/css'`.",
    '',
  );
  s.push(`## Token reference (${tokens.total} tokens)`, '');
  s.push(tokenTableMarkdown(tokens));

  if (components.length) {
    s.push('## Component assistive-technology support (generated from the contracts)', '');
    s.push(
      'Per AT and platform status, copied from each contract (ADR-010, ADR-015). Wording is fixed by status.',
      '',
    );
    for (const c of components) {
      s.push(`### ${c.name}`, '', atSupportMarkdown(c.a11y.atSupport), '');
    }
  }

  for (const page of resolved) {
    s.push(`# ${page.title}`, '');
    s.push(`Source: ${pageUrl(site, page)}`, '');
    s.push(
      page.present && page.body ? page.body : '_Content pending. See the source URL above._',
      '',
    );
  }
  return s.join('\n');
}

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'bingbot',
  'DuckAssistBot',
  'MistralAI-User',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Meta-ExternalAgent',
  'cohere-ai',
  'Diffbot',
  'Timpibot',
];

function buildRobots(site: string) {
  const b = baseUrl(site);
  const lines = [
    '# RamosLabs Design System robots policy.',
    '# Public, free-to-use design system (MIT). We welcome AI ingestion.',
    `# AI agents: structured docs at ${b}/llms.txt and ${b}/llms-full.txt`,
    '',
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
    'Allow: /',
    '',
  ];
  for (const ua of AI_CRAWLERS) {
    lines.push(`User-agent: ${ua}`, 'Allow: /', '');
  }
  lines.push(`Sitemap: ${b}/sitemap-index.xml`, '');
  return lines.join('\n');
}

function buildPageMarkdown(site: string, page: LoadedPage) {
  return `# ${page.title}

> ${page.summary}

Source: ${pageUrl(site, page)}

${page.body}
`;
}

export function buildRegistry(
  site: string,
  resolved: LoadedPage[],
  tokens: Tokens,
  version: string,
  contracts: Contracts,
) {
  return JSON.stringify(
    {
      name: SITE.title,
      version,
      license: SITE.license,
      copyright: SITE.copyright,
      homepage: SITE.website,
      attribution: SITE.attribution,
      install: 'bun add @ramoslabs/tokens',
      generatedFrom:
        '@ramoslabs/tokens dist JSON + distilled page content + @ramoslabs/contracts contract JSON',
      schemas: Object.fromEntries(
        Object.keys(SCHEMA_FILES).map((f) => [
          f.replace(/\.v1\.json$/, ''),
          `${baseUrl(site)}/schema/${f}`,
        ]),
      ),
      tokens: {
        total: tokens.total,
        byCategory: tokens.byCategory,
        url: `${baseUrl(site)}/tokens.json`,
      },
      patterns: resolved
        .filter((p) => p.group === 'patterns')
        .map((p) => ({ id: p.id, title: p.title, url: pageUrl(site, p), summary: p.summary })),
      answers: resolved
        .filter((p) => p.group === 'answers')
        .map((p) => ({ id: p.id, title: p.title, url: pageUrl(site, p), summary: p.summary })),
      components: buildComponents(contracts.components, docLinksFor(site, contracts.components)),
      kinds: buildKinds(contracts.kinds),
    },
    null,
    2,
  );
}

function tokensVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(tokensPkgPath, 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * A fresh registry.json text, generated from the sources (tokens dist, pages, contracts).
 * The drift check compares the built `registry.json` with this (ADR-010).
 */
export function generateRegistry(site = 'https://design.ramoslabs.com'): string {
  return buildRegistry(site, loadPages(), loadTokens(), tokensVersion(), loadContracts()) + '\n';
}

// --- integration ---------------------------------------------------------------
export function agentic(): AstroIntegration {
  let site = 'https://design.ramoslabs.com';
  return {
    name: 'ramoslabs-agentic',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (config.site) site = config.site;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const tokens = loadTokens();
        const resolved = loadPages();

        const version = tokensVersion();
        const contracts = loadContracts();

        const artifacts: Record<string, string> = {
          'llms.txt': buildLlmsTxt(site, resolved),
          'llms-full.txt': buildLlmsFull(site, resolved, tokens, contracts.components),
          'registry.json': buildRegistry(site, resolved, tokens, version, contracts) + '\n',
          'robots.txt': buildRobots(site),
        };

        // 1) committed copies at repo root (versioning)
        for (const [name, content] of Object.entries(artifacts)) {
          fs.writeFileSync(path.join(repoRoot, name), content);
        }

        // 2) served copies in the build output, plus tokens.json + AGENTS.md
        for (const [name, content] of Object.entries(artifacts)) {
          fs.writeFileSync(path.join(outDir, name), content);
        }
        fs.copyFileSync(tokensJsonPath, path.join(outDir, 'tokens.json'));
        // Serve the compiled CSS variables so agents without npm can consume the tokens
        // directly (announced in AGENTS.md / README as a machine source).
        if (fs.existsSync(tokensCssPath)) {
          fs.copyFileSync(tokensCssPath, path.join(outDir, 'tokens.css'));
        }
        if (fs.existsSync(agentsMdPath)) {
          fs.copyFileSync(agentsMdPath, path.join(outDir, 'AGENTS.md'));
        }
        // Serve the agent skill so any project can discover and install it.
        if (fs.existsSync(skillPath)) {
          fs.copyFileSync(skillPath, path.join(outDir, 'skill.md'));
        }

        // The JSON Schemas the contracts name in `$schema`, served at their `$id` URLs.
        fs.mkdirSync(path.join(outDir, 'schema'), { recursive: true });
        for (const [served, source] of Object.entries(SCHEMA_FILES)) {
          fs.copyFileSync(
            path.join(contractsDir, 'schema', source),
            path.join(outDir, 'schema', served),
          );
        }

        // 3) a Markdown twin of every doc page (/<route>.md), served as text/markdown by the
        // Worker and offered via Link rel=alternate + Accept negotiation.
        for (const page of resolved) {
          if (!page.present) continue;
          const target = path.join(outDir, mdPathFor(page.path));
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, buildPageMarkdown(site, page));
        }

        const missing = resolved.filter((p) => !p.present).length;
        logger.info(
          `agentic layer: ${resolved.length} pages (${missing} missing), ${tokens.total} tokens, ${contracts.components.length} components, clean URLs @ ${baseUrl(site)}`,
        );
      },
    },
  };
}
