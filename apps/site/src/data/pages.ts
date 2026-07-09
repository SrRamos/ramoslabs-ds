// Single source of truth for the documentation pages.
// Consumed by: the nav/sidebar, each page's SEO <BaseHead>, and the agentic
// integration that emits llms.txt / llms-full.txt / registry.json / sitemap data.
//
// `path` is the clean, crawlable URL (trailing slash to match trailingSlash:'always').
// `contentFile` points at the distilled plain-text body under agentic/content, which
// the agentic layer inlines for AI agents.

export type PageGroup = 'root' | 'agents' | 'foundations' | 'patterns'

export type Page = {
  id: string
  title: string
  group: PageGroup
  path: string
  summary: string
  icon: string // Material Symbols ligature, used by the sidebar
  contentFile: string // relative to apps/site/agentic/content
  interactive?: boolean // true if the page ships a JS island
}

export const SITE = {
  title: 'RamosLabs Design System',
  tagline: 'A mono-indigo, taxonomy-first design system. Tokens are the single source of truth.',
  copyright: '© 2026 RAMOS SOLUTIONS S.A.S.',
  website: 'https://ramoslabs.com',
  repo: 'https://github.com/SrRamos/ramoslabs-ds',
  license: 'MIT',
  attribution:
    'RamosLabs Design System by RAMOS SOLUTIONS S.A.S. (https://ramoslabs.com), MIT License.',
} as const

export const pages: Page[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    group: 'root',
    path: '/',
    icon: 'menu_book',
    summary:
      'What the RamosLabs DS is, its three-tier taxonomy, naming scheme, and single token source of truth',
    contentFile: 'Introduction.md',
  },
  {
    id: 'installation',
    title: 'Installation',
    group: 'root',
    path: '/installation/',
    icon: 'download',
    summary:
      'Install @ramoslabs/tokens from npm, import the CSS variables once at your app entry, and build against the token contract — plus the no-install path and the framework notes',
    contentFile: 'Installation.md',
  },

  // ---- For Agents ----
  {
    id: 'agents',
    title: 'For Agents',
    group: 'agents',
    path: '/agents/',
    icon: 'smart_toy',
    summary:
      'Agent-native, MCP-first, AI-ready by design: the machine-readable contract that lets any agent build against this system with typed, verifiable tools instead of scraped HTML',
    contentFile: 'agents/ForAgents.md',
  },
  {
    id: 'mcp',
    title: 'MCP Server',
    group: 'agents',
    path: '/agents/mcp/',
    icon: 'hub',
    summary:
      'The Model Context Protocol server: seven typed, read-only tools (search_tokens, get_token, check_contrast, list_docs, get_doc, lint_css, get_agents_guide), how to connect each client, and why the tools verify rather than just install',
    contentFile: 'agents/MCP.md',
  },

  // ---- Foundations ----
  {
    id: 'colors',
    title: 'Colors',
    group: 'foundations',
    path: '/foundations/colors/',
    icon: 'palette',
    summary:
      'Mono-indigo accent, slate neutral ramp, reserved status colors, role tokens over raw hex, and measured contrast floors',
    contentFile: 'foundations/Colors.md',
  },
  {
    id: 'typography',
    title: 'Typography',
    group: 'foundations',
    path: '/foundations/typography/',
    icon: 'format_size',
    summary:
      'Three font families, a ten-step size scale, five role recipes, and the weight, leading, tracking, and measure rules',
    contentFile: 'foundations/Typography.md',
  },
  {
    id: 'spacing',
    title: 'Spacing',
    group: 'foundations',
    path: '/foundations/spacing/',
    icon: 'space_bar',
    summary:
      'A 4px base with an 8px rhythm, fourteen fixed steps, touch-target floors, and density rules',
    contentFile: 'foundations/Spacing.md',
  },
  {
    id: 'border-radius',
    title: 'Border Radius',
    group: 'foundations',
    path: '/foundations/border-radius/',
    icon: 'rounded_corner',
    summary:
      'Eight radius steps, the 6px control signature, pill as accent only, and the concentric and squircle rules',
    contentFile: 'foundations/BorderRadius.md',
  },
  {
    id: 'shadows',
    title: 'Shadows',
    group: 'foundations',
    path: '/foundations/shadows/',
    icon: 'layers',
    summary:
      'Three indigo-tinted two-layer elevation levels plus a focus ring, with shadow meaning height and never state',
    contentFile: 'foundations/Shadows.md',
  },
  {
    id: 'motion',
    title: 'Motion',
    group: 'foundations',
    path: '/foundations/motion/',
    icon: 'animation',
    summary:
      'Three durations, five easings, the transform-and-opacity performance contract, and reduced-motion as the floor',
    contentFile: 'foundations/Motion.md',
  },
  {
    id: 'responsive',
    title: 'Responsive',
    group: 'foundations',
    path: '/foundations/responsive/',
    icon: 'devices',
    summary:
      'Mobile-first discipline, five min-width breakpoints, media vs container queries, intrinsic layout, and safe areas',
    contentFile: 'foundations/Responsive.md',
  },
  {
    id: 'helpers',
    title: 'Helpers',
    group: 'foundations',
    path: '/foundations/helpers/',
    icon: 'build',
    summary:
      'Single-purpose utility classes sourced from tokens, the token-utility-component decision, and the sr-only and focus-ring infrastructure',
    contentFile: 'foundations/Helpers.md',
  },
  {
    id: 'token-reference',
    title: 'Token Reference',
    group: 'foundations',
    path: '/foundations/token-reference/',
    icon: 'tag',
    summary:
      'How the 213 tokens are named, the two-tier primitive and semantic model, categories, and how to consume and author them',
    contentFile: 'foundations/TokenReference.md',
  },
  {
    id: 'color-picker',
    title: 'Color Picker',
    group: 'foundations',
    path: '/foundations/color-picker/',
    icon: 'colorize',
    summary:
      'An interactive explorer for the mono-indigo palette: pick any role token and copy its value and contrast.',
    contentFile: 'foundations/Colors.md',
    interactive: true,
  },

  // ---- Patterns ----
  {
    id: 'interactive',
    title: 'Interactive',
    group: 'patterns',
    path: '/patterns/interactive/',
    icon: 'touch_app',
    summary:
      'The three-modality state model, the tonal indigo --state-* overlay, the pointer-only hover gate, and the two-tone --shadow-focus ring',
    contentFile: 'patterns/Interactive.md',
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    group: 'patterns',
    path: '/patterns/accessibility/',
    icon: 'accessibility',
    summary:
      'The POUR taxonomy, semantic-HTML-before-ARIA, contrast ratios, keyboard and focus, target size, name-role-value, and a pre-ship checklist keyed to WCAG 2.2',
    contentFile: 'patterns/Accessibility.md',
  },
  {
    id: 'form-elements',
    title: 'Form Elements',
    group: 'patterns',
    path: '/patterns/form-elements/',
    icon: 'input',
    summary:
      'The canonical form guide: native-first doctrine, the accent-color theming recipe, field anatomy, validation timing, the mobile keyboard contract, the a11y floor, and a catalog of 25 controls',
    contentFile: 'patterns/FormElements.md',
  },
  {
    id: 'data-tables',
    title: 'Data Tables',
    group: 'patterns',
    path: '/patterns/data-tables/',
    icon: 'table_chart',
    summary:
      'Native <table> first, the table vs role=grid fork, accessible sorting and row selection, density and alignment, pagination vs infinite scroll, filters, row actions, states, and the four mobile patterns',
    contentFile: 'patterns/DataTables.md',
  },
  {
    id: 'modals',
    title: 'Modals',
    group: 'patterns',
    path: '/patterns/modals/',
    icon: 'open_in_full',
    summary:
      'The six accessibility requirements of a modal, native <dialog>.showModal() as the way to get them, dialog vs alertdialog, when not to use a modal, the Popover API, pitfalls, and the mobile bottom sheet',
    contentFile: 'patterns/Modals.md',
  },
  {
    id: 'mobile-first',
    title: 'Mobile First',
    group: 'patterns',
    path: '/patterns/mobile-first/',
    icon: 'devices_other',
    summary:
      'The desktop-to-mobile pattern map, bottom sheets from native <dialog>, thumb-zone and sticky CTAs, bottom nav and FAB, snackbars, the gesture-alternative rules, safe-area insets, and capability-not-user-agent activation',
    contentFile: 'patterns/MobileFirst.md',
  },
  {
    id: 'persuasion',
    title: 'Persuasion',
    group: 'patterns',
    path: '/patterns/persuasion/',
    icon: 'campaign',
    summary:
      'The standing six UX persuasion principles (smart defaults, endowed progress, reciprocity, IKEA/endowment, loss aversion, contrast) each gated by a hard truth-and-reversibility line, with dark patterns banned',
    contentFile: 'patterns/Persuasion.md',
  },
  {
    id: 'voice-tone',
    title: 'Voice & Tone',
    group: 'patterns',
    path: '/patterns/voice-tone/',
    icon: 'record_voice_over',
    summary:
      'One constant brand voice, tone that adapts to context, three unbending voice principles, a microcopy library, tone by context, the error-writing framing rule, and the copy ethics prohibitions',
    contentFile: 'patterns/VoiceTone.md',
  },
  {
    id: 'ai-insights',
    title: 'AI Content',
    group: 'patterns',
    path: '/patterns/ai-content/',
    icon: 'monitoring',
    summary:
      'The AI-content pattern: label generated output, communicate uncertainty, show generation states, keep a human in the loop, plan for wrong answers, one-tap feedback, and data disclosure, under a disclosed-bounded-checkable-reversible contract',
    contentFile: 'patterns/AIInsights.md',
  },
]

export const rootPages = pages.filter((p) => p.group === 'root')
export const agentsPages = pages.filter((p) => p.group === 'agents')
export const foundationsPages = pages.filter((p) => p.group === 'foundations')
export const patternsPages = pages.filter((p) => p.group === 'patterns')
export const rootPage = pages.find((p) => p.group === 'root')!

export function pageByPath(pathname: string): Page | undefined {
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/'
  return pages.find((p) => p.path === normalized)
}
