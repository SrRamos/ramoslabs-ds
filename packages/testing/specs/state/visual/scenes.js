/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/scenes.js
// SJState visual scenes (W1-C11.f, ADR-013 L5). Static markup built from the REAL core getters (state, icon and
// button) and the real icon data, so a scene cannot drift from what the adapters render. Layout uses tokens only.
// The visual harness freezes animation, so the spinner is shown at its static pose (the motion itself, and its
// removal under prefers-reduced-motion, are asserted in l2.e2e.ts). Baselines are NOT committed by the agent:
// `candidates` writes PNGs for a human to review (C11-NOTES.md ".f"). Review points: the five variants side by side
// (three distinct empty kinds), glyph and heading colour per variant, spacing of the actions, RTL, narrow width.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

// Core's dist is extensionless ESM (a bundler's input, not node's), so bundle sources in memory.
const out = await build({
  stdin: {
    contents: [
      `export { createState } from ${JSON.stringify(join(packages, 'core', 'src', 'state', 'index.ts'))};`,
      `export { createIcon } from ${JSON.stringify(join(packages, 'core', 'src', 'icon', 'index.ts'))};`,
      `export { createButton } from ${JSON.stringify(join(packages, 'core', 'src', 'button', 'index.ts'))};`,
      `export * as icons from ${JSON.stringify(join(packages, 'icons', 'src', 'generated', 'index.ts'))};`,
    ].join('\n'),
    resolveDir: packages,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const { createState, createIcon, createButton, icons } = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attrs = (bag) =>
  Object.entries(bag)
    .filter(([, v]) => typeof v !== 'function' && v !== undefined && v !== false && v !== null)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`))
    .join(' ');

const glyph = (data, extra = {}) => {
  const i = createIcon(() => ({ icon: data, size: 'lg' }));
  const kids = i
    .getNodes()
    .map(([tag, a]) => `<${tag} ${attrs(a)}></${tag}>`)
    .join('');
  return `<svg ${attrs(i.getRootProps(extra))}>${kids}</svg>`;
};
const button = (text, props = {}) => {
  const b = createButton(() => props);
  return `<button ${attrs(b.getRootProps())}>${esc(text)}</button>`;
};

/** One SJState as the getters describe it; parts only with content. */
function state({ variant, heading, description, icon, spin, actions }) {
  const s = createState(() => ({ variant, heading, description }));
  const parts = [
    icon &&
      `<span ${attrs(s.getIconProps())}>${glyph(icons[icon], spin ? { 'data-spin': 'true' } : {})}</span>`,
    heading && `<p ${attrs(s.getTitleProps())}>${esc(heading)}</p>`,
    description && `<p ${attrs(s.getDescriptionProps())}>${esc(description)}</p>`,
    actions?.length &&
      `<div ${attrs(s.getActionsProps())}>${actions.map((a) => button(a)).join('')}</div>`,
  ].filter(Boolean);
  return `<div ${attrs(s.getRootProps())}>${parts.join('')}</div>`;
}

const FIRST_USE = {
  variant: 'first-use',
  heading: 'No projects yet',
  description: 'Create your first project to get started.',
  icon: 'Folder',
  actions: ['Create project'],
};
const NO_RESULTS = {
  variant: 'no-results',
  heading: 'No results for "invoice"',
  description: 'Try a different search or clear the filters.',
  icon: 'Search',
  actions: ['Clear filters'],
};
const CLEARED = {
  variant: 'cleared',
  heading: 'Trash emptied',
  description: 'Everything was removed.',
  icon: 'Trash',
};
const LOADING = {
  variant: 'loading',
  heading: 'Loading projects',
  icon: 'LoaderCircle',
  spin: true,
};
const ERROR = {
  variant: 'error',
  heading: 'Could not load projects',
  description: 'Check your connection and try again.',
  icon: 'CircleAlert',
  actions: ['Try again'],
};

const card = (html) =>
  `<div style="border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface)">${html}</div>`;

export const SCENES = [
  {
    // Review point: three distinct empty kinds (first-use, no-results, cleared) plus loading and error, side by
    // side. Heading-only so the five fit the harness viewport (480 x 320); the full copy has a scene each below.
    name: 'state-variants',
    html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);align-items:start">${[
      { ...FIRST_USE, heading: 'First use' },
      { ...NO_RESULTS, heading: 'No results' },
      { ...CLEARED, heading: 'Cleared' },
      { ...LOADING, heading: 'Loading' },
      { ...ERROR, heading: 'Error' },
    ]
      .map((v) =>
        card(state({ variant: v.variant, heading: v.heading, icon: v.icon, spin: v.spin })),
      )
      .join('')}</div>`,
  },
  { name: 'state-first-use', html: card(state(FIRST_USE)) },
  { name: 'state-no-results', html: card(state(NO_RESULTS)) },
  { name: 'state-cleared', html: card(state(CLEARED)) },
  {
    // Static pose of the spinner (the harness freezes motion), the same pose reduced motion shows.
    name: 'state-loading-static',
    html: card(state(LOADING)),
  },
  { name: 'state-error', html: card(state(ERROR)) },
  {
    // The interrupting error looks the same: urgency is announced, not painted.
    name: 'state-error-two-actions',
    html: card(state({ ...ERROR, actions: ['Try again', 'Contact support'] })),
  },
  {
    name: 'state-minimal',
    html: card(state({ variant: 'cleared', heading: 'All clear' })),
  },
  {
    // RTL: logical padding and centred content; the glyph is not mirrored (it is not directional).
    name: 'state-rtl',
    html: `<div dir="rtl">${card(state({ ...NO_RESULTS, heading: 'لا توجد نتائج', description: 'جرّب بحثًا مختلفًا أو امسح عوامل التصفية.', actions: ['مسح عوامل التصفية'] }))}</div>`,
  },
  {
    // Narrow container: long copy wraps, actions wrap, nothing overflows.
    name: 'state-narrow-long-copy',
    html: `<div style="inline-size:16rem">${card(state({ ...NO_RESULTS, heading: 'No results for "quarterly invoice reconciliation"', description: 'Try another term or remove a filter.', actions: ['Clear filters'] }))}</div>`,
  },
];
