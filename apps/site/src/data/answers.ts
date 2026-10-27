// Question-led, citable pages. The reviewed JSON under ./answers/ is the single source for
// the HTML page, its FAQPage/HowTo JSON-LD, and the llms.txt / llms-full.txt entries.
//
// Evidence rule: every factual statement carries a {ref:id} marker pointing at an entry in the
// answer's `references` (primary source, with its date). The build fails on a marker with no
// reference, or a reference nothing cites, so nothing unsourced or orphaned can ship.
import mutedText from './answers/muted-text-token.json'
import indigoContrast from './answers/indigo-contrast-wcag.json'
import installTokens from './answers/install-tokens-vue-react-html.json'
import comparison from './answers/ramoslabs-ds-vs-material-vs-tailwind.json'

export type AnswerSection = {
  heading: string
  body?: string[]
  table?: { caption?: string; head: string[]; rows: string[][] }
  code?: { label: string; lang: string; source: string }[]
}

// kind: external = a third-party primary source; ds = this repo at a pinned commit;
// measured = something we ran and recorded (method and date are in the title).
export type Reference = {
  id: string
  kind: 'external' | 'ds' | 'measured'
  title: string
  publisher: string
  url: string
  date: string // the source's own date/version, or the date we measured
  accessed?: string // when we read it (external sources)
}

export type Answer = {
  id: string
  title: string
  summary: string
  short: string
  sections: AnswerSection[]
  faq: { q: string; a: string }[]
  howto?: { name: string; steps: { name: string; text: string }[] }
  references: Reference[]
}

export const answers: Answer[] = [mutedText, indigoContrast, installTokens, comparison] as Answer[]

export function answerById(id: string): Answer | undefined {
  return answers.find((a) => a.id === id)
}

const MARKER = /\{ref:([a-z0-9-]+)\}/g

// Every string that can carry a marker, in one place, for validation.
function allStrings(a: Answer): string[] {
  const out = [a.short, a.summary, ...a.faq.flatMap((f) => [f.q, f.a])]
  for (const s of a.sections) {
    out.push(...(s.body ?? []))
    if (s.table) out.push(...(s.table.caption ? [s.table.caption] : []), ...s.table.rows.flat())
  }
  if (a.howto) out.push(...a.howto.steps.map((s) => s.text))
  return out
}

export function validateAnswer(a: Answer) {
  const ids = new Set(a.references.map((r) => r.id))
  const used = new Set<string>()
  for (const s of allStrings(a)) {
    for (const m of s.matchAll(MARKER)) {
      if (!ids.has(m[1])) throw new Error(`answer "${a.id}": marker {ref:${m[1]}} has no reference`)
      used.add(m[1])
    }
  }
  for (const id of ids) if (!used.has(id)) throw new Error(`answer "${a.id}": reference "${id}" is never cited`)
  if (ids.size !== a.references.length) throw new Error(`answer "${a.id}": duplicate reference id`)
  for (const r of a.references) {
    if (!/^https:\/\//.test(r.url) || !r.date)
      throw new Error(`answer "${a.id}": reference "${r.id}" needs an https url and a date`)
  }
}
answers.forEach(validateAnswer)

const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const refNumber = (a: Answer, id: string) => a.references.findIndex((r) => r.id === id) + 1

// Escape, then turn `inline code` into <code> and {ref:id} into a numbered link to the reference.
export function inlineHtml(text: string, answer?: Answer): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(MARKER, (_m, id: string) => {
      if (!answer) return ''
      return `<sup class="an-ref"><a href="#ref-${id}" aria-label="Source ${refNumber(answer, id)}">[${refNumber(answer, id)}]</a></sup>`
    })
}

/** Plain text for JSON-LD and the index: no backticks, no source markers. */
export const plain = (text: string) =>
  text
    .replace(MARKER, '')
    .replace(/`/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()

// schema.org FAQPage (and HowTo when the answer is procedural) for one answer page.
export function answerJsonLd(answer: Answer, url: string) {
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url,
    mainEntity: answer.faq.map((f) => ({
      '@type': 'Question',
      name: plain(f.q),
      acceptedAnswer: { '@type': 'Answer', text: plain(f.a) },
    })),
  }
  const out: Record<string, unknown>[] = [faq]
  if (answer.howto) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: answer.howto.name,
      url,
      step: answer.howto.steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: plain(s.name),
        text: plain(s.text),
      })),
    })
  }
  return out
}

function mdRow(cells: string[]) {
  return `| ${cells.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`
}

export function refLine(r: Reference, n: number): string {
  const when = r.accessed ? `${r.date}; accessed ${r.accessed}` : r.date
  return `${n}. ${r.title}. ${r.publisher}. ${when}. ${r.url}`
}

// Plain markdown body used by llms-full.txt and the .md twin (the page itself is rendered by Astro).
export function answerMarkdown(answer: Answer): string {
  const cite = (t: string) => t.replace(MARKER, (_m, id: string) => ` [${refNumber(answer, id)}]`)
  const s: string[] = [`**Short answer:** ${cite(answer.short)}`, '']
  for (const sec of answer.sections) {
    s.push(`## ${sec.heading}`, '')
    for (const p of sec.body ?? []) s.push(cite(p), '')
    if (sec.table) {
      if (sec.table.caption) s.push(cite(sec.table.caption), '')
      s.push(mdRow(sec.table.head), mdRow(sec.table.head.map(() => '---')))
      for (const r of sec.table.rows) s.push(mdRow(r.map(cite)))
      s.push('')
    }
    for (const c of sec.code ?? []) s.push(`${c.label}:`, '', '```' + c.lang, c.source, '```', '')
  }
  if (answer.howto) {
    s.push(`## ${answer.howto.name}`, '')
    answer.howto.steps.forEach((st, i) => s.push(`${i + 1}. ${st.name}: ${cite(st.text)}`))
    s.push('')
  }
  s.push('## FAQ', '')
  for (const f of answer.faq) s.push(`**${cite(f.q)}**`, '', cite(f.a), '')
  s.push('## References', '', ...answer.references.map((r, i) => refLine(r, i + 1)), '')
  return s.join('\n').trim()
}
