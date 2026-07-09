import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { pages, SITE, type Page } from '../src/data/pages'

// RamosLabs DS agentic layer, as an Astro integration.
// On `astro:build:done` it emits, into the build output (dist/):
//   llms.txt, llms-full.txt, registry.json, robots.txt, AGENTS.md, tokens.json
// It also writes the committed copies at the repo root for versioning.
// The production URL comes from Astro's `site` config — the single source of truth,
// so page links in every artifact are clean, crawlable URLs.
//
// Sitemap generation is owned by @astrojs/sitemap (emits sitemap-index.xml).

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const agenticDir = __dirname
const repoRoot = path.resolve(agenticDir, '..', '..', '..')
const contentDir = path.join(agenticDir, 'content')
const tokensJsonPath = path.join(repoRoot, 'packages', 'tokens', 'dist', 'tokens.json')
const tokensPkgPath = path.join(repoRoot, 'packages', 'tokens', 'package.json')
const agentsMdPath = path.join(repoRoot, 'AGENTS.md')

// Only non-interactive doc pages carry agent-facing prose; the color picker is an app feature.
const docPages = pages.filter((p) => !p.interactive)

// --- helpers -------------------------------------------------------------------
function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const text = stripBom(raw)
  if (!text.startsWith('---')) return { data: {}, body: text.trim() }
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== '---') return { data: {}, body: text.trim() }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) return { data: {}, body: text.trim() }
  const data: Record<string, string> = {}
  for (let i = 1; i < end; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  const body = lines.slice(end + 1).join('\n').trim()
  return { data, body }
}

function baseUrl(site: string) {
  return site.replace(/\/+$/, '')
}

function pageUrl(site: string, page: Page) {
  // page.path is a clean path with leading + trailing slash ('/', '/foundations/colors/').
  return `${baseUrl(site)}${page.path}`
}

type LoadedPage = Page & { body: string; present: boolean }

function loadPages(): LoadedPage[] {
  return docPages.map((page) => {
    const filePath = path.join(contentDir, page.contentFile)
    if (!fs.existsSync(filePath)) {
      process.stderr.write(`agentic warn: content missing for "${page.id}": ${page.contentFile}\n`)
      return { ...page, body: '', present: false }
    }
    const { body } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'))
    return { ...page, body, present: true }
  })
}

type Tokens = {
  flat: Record<string, unknown>
  byCategory: Record<string, number>
  grouped: Record<string, Array<{ name: string; value: string }>>
  total: number
}

function loadTokens(): Tokens {
  const flat = JSON.parse(fs.readFileSync(tokensJsonPath, 'utf8')) as Record<string, unknown>
  const byCategory: Record<string, number> = {}
  const grouped: Record<string, Array<{ name: string; value: string }>> = {}
  for (const [name, value] of Object.entries(flat)) {
    const category = name.split('-')[0]
    byCategory[category] = (byCategory[category] ?? 0) + 1
    ;(grouped[category] ??= []).push({ name, value: String(value) })
  }
  return { flat, byCategory, grouped, total: Object.keys(flat).length }
}

function tokenTableMarkdown(tokens: Tokens) {
  const parts: string[] = []
  for (const category of Object.keys(tokens.grouped)) {
    parts.push(`### ${category} (${tokens.grouped[category].length})\n`)
    parts.push('| Token | Value |')
    parts.push('| --- | --- |')
    for (const { name, value } of tokens.grouped[category]) {
      parts.push(`| \`--${name}\` | \`${value}\` |`)
    }
    parts.push('')
  }
  return parts.join('\n')
}

// --- artifact builders ---------------------------------------------------------
function buildLlmsTxt(site: string, resolved: LoadedPage[]) {
  const b = baseUrl(site)
  const bullets = (group: string) =>
    resolved
      .filter((p) => p.group === group)
      .map((p) => `- [${p.title}](${pageUrl(site, p)}): ${p.summary}`)
      .join('\n')

  return `# ${SITE.title}

> ${SITE.tagline}

A mono-indigo, taxonomy-first design system. Tokens are the single source of truth:
color, spacing, typography, radius, shadow, and motion values ship as CSS variables via
\`@ramoslabs/tokens\`. Never hardcode a raw value; read the token.

## Foundations

${bullets('foundations')}

## Patterns

${bullets('patterns')}

## Machine-readable

- [llms-full.txt](${b}/llms-full.txt): every page inlined, plus the full token table.
- [registry.json](${b}/registry.json): tokens, patterns, and components as JSON.
- [tokens.json](${b}/tokens.json): the flat DTCG token map (name to resolved value).

## Install

\`bun add @ramoslabs/tokens\` (public npm). Then \`@import '@ramoslabs/tokens/css'\`.

## License

Free to use under the MIT License. Keep the copyright and license notice, and credit
RamosLabs. ${SITE.copyright}. ${SITE.website}
`
}

function buildLlmsFull(site: string, resolved: LoadedPage[], tokens: Tokens) {
  const s: string[] = []
  s.push(`# ${SITE.title}`, '')
  s.push(`> ${SITE.tagline}`, '')
  s.push('This is the complete, self-contained reference for AI agents building UI on the')
  s.push('RamosLabs Design System. It inlines every documentation page and the full token table.', '')
  s.push(
    `Free to use under the MIT License. Keep the copyright and license notice, and credit RamosLabs. ${SITE.copyright}. ${SITE.website}`,
    ''
  )
  s.push('Install: `bun add @ramoslabs/tokens` (public npm), then `@import \'@ramoslabs/tokens/css\'`.', '')
  s.push(`## Token reference (${tokens.total} tokens)`, '')
  s.push(tokenTableMarkdown(tokens))

  for (const page of resolved) {
    s.push(`# ${page.title}`, '')
    s.push(`Source: ${pageUrl(site, page)}`, '')
    s.push(page.present && page.body ? page.body : '_Content pending. See the source URL above._', '')
  }
  return s.join('\n')
}

const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot',
  'Bytespider', 'Amazonbot', 'Meta-ExternalAgent', 'cohere-ai', 'Diffbot', 'Timpibot',
]

function buildRobots(site: string) {
  const b = baseUrl(site)
  const lines = [
    '# RamosLabs Design System robots policy.',
    '# Public, free-to-use design system (MIT). We welcome AI ingestion.',
    `# AI agents: structured docs at ${b}/llms.txt and ${b}/llms-full.txt`,
    '',
    'User-agent: *',
    'Allow: /',
    '',
  ]
  for (const ua of AI_CRAWLERS) {
    lines.push(`User-agent: ${ua}`, 'Allow: /', '')
  }
  lines.push(`Sitemap: ${b}/sitemap-index.xml`, '')
  return lines.join('\n')
}

function buildRegistry(site: string, resolved: LoadedPage[], tokens: Tokens, version: string) {
  return JSON.stringify(
    {
      name: SITE.title,
      version,
      license: SITE.license,
      copyright: SITE.copyright,
      homepage: SITE.website,
      attribution: SITE.attribution,
      install: 'bun add @ramoslabs/tokens',
      generatedFrom: '@ramoslabs/tokens dist JSON + distilled page content',
      tokens: {
        total: tokens.total,
        byCategory: tokens.byCategory,
        url: `${baseUrl(site)}/tokens.json`,
      },
      patterns: resolved
        .filter((p) => p.group === 'patterns')
        .map((p) => ({ id: p.id, title: p.title, url: pageUrl(site, p), summary: p.summary })),
      components: [],
    },
    null,
    2
  )
}

// --- integration ---------------------------------------------------------------
export function agentic(): AstroIntegration {
  let site = 'https://design.ramoslabs.com'
  return {
    name: 'ramoslabs-agentic',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (config.site) site = config.site
      },
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir)
        const tokens = loadTokens()
        const resolved = loadPages()

        let version = '0.0.0'
        try {
          version = JSON.parse(fs.readFileSync(tokensPkgPath, 'utf8')).version ?? version
        } catch {
          /* keep default */
        }

        const artifacts: Record<string, string> = {
          'llms.txt': buildLlmsTxt(site, resolved),
          'llms-full.txt': buildLlmsFull(site, resolved, tokens),
          'registry.json': buildRegistry(site, resolved, tokens, version) + '\n',
          'robots.txt': buildRobots(site),
        }

        // 1) committed copies at repo root (versioning)
        for (const [name, content] of Object.entries(artifacts)) {
          fs.writeFileSync(path.join(repoRoot, name), content)
        }

        // 2) served copies in the build output, plus tokens.json + AGENTS.md
        for (const [name, content] of Object.entries(artifacts)) {
          fs.writeFileSync(path.join(outDir, name), content)
        }
        fs.copyFileSync(tokensJsonPath, path.join(outDir, 'tokens.json'))
        if (fs.existsSync(agentsMdPath)) {
          fs.copyFileSync(agentsMdPath, path.join(outDir, 'AGENTS.md'))
        }

        const missing = resolved.filter((p) => !p.present).length
        logger.info(
          `agentic layer: ${resolved.length} pages (${missing} missing), ${tokens.total} tokens, clean URLs @ ${baseUrl(site)}`
        )
      },
    },
  }
}
