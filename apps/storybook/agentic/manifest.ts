export type Page = {
  id: string
  title: string
  group: 'foundations' | 'patterns' | 'root'
  storybookTitle: string
  file: string // path relative to agentic/content, e.g. 'foundations/Colors.md'
}

export const SITE_URL = process.env.SITE_URL ?? 'https://ramoslabs-ds.pages.dev'

// Introduction first, then foundations in book order, then patterns in book order.
// storybookTitle is the verbatim <Meta title="..." /> string from each source MDX;
// the generator derives the live docs URL from it.
export const pages: Page[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    group: 'root',
    storybookTitle: 'Introduction',
    file: 'Introduction.md',
  },

  {
    id: 'colors',
    title: 'Colors',
    group: 'foundations',
    storybookTitle: 'Foundations/Colors',
    file: 'foundations/Colors.md',
  },
  {
    id: 'typography',
    title: 'Typography',
    group: 'foundations',
    storybookTitle: 'Foundations/Typography',
    file: 'foundations/Typography.md',
  },
  {
    id: 'spacing',
    title: 'Spacing',
    group: 'foundations',
    storybookTitle: 'Foundations/Spacing',
    file: 'foundations/Spacing.md',
  },
  {
    id: 'border-radius',
    title: 'Border Radius',
    group: 'foundations',
    storybookTitle: 'Foundations/Border Radius',
    file: 'foundations/BorderRadius.md',
  },
  {
    id: 'shadows',
    title: 'Shadows',
    group: 'foundations',
    storybookTitle: 'Foundations/Shadows',
    file: 'foundations/Shadows.md',
  },
  {
    id: 'motion',
    title: 'Motion',
    group: 'foundations',
    storybookTitle: 'Foundations/Motion',
    file: 'foundations/Motion.md',
  },
  {
    id: 'responsive',
    title: 'Responsive',
    group: 'foundations',
    storybookTitle: 'Foundations/Responsive',
    file: 'foundations/Responsive.md',
  },
  {
    id: 'helpers',
    title: 'Helpers',
    group: 'foundations',
    storybookTitle: 'Foundations/Helpers',
    file: 'foundations/Helpers.md',
  },
  {
    id: 'token-reference',
    title: 'Token Reference',
    group: 'foundations',
    storybookTitle: 'Foundations/Token Reference',
    file: 'foundations/TokenReference.md',
  },

  {
    id: 'interactive',
    title: 'Interactive',
    group: 'patterns',
    storybookTitle: 'Patterns/Interactive',
    file: 'patterns/Interactive.md',
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    group: 'patterns',
    storybookTitle: 'Patterns/Accessibility',
    file: 'patterns/Accessibility.md',
  },
  {
    id: 'form-elements',
    title: 'Form Elements',
    group: 'patterns',
    storybookTitle: 'Patterns/Form Elements',
    file: 'patterns/FormElements.md',
  },
  {
    id: 'data-tables',
    title: 'Data Tables',
    group: 'patterns',
    storybookTitle: 'Patterns/Data Tables',
    file: 'patterns/DataTables.md',
  },
  {
    id: 'modals',
    title: 'Modals',
    group: 'patterns',
    storybookTitle: 'Patterns/Modals',
    file: 'patterns/Modals.md',
  },
  {
    id: 'mobile-first',
    title: 'Mobile First',
    group: 'patterns',
    storybookTitle: 'Patterns/Mobile First',
    file: 'patterns/MobileFirst.md',
  },
  {
    id: 'persuasion',
    title: 'Persuasion',
    group: 'patterns',
    storybookTitle: 'Patterns/Persuasion',
    file: 'patterns/Persuasion.md',
  },
  {
    id: 'voice-tone',
    title: 'Voice & Tone',
    group: 'patterns',
    storybookTitle: 'Patterns/Voice & Tone',
    file: 'patterns/VoiceTone.md',
  },
  {
    id: 'ai-insights',
    title: 'AI Content',
    group: 'patterns',
    storybookTitle: 'Patterns/AI Content',
    file: 'patterns/AIInsights.md',
  },
]
