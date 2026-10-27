// Question-led, citable pages. The reviewed JSON under ./answers/ is the single source for
// the HTML page, its FAQPage/HowTo JSON-LD, and the llms.txt / llms-full.txt entries.
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

export type Answer = {
  id: string
  title: string
  summary: string
  short: string
  sections: AnswerSection[]
  faq: { q: string; a: string }[]
  howto?: { name: string; steps: { name: string; text: string }[] }
  sources: string[]
}

export const answers: Answer[] = [mutedText, indigoContrast, installTokens, comparison] as Answer[]

export function answerById(id: string): Answer | undefined {
  return answers.find((a) => a.id === id)
}

const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Escape, then turn `inline code` spans into <code> for the rendered page.
export function inlineHtml(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')
}

// JSON-LD answer text is plain: drop the backtick markers.
const plain = (text: string) => text.replace(/`/g, '')

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

// Plain markdown body used by llms-full.txt (the page itself is rendered by Astro).
export function answerMarkdown(answer: Answer): string {
  const s: string[] = [`**Short answer:** ${answer.short}`, '']
  for (const sec of answer.sections) {
    s.push(`## ${sec.heading}`, '')
    for (const p of sec.body ?? []) s.push(p, '')
    if (sec.table) {
      if (sec.table.caption) s.push(`${sec.table.caption}`, '')
      s.push(mdRow(sec.table.head), mdRow(sec.table.head.map(() => '---')))
      for (const r of sec.table.rows) s.push(mdRow(r))
      s.push('')
    }
    for (const c of sec.code ?? []) s.push(`${c.label}:`, '', '```' + c.lang, c.source, '```', '')
  }
  if (answer.howto) {
    s.push(`## ${answer.howto.name}`, '')
    answer.howto.steps.forEach((st, i) => s.push(`${i + 1}. ${st.name}: ${st.text}`))
    s.push('')
  }
  s.push('## FAQ', '')
  for (const f of answer.faq) s.push(`**${f.q}**`, '', f.a, '')
  if (answer.sources.length) s.push('## Sources', '', answer.sources.join('; ') + '.', '')
  return s.join('\n').trim()
}
