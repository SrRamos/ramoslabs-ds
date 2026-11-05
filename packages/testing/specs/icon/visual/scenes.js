/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/scenes.js
// SJIcon visual scenes (W1-C12.f, ADR-013 L5). Static markup built from the REAL core getters (icon and button) and
// the real icon data, so a scene cannot drift from what the adapters render. Layout uses tokens only. The visual
// harness freezes animation, so the spinner is shown at its static pose (the motion itself is asserted in l2.e2e.ts).
// Baselines are NOT committed by the agent: `candidates` writes PNGs for a human to review (C12-NOTES.md ".f").
// Review points carried from .b: stroke weight at 14 px, 1 px line-box growth next to text, static spinner under
// reduced motion.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

// Core's dist is extensionless ESM (a bundler's input, not node's), so bundle sources in memory.
const out = await build({
  stdin: {
    contents: [
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
const { createIcon, createButton, icons } = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attrs = (bag) =>
  Object.entries(bag)
    .filter(([, v]) => typeof v !== 'function' && v !== undefined && v !== false && v !== null)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`))
    .join(' ');

/** One icon as the getters describe it: an `<svg>` plus its sanitized children. */
function icon(data, props = {}, extra = {}) {
  const i = createIcon(() => ({ icon: data, ...props }));
  const kids = i
    .getNodes()
    .map(([tag, a]) => `<${tag} ${attrs(a)}></${tag}>`)
    .join('');
  return `<svg ${attrs(i.getRootProps(extra))}>${kids}</svg>`;
}
const IC = (name) => icons[name];
const row = (...items) =>
  `<div style="display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:center">${items.join('')}</div>`;
const cell = (label, html) =>
  `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:var(--space-1);font-size:var(--font-size-xs)">${html}<span>${label}</span></span>`;
const SET = [
  'Search',
  'Plus',
  'X',
  'Check',
  'ChevronRight',
  'ArrowLeft',
  'Menu',
  'Settings',
  'Bell',
  'User',
  'Mail',
  'Trash',
  'Pencil',
  'Download',
  'Star',
  'CircleAlert',
];

/** An SJButton (core getters) with an SJIcon (size fit) in its icon part. */
function btn(props, text, data, iconProps = {}) {
  const b = createButton(() => props);
  const link = b.element() === 'a';
  const bag = link ? b.getLinkProps() : b.getRootProps();
  const tag = link ? 'a' : 'button';
  const ic = `<span ${attrs(b.getIconProps())}>${icon(data, { size: 'fit', ...iconProps })}</span>`;
  return `<${tag} ${attrs(bag)}>${ic}${esc(text)}</${tag}>`;
}

export const SCENES = [
  {
    name: 'icon-sizes',
    html: row(
      ...['sm', 'md', 'lg'].map((size) =>
        cell(size, icon(IC('Search'), { size, label: 'Search' })),
      ),
    ),
  },
  {
    // Review point: stroke weight at 14 px (sm) next to 20 and 24.
    name: 'icon-set-sm',
    html: row(...SET.map((n) => icon(IC(n), { size: 'sm', label: n }))),
  },
  { name: 'icon-set-md', html: row(...SET.map((n) => icon(IC(n), { size: 'md', label: n }))) },
  { name: 'icon-set-lg', html: row(...SET.map((n) => icon(IC(n), { size: 'lg', label: n }))) },
  {
    name: 'icon-colors',
    html: row(
      ...['slate-900', 'slate-700', 'slate-500', 'primary'].map((c) =>
        cell(
          c,
          `<span style="color:var(--color-${c})">${icon(IC('CircleCheck'), { size: 'lg', label: c })}</span>`,
        ),
      ),
    ),
  },
  {
    // Review point: 1 px line-box growth next to text; the baseline does not move.
    name: 'icon-inline-text',
    html: `<p style="margin:0;font-size:var(--font-size-base)">Search ${icon(IC('Search'))} saved ${icon(IC('Star'), { size: 'sm' })} items ${icon(IC('Check'), { size: 'lg' })} done</p>`,
  },
  {
    name: 'icon-fit',
    html: row(
      ...[16, 32, 48].map((px) =>
        cell(
          `${px}px box`,
          `<span style="display:inline-block;inline-size:${px}px;block-size:${px}px">${icon(IC('Search'), { size: 'fit', label: 'Search' })}</span>`,
        ),
      ),
    ),
  },
  {
    // ltr and rtl: only a mirrorable icon flips.
    name: 'icon-rtl-mirror',
    html: row(
      cell('ltr chevron-right', icon(IC('ChevronRight'), { size: 'lg', dir: 'ltr' })),
      cell('rtl chevron-right', icon(IC('ChevronRight'), { size: 'lg', dir: 'rtl' })),
      cell('rtl search (not mirrored)', icon(IC('Search'), { size: 'lg', dir: 'rtl' })),
    ),
  },
  {
    // Static pose of the spinner (the harness freezes motion); the animation is asserted in l2.e2e.ts.
    name: 'icon-spin-static',
    html: row(icon(IC('LoaderCircle'), { size: 'lg', label: 'Loading' }, { 'data-spin': 'true' })),
  },
  {
    name: 'icon-in-button',
    html: row(
      btn({}, 'Add item', IC('Plus')),
      btn({ variant: 'outline' }, 'Next', IC('ChevronRight')),
      btn({ size: 'sm' }, 'Small', IC('Plus')),
      btn({ size: 'lg' }, 'Large', IC('Plus')),
    ),
  },
  {
    name: 'icon-only-button',
    html: row(
      btn({ iconOnly: true, label: 'Close dialog' }, '', IC('X')),
      btn({ iconOnly: true, label: 'Close dialog', variant: 'outline' }, '', IC('X')),
      btn({ iconOnly: true, label: 'Close dialog', variant: 'soft' }, '', IC('X')),
    ),
  },
  {
    name: 'icon-link-button',
    html: row(btn({ href: '#x' }, 'Read the documentation', IC('ArrowRight'))),
  },
];
