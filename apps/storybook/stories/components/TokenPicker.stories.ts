import type { Meta, StoryObj } from '@storybook/vue3-vite';
import TokenPicker from './TokenPicker.vue';

const meta: Meta<typeof TokenPicker> = {
  title: 'Foundations/Color Picker',
  component: TokenPicker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Pick a token, read whether text can legibly sit on it. Every ratio here is the exact WCAG 2.x math, so the number on screen is the number an auditor measures. Contrast is the most common accessibility failure on the web, and it is a numeric floor to clear, not a look to eyeball.

## How to use it

1. Open a story below (**All Colors** is the full set; the themed groups isolate brand, text, semantic, and surface).
2. **Click a swatch.** It becomes the tested surface, measured against white text and black text.
3. **Read the badge.** Each candidate shows its ratio (e.g. \`6.29:1\`) and a level. Pick the text color whose badge covers the text size you will actually render.
4. **Copy the token.** One click copies the \`var(--color-token)\` reference, so product code consumes the semantic role, never a raw hex.

| Badge | Ratio | Clears |
| --- | --- | --- |
| **AAA** | 7:1+ | Normal text at AAA and everything under it |
| **AA** | 4.5 to 6.99 | Normal text at AA; large text and UI at AAA |
| **AA Large** | 3 to 4.49 | Large text (1.4.3) and non-text / UI (1.4.11) only, never body text |
| **Fail** | below 3 | Nothing a user must read |

Text size decides which badge you may accept: **AA Large** passes a 24px heading, a button edge, or a meaningful icon, and fails a 16px paragraph.

## WCAG floors

WCAG 2.2 is the W3C Recommendation this system certifies against [1][2][3][4]:

- **Normal text:** 4.5:1 (AA), 7:1 (AAA). Target 7.
- **Large text** (24px, or 18.66px bold): 3:1 (AA), 4.5:1 (AAA).
- **UI boundaries, focus rings, meaningful icons and chart marks:** 3:1 (1.4.11).
- **Disabled controls and pure decoration:** exempt, so never carrying information a user must read.

"Large" is a spatial exemption, not a license: anything under 24px (or 18.66px bold) is normal text and owes the full 4.5:1.

The tool runs the WCAG formula verbatim: ratio \`(L1 + 0.05) / (L2 + 0.05)\` over relative luminance \`L = 0.2126 R + 0.7152 G + 0.0722 B\` on linearized sRGB [5][6]. Green dominates the weight because the eye is most sensitive to it.

**On the horizon (draft, not normative):** the 2.x ratio is a plain luminance division that misjudges the extremes and ignores font weight. **APCA** models perceived lightness, weight, size, and polarity instead, on a signed \`Lc\` scale [7]. It is associated with WCAG 3.0, but that is an early Working Draft (3 March 2026) still specifying ratio-based contrast [8]. WCAG 2.2 stays the floor we ship; track APCA, do not certify against it.

## Deriving pairs from the mono-indigo ramp

One accent hue means accessible pairings come from walking the indigo ramp, not reaching for a second color:

- **Indigo 600** (\`--color-primary\`, #4f46e5) on white is **6.29:1**: AA for text, AAA for large. Safe for links, accent labels, and as a fill under white text (read the same pairing the other way for the primary button).
- Hover and active step to **indigo 700** (\`--color-primary-dark\`, #4338ca), where white text rises to **7.90:1** (AAA). Contrast climbs as a control engages, never weakens.
- For tinted zones pair **indigo 50** (\`--color-primary-surface\`, #eef2ff) with deep indigo text (700+), and confirm the ratio rather than assume it.
- Indigo 300 and 400 fail as text on white; the tool badges them **Fail**, and that verdict is the point.

**Color is never the whole message (1.4.1)** [9]. A passing ratio does not satisfy this: every status needs an icon and label, every invalid field needs text and not just a red border, and focus stays a visible ring, not a hue shift.

---

<sub>Sources: [1] <a href="https://www.w3.org/TR/WCAG22/#contrast-minimum">1.4.3 Contrast (Minimum)</a> · [2] <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">Understanding 1.4.3</a> · [3] <a href="https://www.w3.org/TR/WCAG22/#non-text-contrast">1.4.11 Non-text Contrast</a> · [4] <a href="https://www.w3.org/TR/WCAG22/#contrast-enhanced">1.4.6 Contrast (Enhanced)</a> · [5] <a href="https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio">contrast ratio</a> · [6] <a href="https://www.w3.org/TR/WCAG22/#dfn-relative-luminance">relative luminance</a> · [7] <a href="https://github.com/Myndex/SAPC-APCA">APCA</a> · [8] <a href="https://www.w3.org/TR/wcag-3.0/">WCAG 3.0 Working Draft</a> · [9] <a href="https://www.w3.org/TR/WCAG22/#use-of-color">1.4.1 Use of Color</a></sub>
        `,
      },
    },
  },
  // A Docs page carries the editorial guidance; the stories below render the live tool.
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Primary story shown in docs
export const Default: Story = {
  name: 'All Colors',
  args: {
    title: 'Complete Palette',
    colors: [
      // Brand
      { name: 'Primary', token: '--color-primary', value: '#4f46e5' },
      { name: 'Primary Light', token: '--color-primary-light', value: '#6366f1' },
      { name: 'Primary Dark', token: '--color-primary-dark', value: '#4338ca' },
      { name: 'Secondary', token: '--color-secondary', value: '#8B5CF6' },
      // Text
      { name: 'Heading', token: '--color-text-heading', value: '#0f172a' },
      { name: 'Body', token: '--color-text-body', value: '#64748b' },
      { name: 'Muted', token: '--color-text-muted', value: '#64748b' },
      // Surface
      { name: 'Surface', token: '--color-surface', value: '#ffffff' },
      { name: 'Background', token: '--color-background', value: '#f8fafc' },
      { name: 'Border', token: '--color-border', value: '#e6e8eb' },
      // Semantic
      { name: 'Success', token: '--color-success', value: '#10b981' },
      { name: 'Warning', token: '--color-warning', value: '#f59e0b' },
      { name: 'Error', token: '--color-error', value: '#ef4444' },
      { name: 'Info', token: '--color-info', value: '#3b82f6' },
    ],
  },
};

export const BrandColors: Story = {
  args: {
    title: 'Brand Colors',
    colors: [
      { name: 'Primary', token: '--color-primary', value: '#4f46e5', description: 'Main brand color' },
      { name: 'Primary Light', token: '--color-primary-light', value: '#6366f1', description: 'Hover states' },
      { name: 'Primary Dark', token: '--color-primary-dark', value: '#4338ca', description: 'Pressed states' },
      { name: 'Secondary', token: '--color-secondary', value: '#8B5CF6', description: 'Gradients, accents' },
    ],
  },
};

export const TextColors: Story = {
  args: {
    title: 'Text Colors',
    colors: [
      { name: 'Heading', token: '--color-text-heading', value: '#0f172a', description: 'Headlines' },
      { name: 'Body', token: '--color-text-body', value: '#64748b', description: 'Paragraphs' },
      { name: 'Muted', token: '--color-text-muted', value: '#64748b', description: 'Labels, hints' },
      { name: 'Disabled', token: '--color-text-disabled', value: '#cbd5e1', description: 'Disabled text' },
    ],
  },
};

export const SemanticColors: Story = {
  args: {
    title: 'Semantic Colors',
    colors: [
      { name: 'Success', token: '--color-success', value: '#10b981', description: 'Confirmations' },
      { name: 'Success Surface', token: '--color-success-surface', value: '#f0fdf4', description: 'Success bg' },
      { name: 'Warning', token: '--color-warning', value: '#f59e0b', description: 'Cautions' },
      { name: 'Warning Surface', token: '--color-warning-surface', value: '#fffbeb', description: 'Warning bg' },
      { name: 'Error', token: '--color-error', value: '#ef4444', description: 'Errors' },
      { name: 'Error Surface', token: '--color-error-surface', value: '#fef2f2', description: 'Error bg' },
      { name: 'Info', token: '--color-info', value: '#3b82f6', description: 'Information' },
      { name: 'Info Surface', token: '--color-info-surface', value: '#eff6ff', description: 'Info bg' },
    ],
  },
};

export const SurfaceColors: Story = {
  args: {
    title: 'Surface Colors',
    colors: [
      { name: 'Surface', token: '--color-surface', value: '#ffffff', description: 'Cards, modals' },
      { name: 'Background', token: '--color-background', value: '#f8fafc', description: 'Page background' },
      { name: 'Border', token: '--color-border', value: '#e6e8eb', description: 'Dividers, borders' },
    ],
  },
};
