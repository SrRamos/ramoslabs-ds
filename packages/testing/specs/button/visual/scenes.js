/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/scenes.js
// SJButton visual scenes (W1-C01.f, ADR-013 L5). Static markup built from the REAL core getters, so the scene
// cannot drift from what the adapters render. Layout uses tokens only. `focus: true` presses Tab once so the
// ring is the real :focus-visible one. Baselines are NOT committed by the agent: see ../../../../../docs/implementation/C01-NOTES.md ".f".
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Core's dist is extensionless ESM (a bundler's input, not node's), so bundle the core source in memory.
const entry = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'core',
  'src',
  'button',
  'index.ts',
);
const out = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const { createButton } = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attrs = (bag) =>
  Object.entries(bag)
    .filter(([, v]) => typeof v !== 'function' && v !== undefined && v !== false && v !== null)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`))
    .join(' ');

/** One button as the getters describe it: `<button>` or `<a>` plus an optional decorative icon. */
function btn(props, text = '', icon = '') {
  const b = createButton(() => props);
  const link = b.element() === 'a';
  const bag = link ? b.getLinkProps() : b.getRootProps();
  const ic = icon ? `<span ${attrs(b.getIconProps())}>${esc(icon)}</span>` : '';
  const tag = link ? 'a' : 'button';
  return `<${tag} ${attrs(bag)}>${ic}${esc(text)}</${tag}>`;
}
const row = (...items) =>
  `<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center">${items.join('')}</div>`;
const VARIANTS = ['solid', 'soft', 'outline', 'ghost'];
const TONES = ['primary', 'neutral', 'success', 'warning', 'error', 'info'];

export const SCENES = [
  { name: 'button-variants', html: row(...VARIANTS.map((variant) => btn({ variant }, variant))) },
  {
    name: 'button-tones-solid',
    html: row(...TONES.map((tone) => btn({ tone }, tone))),
  },
  {
    name: 'button-tones-outline',
    html: row(...TONES.map((tone) => btn({ tone, variant: 'outline' }, tone))),
  },
  {
    name: 'button-sizes',
    html: row(...['sm', 'md', 'lg'].map((size) => btn({ size }, size))),
  },
  {
    name: 'button-disabled',
    html: row(...VARIANTS.map((variant) => btn({ variant, disabled: true }, variant))),
  },
  { name: 'button-focus', html: row(btn({}, 'Save changes')), focus: true },
  {
    name: 'button-icon-only',
    html: row(
      btn({ iconOnly: true, label: 'Close dialog' }, '', '✕'),
      btn({ iconOnly: true, label: 'Close dialog', variant: 'outline' }, '', '✕'),
    ),
  },
  { name: 'button-with-icon', html: row(btn({}, 'Add item', '+')) },
  { name: 'button-link', html: row(btn({ href: '#x' }, 'Read the documentation')) },
  {
    name: 'button-long-label',
    html: `<div style="inline-size:15rem">${btn({}, 'Archive every conversation older than ninety days and notify all of the workspace owners')}</div>`,
  },
];
