// Generates the RamosLabs DS agentic layer: llms.txt, llms-full.txt, registry.json.
// Run from apps/storybook with plain Node (no flags, no extra dependencies):
//   node agentic/build-agentic.mjs
// Sources: the built @ramoslabs/tokens JSON, the distilled content/*.md files, and manifest.ts.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const agenticDir = __dirname
const storybookDir = path.resolve(agenticDir, '..')
const repoRoot = path.resolve(storybookDir, '..', '..')
const contentDir = path.join(agenticDir, 'content')
const tokensJsonPath = path.join(repoRoot, 'packages', 'tokens', 'dist', 'tokens.json')
const tokensPkgPath = path.join(repoRoot, 'packages', 'tokens', 'package.json')
const storybookStaticDir = path.join(storybookDir, 'storybook-static')

const warnings = []
const warn = (msg) => {
  warnings.push(msg)
  process.stderr.write(`warn: ${msg}\n`)
}

// --- load manifest.ts without a TypeScript loader ------------------------------
// Node runs plain .mjs, so strip the two TS-only constructs and import as a data URL.
async function loadManifest() {
  let src = fs.readFileSync(path.join(agenticDir, 'manifest.ts'), 'utf8')
  src = src.replace(/export type Page = \{[\s\S]*?\n\}\n/, '')
  src = src.replace(/: Page\[\]/, '')
  return import('data:text/javascript,' + encodeURIComponent(src))
}

// --- tiny YAML frontmatter parser ----------------------------------------------
// Handles the flat `key: value` frontmatter the content contract defines. No nesting.
function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function parseFrontmatter(raw) {
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
  const data = {}
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

// --- docs URL derivation from the verbatim storybookTitle ----------------------
// Matches Storybook routing: lowercase, non-alphanumeric runs become a single dash, trim.
function slugFromTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function docsUrl(siteUrl, storybookTitle) {
  return `${siteUrl}/?path=/docs/${slugFromTitle(storybookTitle)}--docs`
}

// --- token reference -----------------------------------------------------------
function loadTokens() {
  const flat = JSON.parse(fs.readFileSync(tokensJsonPath, 'utf8'))
  const byCategory = {}
  const grouped = {}
  for (const [name, value] of Object.entries(flat)) {
    const category = name.split('-')[0]
    byCategory[category] = (byCategory[category] ?? 0) + 1
    ;(grouped[category] ??= []).push({ name, value: String(value) })
  }
  return { flat, byCategory, grouped, total: Object.keys(flat).length }
}

function tokenTableMarkdown(tokens) {
  const parts = []
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

// --- load content --------------------------------------------------------------
function loadPages(pages) {
  return pages.map((page) => {
    const filePath = path.join(contentDir, page.file)
    if (!fs.existsSync(filePath)) {
      warn(`content file missing for page "${page.id}": ${page.file}`)
      return { ...page, summary: '', body: '', present: false }
    }
    const { data, body } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'))
    if (!data.summary) warn(`no summary in frontmatter for page "${page.id}": ${page.file}`)
    return { ...page, summary: data.summary ?? '', body, present: true }
  })
}

// --- emit ----------------------------------------------------------------------
const TITLE = 'RamosLabs Design System'

function buildLlmsTxt({ siteUrl, resolved, introSummary }) {
  const bullets = (group) =>
    resolved
      .filter((p) => p.group === group)
      .map((p) => {
        const url = docsUrl(siteUrl, p.storybookTitle)
        return p.summary ? `- [${p.title}](${url}): ${p.summary}` : `- [${p.title}](${url})`
      })
      .join('\n')

  return `# ${TITLE}

> ${introSummary}

A mono-indigo, taxonomy-first design system. Tokens are the single source of truth:
color, spacing, typography, radius, shadow, and motion values ship as CSS variables via
\`@ramoslabs/tokens\`. Never hardcode a raw value; read the token.

## Foundations

${bullets('foundations')}

## Patterns

${bullets('patterns')}

## Machine-readable

- [llms-full.txt](${siteUrl}/llms-full.txt): every page inlined, plus the full token table.
- [registry.json](${siteUrl}/registry.json): tokens, patterns, and components as JSON.
- [tokens.json](${siteUrl}/tokens.json): the flat DTCG token map (name to resolved value).
`
}

function buildLlmsFull({ siteUrl, resolved, introSummary, tokens }) {
  const sections = []
  sections.push(`# ${TITLE}`)
  sections.push('')
  sections.push(`> ${introSummary}`)
  sections.push('')
  sections.push(
    'This is the complete, self-contained reference for AI agents building UI on the'
  )
  sections.push(
    'RamosLabs Design System. It inlines every documentation page and the full token table.'
  )
  sections.push('')
  sections.push(`## Token reference (${tokens.total} tokens)`)
  sections.push('')
  sections.push(tokenTableMarkdown(tokens))

  for (const page of resolved) {
    sections.push(`# ${page.title}`)
    sections.push('')
    const url = docsUrl(siteUrl, page.storybookTitle)
    sections.push(`Source: ${url}`)
    sections.push('')
    if (page.present && page.body) {
      sections.push(page.body)
    } else {
      sections.push('_Content pending. See the source URL above._')
    }
    sections.push('')
  }
  return sections.join('\n')
}

function buildRegistry({ siteUrl, resolved, tokens, version }) {
  const patterns = resolved
    .filter((p) => p.group === 'patterns')
    .map((p) => ({
      id: p.id,
      title: p.title,
      url: docsUrl(siteUrl, p.storybookTitle),
      summary: p.summary,
    }))

  return {
    name: TITLE,
    version,
    generatedFrom: '@ramoslabs/tokens dist JSON + Storybook MDX content',
    tokens: {
      total: tokens.total,
      byCategory: tokens.byCategory,
      url: `${siteUrl}/tokens.json`,
    },
    patterns,
    components: [],
  }
}

// --- run -----------------------------------------------------------------------
async function main() {
  const manifest = await loadManifest()
  const siteUrl = manifest.SITE_URL
  const tokens = loadTokens()
  const resolved = loadPages(manifest.pages)

  const introPage = resolved.find((p) => p.group === 'root') ?? resolved[0]
  const introSummary =
    introPage?.summary ||
    'A mono-indigo design system with tokens as the single source of truth.'

  let version = '0.0.0'
  try {
    version = JSON.parse(fs.readFileSync(tokensPkgPath, 'utf8')).version ?? version
  } catch {
    warn('could not read @ramoslabs/tokens version; defaulting to 0.0.0')
  }

  const llmsTxt = buildLlmsTxt({ siteUrl, resolved, introSummary })
  const llmsFull = buildLlmsFull({ siteUrl, resolved, introSummary, tokens })
  const registry = JSON.stringify(
    buildRegistry({ siteUrl, resolved, tokens, version }),
    null,
    2
  )

  // Repo root: committed artifacts.
  const rootOutputs = {
    'llms.txt': llmsTxt,
    'llms-full.txt': llmsFull,
    'registry.json': registry + '\n',
  }
  for (const [name, content] of Object.entries(rootOutputs)) {
    fs.writeFileSync(path.join(repoRoot, name), content)
  }

  // Deploy output: serve the same files from the site root, plus the token JSON.
  if (fs.existsSync(storybookStaticDir)) {
    for (const [name, content] of Object.entries(rootOutputs)) {
      fs.writeFileSync(path.join(storybookStaticDir, name), content)
    }
    fs.copyFileSync(tokensJsonPath, path.join(storybookStaticDir, 'tokens.json'))
    const agentsMd = path.join(repoRoot, 'AGENTS.md')
    if (fs.existsSync(agentsMd)) {
      fs.copyFileSync(agentsMd, path.join(storybookStaticDir, 'AGENTS.md'))
    } else {
      warn('AGENTS.md not found at repo root; skipped copy into storybook-static')
    }
  } else {
    warn(`storybook-static not found at ${storybookStaticDir}; skipped deploy copies`)
  }

  const missing = resolved.filter((p) => !p.present).length
  process.stdout.write(
    `Built agentic layer: ${resolved.length} pages (${missing} missing), ` +
      `${tokens.total} tokens, ${warnings.length} warning(s).\n`
  )
}

main().catch((err) => {
  process.stderr.write(`build-agentic failed: ${err.stack || err}\n`)
  process.exit(1)
})
