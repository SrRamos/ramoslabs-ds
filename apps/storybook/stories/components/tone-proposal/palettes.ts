// Status tone palettes for the SJButton tone proposal (story-only, not shipped).
// Research and method: docs/research/status-tones-2026.md.
// Every proposed colour is authored in OKLCH and converted to sRGB hex here, so the swatch, the contrast
// numbers and the rendered button all come from the same value. `current` is the shipped baseline, read
// from the existing primitives by name.
import { oklch } from './color';

export const TONES = ['success', 'warning', 'error', 'info', 'neutral'] as const;
export type Tone = (typeof TONES)[number];

/** Every colour role one tone needs, light and dark. */
export type Roles = {
  /** Solid fill at rest, its gradient end and its 1px border. */
  solid: string;
  solidEnd: string;
  solidBorder: string;
  /** Solid fill on hover and its gradient end (the sheen stays on). */
  hover: string;
  hoverEnd: string;
  /** Solid fill while pressed (no gradient, no sheen). */
  press: string;
  /** Label on the solid fill. */
  on: string;
  /** Label for soft / outline / ghost / link and status text on white. */
  text: string;
  /** Link hover and press, alert titles. */
  textStrong: string;
  /** Soft fill at rest, hover and press; ghost and outline reuse surface / surfaceHover. */
  surface: string;
  surfaceHover: string;
  surfacePress: string;
  /** Alert and badge hairline. */
  border: string;
  /** Outline variant border (3:1 against the page). */
  outline: string;
  /** Dark-surface counterparts. The solid roles are shared with light. */
  dText: string;
  dTextStrong: string;
  dSurface: string;
  dSurfaceHover: string;
  dSurfacePress: string;
  dBorder: string;
  dOutline: string;
  /** Dark solid overrides; omitted means the light solid is reused (true for every status tone). */
  dSolid?: string;
  dSolidEnd?: string;
  dSolidBorder?: string;
  dHover?: string;
  dHoverEnd?: string;
  dPress?: string;
  dOn?: string;
};

export type Palette = {
  id: 'current' | 'a' | 'b' | 'c';
  name: string;
  tagline: string;
  tones: Record<Tone, Roles>;
  /** Hex values that already exist as primitives map to the token name; the rest are NEW. */
  tradeoffs: string[];
};

/** Light page and dark page the ratios are measured against (existing tokens). */
export const PAGE = { light: '#ffffff', dark: '#0f172a', darkName: 'color.slate.900' } as const;

const WHITE = '#ffffff';

type Spec = {
  h: number;
  /** Solid fill lightness and chroma. */
  L: number;
  C: number;
  /** Lightness offsets for hover / press / gradient end / border. */
  steps?: { hover: number; press: number; end: number; border: number };
  /** Label on the solid: white, or an OKLCH ink. */
  on?: [number, number, number];
  /** Hue used for text and surfaces when it differs from the fill (yellows drift toward orange as they darken). */
  hText?: number;
  hSurf?: number;
  text: [L: number, C: number];
  surfC: number;
  dText: [L: number, C: number];
  dSurfC: number;
  /** Inverted solid on dark (neutral): a light fill with this ink label. */
  dSolid?: [L: number, C: number, ink: [number, number, number]];
};

const DARK_STEPS = { hover: -0.04, press: -0.08, end: -0.06, border: -0.1 };
const LIGHT_STEPS = { hover: -0.03, press: -0.07, end: -0.05, border: -0.12 };

function build(s: Spec): Roles {
  const st = s.steps ?? (s.on ? LIGHT_STEPS : DARK_STEPS);
  const ht = s.hText ?? s.h;
  const hs = s.hSurf ?? s.h;
  return {
    solid: oklch(s.L, s.C, s.h),
    solidEnd: oklch(s.L + st.end, s.C, s.h),
    solidBorder: oklch(s.L + st.border, s.C, s.h),
    hover: oklch(s.L + st.hover, s.C, s.h),
    hoverEnd: oklch(s.L + st.hover + st.end, s.C, s.h),
    press: oklch(s.L + st.press, s.C, s.h),
    on: s.on ? oklch(...s.on) : WHITE,
    text: oklch(s.text[0], s.text[1], ht),
    textStrong: oklch(s.text[0] - 0.07, s.text[1] * 0.9, ht),
    surface: oklch(0.975, s.surfC, hs),
    surfaceHover: oklch(0.948, s.surfC * 1.7, hs),
    surfacePress: oklch(0.918, s.surfC * 2.4, hs),
    border: oklch(0.885, s.surfC * 3, hs),
    outline: oklch(s.text[0] + 0.1, s.text[1], ht),
    dText: oklch(s.dText[0], s.dText[1], s.h),
    dTextStrong: oklch(s.dText[0] + 0.07, s.dText[1] * 0.85, s.h),
    dSurface: oklch(0.255, s.dSurfC, hs),
    dSurfaceHover: oklch(0.29, s.dSurfC * 1.15, hs),
    dSurfacePress: oklch(0.325, s.dSurfC * 1.3, hs),
    dBorder: oklch(0.36, s.dSurfC * 1.4, hs),
    dOutline: oklch(s.dText[0] - 0.12, s.dText[1], s.h),
    ...(s.dSolid && {
      dSolid: oklch(s.dSolid[0], s.dSolid[1], s.h),
      dSolidEnd: oklch(s.dSolid[0] - 0.04, s.dSolid[1], s.h),
      dSolidBorder: oklch(s.dSolid[0] - 0.08, s.dSolid[1], s.h),
      dHover: oklch(s.dSolid[0] - 0.04, s.dSolid[1], s.h),
      dHoverEnd: oklch(s.dSolid[0] - 0.08, s.dSolid[1], s.h),
      dPress: oklch(s.dSolid[0] - 0.09, s.dSolid[1], s.h),
      dOn: oklch(...s.dSolid[2]),
    }),
  };
}

/** Existing primitives, for the baseline and for "is this value already a token" lookups. */
export const PRIMITIVES: Record<string, string> = {
  '#ffffff': 'white',
  '#f8fafc': 'slate.50', '#f1f5f9': 'slate.100', '#e2e8f0': 'slate.200', '#cbd5e1': 'slate.300',
  '#94a3b8': 'slate.400', '#64748b': 'slate.500', '#475569': 'slate.600', '#334155': 'slate.700',
  '#1e293b': 'slate.800', '#0f172a': 'slate.900', '#020617': 'slate.950',
  '#ecfdf5': 'emerald.50', '#d1fae5': 'emerald.100', '#a7f3d0': 'emerald.200', '#6ee7b7': 'emerald.300',
  '#34d399': 'emerald.400', '#10b981': 'emerald.500', '#059669': 'emerald.600', '#047857': 'emerald.700',
  '#065f46': 'emerald.800', '#064e3b': 'emerald.900', '#022c22': 'emerald.950',
  '#f0fdf4': 'green.50', '#dcfce7': 'green.100', '#bbf7d0': 'green.200', '#86efac': 'green.300',
  '#4ade80': 'green.400', '#22c55e': 'green.500', '#16a34a': 'green.600', '#15803d': 'green.700',
  '#166534': 'green.800', '#14532d': 'green.900', '#052e16': 'green.950',
  '#fffbeb': 'amber.50', '#fef3c7': 'amber.100', '#fde68a': 'amber.200', '#fcd34d': 'amber.300',
  '#fbbf24': 'amber.400', '#f59e0b': 'amber.500', '#d97706': 'amber.600', '#b45309': 'amber.700',
  '#92400e': 'amber.800', '#78350f': 'amber.900', '#451a03': 'amber.950',
  '#fef2f2': 'red.50', '#fee2e2': 'red.100', '#fecaca': 'red.200', '#fca5a5': 'red.300',
  '#f87171': 'red.400', '#ef4444': 'red.500', '#dc2626': 'red.600', '#b91c1c': 'red.700',
  '#991b1b': 'red.800', '#7f1d1d': 'red.900', '#450a0a': 'red.950',
  '#eff6ff': 'blue.50', '#dbeafe': 'blue.100', '#bfdbfe': 'blue.200', '#93c5fd': 'blue.300',
  '#60a5fa': 'blue.400', '#3b82f6': 'blue.500', '#2563eb': 'blue.600', '#1d4ed8': 'blue.700',
  '#1e40af': 'blue.800', '#1e3a8a': 'blue.900', '#172554': 'blue.950',
  '#eef2ff': 'indigo.50', '#e0e7ff': 'indigo.100', '#c7d2fe': 'indigo.200', '#a5b4fc': 'indigo.300',
  '#818cf8': 'indigo.400', '#6366f1': 'indigo.500', '#4f46e5': 'indigo.600', '#4338ca': 'indigo.700',
  '#3730a3': 'indigo.800', '#312e81': 'indigo.900', '#1e1b4b': 'indigo.950',
};

const P = (name: string) => {
  const hit = Object.entries(PRIMITIVES).find(([, n]) => n === name);
  if (!hit) throw new Error(`unknown primitive ${name}`);
  return hit[0];
};

/** The shipped values (button.css + color.semantic.json). Dark has no counterparts today; the baseline
 * maps the same families to their 300 / 950 steps, the nearest thing a consumer could do now. */
function current(fam: string, o: Partial<Roles> = {}): Roles {
  return {
    solid: P(`${fam}.700`),
    solidEnd: P(`${fam}.800`),
    solidBorder: P(`${fam}.800`),
    hover: P(`${fam}.800`),
    hoverEnd: P(`${fam}.900`),
    press: P(`${fam}.900`),
    on: WHITE,
    text: P(`${fam}.800`),
    textStrong: P(`${fam}.900`),
    surface: P(`${fam}.50`),
    surfaceHover: P(`${fam}.100`),
    surfacePress: P(`${fam}.200`),
    border: P(`${fam}.200`),
    outline: P(`${fam}.800`),
    dText: P(`${fam}.300`),
    dTextStrong: P(`${fam}.200`),
    dSurface: P(`${fam}.950`),
    dSurfaceHover: P(`${fam}.900`),
    dSurfacePress: P(`${fam}.900`),
    dBorder: P(`${fam}.800`),
    dOutline: P(`${fam}.400`),
    ...o,
  };
}

export const PALETTES: Palette[] = [
  {
    id: 'current',
    name: 'Current (baseline)',
    tagline:
      'What ships in #126: Tailwind-family primitives at mixed lightness. Emerald 800, amber 500 with slate 900 text, red 700, blue 700, slate 900. Soft and outline use the green / amber / red / blue 800-900 text steps.',
    tones: {
      success: current('green', {
        solid: P('emerald.800'),
        solidEnd: P('emerald.900'),
        solidBorder: P('emerald.900'),
        hover: P('emerald.900'),
        hoverEnd: P('emerald.950'),
        press: P('emerald.950'),
      }),
      warning: current('amber', {
        solid: P('amber.500'),
        solidEnd: P('amber.600'),
        solidBorder: P('amber.600'),
        hover: P('amber.400'),
        hoverEnd: P('amber.500'),
        press: P('amber.600'),
        on: P('slate.900'),
        text: P('amber.900'),
        textStrong: P('amber.950'),
        outline: P('amber.900'),
      }),
      error: current('red'),
      info: current('blue'),
      neutral: {
        ...current('slate'),
        solid: P('slate.900'),
        solidEnd: P('slate.950'),
        solidBorder: P('slate.950'),
        hover: P('slate.800'),
        hoverEnd: P('slate.950'),
        press: P('slate.950'),
        text: P('slate.700'),
        textStrong: P('slate.900'),
        surface: P('slate.100'),
        surfaceHover: P('slate.200'),
        surfacePress: P('slate.300'),
        border: P('slate.200'),
        outline: P('slate.500'),
        dText: P('slate.300'),
        dTextStrong: P('slate.100'),
        dSurface: P('slate.800'),
        dSurfaceHover: P('slate.700'),
        dSurfacePress: P('slate.700'),
        dSolid: P('slate.100'),
        dSolidEnd: P('slate.200'),
        dSolidBorder: P('slate.300'),
        dHover: P('slate.200'),
        dHoverEnd: P('slate.300'),
        dPress: P('slate.300'),
        dOn: P('slate.900'),
        dBorder: P('slate.700'),
        dOutline: P('slate.400'),
      },
    },
    tradeoffs: [
      'Five fills at five different lightnesses (OKLCH L 43 to 77): the row reads as a set of unrelated swatches, not a family.',
      'Emerald 800 is a deep bottle green at low chroma (0.086); next to the vivid Indigo 600 (0.230) it looks dull, the "rustic" note.',
      'Amber 500 is the lightest and loudest fill; with slate 900 text it is the only dark-label button and it shouts.',
      'Blue 700 (h 264) is 13 degrees from Indigo 600 (h 277): info reads as a second, slightly-off primary.',
      'No dark counterparts exist: dark rows here map to the 300 / 950 steps by hand.',
    ],
  },
  {
    id: 'a',
    name: 'A. Harmonic',
    tagline:
      'One lightness for every status fill (OKLCH L 49, a step under Indigo 600 at L 51 so the primary stays the brightest), chroma tuned per hue so no tone shouts, hues pulled away from muddy zones: jade green, crimson-leaning red, cerulean info 30 degrees clear of indigo, honey amber with a warm ink label. Neutral is an indigo-tinted ink.',
    tones: {
      success: build({ h: 160, L: 0.49, C: 0.11, text: [0.47, 0.1], surfC: 0.022, dText: [0.8, 0.13], dSurfC: 0.04 }),
      warning: build({
        h: 80,
        L: 0.835,
        C: 0.14,
        on: [0.29, 0.065, 55],
        hText: 55,
        hSurf: 85,
        text: [0.48, 0.115],
        surfC: 0.03,
        dText: [0.84, 0.13],
        dSurfC: 0.035,
      }),
      error: build({ h: 22, L: 0.5, C: 0.175, text: [0.48, 0.17], surfC: 0.016, dText: [0.8, 0.12], dSurfC: 0.05 }),
      info: build({ h: 245, L: 0.5, C: 0.13, text: [0.48, 0.13], surfC: 0.016, dText: [0.78, 0.11], dSurfC: 0.05 }),
      neutral: build({
        h: 277,
        L: 0.27,
        C: 0.035,
        steps: { hover: 0.05, press: -0.04, end: -0.04, border: -0.06 },
        text: [0.4, 0.035],
        surfC: 0.007,
        dText: [0.82, 0.02],
        dSurfC: 0.025,
        dSolid: [0.95, 0.012, [0.27, 0.035, 277]],
      }),
    },
    tradeoffs: [
      'Most cohesive: the four status fills read as one family next to Indigo 600, because they share its lightness and sit at similar perceived colourfulness.',
      'Lowest WCAG headroom on the fills (white on the sheened fill 4.63 on success, 4.69 on info): any later sheen increase must be re-checked.',
      'Jade (h 160) and cerulean (h 245) are less literal than "traffic light" green and blue; still read as success and info in context.',
      'Every value is NEW: the system gains five OKLCH status scales (or at least the 15 steps used here).',
    ],
  },
  {
    id: 'b',
    name: 'B. Jewel',
    tagline:
      'Deeper, richer fills (OKLCH L 45 to 46, warning 52) with the most chroma sRGB allows at that depth: emerald, ruby, sapphire. Warning keeps a white label on a burnt orange. Highest contrast of the three, the "Stripe dashboard" register. Neutral is cool graphite.',
    tones: {
      success: build({ h: 158, L: 0.45, C: 0.12, text: [0.45, 0.11], surfC: 0.024, dText: [0.8, 0.14], dSurfC: 0.045 }),
      warning: build({
        h: 44,
        L: 0.525,
        C: 0.17,
        hSurf: 75,
        text: [0.47, 0.13],
        surfC: 0.03,
        dText: [0.82, 0.13],
        dSurfC: 0.045,
      }),
      error: build({ h: 18, L: 0.46, C: 0.18, text: [0.46, 0.17], surfC: 0.018, dText: [0.8, 0.13], dSurfC: 0.055 }),
      info: build({ h: 255, L: 0.46, C: 0.16, text: [0.46, 0.16], surfC: 0.018, dText: [0.78, 0.12], dSurfC: 0.055 }),
      neutral: build({
        h: 260,
        L: 0.25,
        C: 0.02,
        steps: { hover: 0.05, press: -0.04, end: -0.04, border: -0.06 },
        text: [0.4, 0.025],
        surfC: 0.006,
        dText: [0.82, 0.015],
        dSurfC: 0.02,
        dSolid: [0.95, 0.008, [0.25, 0.02, 260]],
      }),
    },
    tradeoffs: [
      'Most contrast headroom on success, error and info (white on the sheened fill 5.4 to 6.5:1); the white-label warning is the exception at 4.62.',
      'Warning with a white label forces the hue toward orange (h 44) and darkens it to L 52: it reads "caution" well but sits closest to error, and under protanopia / deuteranopia warning and error converge more than in A or C.',
      'Deeper fills look heavier on dark surfaces and lose some glow; the gradient is less visible.',
      'Sapphire (h 255) is closer to indigo than A\'s cerulean; info and primary are distinguishable but related.',
    ],
  },
  {
    id: 'c',
    name: 'C. Quiet',
    tagline:
      'Linear / Geist register: low-chroma fills (C 0.09 to 0.13) so status never competes with the Indigo primary; emphasis moves to soft and outline. Sage green, muted rose-red, steel blue, a soft honey warning with ink text. Neutral is a cool indigo-tinted graphite.',
    tones: {
      success: build({ h: 165, L: 0.48, C: 0.085, text: [0.46, 0.08], surfC: 0.016, dText: [0.8, 0.09], dSurfC: 0.03 }),
      warning: build({
        h: 82,
        L: 0.84,
        C: 0.12,
        on: [0.3, 0.05, 60],
        hText: 60,
        hSurf: 88,
        text: [0.47, 0.095],
        surfC: 0.025,
        dText: [0.85, 0.11],
        dSurfC: 0.035,
      }),
      error: build({ h: 16, L: 0.49, C: 0.14, text: [0.47, 0.135], surfC: 0.013, dText: [0.8, 0.1], dSurfC: 0.04 }),
      info: build({ h: 240, L: 0.49, C: 0.095, text: [0.47, 0.095], surfC: 0.013, dText: [0.79, 0.085], dSurfC: 0.04 }),
      neutral: build({
        h: 277,
        L: 0.29,
        C: 0.025,
        steps: { hover: 0.05, press: -0.04, end: -0.04, border: -0.06 },
        text: [0.42, 0.025],
        surfC: 0.006,
        dText: [0.83, 0.015],
        dSurfC: 0.02,
        dSolid: [0.95, 0.01, [0.29, 0.025, 277]],
      }),
    },
    tradeoffs: [
      'Calmest and most "tool-like": the primary is unambiguously the loudest colour on the screen.',
      'Lowest chroma means the smallest colour differences between tones: under CVD it leans hardest on the icon and label (still required by AGENTS.md).',
      'Error at C 0.14 (a muted rose-red, h 16, kept off the brick zone around h 25-30) is less urgent; destructive confirmations may want the solid from A instead.',
      'Risk of reading "grey" on low-quality or dimmed displays.',
    ],
  },
];

/** --opacity-sheen (12%) as a fraction: the white over the top of every solid fill. */
export const SHEEN = 0.12;
