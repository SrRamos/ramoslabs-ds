// SJButton redesign PROPOSAL (not shipped). Three visual directions rendered as scoped prototype
// stylesheets, so the owner can compare them in Storybook before any token, CSS or component change.
// Research and sources: docs/research/button-premium-2026.md.
//
// Rules this file follows:
// - Every prototype value is a `--proposal-*` custom property declared at the top of the generated CSS.
//   Each maps to an existing token when one exists; values with no token are marked `NEW` and listed in the
//   research doc as the token change that direction would need.
// - Brand primary stays Indigo 600 as the action colour. Violet only appears as the decorative hit-area
//   annotation in the touch-target story, never on a control.
// - Fonts are self-hosted from .storybook/static/fonts/proposal (OFL, ADR-009, same approach as #52).
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, ref, type PropType } from 'vue';
import { SJButton } from '@ramoslabs/vue/button';
import { about, tryIt } from './_shared';

type SizeKey = 'xs' | 'sm' | 'md' | 'lg';
type Val = [expr: string, px: number, isNew?: 'NEW'];
type SizeSpec = { h: Val; px: Val; fs: Val; r: Val; icon: Val; gap: Val };
type Direction = {
  id: 'a' | 'b' | 'c';
  name: string;
  tagline: string;
  font: { family: string; label: string; weight: Val; tracking: Val; features: string };
  sizes: Record<SizeKey, SizeSpec>;
  tradeoffs: string[];
};

// Shared value vocabulary: token expression, px, NEW marker.
const T = {
  s1: ['var(--space-1)', 4],
  s1_5: ['0.375rem', 6, 'NEW'],
  s2: ['var(--space-2)', 8],
  s2_5: ['0.625rem', 10, 'NEW'],
  s3: ['var(--space-3)', 12],
  s3_5: ['0.875rem', 14, 'NEW'],
  s4: ['var(--space-4)', 16],
  s5: ['var(--space-5)', 20],
  s6: ['var(--space-6)', 24],
  h24: ['var(--space-6)', 24],
  h28: ['1.75rem', 28, 'NEW'],
  h32: ['var(--space-8)', 32],
  h36: ['2.25rem', 36, 'NEW'],
  h40: ['var(--space-10)', 40],
  h44: ['var(--target-min)', 44],
  h48: ['var(--space-12)', 48],
  fs12: ['var(--font-size-xs)', 12],
  fs13: ['0.8125rem', 13, 'NEW'],
  fs14: ['var(--font-size-sm)', 14],
  fs15: ['0.9375rem', 15, 'NEW'],
  fs16: ['var(--font-size-base)', 16],
  r4: ['var(--radius-xs)', 4],
  r6: ['var(--radius-sm)', 6],
  r8: ['var(--radius-md)', 8],
  r10: ['0.625rem', 10, 'NEW'],
  r12: ['var(--radius-lg)', 12],
  i12: ['0.75rem', 12, 'NEW'],
  i14: ['var(--icon-size-sm)', 14],
  i16: ['1rem', 16, 'NEW'],
  i18: ['1.125rem', 18, 'NEW'],
  i20: ['var(--icon-size-md)', 20],
} satisfies Record<string, Val>;

const RTL_FALLBACK = `'IBM Plex Sans Arabic Proposal', 'Noto Sans Hebrew Proposal', system-ui, sans-serif`;

const DIRECTIONS: Direction[] = [
  {
    id: 'a',
    name: 'A. Graphite',
    tagline:
      'Geist-like. Near-black neutral carries most actions, Indigo 600 is reserved for the one primary action. Flat fills, hairline rings, no motion beyond colour.',
    font: {
      family: `'Geist Proposal', ${RTL_FALLBACK}`,
      label: 'Geist (OFL, variable 100-900)',
      weight: ['var(--font-weight-medium)', 500],
      tracking: ['-0.006em', 0, 'NEW'],
      features: `'ss01' 0`,
    },
    sizes: {
      xs: { h: T.h24, px: T.s2, fs: T.fs12, r: T.r4, icon: T.i12, gap: T.s1 },
      sm: { h: T.h28, px: T.s2_5, fs: T.fs13, r: T.r6, icon: T.i14, gap: T.s1_5 },
      md: { h: T.h32, px: T.s3, fs: T.fs14, r: T.r6, icon: T.i16, gap: T.s1_5 },
      lg: { h: T.h40, px: T.s4, fs: T.fs14, r: T.r8, icon: T.i16, gap: T.s2 },
    },
    tradeoffs: [
      'Densest of the three (md 32). Best for dashboards, tables and toolbars; on marketing pages lg 40 is the largest size.',
      'Premium comes from proportion and type, not effects, so it looks the most "engineered" and the least branded.',
      'Near-black solid is a second strong colour next to Indigo: teams must be told when to use which (rule: one indigo per view).',
      'Needs the hit-area extension on touch: xs, sm and md are visually below 44.',
    ],
  },
  {
    id: 'b',
    name: 'B. Luminous Indigo',
    tagline:
      'Linear-like. Indigo solid with a two-step vertical gradient, a 1px inner top highlight and a crisp inner edge; scale 0.97 on press. Reads "crafted" on both light and dark.',
    font: {
      family: `'Inter Proposal', ${RTL_FALLBACK}`,
      label: 'Inter v4 (OFL, variable wght 100-900 + opsz 14-32, cv11 single-storey a)',
      weight: ['var(--font-weight-medium)', 500],
      tracking: ['-0.011em', 0, 'NEW'],
      features: `'cv11' 1, 'calt' 1`,
    },
    sizes: {
      xs: { h: T.h24, px: T.s2, fs: T.fs12, r: T.r6, icon: T.i14, gap: T.s1 },
      sm: { h: T.h32, px: T.s3, fs: T.fs13, r: T.r6, icon: T.i16, gap: T.s1_5 },
      md: { h: T.h36, px: T.s3_5, fs: T.fs14, r: T.r8, icon: T.i16, gap: T.s1_5 },
      lg: { h: T.h44, px: T.s5, fs: T.fs15, r: T.r10, icon: T.i18, gap: T.s2 },
    },
    tradeoffs: [
      'Most visual impact: the only direction that looks premium on a dark hero without extra art.',
      'Gradient and inset shadows add tokens (shadow.highlight, shadow.edge) and must be re-tuned per tone; forced colors drops them (the 1px border stays).',
      'Skeuomorphic accents age faster than flat; the highlight is kept to 1px to stay restrained.',
      'lg is exactly 44 (target-min), so a primary CTA needs no hit-area trick even on touch.',
    ],
  },
  {
    id: 'c',
    name: 'C. Soft Precision',
    tagline:
      'Refined flat. Plus Jakarta Sans at semibold, slightly larger radii that scale with height, no shadows; soft (tonal) is the first-class secondary. Press nudges 1px down.',
    font: {
      family: `'Plus Jakarta Sans Proposal', ${RTL_FALLBACK}`,
      label: 'Plus Jakarta Sans (OFL, variable 200-800)',
      weight: ['var(--font-weight-semibold)', 600],
      tracking: ['var(--tracking-normal)', 0],
      features: `normal`,
    },
    sizes: {
      xs: { h: T.h28, px: T.s2_5, fs: T.fs12, r: T.r8, icon: T.i14, gap: T.s1_5 },
      sm: { h: T.h32, px: T.s3, fs: T.fs13, r: T.r8, icon: T.i16, gap: T.s1_5 },
      md: { h: T.h40, px: T.s4, fs: T.fs14, r: T.r10, icon: T.i16, gap: T.s2 },
      lg: { h: T.h48, px: T.s6, fs: T.fs16, r: T.r12, icon: T.i20, gap: T.s2 },
    },
    tradeoffs: [
      'Most comfortable and friendliest; closest to Material 3 and Apple proportions. Least "dense SaaS".',
      'md 40 is still 4px under the 44 target, so touch still needs the extension, but only for xs to md.',
      'Flat colour depends heavily on the font: with Rubik it would fall back to looking generic.',
      'Fewest new colour tokens (no gradients, no inset shadows).',
    ],
  },
];

const SIZES: SizeKey[] = ['xs', 'sm', 'md', 'lg'];
const VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const;
const TONES = ['primary', 'neutral', 'destructive'] as const;

// ---------- generated proposal custom properties ----------
const decl = (name: string, v: Val) =>
  `  ${name}: ${v[0]}; /* ${v[1] ? v[1] + 'px' : v[0]}${v[2] ? ' NEW token' : ''} */`;

const directionVars = (d: Direction) => {
  const p = `--proposal-${d.id}`;
  const lines = [
    `  ${p}-font: ${d.font.family}; /* NEW font.family.sans value */`,
    decl(`${p}-weight`, d.font.weight),
    `  ${p}-tracking: ${d.font.tracking[0]};${d.font.tracking[2] ? ' /* NEW tracking.ui */' : ''}`,
    `  ${p}-features: ${d.font.features};`,
  ];
  for (const s of SIZES) {
    const z = d.sizes[s];
    lines.push(
      decl(`${p}-h-${s}`, z.h),
      decl(`${p}-px-${s}`, z.px),
      decl(`${p}-fs-${s}`, z.fs),
      decl(`${p}-r-${s}`, z.r),
      decl(`${p}-icon-${s}`, z.icon),
      decl(`${p}-gap-${s}`, z.gap),
    );
  }
  const sizeRules = SIZES.map(
    (s) =>
      `.pdir-${d.id} .pbtn[data-size='${s}'] { --_h: var(${p}-h-${s}); --_px: var(${p}-px-${s}); --_fs: var(${p}-fs-${s}); --_r: var(${p}-r-${s}); --_icon: var(${p}-icon-${s}); --_gap: var(${p}-gap-${s}); }`,
  ).join('\n');
  return `.pdir-${d.id} {\n${lines.join('\n')}\n  --p-font: var(${p}-font);\n  --p-weight: var(${p}-weight);\n  --p-tracking: var(${p}-tracking);\n  --p-features: var(${p}-features);\n}\n${sizeRules}`;
};

// Self-hosted @font-face (files fetched once from the OFL sources, see the research doc). Relative URLs
// resolve against iframe.html, exactly like the fonts block in preview-head.html.
const LATIN = `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`;
const ARABIC = `U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC`;
const HEBREW = `U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F`;
const face = (family: string, file: string, weight: string, range: string) =>
  `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('./fonts/proposal/${file}') format('woff2'); unicode-range: ${range}; }`;
const FONTS = [
  face('Geist Proposal', 'geist-latin-100-900.woff2', '100 900', LATIN),
  face('Inter Proposal', 'inter-latin-100-900.woff2', '100 900', LATIN),
  face('Plus Jakarta Sans Proposal', 'plus-jakarta-sans-latin-200-800.woff2', '200 800', LATIN),
  face('IBM Plex Sans Arabic Proposal', 'ibm-plex-sans-arabic-arabic-500.woff2', '500', ARABIC),
  face('IBM Plex Sans Arabic Proposal', 'ibm-plex-sans-arabic-arabic-600.woff2', '600', ARABIC),
  face('Noto Sans Hebrew Proposal', 'noto-sans-hebrew-hebrew-100-900.woff2', '100 900', HEBREW),
].join('\n');

// Alpha helper: an existing colour token at a percentage, no raw rgba.
const a = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;

const CSS = `
${FONTS}

/* ===== Proposal custom properties (top of the prototype stylesheet) ===== */
/* Shared palette. Every value is an existing colour token, or an existing token mixed for alpha. */
.pdir {
  --proposal-surface: var(--color-white);
  --proposal-text: var(--color-slate-700);
  --proposal-heading: var(--color-slate-900);
  --proposal-muted: var(--color-slate-500);
  --proposal-focus: var(--color-primary);
  --proposal-primary-solid: var(--color-primary);
  --proposal-primary-solid-2: var(--color-indigo-700);
  --proposal-primary-solid-h: var(--color-indigo-700);
  --proposal-primary-solid-a: var(--color-indigo-800);
  --proposal-primary-on: var(--color-white);
  --proposal-primary-soft: var(--color-indigo-50);
  --proposal-primary-soft-h: var(--color-indigo-100);
  --proposal-primary-soft-a: var(--color-indigo-200);
  --proposal-primary-on-soft: var(--color-indigo-700);
  --proposal-primary-line: var(--color-indigo-500); /* 4.47:1 on white, clears 3:1 */
  --proposal-primary-text: var(--color-primary);
  --proposal-primary-tint: var(--color-indigo-50);
  --proposal-primary-tint-a: var(--color-indigo-100);
  --proposal-neutral-solid: var(--color-slate-900);
  --proposal-neutral-solid-2: var(--color-slate-950);
  --proposal-neutral-solid-h: var(--color-slate-800);
  --proposal-neutral-solid-a: var(--color-slate-950);
  --proposal-neutral-on: var(--color-white);
  --proposal-neutral-soft: var(--color-slate-100);
  --proposal-neutral-soft-h: var(--color-slate-200);
  --proposal-neutral-soft-a: var(--color-slate-300);
  --proposal-neutral-on-soft: var(--color-slate-900);
  --proposal-neutral-line: color-mix(in srgb, var(--color-slate-500) 40%, var(--color-slate-400)); /* NEW color.border.control, ~3.2:1 */
  --proposal-neutral-text: var(--color-slate-800);
  --proposal-neutral-tint: var(--color-slate-100);
  --proposal-neutral-tint-a: var(--color-slate-200);
  --proposal-destructive-solid: var(--color-error-strong);
  --proposal-destructive-solid-2: var(--color-red-700);
  --proposal-destructive-solid-h: var(--color-red-700);
  --proposal-destructive-solid-a: var(--color-red-800);
  --proposal-destructive-on: var(--color-white);
  --proposal-destructive-soft: var(--color-red-50);
  --proposal-destructive-soft-h: var(--color-red-100);
  --proposal-destructive-soft-a: var(--color-red-200);
  --proposal-destructive-on-soft: var(--color-red-800);
  --proposal-destructive-line: var(--color-red-500); /* 3.76:1 on white */
  --proposal-destructive-text: var(--color-red-700);
  --proposal-destructive-tint: var(--color-red-50);
  --proposal-destructive-tint-a: var(--color-red-100);
  --proposal-disabled-bg: var(--color-slate-100);
  --proposal-disabled-fg: var(--color-slate-400);
  --proposal-disabled-line: var(--color-slate-200);
  --proposal-hit: var(--target-floor); /* 24px everywhere (WCAG 2.5.8 AA) */
}
/* Dark surface: the same names remapped, no new colours. */
.pdir.p-dark {
  --proposal-surface: var(--color-slate-950);
  --proposal-text: var(--color-slate-300);
  --proposal-heading: var(--color-white);
  --proposal-muted: var(--color-slate-400);
  --proposal-focus: var(--color-indigo-400);
  --proposal-primary-solid: var(--color-primary);
  --proposal-primary-solid-2: var(--color-indigo-700);
  --proposal-primary-solid-h: var(--color-indigo-700);
  --proposal-primary-solid-a: var(--color-indigo-800);
  --proposal-primary-soft: ${a('--color-indigo-500', 18)};
  --proposal-primary-soft-h: ${a('--color-indigo-500', 26)};
  --proposal-primary-soft-a: ${a('--color-indigo-500', 34)};
  --proposal-primary-on-soft: var(--color-indigo-200);
  --proposal-primary-line: var(--color-indigo-400);
  --proposal-primary-text: var(--color-indigo-300);
  --proposal-primary-tint: ${a('--color-indigo-500', 16)};
  --proposal-primary-tint-a: ${a('--color-indigo-500', 26)};
  --proposal-neutral-solid: var(--color-white);
  --proposal-neutral-solid-2: var(--color-slate-200);
  --proposal-neutral-solid-h: var(--color-slate-200);
  --proposal-neutral-solid-a: var(--color-slate-300);
  --proposal-neutral-on: var(--color-slate-950);
  --proposal-neutral-soft: ${a('--color-white', 8)};
  --proposal-neutral-soft-h: ${a('--color-white', 13)};
  --proposal-neutral-soft-a: ${a('--color-white', 18)};
  --proposal-neutral-on-soft: var(--color-slate-100);
  --proposal-neutral-line: var(--color-slate-500);
  --proposal-neutral-text: var(--color-slate-100);
  --proposal-neutral-tint: ${a('--color-white', 8)};
  --proposal-neutral-tint-a: ${a('--color-white', 14)};
  --proposal-destructive-soft: ${a('--color-red-500', 18)};
  --proposal-destructive-soft-h: ${a('--color-red-500', 26)};
  --proposal-destructive-soft-a: ${a('--color-red-500', 34)};
  --proposal-destructive-on-soft: var(--color-red-200);
  --proposal-destructive-line: var(--color-red-400);
  --proposal-destructive-text: var(--color-red-300);
  --proposal-destructive-tint: ${a('--color-red-500', 16)};
  --proposal-destructive-tint-a: ${a('--color-red-500', 26)};
  --proposal-disabled-bg: ${a('--color-white', 6)};
  --proposal-disabled-fg: var(--color-slate-600);
  --proposal-disabled-line: var(--color-slate-800);
}

${DIRECTIONS.map(directionVars).join('\n\n')}

/* ===== Radius options (owner review, the "Radius" control). They override each direction's own radius on
   every size, icon-only squares included (they read the same --_r). The focus outline follows border-radius. ===== */
.pradius-tight {
  --proposal-radius-xs: 0.125rem; /* 2px NEW radius.2xs */
  --proposal-radius-sm: 0.1875rem; /* 3px NEW radius.3xs-ish (no token between 2 and 4) */
  --proposal-radius-md: var(--radius-xs); /* 4px */
  --proposal-radius-lg: var(--radius-xs); /* 4px */
}
.pradius-sharp {
  --proposal-radius-xs: 0.125rem; /* 2px NEW */
  --proposal-radius-sm: 0.125rem;
  --proposal-radius-md: 0.125rem;
  --proposal-radius-lg: 0.125rem;
}
.pradius-none {
  --proposal-radius-xs: var(--radius-none);
  --proposal-radius-sm: var(--radius-none);
  --proposal-radius-md: var(--radius-none);
  --proposal-radius-lg: var(--radius-none);
}
${SIZES.map((sz) => `:is(.pradius-tight, .pradius-sharp, .pradius-none) .pdir .pbtn[data-size='${sz}'] { --_r: var(--proposal-radius-${sz}); }`).join('\n')}
:is(.pradius-tight, .pradius-sharp, .pradius-none) .pdir .pbtn .pkbd { border-radius: min(var(--_r), var(--radius-xs)); }

/* ===== Prototype button (shared structure; directions only change the variables above + a few effects) ===== */
.pbtn {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: var(--_gap);
  box-sizing: border-box;
  block-size: var(--_h);
  min-inline-size: var(--_h);
  margin: 0;
  padding-block: 0;
  padding-inline: var(--_px);
  border: var(--border-width-hairline) solid var(--_bd, transparent);
  border-radius: var(--_r);
  font-family: var(--p-font);
  font-size: var(--_fs);
  font-weight: var(--p-weight);
  font-feature-settings: var(--p-features);
  letter-spacing: var(--p-tracking);
  line-height: var(--leading-none);
  white-space: nowrap;
  color: var(--_fg);
  background-color: var(--_bg, transparent);
  background-image: var(--_img, none);
  box-shadow: var(--_sh, none);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition-property: color, background-color, border-color, box-shadow, scale, translate;
  transition-duration: var(--duration-fast);
  transition-timing-function: var(--easing-out);
}
.pbtn svg { inline-size: var(--_icon); block-size: var(--_icon); flex: none; stroke-width: var(--p-stroke, var(--icon-stroke-width)); }
.pbtn[data-icon-only] { inline-size: var(--_h); padding-inline: 0; }
.pbtn .pkbd {
  margin-inline-start: var(--space-1);
  padding-inline: var(--space-1);
  border-radius: var(--radius-xs);
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-normal);
  background: color-mix(in srgb, currentColor 14%, transparent);
}
[dir='rtl'] .pbtn [data-mirror] { scale: -1 1; }

/* Hit area: invisible, centred, never smaller than 24px; 44px under a coarse pointer. Visual stays compact. */
.pbtn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  inline-size: max(100%, var(--proposal-hit));
  block-size: max(100%, var(--proposal-hit));
  translate: -50% -50%;
}
@media (pointer: coarse) { .pdir { --proposal-hit: var(--target-min); } }
.p-coarse .pdir, .pdir.p-coarse { --proposal-hit: var(--target-min); }
.p-showhit .pbtn::before { outline: var(--border-width-hairline) dashed var(--color-violet-500); }

/* Tones feed the variants. */
.pbtn[data-tone] { --t-solid: var(--proposal-primary-solid); --t-solid-2: var(--proposal-primary-solid-2); --t-solid-h: var(--proposal-primary-solid-h); --t-solid-a: var(--proposal-primary-solid-a); --t-on: var(--proposal-primary-on); --t-soft: var(--proposal-primary-soft); --t-soft-h: var(--proposal-primary-soft-h); --t-soft-a: var(--proposal-primary-soft-a); --t-on-soft: var(--proposal-primary-on-soft); --t-line: var(--proposal-primary-line); --t-text: var(--proposal-primary-text); --t-tint: var(--proposal-primary-tint); --t-tint-a: var(--proposal-primary-tint-a); }
.pbtn[data-tone='neutral'] { --t-solid: var(--proposal-neutral-solid); --t-solid-2: var(--proposal-neutral-solid-2); --t-solid-h: var(--proposal-neutral-solid-h); --t-solid-a: var(--proposal-neutral-solid-a); --t-on: var(--proposal-neutral-on); --t-soft: var(--proposal-neutral-soft); --t-soft-h: var(--proposal-neutral-soft-h); --t-soft-a: var(--proposal-neutral-soft-a); --t-on-soft: var(--proposal-neutral-on-soft); --t-line: var(--proposal-neutral-line); --t-text: var(--proposal-neutral-text); --t-tint: var(--proposal-neutral-tint); --t-tint-a: var(--proposal-neutral-tint-a); }
.pbtn[data-tone='destructive'] { --t-solid: var(--proposal-destructive-solid); --t-solid-2: var(--proposal-destructive-solid-2); --t-solid-h: var(--proposal-destructive-solid-h); --t-solid-a: var(--proposal-destructive-solid-a); --t-on: var(--proposal-destructive-on); --t-soft: var(--proposal-destructive-soft); --t-soft-h: var(--proposal-destructive-soft-h); --t-soft-a: var(--proposal-destructive-soft-a); --t-on-soft: var(--proposal-destructive-on-soft); --t-line: var(--proposal-destructive-line); --t-text: var(--proposal-destructive-text); --t-tint: var(--proposal-destructive-tint); --t-tint-a: var(--proposal-destructive-tint-a); }

.pbtn[data-variant='solid'] { --_fg: var(--t-on); --_bg: var(--t-solid); --_bd: var(--t-solid); --_bg-h: var(--t-solid-h); --_bg-a: var(--t-solid-a); }
.pbtn[data-variant='soft'] { --_fg: var(--t-on-soft); --_bg: var(--t-soft); --_bg-h: var(--t-soft-h); --_bg-a: var(--t-soft-a); }
.pbtn[data-variant='outline'] { --_fg: var(--t-text); --_bg: var(--proposal-surface); --_bd: var(--t-line); --_bg-h: var(--t-tint); --_bg-a: var(--t-tint-a); }
.pbtn[data-variant='ghost'] { --_fg: var(--t-text); --_bg: transparent; --_bg-h: var(--t-tint); --_bg-a: var(--t-tint-a); }
.pbtn[data-variant='outline'][data-tone='neutral'] { --_fg: var(--proposal-heading); }

/* Pointer states: real :hover (hover-capable pointers only) and :active, plus .is-* mirrors for static review. */
@media (hover: hover) {
  .pbtn:hover:not(:disabled) { background-color: var(--_bg-h); background-image: var(--_img-h, var(--_img, none)); box-shadow: var(--_sh-h, var(--_sh, none)); }
}
.pbtn.is-hover { background-color: var(--_bg-h); background-image: var(--_img-h, var(--_img, none)); box-shadow: var(--_sh-h, var(--_sh, none)); }
.pbtn:active:not(:disabled), .pbtn.is-active { background-color: var(--_bg-a); background-image: var(--_img-a, none); box-shadow: var(--_sh-a, none); scale: var(--_press-scale, 1); translate: 0 var(--_press-y, 0); }
.pbtn:focus-visible, .pbtn.is-focus { outline: var(--focus-ring-width) solid var(--proposal-focus); outline-offset: var(--focus-ring-offset); }
/* Disabled outranks every direction rule (0,4,0). */
.pdir .pbtn.pbtn:disabled {
  --_fg: var(--proposal-disabled-fg);
  --_bg: var(--proposal-disabled-bg);
  --_bd: transparent;
  --_img: none;
  --_sh: none;
  cursor: not-allowed;
}
.pdir .pbtn.pbtn:disabled[data-variant='outline'] { --_bd: var(--proposal-disabled-line); --_bg: transparent; }
.pdir .pbtn.pbtn:disabled[data-variant='ghost'] { --_bg: transparent; }
@media (prefers-reduced-motion: reduce) { .pbtn { transition-duration: 0s; --_press-scale: 1; --_press-y: 0; } }
@media (forced-colors: active) { .pbtn { border-color: ButtonBorder; } .pbtn:disabled { color: GrayText; border-color: GrayText; } }

/* True link variant: inline text, underlined at rest (never colour alone, 1.4.1), inherits the sentence size. */
.plink {
  font: inherit;
  font-weight: var(--p-weight);
  color: var(--t-text, var(--proposal-primary-text));
  text-decoration-line: underline;
  text-decoration-thickness: var(--p-link-thick, 1px);
  text-underline-offset: var(--p-link-offset, 0.2em);
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
  border-radius: var(--radius-xs);
  transition: text-decoration-color var(--duration-fast) var(--easing-out);
}
.plink[data-tone='neutral'] { --t-text: var(--proposal-heading); }
.plink[data-tone='destructive'] { --t-text: var(--proposal-destructive-text); }
.plink:hover, .plink.is-hover { text-decoration-color: currentColor; }
.plink:focus-visible, .plink.is-focus { outline: var(--focus-ring-width) solid var(--proposal-focus); outline-offset: var(--focus-ring-offset); }
.plink svg { display: inline-block; inline-size: 1em; block-size: 1em; vertical-align: -0.125em; margin-inline-start: var(--space-1); stroke-width: var(--icon-stroke-width); }
.plink[aria-disabled='true'] { color: var(--proposal-disabled-fg); text-decoration-style: dotted; cursor: not-allowed; }

/* ----- Direction A: Graphite (flat, hairline ring on outline, no transform) ----- */
.pdir-a { --p-stroke: 1.75; --p-link-thick: 1px; --p-link-offset: 0.22em; }
.pdir-a .pbtn[data-variant='outline'] { --_sh: 0 1px 0 0 ${a('--color-slate-900', 4)}; }

/* ----- Direction B: Luminous Indigo (gradient, 1px inner highlight, inner edge, press scale) ----- */
.pdir-b { --p-stroke: 1.75; --p-link-thick: 1.5px; --p-link-offset: 0.24em;
  --proposal-b-highlight: inset 0 1px 0 0 ${a('--color-white', 22)}; /* NEW shadow.highlight */
  --proposal-b-lift: 0 1px 2px 0 ${a('--color-indigo-950', 28)}, 0 0 0 0 transparent; /* NEW shadow.lift */
  --proposal-b-glow: 0 1px 2px 0 ${a('--color-indigo-950', 28)}, 0 0 0 3px ${a('--color-indigo-500', 18)}; /* NEW shadow.glow */
  --proposal-b-press: inset 0 1px 2px 0 ${a('--color-black', 24)}; /* NEW shadow.press */
  --proposal-b-sheen: ${a('--color-white', 12)}; /* NEW gradient.sheen */
  --proposal-b-press-scale: 0.97; /* NEW motion.press.scale (Linear uses .97) */
}
.pdir-b .pbtn { --_press-scale: var(--proposal-b-press-scale); }
.pdir-b .pbtn[data-variant='solid'] {
  --_bd: var(--t-solid-2);
  /* Sheen: white 12% at the top fading out by mid-height, over a base-to-darker gradient. White text stays >= 4.9:1. */
  --_img: linear-gradient(to bottom, var(--proposal-b-sheen), transparent 55%), linear-gradient(to bottom, var(--t-solid), var(--t-solid-2));
  --_img-h: linear-gradient(to bottom, var(--proposal-b-sheen), transparent 55%), linear-gradient(to bottom, var(--t-solid-h), var(--t-solid-2));
  --_img-a: linear-gradient(to bottom, var(--t-solid-a), var(--t-solid-a));
  --_sh: var(--proposal-b-highlight), var(--proposal-b-lift);
  --_sh-h: var(--proposal-b-highlight), var(--proposal-b-glow);
  --_sh-a: var(--proposal-b-press);
}
.pdir-b .pbtn[data-variant='soft'] { --_sh: inset 0 0 0 1px color-mix(in srgb, var(--t-on-soft) 10%, transparent); }
.pdir-b .pbtn[data-variant='outline'] { --_sh: var(--shadow-sm); --_sh-h: var(--shadow-sm); }
.pdir-b.p-dark .pbtn[data-variant='solid'][data-tone='neutral'] { --_sh: inset 0 -1px 0 0 ${a('--color-slate-900', 16)}, var(--proposal-b-lift); --_sh-h: inset 0 -1px 0 0 ${a('--color-slate-900', 16)}, 0 0 0 3px ${a('--color-white', 14)}; }
.pdir-b.p-dark .pbtn[data-variant='outline'] { --_bg: ${a('--color-white', 3)}; --_sh: inset 0 1px 0 0 ${a('--color-white', 6)}; --_sh-h: inset 0 1px 0 0 ${a('--color-white', 8)}; }

/* ----- Direction C: Soft Precision (flat, scaled radii, 1px press nudge) ----- */
.pdir-c { --p-stroke: 2; --p-link-thick: 0.08em; --p-link-offset: 0.18em; --proposal-c-press-y: 1px; /* NEW motion.press.offset */ }
.pdir-c .pbtn { --_press-y: var(--proposal-c-press-y); }

/* ===== Specimen layout (tokens only) ===== */
.pdir {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  color: var(--proposal-text);
  background: var(--proposal-surface);
  border: var(--border-width-hairline) solid var(--color-slate-200);
  border-radius: var(--radius-xl);
  font-family: var(--p-font);
  font-size: var(--font-size-sm);
  line-height: var(--leading-normal);
}
.pdir.p-dark { border-color: var(--color-slate-800); }
.pdir h3 { margin: 0; font-family: var(--p-font); font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); letter-spacing: var(--tracking-tight); color: var(--proposal-heading); }
.pdir h4 { margin: 0 0 var(--space-2); font-family: var(--p-font); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--proposal-muted); }
.pdir p { margin: 0; }
.pdir .pmeta { font-size: var(--font-size-xs); color: var(--proposal-muted); font-variant-numeric: tabular-nums; }
.prow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.prow-wide { gap: var(--space-4); }
.pgrid { display: grid; grid-template-columns: max-content repeat(3, max-content); align-items: center; gap: var(--space-2) var(--space-3); }
.pgrid > .pmeta { padding-inline-end: var(--space-2); }
.pgrid > *, .psizes > * { justify-self: start; }
.psizes { display: grid; grid-template-columns: max-content max-content max-content 1fr; align-items: center; gap: var(--space-3); }
.pcols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
.pcols > .pdir { padding: var(--space-5); gap: var(--space-4); }
.pref { display: flex; flex-direction: column; gap: var(--space-2); margin-block-end: var(--space-4); font-family: var(--font-family-sans); font-size: var(--font-size-sm); color: var(--color-slate-600); }
.pnote { max-inline-size: 44rem; }
.pstack { display: flex; flex-direction: column; gap: var(--space-6); }
.pbar { display: flex; gap: var(--space-4); margin-block-end: var(--space-3); font-family: var(--font-family-sans); font-size: var(--font-size-sm); color: var(--color-slate-700); }
`;

let injected = false;
const ensureCss = () => {
  if (injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.id = 'sj-button-proposal';
  el.textContent = CSS;
  document.head.append(el);
  injected = true;
};

// ---------- icons (Lucide paths, ISC) ----------
const ICONS: Record<string, string[]> = {
  plus: ['M5 12h14', 'M12 5v14'],
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'],
  chevron: ['m6 9 6 6 6-6'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  search: ['m21 21-4.34-4.34', 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z'],
  more: ['M12 12h.01', 'M19 12h.01', 'M5 12h.01'],
  sparkles: [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
  ],
};
const PIcon = defineComponent({
  name: 'PIcon',
  props: { name: { type: String, required: true }, mirror: Boolean },
  setup: (p) => () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        'data-mirror': p.mirror ? '' : undefined,
      },
      (ICONS[p.name] ?? []).map((d) => h('path', { d })),
    ),
});

// ---------- specimen ----------
const fmt = (v: Val) => (v[1] ? `${v[1]}` : v[0]);
// Radius shown in captions follows the Radius control (Proposal = the direction's own value).
const RADIUS_PX: Record<string, Record<SizeKey, number>> = {
  tight: { xs: 2, sm: 3, md: 4, lg: 4 },
  sharp: { xs: 2, sm: 2, md: 2, lg: 2 },
  none: { xs: 0, sm: 0, md: 0, lg: 0 },
};
const sizeLine = (d: Direction, s: SizeKey, radius = 'proposal') => {
  const z = d.sizes[s];
  const r = RADIUS_PX[radius]?.[s] ?? fmt(z.r);
  return `${s} · h ${fmt(z.h)} · px ${fmt(z.px)} · r ${r} · ${fmt(z.fs)}/${d.font.weight[1]} · icon ${fmt(z.icon)} · gap ${fmt(z.gap)}`;
};

const Specimen = defineComponent({
  name: 'ButtonProposalSpecimen',
  components: { PIcon },
  props: {
    dir: { type: Object as PropType<Direction>, required: true },
    dark: Boolean,
    compact: Boolean,
    radius: { type: String, default: 'proposal' },
  },
  setup: (p) => {
    ensureCss();
    return {
      SIZES,
      VARIANTS,
      TONES,
      sizeLine: (s: SizeKey) => sizeLine(p.dir, s, p.radius),
      label: (t: string) => ({ primary: 'Save changes', neutral: 'Export', destructive: 'Delete' })[t],
    };
  },
  template: `
  <section :class="['pdir', 'pdir-' + dir.id, { 'p-dark': dark }]" :aria-label="dir.name + (dark ? ' (dark)' : '')">
    <div>
      <h3>{{ dir.name }}{{ dark ? ' · dark' : '' }}</h3>
      <p v-if="!compact && !dark" class="pnote">{{ dir.tagline }}</p>
      <p class="pmeta">{{ dir.font.label }}</p>
    </div>

    <div>
      <h4>Sizes and icon-only squares</h4>
      <div class="psizes">
        <template v-for="s in SIZES" :key="s">
          <button class="pbtn" data-variant="solid" data-tone="primary" :data-size="s" type="button"><PIcon name="plus" />Create</button>
          <button class="pbtn" data-variant="outline" data-tone="neutral" :data-size="s" type="button" data-icon-only :aria-label="'More options, ' + s"><PIcon name="more" /></button>
          <button class="pbtn" data-variant="soft" data-tone="primary" :data-size="s" type="button" data-icon-only :aria-label="'Search, ' + s"><PIcon name="search" /></button>
          <span class="pmeta">{{ compact ? s + ' · ' + sizeLine(s).split(' · ')[1] : sizeLine(s) }}</span>
        </template>
      </div>
    </div>

    <div>
      <h4>Variants × tones (md)</h4>
      <div class="pgrid">
        <template v-for="v in VARIANTS" :key="v">
          <span class="pmeta">{{ v }}</span>
          <button v-for="t in TONES" :key="t" class="pbtn" :data-variant="v" :data-tone="t" data-size="md" type="button">{{ label(t) }}</button>
        </template>
        <span class="pmeta">link</span>
        <a class="plink" data-tone="primary" href="#proposal">View invoice</a>
        <a class="plink" data-tone="neutral" href="#proposal">Learn more</a>
        <a class="plink" data-tone="destructive" href="#proposal">Remove</a>
      </div>
    </div>

    <div>
      <h4>Link in a sentence</h4>
      <p>Tu prueba gratuita termina el 30 de noviembre. <a class="plink" href="#proposal">Revisa la facturación</a> o <a class="plink" data-tone="neutral" href="#proposal">compara los planes<PIcon name="arrow" mirror /></a> antes de esa fecha. ¿Ya no lo necesitas? <a class="plink" data-tone="destructive" href="#proposal">Cancela la suscripción</a>.</p>
    </div>

    <template v-if="!compact">
      <div>
        <h4>Leading and trailing icons</h4>
        <div class="prow">
          <button class="pbtn" data-variant="solid" data-tone="neutral" data-size="md" type="button"><PIcon name="download" />Download</button>
          <button class="pbtn" data-variant="outline" data-tone="neutral" data-size="md" type="button">Options<PIcon name="chevron" /></button>
          <button class="pbtn" data-variant="solid" data-tone="primary" data-size="md" type="button">Continue<PIcon name="arrow" mirror /></button>
          <button class="pbtn" data-variant="soft" data-tone="neutral" data-size="md" type="button"><PIcon name="search" />Search<span class="pkbd">⌘K</span></button>
          <button class="pbtn" data-variant="ghost" data-tone="primary" data-size="md" type="button"><PIcon name="sparkles" />Ask AI</button>
        </div>
      </div>

      <div>
        <h4>States: rest · hover · pressed · focus-visible · disabled</h4>
        <div class="pgrid" style="grid-template-columns: max-content repeat(5, max-content)">
          <template v-for="row in [['solid','primary','Save'],['solid','neutral','Export'],['outline','neutral','Cancel'],['soft','primary','Invite'],['ghost','destructive','Delete']]" :key="row.join()">
            <span class="pmeta">{{ row[0] }} {{ row[1] }}</span>
            <button class="pbtn" :data-variant="row[0]" :data-tone="row[1]" data-size="md" type="button">{{ row[2] }}</button>
            <button class="pbtn is-hover" :data-variant="row[0]" :data-tone="row[1]" data-size="md" type="button" tabindex="-1">{{ row[2] }}</button>
            <button class="pbtn is-active" :data-variant="row[0]" :data-tone="row[1]" data-size="md" type="button" tabindex="-1">{{ row[2] }}</button>
            <button class="pbtn is-focus" :data-variant="row[0]" :data-tone="row[1]" data-size="md" type="button" tabindex="-1">{{ row[2] }}</button>
            <button class="pbtn" :data-variant="row[0]" :data-tone="row[1]" data-size="md" type="button" disabled>{{ row[2] }}</button>
          </template>
        </div>
      </div>

      <div>
        <h4>RTL (Arabic, Hebrew)</h4>
        <div class="prow" dir="rtl" lang="ar">
          <button class="pbtn" data-variant="solid" data-tone="primary" data-size="md" type="button"><PIcon name="plus" />حفظ التغييرات</button>
          <button class="pbtn" data-variant="outline" data-tone="neutral" data-size="md" type="button">إلغاء</button>
          <button class="pbtn" data-variant="soft" data-tone="primary" data-size="md" type="button">متابعة<PIcon name="arrow" mirror /></button>
          <button class="pbtn" data-variant="ghost" data-tone="destructive" data-size="md" type="button"><PIcon name="trash" />حذف</button>
          <button class="pbtn" data-variant="outline" data-tone="neutral" data-size="md" type="button" data-icon-only aria-label="المزيد"><PIcon name="more" /></button>
          <a class="plink" href="#proposal">عرض الفاتورة</a>
        </div>
        <div class="prow" dir="rtl" lang="he" style="margin-block-start: var(--space-2)">
          <button class="pbtn" data-variant="solid" data-tone="neutral" data-size="sm" type="button">שמירה<PIcon name="arrow" mirror /></button>
          <button class="pbtn" data-variant="soft" data-tone="neutral" data-size="sm" type="button">ביטול</button>
          <a class="plink" href="#proposal">למידע נוסף</a>
        </div>
      </div>
    </template>
  </section>`,
});

const byId = (id: Direction['id']) => DIRECTIONS.find((d) => d.id === id)!;

const describe = (d: Direction) => `
**${d.name}.** ${d.tagline}

Font: ${d.font.label}. Weight ${d.font.weight[1]}, tracking ${d.font.tracking[0]}.

| Size | Height | Padding-x | Radius | Font | Icon | Gap |
|---|---|---|---|---|---|---|
${SIZES.map((s) => {
  const z = d.sizes[s];
  const c = (v: Val) => `${v[1]}${v[2] ? ' (NEW)' : ''}`;
  return `| ${s} | ${c(z.h)} | ${c(z.px)} | ${c(z.r)} | ${c(z.fs)} | ${c(z.icon)} | ${c(z.gap)} |`;
}).join('\n')}

Trade-offs:
${d.tradeoffs.map((t) => `- ${t}`).join('\n')}

Hover and press work on the real buttons; the States row also shows them frozen (\`.is-hover\`, \`.is-active\`, \`.is-focus\`) for review.

The Radius column is the direction's own value ("Proposal (current)"). ${RADIUS_NOTE}
`;

type RadiusKey = 'proposal' | 'tight' | 'sharp' | 'none';
const RADIUS_LABELS: Record<RadiusKey, string> = {
  proposal: 'Proposal (current)',
  tight: 'Tight (2/3/4/4)',
  sharp: 'Sharp (2 everywhere)',
  none: 'None (0)',
};
type RadiusArgs = { radius?: RadiusKey };
const radiusClass = (args: RadiusArgs) => 'pradius-' + (args.radius ?? 'tight');
const RADIUS_NOTE = `**Radius control** (Controls panel): Proposal (each direction's own radius), Tight 2/3/4/4 px (default), Sharp 2 px, None 0. It applies to every size and to the icon-only squares, and the focus ring (an \`outline\`) follows the same radius.`;

const meta: Meta<RadiusArgs> = {
  title: 'Components/Button/Proposal',
  tags: ['autodocs'],
  argTypes: {
    radius: {
      name: 'Radius',
      description:
        'Corner radius applied to every size and to icon-only squares. The focus ring follows it.',
      control: { type: 'select', labels: RADIUS_LABELS },
      options: Object.keys(RADIUS_LABELS),
    },
  },
  args: { radius: 'tight' },
  parameters: {
    layout: 'fullscreen',
    ...about(`
**Proposal only, nothing here ships.** Three directions for the SJButton redesign, built as scoped prototype CSS so they can be compared before any token or component change. Research, sources and the token changes each direction needs: \`docs/research/button-premium-2026.md\`.

All three keep Indigo 600 as the action colour, AA contrast (4.5:1 text, 3:1 boundaries), a visible focus ring, a 24 px minimum target everywhere and a 44 px hit area on coarse pointers (see **Touch Targets**). Values marked NEW would need a new token.

${RADIUS_NOTE}
    `),
  },
};
export default meta;
type Story = StoryObj<RadiusArgs>;

export const SideBySide: Story = {
  name: 'Side by side',
  render: (args) => ({
    components: { Specimen, SJButton },
    setup: () => ({ DIRECTIONS, args, radiusClass }),
    template: `<div :class="radiusClass(args)" style="padding: var(--space-4)">
      <div class="pref"><span>Current SJButton (for reference): every size is 44 px tall, so sm and md differ only in font size.</span>
        <div class="prow"><SJButton size="sm">Create</SJButton><SJButton size="md">Create</SJButton><SJButton size="lg">Create</SJButton><SJButton variant="outline" tone="neutral">Export</SJButton><SJButton variant="soft">Invite</SJButton></div></div>
      <div class="pcols"><Specimen v-for="d in DIRECTIONS" :key="d.id" :dir="d" compact :radius="args.radius" /></div>
      <div class="pcols" style="margin-block-start: var(--space-4)"><Specimen v-for="d in DIRECTIONS" :key="d.id" :dir="d" compact dark :radius="args.radius" /></div>
    </div>`,
  }),
  parameters: tryIt(`
The three directions in the same order of rows, light then dark, with the current SJButton above for reference. Compare heights, padding (length), radius and type first, then colour. Each direction has its own story with states, icons and RTL.

${RADIUS_NOTE}
  `),
};

const directionStory = (id: Direction['id']): Story => ({
  render: (args) => ({
    components: { Specimen },
    setup: () => ({ d: byId(id), args, radiusClass }),
    template: `<div :class="['pstack', radiusClass(args)]" style="padding: var(--space-4); max-inline-size: 60rem"><Specimen :dir="d" :radius="args.radius" /><Specimen :dir="d" dark :radius="args.radius" /></div>`,
  }),
  parameters: tryIt(describe(byId(id))),
});

export const DirectionA: Story = { ...directionStory('a'), name: 'A. Graphite' };
export const DirectionB: Story = { ...directionStory('b'), name: 'B. Luminous Indigo' };
export const DirectionC: Story = { ...directionStory('c'), name: 'C. Soft Precision' };

export const TouchTargets: Story = {
  name: 'Touch targets',
  render: (args) => ({
    components: { PIcon },
    setup: () => {
      ensureCss();
      return { DIRECTIONS, SIZES, coarse: ref(true), show: ref(true), args, radiusClass };
    },
    template: `<div :class="radiusClass(args)" style="padding: var(--space-4)">
      <div class="pbar">
        <label><input type="checkbox" v-model="coarse" /> Simulate coarse pointer (44 px hit area)</label>
        <label><input type="checkbox" v-model="show" /> Show hit areas</label>
      </div>
      <div :class="['pcols', { 'p-coarse': coarse, 'p-showhit': show }]">
        <section v-for="d in DIRECTIONS" :key="d.id" :class="['pdir', 'pdir-' + d.id]" :aria-label="d.name + ' touch targets'">
          <h3>{{ d.name }}</h3>
          <div class="prow prow-wide" v-for="s in SIZES" :key="s">
            <button class="pbtn" data-variant="solid" data-tone="primary" :data-size="s" type="button">Save</button>
            <button class="pbtn" data-variant="outline" data-tone="neutral" :data-size="s" type="button" data-icon-only :aria-label="'More, ' + s"><PIcon name="more" /></button>
            <span class="pmeta">{{ s }} · visual {{ d.sizes[s].h[1] }} px</span>
          </div>
        </section>
      </div>
    </div>`,
  }),
  parameters: tryIt(`
The dashed violet box (an annotation, not part of the design) is the real click/tap area. It is an invisible, centred \`::before\` on the button: at least 24 px on every device (WCAG 2.2 SC 2.5.8 AA) and 44 px under \`@media (pointer: coarse)\` (here simulated by the checkbox). The visual button stays compact.

Click just outside an xs button, inside the dashed box: it still activates. Note the spacing cost: on touch, two 28 px buttons need about 16 px between them so their 44 px areas do not overlap. That is the decision the owner must make (see the research doc).

${RADIUS_NOTE}
  `),
};
