/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/scenes.js
// SJSkeleton visual scenes (ADR-013 L5). Static markup built from the REAL core getters, so a scene cannot drift
// from what the adapters render. Layout uses tokens only. The visual harness freezes animation, so the sweep is
// shown at its first pose (the motion itself, and its removal under reduced motion and forced colors, are asserted
// in a11y.e2e.ts). Baselines are NOT committed by the agent: `candidates` writes PNGs for a human to review.
// Review points: the quiet fill (slate 200) on white, the shorter last line, the avatar sizes, the rect ratios, the
// placeholder card next to the loaded card (same box), RTL.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

// Core's dist is extensionless ESM (a bundler's input, not node's), so bundle sources in memory.
const out = await build({
  stdin: {
    contents: `export { createSkeleton } from ${JSON.stringify(join(packages, 'core', 'src', 'skeleton', 'index.ts'))};`,
    resolveDir: packages,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const { createSkeleton } = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attrs = (bag) =>
  Object.entries(bag)
    .filter(([, v]) => typeof v !== 'function' && v !== undefined && v !== false && v !== null)
    .map(([k, v]) => `${k === 'class' ? 'class' : k}="${esc(v === true ? '' : v)}"`)
    .join(' ');

/** One shape: the root and, for text, its lines. */
function shape(p) {
  const s = createSkeleton(() => p);
  const lines = Array.from(
    { length: s.lineCount() },
    () => `<div ${attrs(s.getLineProps())}></div>`,
  );
  return `<div ${attrs(s.getRootProps())}>${lines.join('')}</div>`;
}

const row = 'display:flex;gap:var(--space-3);align-items:flex-start';
const body = 'flex:1;min-inline-size:0;display:flex;flex-direction:column;gap:var(--space-2)';
const line =
  'margin:0;block-size:var(--skeleton-line-height);line-height:var(--skeleton-line-height);font-size:var(--skeleton-line-height);overflow:hidden;white-space:nowrap';
const avatar =
  'flex:none;inline-size:var(--skeleton-avatar-md);block-size:var(--skeleton-avatar-md);border-radius:var(--radius-pill);background:var(--color-primary)';
const card = (html) =>
  `<div style="padding:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface)">${html}</div>`;

/** The group while the placeholder is shown (data-state visible). */
const placeholder = () => {
  const g = createSkeleton(() => ({ shape: 'group', phase: 'visible' }));
  return `<div ${attrs(g.getRootProps())}><div style="${row}">${shape({ shape: 'circle' })}<div style="${body}">${shape({ shape: 'text', lines: 3 })}</div></div></div>`;
};
/** The same group once loaded (data-state idle): the very same box. */
const loaded = () => {
  const g = createSkeleton(() => ({ shape: 'group', phase: 'idle' }));
  return `<div ${attrs(g.getRootProps())}><div style="${row}"><div style="${avatar}"></div><div style="${body}">${['Ramos Labs', 'Design system', 'Updated today'].map((t) => `<p style="${line}">${t}</p>`).join('')}</div></div></div>`;
};

export const SCENES = [
  { name: 'skeleton-text', html: card(shape({ shape: 'text', lines: 3 })) },
  {
    name: 'skeleton-text-single',
    html: card(shape({ shape: 'text', lines: 1 })),
  },
  {
    name: 'skeleton-circle-sizes',
    html: card(
      `<div style="display:flex;gap:var(--space-3);align-items:center">${['sm', 'md', 'lg', 'xl'].map((size) => shape({ shape: 'circle', size })).join('')}</div>`,
    ),
  },
  {
    name: 'skeleton-rect-ratios',
    html: card(
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2)">${['1/1', '4/3', '16/9'].map((ratio) => shape({ shape: 'rect', ratio })).join('')}</div>`,
    ),
  },
  { name: 'skeleton-block', html: card(shape({ shape: 'block' })) },
  { name: 'skeleton-block-static', html: card(shape({ shape: 'block', animation: 'none' })) },
  { name: 'skeleton-card-placeholder', html: card(placeholder()) },
  {
    // Review point: the loaded card has the same box as the placeholder above.
    name: 'skeleton-card-loaded',
    html: card(loaded()),
  },
  {
    // RTL: logical layout (the avatar sits at the right); the sweep direction is reversed (motion is frozen here).
    name: 'skeleton-rtl',
    html: `<div dir="rtl">${card(placeholder())}</div>`,
  },
];
