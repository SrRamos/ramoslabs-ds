// SJButton status-tone PROPOSAL (not shipped). Renders the real SJButton with Direction B styles from
// @ramoslabs/css and swaps only the success / warning / error / info / neutral colours through scoped
// `--tp-<tone>-<role>` custom properties. Research and sources: docs/research/status-tones-2026.md.
//
// Rules this file follows:
// - packages/tokens and packages/css/src/button.css are untouched. The proposal CSS is unlayered and
//   scoped under `.tp`, so it wins over the sj.variant layer only inside this story.
// - Layout, spacing, type, radius and shadow read existing tokens. The only raw values are the candidate
//   colours, authored in OKLCH in ./tone-proposal/palettes.ts; the table marks each as an existing
//   primitive or NEW.
// - Indigo 600 primary is unchanged and shown as the anchor of every row. Every pair rendered is AA or
//   better (./tone-proposal/metrics.ts `failures` is empty for every palette).
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { computed, defineComponent, h, type PropType } from 'vue';
import { SJButton } from '@ramoslabs/vue/button';
import type { IconData } from '@ramoslabs/core/icon';
import { SJIcon, about, iconAlert, tryIt } from './_shared';
import { cvdFilterValues, type Cvd } from './tone-proposal/color';
import { PALETTES, TONES, type Palette, type Roles, type Tone } from './tone-proposal/palettes';
import { dark, describe, failures, floor, rows, separation, VISIONS } from './tone-proposal/metrics';

const VARIANTS = ['solid', 'soft', 'outline', 'ghost', 'link'] as const;
const STATES = ['rest', 'hover', 'press'] as const;
const CVDS: Cvd[] = ['deuteranopia', 'protanopia', 'tritanopia'];
const LABEL: Record<Tone, string> = {
  success: 'Approve',
  warning: 'Review',
  error: 'Delete',
  info: 'Details',
  neutral: 'Cancel',
};

// Guard: a palette with a pair below AA must never reach the canvas.
for (const p of PALETTES) {
  const f = failures(p);
  if (f.length) throw new Error(`Tone proposal ${p.id} has pairs below AA:\n${f.join('\n')}`);
}

// ---------------------------------------------------------------------------------------------------
// Scoped CSS
// ---------------------------------------------------------------------------------------------------

const ROLE_KEYS = [
  'solid',
  'solidEnd',
  'solidBorder',
  'hover',
  'hoverEnd',
  'press',
  'on',
  'text',
  'textStrong',
  'surface',
  'surfaceHover',
  'surfacePress',
  'border',
  'outline',
] as const;
type RoleKey = (typeof ROLE_KEYS)[number];
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const v = (t: Tone, r: RoleKey) => `var(--tp-${t}-${kebab(r)})`;

function lightVars(r: Roles): Record<RoleKey, string> {
  return Object.fromEntries(ROLE_KEYS.map((k) => [k, r[k]])) as Record<RoleKey, string>;
}
function darkVars(r: Roles): Record<RoleKey, string> {
  return {
    ...dark(r),
    text: r.dText,
    textStrong: r.dTextStrong,
    surface: r.dSurface,
    surfaceHover: r.dSurfaceHover,
    surfacePress: r.dSurfacePress,
    border: r.dBorder,
    outline: r.dOutline,
  };
}
const declare = (t: Tone, vars: Record<RoleKey, string>) =>
  ROLE_KEYS.map((k) => `--tp-${t}-${kebab(k)}: ${vars[k]};`).join(' ');

function paletteCss(p: Palette): string {
  const light = TONES.map((t) => declare(t, lightVars(p.tones[t]))).join('\n  ');
  const dk = TONES.map((t) => declare(t, darkVars(p.tones[t]))).join('\n  ');
  return `.tp[data-palette='${p.id}'] {\n  ${light}\n}\n.tp[data-palette='${p.id}'] .tp-dark {\n  ${dk}\n}`;
}

// Enabled buttons only: a disabled button keeps the DS disabled style (sj.state).
const B = `:is(.sj-button__root, .sj-button__link):not([data-disabled]:not([data-disabled='false']))`;
const at = (variant: string, t: string) => `${B}[data-variant='${variant}'][data-tone='${t}']`;
/** Real pointer state and its static simulation (a `data-sim` ancestor), as one selector list. */
const sel = (variant: string, t: string, state: 'rest' | 'hover' | 'press') => {
  const base = at(variant, t);
  if (state === 'rest') return `.tp ${base}`;
  const pseudo = state === 'hover' ? ':hover' : ':active';
  return `.tp ${base}${pseudo}, .tp [data-sim='${state}'] ${base}`;
};

function toneRules(t: Tone): string {
  const css: string[] = [];
  const rule = (s: string, body: string) => css.push(`${s} { ${body} }`);
  // Solid
  rule(
    sel('solid', t, 'rest'),
    `color: ${v(t, 'on')}; background-color: ${v(t, 'solid')}; border-color: ${v(t, 'solidBorder')}; --_end: ${v(t, 'solidEnd')};`,
  );
  rule(
    sel('solid', t, 'hover'),
    `background-color: ${v(t, 'hover')}; border-color: ${v(t, 'solidBorder')}; --_end: ${v(t, 'hoverEnd')};
     box-shadow: var(--shadow-highlight), var(--shadow-lift), 0 0 0 var(--tp-glow-width) color-mix(in srgb, ${v(t, 'solid')} var(--tp-glow-mix), transparent);`,
  );
  rule(sel('solid', t, 'press'), `background-color: ${v(t, 'press')}; border-color: ${v(t, 'press')};`);
  // Soft
  rule(
    sel('soft', t, 'rest'),
    `color: ${v(t, 'text')}; background-color: ${v(t, 'surface')}; border-color: ${v(t, 'surface')};`,
  );
  rule(sel('soft', t, 'hover'), `background-color: ${v(t, 'surfaceHover')}; border-color: ${v(t, 'surfaceHover')};`);
  rule(sel('soft', t, 'press'), `background-color: ${v(t, 'surfacePress')}; border-color: ${v(t, 'surfacePress')};`);
  // Outline
  rule(sel('outline', t, 'rest'), `color: ${v(t, 'text')}; background-color: transparent; border-color: ${v(t, 'outline')};`);
  rule(sel('outline', t, 'hover'), `background-color: ${v(t, 'surface')};`);
  rule(sel('outline', t, 'press'), `background-color: ${v(t, 'surfaceHover')};`);
  // Ghost
  rule(sel('ghost', t, 'rest'), `color: ${v(t, 'text')}; background-color: transparent; border-color: transparent;`);
  rule(sel('ghost', t, 'hover'), `background-color: ${v(t, 'surface')};`);
  rule(sel('ghost', t, 'press'), `background-color: ${v(t, 'surfaceHover')};`);
  // Link
  rule(sel('link', t, 'rest'), `color: ${v(t, 'text')};`);
  rule(sel('link', t, 'hover'), `color: ${v(t, 'textStrong')}; text-decoration-thickness: var(--control-link-underline-thickness-hover);`);
  rule(sel('link', t, 'press'), `color: ${v(t, 'textStrong')}; text-decoration-thickness: var(--control-link-underline-thickness-hover);`);
  return css.join('\n');
}

const SHARED_CSS = `
/* NEW: the hover halo takes the tone's own hue instead of the indigo in --shadow-glow (3px, 18% today). */
.tp { --tp-glow-width: 3px; --tp-glow-mix: 22%; }
${TONES.map(toneRules).join('\n')}

/* Primary is unchanged; these only simulate its existing hover and press statically. */
.tp [data-sim='hover'] ${at('solid', 'primary')} { background-color: var(--color-primary-dark); --_end: var(--color-indigo-700); box-shadow: var(--shadow-highlight), var(--shadow-glow); }
.tp [data-sim='press'] ${at('solid', 'primary')} { background-color: var(--color-indigo-800); border-color: var(--color-indigo-800); }

/* Static press: the same changes button.css makes on :active. */
.tp [data-sim='press'] ${B}[data-variant='solid'] { background-image: none; box-shadow: var(--shadow-press); }
.tp [data-sim='press'] ${B}:not([data-variant='link']) { scale: var(--motion-press-scale); }

/* Dark surface: page and disabled (the DS has no dark disabled yet; proposal only). */
.tp-dark { background: var(--color-slate-900); color: var(--color-slate-300); }
.tp-dark :is(.sj-button__root, .sj-button__link)[data-disabled='true'] {
  color: var(--color-slate-500); background-color: var(--color-slate-800); border-color: var(--color-slate-700);
}
.tp-dark :is(.sj-button__root, .sj-button__link)[data-disabled='true']:is([data-variant='outline'], [data-variant='ghost'], [data-variant='link']) { background-color: transparent; }
.tp-dark :is(.sj-button__root, .sj-button__link)[data-variant='solid'][data-tone='primary'] { box-shadow: var(--shadow-highlight); }

/* Layout (tokens only). */
.tp { display: flex; flex-direction: column; gap: var(--space-6); font-family: var(--font-family-sans); color: var(--color-text-body); }
.tp h3, .tp h4 { margin: 0; color: var(--color-text-heading); font-weight: var(--font-weight-semibold); }
.tp h3 { font-size: var(--font-size-lg); }
.tp h4 { font-size: var(--font-size-sm); }
.tp-dark h3, .tp-dark h4 { color: var(--color-slate-100); }
.tp-intro { margin: 0; max-inline-size: 60rem; font-size: var(--font-size-sm); line-height: var(--leading-relaxed); }
.tp-surfaces { display: grid; grid-template-columns: repeat(auto-fit, minmax(30rem, 1fr)); gap: var(--space-4); }
.tp-surface { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); border-radius: var(--radius-lg); border: var(--border-width-hairline) solid var(--color-border); background: var(--color-white); }
.tp-surface.tp-dark { background: var(--color-slate-900); border-color: var(--color-slate-800); }
.tp-grid { font-size: var(--font-size-sm); display: grid; grid-template-columns: 4.5rem repeat(6, max-content); gap: var(--space-2) var(--space-3); align-items: center; }
.tp-grid > .tp-k { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.tp-dark .tp-grid > .tp-k, .tp-dark .tp-k { color: var(--color-slate-400); }
.tp-sim { display: contents; }
.tp-row { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: center; }
.tp-k { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.tp-context { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--space-3); }
.tp-alert { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); border: var(--border-width-hairline) solid; font-size: var(--font-size-sm); line-height: var(--leading-normal); }
.tp-alert > .sj-icon, .tp-alert > svg { grid-row: span 2; margin-block-start: var(--space-1); }
.tp-alert strong { font-weight: var(--font-weight-semibold); }
.tp-alert p { margin: 0; }
.tp-badge { display: inline-flex; align-items: center; gap: var(--space-1); padding: 0 var(--space-2); min-block-size: var(--space-6); border-radius: var(--radius-pill); border: var(--border-width-hairline) solid; font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); }
.tp-dot { inline-size: var(--space-2); block-size: var(--space-2); border-radius: var(--radius-pill); background: currentColor; }
.tp-field { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--font-size-sm); }
.tp-field label { font-weight: var(--font-weight-medium); color: var(--color-text-heading); }
.tp-dark .tp-field label { color: var(--color-slate-100); }
.tp-input { padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); border: var(--border-width-hairline) solid; background: var(--color-white); color: var(--color-text-heading); font: inherit; }
.tp-dark .tp-input { background: var(--color-slate-950); color: var(--color-slate-100); }
.tp-msg { display: flex; align-items: center; gap: var(--space-1); margin: 0; font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); }
.tp-table { border-collapse: collapse; font-size: var(--font-size-xs); font-variant-numeric: tabular-nums; }
.tp-table th, .tp-table td { padding: var(--space-1) var(--space-2); border-block-end: var(--border-width-hairline) solid var(--color-border); text-align: start; white-space: nowrap; }
.tp-table th { color: var(--color-text-muted); font-weight: var(--font-weight-medium); }
.tp-table code { font-size: var(--font-size-xs); }
.tp-swatch { display: inline-block; inline-size: var(--space-3); block-size: var(--space-3); border-radius: var(--radius-xs); vertical-align: middle; margin-inline-end: var(--space-1); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border); }
.tp-new { color: var(--color-primary-dark); font-weight: var(--font-weight-semibold); }
.tp-notes { margin: 0; padding-inline-start: var(--space-5); font-size: var(--font-size-sm); line-height: var(--leading-relaxed); max-inline-size: 60rem; }
.tp-compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr)); gap: var(--space-4); }
.tp-cvd { display: grid; grid-template-columns: 7rem 1fr; gap: var(--space-2) var(--space-4); align-items: center; }
.tp-filter-defs { position: absolute; inline-size: 0; block-size: 0; overflow: hidden; }
`;

const STYLE = `${SHARED_CSS}\n${PALETTES.map(paletteCss).join('\n')}`;

// ---------------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------------

const iconCheck: IconData = {
  name: 'circle-check',
  nodes: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'm9 12 2 2 4-4' }],
  ],
};
const iconTriangle: IconData = {
  name: 'triangle-alert',
  nodes: [
    ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }],
    ['path', { d: 'M12 9v4' }],
    ['path', { d: 'M12 17h.01' }],
  ],
};
const iconInfo: IconData = {
  name: 'info',
  nodes: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 16v-4' }],
    ['path', { d: 'M12 8h.01' }],
  ],
};
const ICON: Record<Tone, IconData> = {
  success: iconCheck,
  warning: iconTriangle,
  error: iconAlert,
  info: iconInfo,
  neutral: iconInfo,
};

/** Injects the proposal stylesheet and the three CVD filters once per story. */
const ProposalStyle = defineComponent({
  name: 'ProposalStyle',
  setup: () => () => [
    h('style', STYLE),
    h('svg', { class: 'tp-filter-defs', 'aria-hidden': 'true', focusable: 'false' }, [
      h(
        'defs',
        CVDS.map((k) =>
          h('filter', { id: `tp-${k}`, 'color-interpolation-filters': 'linearRGB' }, [
            h('feColorMatrix', { type: 'matrix', values: cvdFilterValues(k) }),
          ]),
        ),
      ),
    ]),
  ],
});

/** Variant x tone x state grid for one surface. */
const ButtonMatrix = defineComponent({
  name: 'ButtonMatrix',
  components: { SJButton },
  props: { compact: { type: Boolean, default: false } },
  setup: (props) => ({
    rowsOf: computed(() =>
      props.compact
        ? (['solid', 'soft', 'outline'] as const).map((variant) => ({ variant, state: 'rest' as const }))
        : VARIANTS.flatMap((variant) => STATES.map((state) => ({ variant, state }))),
    ),
    tones: TONES,
    label: LABEL,
  }),
  template: `<div class="tp-grid">
    <template v-for="r in rowsOf" :key="r.variant + r.state">
      <span class="tp-k">{{ r.variant }}<template v-if="!compact"><br />{{ r.state }}</template></span>
      <div class="tp-sim" :data-sim="r.state">
        <SJButton :variant="r.variant" tone="primary" size="sm">Save</SJButton>
        <SJButton v-for="t in tones" :key="t" :variant="r.variant" :tone="t" size="sm">{{ label[t] }}</SJButton>
      </div>
    </template>
    <template v-if="!compact">
      <span class="tp-k">disabled</span>
      <SJButton disabled size="sm">Save</SJButton>
      <SJButton disabled variant="soft" tone="success" size="sm">Approve</SJButton>
      <SJButton disabled variant="outline" tone="warning" size="sm">Review</SJButton>
      <SJButton disabled variant="ghost" tone="error" size="sm">Delete</SJButton>
      <SJButton disabled variant="link" tone="info" size="sm">Details</SJButton>
      <SJButton disabled variant="solid" tone="neutral" size="sm">Cancel</SJButton>
    </template>
  </div>`,
});

/** The same hue across an inline alert, badges and field messages. */
const StatusContext = defineComponent({
  name: 'StatusContext',
  components: { SJButton, SJIcon },
  props: { compact: { type: Boolean, default: false } },
  setup: () => ({
    icon: ICON,
    v: (t: Tone, r: RoleKey) => `var(--tp-${t}-${kebab(r)})`,
    alerts: [
      { t: 'success', title: 'Payment received', body: 'Invoice 1042 is paid and the receipt was sent.' },
      { t: 'warning', title: 'Card expires soon', body: 'Update it before 30 Nov to avoid a failed renewal.' },
      { t: 'error', title: 'Sync failed', body: 'Two events could not be saved. Your changes are kept locally.' },
      { t: 'info', title: 'New export format', body: 'CSV exports now include the time zone column.' },
    ] as { t: Tone; title: string; body: string }[],
    badges: [
      ['success', 'Paid'],
      ['warning', 'Pending'],
      ['error', 'Overdue'],
      ['info', 'Draft'],
      ['neutral', 'Archived'],
    ] as [Tone, string][],
  }),
  template: `<div class="tp-context">
    <div v-for="a in (compact ? alerts.slice(2, 3) : alerts)" :key="a.t" class="tp-alert"
      :style="{ background: v(a.t, 'surface'), borderColor: v(a.t, 'border') }">
      <SJIcon :icon="icon[a.t]" :style="{ color: v(a.t, 'text') }" />
      <strong :style="{ color: v(a.t, 'textStrong') }">{{ a.title }}</strong>
      <p>{{ a.body }} <SJButton variant="link" :tone="a.t">{{ a.t === 'error' ? 'Retry' : 'View' }}</SJButton></p>
    </div>
    <div class="tp-row" style="align-content: start">
      <span v-for="[t, l] in badges" :key="'s' + t" class="tp-badge"
        :style="{ color: v(t, 'text'), background: v(t, 'surface'), borderColor: v(t, 'border') }"><span class="tp-dot" />{{ l }}</span>
      <template v-if="!compact">
        <span v-for="[t, l] in badges" :key="'b' + t" class="tp-badge"
          :style="{ color: v(t, 'on'), background: v(t, 'solid'), borderColor: v(t, 'solidBorder') }">{{ l }}</span>
      </template>
    </div>
    <div v-if="!compact" class="tp-field">
      <label>Email</label>
      <input class="tp-input" value="ana@ramoslabs" aria-invalid="true" readonly :style="{ borderColor: v('error', 'outline') }" />
      <p class="tp-msg" :style="{ color: v('error', 'text') }"><SJIcon :icon="icon.error" />Enter a full address, like ana@ramoslabs.com</p>
      <p class="tp-msg" :style="{ color: v('success', 'text') }"><SJIcon :icon="icon.success" />Username is available</p>
      <p class="tp-msg" :style="{ color: v('warning', 'text') }"><SJIcon :icon="icon.warning" />Caps Lock is on</p>
    </div>
  </div>`,
});

/** Light and dark surfaces of one palette, full or compact. */
const PaletteBoard = defineComponent({
  name: 'PaletteBoard',
  components: { ButtonMatrix, StatusContext },
  props: {
    palette: { type: Object as PropType<Palette>, required: true },
    compact: { type: Boolean, default: false },
  },
  template: `<div class="tp-surfaces">
    <section class="tp-surface" aria-label="Light surface">
      <h4>Light · white</h4>
      <ButtonMatrix :compact="compact" />
      <StatusContext :compact="compact" />
    </section>
    <section class="tp-surface tp-dark" aria-label="Dark surface">
      <h4>Dark · slate 900</h4>
      <ButtonMatrix :compact="compact" />
      <StatusContext :compact="compact" />
    </section>
  </div>`,
});

/** Solids and soft badges of one palette under each simulated colour-vision deficiency. */
const CvdRows = defineComponent({
  name: 'CvdRows',
  components: { SJButton },
  props: { palette: { type: Object as PropType<Palette>, required: true } },
  setup: (props) => ({
    cvds: ['normal', ...CVDS],
    tones: TONES,
    label: LABEL,
    sep: computed(() => separation(props.palette)),
    v: (t: Tone, r: RoleKey) => `var(--tp-${t}-${kebab(r)})`,
  }),
  template: `<div class="tp-cvd">
    <template v-for="k in cvds" :key="k">
      <span class="tp-k">{{ k }}<br />closest ΔE {{ sep[k].dE }}<br />{{ sep[k].pair }}</span>
      <div class="tp-row" :style="k === 'normal' ? {} : { filter: 'url(#tp-' + k + ')' }">
        <SJButton tone="primary" size="sm">Save</SJButton>
        <SJButton v-for="t in tones" :key="t" :tone="t" size="sm">{{ label[t] }}</SJButton>
        <span v-for="t in tones" :key="'b' + t" class="tp-badge"
          :style="{ color: v(t, 'text'), background: v(t, 'surface'), borderColor: v(t, 'border') }"><span class="tp-dot" />{{ t }}</span>
      </div>
    </template>
  </div>`,
});

/** Visible version of the docs table (OKLCH, hex, WCAG, APCA, NEW). */
const ValueTable = defineComponent({
  name: 'ValueTable',
  props: { palette: { type: Object as PropType<Palette>, required: true } },
  setup: (props) => ({
    r: computed(() => rows(props.palette)),
    f: computed(() => floor(props.palette)),
    isNew: (s: string) => s.includes('NEW'),
  }),
  template: `<div style="overflow-x: auto">
    <table class="tp-table">
      <thead><tr>
        <th>Tone</th><th>Solid</th><th>OKLCH</th><th>Label</th><th>WCAG rest · sheen · hover · press</th><th>APCA (sheen)</th>
        <th>Text</th><th>WCAG white · soft press</th><th>APCA</th><th>Dark text</th><th>WCAG slate 900</th><th>APCA</th><th>Primitive (solid / text / soft / dark text)</th>
      </tr></thead>
      <tbody><tr v-for="x in r" :key="x.tone">
        <td>{{ x.tone }}</td>
        <td><span class="tp-swatch" :style="{ background: x.solid }" /><code>{{ x.solid }}</code></td>
        <td><code>{{ x.oklch }}</code></td>
        <td><span class="tp-swatch" :style="{ background: x.on }" /><code>{{ x.on }}</code></td>
        <td>{{ x.rest }} · {{ x.sheen }} · {{ x.hover }} · {{ x.press }}</td>
        <td>{{ x.apcaSheen }}</td>
        <td><span class="tp-swatch" :style="{ background: x.text }" /><code>{{ x.text }}</code></td>
        <td>{{ x.textWhite }} · {{ x.textSoftPress }}</td>
        <td>{{ x.apcaText }}</td>
        <td><span class="tp-swatch" :style="{ background: x.dText }" /><code>{{ x.dText }}</code></td>
        <td>{{ x.dTextPage }}</td>
        <td>{{ x.apcaDark }}</td>
        <td :class="{ 'tp-new': isNew(x.isNew) }">{{ x.isNew }}</td>
      </tr></tbody>
    </table>
    <p class="tp-k" style="margin-block-start: var(--space-2)">Lowest text pair in this palette: <strong>{{ f.ratio }}:1</strong> ({{ f.where }}). Every pair rendered here is at least 4.5:1 text and 3:1 non-text.</p>
  </div>`,
});

// ---------------------------------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------------------------------

type Args = { palette: Palette['id'] };
const byId = (id: Palette['id']) => PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;

const meta: Meta<Args> = {
  title: 'Components/Button/Tone Proposal',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    ...about(`
**Proposal only.** Three candidate status-tone palettes for the Direction B SJButton, plus the shipped values as a baseline. The buttons are the real \`SJButton\` with \`@ramoslabs/css\`; only the success, warning, error, info and neutral colours are swapped, through scoped \`--tp-<tone>-<role>\` properties. Indigo 600 primary is unchanged and sits first in every row as the anchor. Nothing in \`packages/tokens\` or \`button.css\` changes until the owner picks one.

Method and sources: \`docs/research/status-tones-2026.md\`. Colours are authored in OKLCH and converted to sRGB hex; WCAG ratios are floored to 2 dp like \`packages/testing/contrast\`, and "sheen" is the label on the lightest pixel (12% white over the fill). APCA is Lc 0.0.98G (secondary signal: Lc 60 is the floor for UI labels, Lc 75 for body text). CVD rows use the Machado 2009 matrices at full severity through an SVG \`feColorMatrix\`.

${PALETTES.map(describe).join('\n\n---\n\n')}
    `),
  },
  argTypes: {
    palette: {
      control: 'inline-radio',
      options: PALETTES.map((p) => p.id),
      labels: Object.fromEntries(PALETTES.map((p) => [p.id, p.name])),
      description: 'Palette to render',
    },
  },
  args: { palette: 'a' },
  render: (args) => ({
    components: { ProposalStyle, PaletteBoard, CvdRows, ValueTable },
    setup: () => ({ p: computed(() => byId(args.palette)) }),
    template: `<div class="tp" :data-palette="p.id">
      <ProposalStyle />
      <h3>{{ p.name }}</h3>
      <p class="tp-intro">{{ p.tagline }}</p>
      <ValueTable :palette="p" />
      <PaletteBoard :palette="p" />
      <h4>Colour-vision simulation (Machado 2009, full severity)</h4>
      <CvdRows :palette="p" />
      <h4>Trade-offs</h4>
      <ul class="tp-notes"><li v-for="t in p.tradeoffs" :key="t">{{ t }}</li></ul>
    </div>`,
  }),
};
export default meta;
type Story = StoryObj<Args>;

export const Palette_: Story = {
  name: 'Palette',
  parameters: tryIt(`
Pick a palette with the **palette** control (Current is the shipped baseline). Each board has every variant in rest, hover and press (simulated statically), a disabled row, light and dark surfaces, the same hue in an alert, badges and field messages, and the three simulated colour-vision deficiencies.
1. Hover and press the real buttons too: they follow the simulated rows.
2. Under each simulated deficiency, the tones should still look different from each other and from the Indigo **Save**; the icon and the words still carry the meaning (AGENTS.md: never colour alone).
3. Compare how loud the status fills feel next to Indigo 600. The primary should stay the most important colour.
  `),
};

export const SideBySide: Story = {
  name: 'Side by side',
  argTypes: { palette: { table: { disable: true } } },
  render: () => ({
    components: { ProposalStyle, PaletteBoard },
    setup: () => ({ palettes: PALETTES }),
    template: `<div class="tp" data-palette="current">
      <ProposalStyle />
      <div v-for="p in palettes" :key="p.id" class="tp" :data-palette="p.id" style="gap: var(--space-3)">
        <h3>{{ p.name }}</h3>
        <PaletteBoard :palette="p" compact />
      </div>
    </div>`,
  }),
  parameters: tryIt(`
All four palettes stacked, compact: solid, soft and outline at rest, an error alert and soft badges, light and dark. Look at each row as a set: do the five tones read as one family next to Indigo 600?
  `),
};

export const ColourVision: Story = {
  name: 'Colour vision',
  argTypes: { palette: { table: { disable: true } } },
  render: () => ({
    components: { ProposalStyle, CvdRows },
    setup: () => ({ palettes: PALETTES, visions: VISIONS }),
    template: `<div class="tp">
      <ProposalStyle />
      <div v-for="p in palettes" :key="p.id" class="tp" :data-palette="p.id" style="gap: var(--space-2)">
        <h4>{{ p.name }}</h4>
        <CvdRows :palette="p" />
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Every palette under normal vision, deuteranopia, protanopia and tritanopia. The label on the left is the closest pair of fills (deltaE OK x100, about 2 is barely noticeable): higher is better. In the baseline, info and the Indigo primary nearly merge under tritanopia.
  `),
};
