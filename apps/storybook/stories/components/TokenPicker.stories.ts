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
The live contrast tool for the RamosLabs palette. Pick any token below and read, in real time, whether text can legibly sit on it. Every ratio you see is computed with the exact WCAG 2.x relative-luminance math, so the number on screen is the number an auditor will measure.

## Why contrast is not optional

Contrast is the difference in relative luminance between two colors, and it is the single most common accessibility failure on the web. It is not a stylistic preference: roughly 1 in 12 men and 1 in 200 women have some form of color vision deficiency, low-vision users are far more numerous still, and every sighted user loses contrast sensitivity in bright sun or on a dimmed laptop. WCAG treats it as a testable, numeric floor precisely because "looks fine to me" is not a standard. A color pairing either clears the ratio for its text size or it does not, and this tool tells you which while the pairing is still on your screen. Treat the ratio as a floor to clear, not a target to graze.

## How to use the picker

1. Open one of the stories under this page (**All Colors** is the full set; the themed groups isolate brand, text, semantic, and surface tokens).
2. **Click a swatch.** The color you pick becomes the tested surface. The panel then measures two candidates against it: **white text on the swatch** and **black text on the swatch**.
3. **Read the ratio and its badge.** Each candidate shows its measured ratio (for example \`6.29:1\`) and a level badge. Choose the text color whose badge satisfies the size of text you actually plan to render.
4. **Copy the token.** One click copies the \`var(--color-token)\` reference so product code consumes the semantic role, never a raw hex.

The badges map directly to the WCAG thresholds:

| Badge | Measured ratio | What it clears |
| --- | --- | --- |
| **AAA** | 7:1 or higher | Normal text at AAA, and everything below it |
| **AA** | 4.5:1 to 6.99:1 | Normal text at AA; large text and UI at AAA |
| **AA Large** | 3:1 to 4.49:1 | Large text (SC 1.4.3) and non-text / UI contrast (SC 1.4.11) only, never normal body text |
| **Fail** | below 3:1 | Nothing that carries information a user must read |

A pairing that reads **AA Large** is a legitimate pass for a 24px heading, a button boundary, or a meaningful icon. It is a failure for a 16px paragraph. The size of the text decides which badge you are allowed to accept.

## The WCAG contrast taxonomy

WCAG 2.2 is a W3C Recommendation and is the standard this system certifies against. Four success criteria set the floors [1][2][3][4]:

| Success criterion | Applies to | Level | Ratio |
| --- | --- | --- | --- |
| **1.4.3** Contrast (Minimum) | Normal text | AA | **4.5:1** |
| **1.4.3** Contrast (Minimum) | Large text (24px, or 18.66px / 14pt bold) | AA | **3:1** |
| **1.4.11** Non-text Contrast | UI component boundaries, focus indicators, meaningful graphics | AA | **3:1** |
| **1.4.6** Contrast (Enhanced) | Normal text | AAA | **7:1** |
| **1.4.6** Contrast (Enhanced) | Large text | AAA | **4.5:1** |

"Large text" is a spatial exemption, not a license: type only counts as large at 24px, or 18.66px when bold. Anything smaller is normal text and owes the full 4.5:1.

### The formula this tool runs

The ratio is defined as \`(L1 + 0.05) / (L2 + 0.05)\`, where \`L1\` is the relative luminance of the lighter color and \`L2\` that of the darker [5]. Relative luminance itself is \`L = 0.2126 R + 0.7152 G + 0.0722 B\`, computed on sRGB channels that are first linearized: each channel \`c\` (as a 0 to 1 fraction) becomes \`c / 12.92\` when \`c <= 0.03928\`, otherwise \`((c + 0.055) / 1.055) ^ 2.4\` [6]. The green weight dominates because the human eye is most sensitive to green, which is why a green and a red of equal "brightness" contrast very differently. The picker implements this formula verbatim, so its output is the reference measurement.

### On the horizon: APCA and WCAG 3 (draft, speculative)

The 2.x ratio is a blunt instrument. Because it is a plain luminance division, it is known to misjudge readability at the extremes, over-strict on dark-on-light and over-lenient on light-on-dark, and it ignores font weight entirely. The **Accessible Perceptual Contrast Algorithm (APCA)** models perceived lightness, text weight, size, and polarity instead, reporting a signed \`Lc\` value on a roughly 0 to 108 scale where doubling the number doubles the perceived contrast [7]. APCA is associated with the WCAG 3.0 effort, but be honest about its status: WCAG 3.0 is an early W3C Working Draft (dated 3 March 2026) that explicitly warns it is "a work in progress," and its current text still specifies ratio-based contrast rather than adopting APCA [8]. Nothing here is normative yet. **WCAG 2.2 remains the floor we ship against**; APCA is worth tracking, not certifying against.

## Implementation rules

**Contrast floors by role.** Hold each type of element to its own floor, and let the tool prove it:

- **Normal text** (below 24px, or below 18.66px bold): **4.5:1** minimum, target **7:1**.
- **Large text** (24px+, or 18.66px+ bold): **3:1** minimum.
- **UI boundaries, focus rings, meaningful icons and chart marks**: **3:1** minimum, per 1.4.11.
- **Disabled controls and pure decoration**: exempt, and therefore never allowed to carry information a user must read.

**Deriving accessible pairs from the mono-indigo palette.** The system runs on one accent hue, so accessible pairings come from walking the indigo ramp, not from reaching for a second color:

- **Indigo 600** (\`--color-primary\`, #4f46e5) on white measures **6.29:1**. That clears AA for text and AAA for large text, which is why it is safe for links, accent labels, and as a solid fill under white text.
- **White on indigo 600** is the same 6.29:1 pairing read the other way: the default primary button, safe at any text size.
- Step the interaction states along the ramp: rest at indigo 600, hover and active at **indigo 700** (\`--color-primary-dark\`, #4338ca), where white text rises to **7.90:1** (AAA). Contrast strengthens as the control is engaged, never weakens.
- For tinted zones, pair the lightest ramp step, **indigo 50** (\`--color-primary-surface\`, #eef2ff), with deep indigo text (700 or darker), and confirm the ratio here rather than assuming it.
- Do not press indigo 300 or 400 into service as text on white. They sit below the floor; the tool will badge them **Fail**, and that verdict is the point.

**Never signal by color alone.** SC 1.4.1 is explicit: color must not be the only visual means of conveying information, indicating an action, or distinguishing an element [9]. A passing contrast ratio does not satisfy this. Every status still needs an icon and a label, every invalid field needs text and not merely a red border, and the focus indicator stays a visible ring rather than a hue shift. Contrast makes color legible; 1.4.1 makes sure color is never the whole message.

## Do and don't

**Do**

- Verify normal text at **4.5:1+** and UI boundaries and meaningful icons at **3:1+** with this tool as part of finishing any surface.
- Pick the text color by the badge that matches your real text size, not the badge that looks generous.
- Derive states by walking the indigo ramp, so contrast climbs on hover and active.
- Copy the \`var(--color-token)\` reference the tool hands you, and consume the semantic role in product code.

**Don't**

- Ship a 16px paragraph on a color that only earns an **AA Large** badge. That badge is for large text and UI, not body copy.
- Hardcode a hex or lean on a primitive because it "looked close enough" on your screen. Measure it.
- Treat a passing ratio as full accessibility. It is one criterion; pair it with 1.4.1 and visible focus.
- Introduce a second accent hue to solve a contrast problem the indigo ramp already solves.

## Sources

1. WCAG 2.2, SC 1.4.3 Contrast (Minimum), AA 4.5:1 / large text 3:1. https://www.w3.org/TR/WCAG22/#contrast-minimum
2. WCAG 2.2, Understanding 1.4.3 (large text = 24px, or 18.66px / 14pt bold). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
3. WCAG 2.2, SC 1.4.11 Non-text Contrast, 3:1 for UI components and graphics. https://www.w3.org/TR/WCAG22/#non-text-contrast
4. WCAG 2.2, SC 1.4.6 Contrast (Enhanced), AAA 7:1 / large 4.5:1. https://www.w3.org/TR/WCAG22/#contrast-enhanced
5. WCAG 2.2, definition of contrast ratio. https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
6. WCAG 2.2, definition of relative luminance. https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
7. APCA (Accessible Perceptual Contrast Algorithm), perceptual, polarity-aware, still a draft candidate. https://github.com/Myndex/SAPC-APCA
8. WCAG 3.0 Working Draft (3 March 2026), an unfinished work in progress, not a standard. https://www.w3.org/TR/wcag-3.0/
9. WCAG 2.2, SC 1.4.1 Use of Color. https://www.w3.org/TR/WCAG22/#use-of-color
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
