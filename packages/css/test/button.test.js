/* global document, getComputedStyle */
// W1-C01.b: SJButton CSS (the golden reference). Contrast pairs come from the BUILT css (G2 NICE-1),
// then the real cascade in Chromium is compared with the extracted pairs, so the extractor cannot drift.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SURFACES,
  TONES,
  VARIANTS,
  checkContrastMatrix,
  extractPairs,
  formatFailure,
  loadTokens,
} from '../../testing/contrast/index.js';
import { checkStylesheets } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const source = readFileSync(`${srcDir}/button.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const contractsDir = fileURLToPath(new URL('../../contracts/contracts', import.meta.url));
const SIZES = ['sm', 'md', 'lg'];

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const rgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const attrs = (v, t, s) => `data-variant="${v}" data-tone="${t}" data-size="${s}"`;
const BODY = `
  <button id="root" class="sj-button__root" data-part="root" ${attrs('solid', 'primary', 'md')} type="button">Save</button>
  <a id="link" class="sj-button__link" data-part="link" href="#x" ${attrs('solid', 'primary', 'md')}>Docs</a>
  <a id="dlink" class="sj-button__link" data-part="link" role="link" aria-disabled="true" data-disabled="true" ${attrs('solid', 'primary', 'md')}>Off</a>
  <button id="sm" class="sj-button__root" data-part="root" ${attrs('ghost', 'neutral', 'sm')} type="button">Sm</button>
  <button id="lg" class="sj-button__root" data-part="root" ${attrs('outline', 'info', 'lg')} type="button">Lg</button>
  <button id="icon" class="sj-button__root" data-part="root" ${attrs('soft', 'error', 'md')} data-icon-only="true" aria-label="Delete" type="button"><span class="sj-button__icon" data-part="icon" aria-hidden="true">x</span></button>
  <button id="off" class="sj-button__root" data-part="root" ${attrs('solid', 'primary', 'md')} disabled data-disabled="true" type="button">Off</button>
  <button id="long" class="sj-button__root" data-part="root" ${attrs('solid', 'primary', 'md')} type="button" style="inline-size:8rem">A very long label that must wrap instead of overflowing its box</button>
  <button id="ico" class="sj-button__root" data-part="root" ${attrs('solid', 'primary', 'md')} type="button"><span id="i" class="sj-button__icon" data-part="icon" aria-hidden="true">*</span><span id="t">Next</span></button>`;
const open = (opts = {}, body = BODY, attr = '') => b.page(opts, doc({ css, body, attrs: attr }));
const style = (page, id, props) =>
  page.evaluate(
    ([i, p]) => {
      const s = getComputedStyle(document.getElementById(i));
      return Object.fromEntries(p.map((k) => [k, s.getPropertyValue(k)]));
    },
    [id, props],
  );
const box = (page, id) =>
  page.evaluate((i) => {
    const r = document.getElementById(i).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
  }, id);

describe('source', () => {
  it('matches the contract anatomy and uses tokens only', () => {
    expect(checkStylesheets(srcDir, contractsDir)).toEqual([]);
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\d(px|ms)\b/);
    expect(source).not.toMatch(/outline:\s*(none|0)/);
    for (const p of ['root', 'link', 'icon']) expect(source).toContain(`sj-button__${p}`);
  });
  it('styles root and link together everywhere', () => {
    for (const m of source.matchAll(/\.sj-button__root(?!,)/g)) {
      const around = source.slice(Math.max(0, m.index - 2), m.index + 40);
      expect(around).toMatch(/is\(\.sj-button__root/);
    }
  });
});

describe('contrast from the built CSS', () => {
  let pairs;
  let failures;
  beforeAll(() => {
    ({ pairs, failures } = checkContrastMatrix(tokens, { css }));
  });

  it('passes: every variant x tone text pair at 4.5:1, outline boundary at 3:1', () => {
    expect(failures.map(formatFailure)).toEqual([]);
  });
  it('reads all 24 variant x tone combos at rest, hover and active from the CSS, not RECIPE', () => {
    const fromCss = pairs.filter((p) => p.source === 'css' && p.id.startsWith('button/'));
    for (const v of VARIANTS)
      for (const t of TONES)
        for (const st of ['', 'hover/', 'active/']) {
          const hit = fromCss.filter((p) => p.id.startsWith(`button/${v}/${t}/${st}text`));
          expect(hit.length, `${v}/${t}/${st}`).toBeGreaterThan(0);
        }
    expect(pairs.some((p) => p.source === 'recipe' && p.kind === 'text' && p.variant)).toBe(false);
    expect(fromCss.every((p) => (p.kind === 'text' ? p.min === 4.5 : p.min === 3))).toBe(true);
  });
  it('checks transparent fills on every surface', () => {
    for (const s of SURFACES)
      expect(pairs.some((p) => p.id === `button/ghost/primary/text-on-${s}`)).toBe(true);
  });
  it('a seeded weak fill, hover and outline border fail with the pair and token', () => {
    const bad = (from, to) => checkContrastMatrix(tokens, { css: css.replace(from, to) }).failures;
    const solid = bad(
      /(data-variant='solid'\]\[data-tone='error'\]\s*\{[^}]*?background-color: )var\(--color-error-strong\)/,
      '$1var(--color-red-200)',
    );
    expect(solid.map((f) => f.id)).toContain('button/solid/error/text');
    const hover = bad(
      /(data-variant='solid'\]\[data-tone='success'\]:hover\s*\{\s*background-color: )var\(--color-emerald-800\)/,
      '$1var(--color-emerald-200)',
    );
    expect(hover.map((f) => f.id)).toContain('button/solid/success/hover/text');
    const outline = bad(
      /(data-variant='outline'\]\[data-tone='neutral'\]\s*\{[^}]*?border-color: )var\(--color-text-muted\)/,
      '$1var(--color-slate-300)',
    );
    expect(outline.some((f) => f.id.startsWith('button/outline/neutral/border-on-'))).toBe(true);
  });
});

describe('real cascade matches the extractor', () => {
  it('computed color, fill and border equal the extracted tokens for all 72 combos', async () => {
    const pairs = extractPairs(css).filter((p) => p.component === 'button');
    expect(pairs).toHaveLength(72);
    const body = VARIANTS.flatMap((v) =>
      TONES.map(
        (t) =>
          `<button id="${v}-${t}" class="sj-button__root" data-part="root" ${attrs(v, t, 'md')}>x</button>`,
      ),
    ).join('');
    const page = await open({}, body);
    for (const p of pairs.filter((x) => x.state === 'rest')) {
      const s = await style(page, `${p.variant}-${p.tone}`, ['color', 'background-color']);
      expect(s.color, `${p.variant}/${p.tone} color`).toBe(rgb(tokens[p.fg]));
      if (p.bg === 'transparent') expect(s['background-color']).toBe('rgba(0, 0, 0, 0)');
      else expect(s['background-color']).toBe(rgb(tokens[p.bg]));
    }
    for (const p of pairs.filter((x) => x.state === 'hover' && x.bg !== 'transparent')) {
      await page.hover(`#${p.variant}-${p.tone}`);
      await page.waitForTimeout(250);
      expect(
        (await style(page, `${p.variant}-${p.tone}`, ['background-color']))['background-color'],
      ).toBe(rgb(tokens[p.bg]));
    }
  });
});

describe('target size (ADR-008)', () => {
  it('every button, link, disabled link, small and icon-only target is at least 44px', async () => {
    const page = await open();
    for (const id of ['root', 'link', 'dlink', 'sm', 'lg', 'icon', 'off', 'long']) {
      const r = await box(page, id);
      expect(r.height, id).toBeGreaterThanOrEqual(44);
      expect(r.width, id).toBeGreaterThanOrEqual(44);
    }
    const icon = await box(page, 'icon');
    expect(Math.abs(icon.width - icon.height)).toBeLessThan(1);
  });
  it('compact density keeps the 24px floor on fine pointers, 44px on coarse', async () => {
    const body = `<div data-density="compact">${BODY}</div>`;
    const fine = await open({}, body);
    const r = await box(fine, 'sm');
    expect(r.height).toBeGreaterThanOrEqual(24);
    expect(r.height).toBeLessThan(44);
    const coarse = await open({ hasTouch: true, isMobile: true }, body);
    expect((await box(coarse, 'sm')).height).toBeGreaterThanOrEqual(44);
  });
  it('long labels wrap inside their box instead of overflowing', async () => {
    const page = await open();
    const r = await box(page, 'long');
    expect(r.width).toBeLessThanOrEqual(129);
    expect(r.height).toBeGreaterThan(44);
  });
});

describe('states', () => {
  it('disabled: not-allowed cursor, muted text, and hover/active do not change the fill', async () => {
    const page = await open();
    for (const id of ['off', 'dlink']) {
      const before = await style(page, id, ['background-color', 'color', 'cursor']);
      expect(before.cursor).toBe('not-allowed');
      expect(before.color).toBe(rgb(tokens['color-text-disabled']));
      await page.hover(`#${id}`);
      await page.mouse.down();
      await page.waitForTimeout(250);
      expect(await style(page, id, ['background-color', 'color', 'cursor'])).toEqual(before);
      await page.mouse.up();
    }
  });
  it('hover and pressed darken an enabled solid button (pointer devices)', async () => {
    const page = await open();
    const rest = (await style(page, 'root', ['background-color']))['background-color'];
    await page.hover('#root');
    await page.waitForTimeout(250);
    expect((await style(page, 'root', ['background-color']))['background-color']).toBe(
      rgb(tokens['color-primary-dark']),
    );
    await page.mouse.down();
    await page.waitForTimeout(250);
    expect((await style(page, 'root', ['background-color']))['background-color']).toBe(
      rgb(tokens['color-indigo-800']),
    );
    await page.mouse.up();
    expect(rest).toBe(rgb(tokens['color-primary']));
  });
  it('keyboard focus draws the base ring on root and link', async () => {
    const page = await open();
    await page.keyboard.press('Tab');
    expect((await style(page, 'root', ['box-shadow']))['box-shadow']).not.toBe('none');
    await page.keyboard.press('Tab');
    expect((await style(page, 'link', ['box-shadow']))['box-shadow']).not.toBe('none');
  });
});

describe('forced colors (ADR-009)', () => {
  it('keeps a visible solid border on button, link and disabled link', async () => {
    const page = await open({ media: { forcedColors: 'active' } });
    for (const id of ['root', 'link', 'dlink', 'icon', 'off']) {
      const s = await style(page, id, ['border-top-style', 'border-top-width', 'border-top-color']);
      expect(s['border-top-style'], id).toBe('solid');
      expect(Number.parseFloat(s['border-top-width']), id).toBeGreaterThan(0);
      expect(s['border-top-color'], id).not.toBe('rgba(0, 0, 0, 0)');
    }
    const off = await style(page, 'off', ['color']);
    const on = await style(page, 'root', ['color']);
    expect(off.color).not.toBe(on.color); // GrayText vs ButtonText
  });
  it('focus keeps an outline instead of the dropped box-shadow', async () => {
    const page = await open({ media: { forcedColors: 'active' } });
    await page.keyboard.press('Tab');
    const s = await style(page, 'root', ['outline-style', 'outline-width']);
    expect(s['outline-style']).toBe('solid');
    expect(Number.parseFloat(s['outline-width'])).toBeGreaterThanOrEqual(2);
  });
});

describe('RTL', () => {
  it('flips icon and label order and pads logically', async () => {
    const ltr = await open({}, BODY, 'dir="ltr"');
    const rtl = await open({}, BODY, 'dir="rtl"');
    const l = [await box(ltr, 'i'), await box(ltr, 't')];
    const r = [await box(rtl, 'i'), await box(rtl, 't')];
    expect(l[0].x).toBeLessThan(l[1].x); // icon first (left) in LTR
    expect(r[0].x).toBeGreaterThan(r[1].x); // icon first (right) in RTL
    const pad = await style(rtl, 'ico', ['padding-left', 'padding-right']);
    expect(pad['padding-left']).toBe(pad['padding-right']); // symmetric: logical, no one-sided physical
    const icon = await box(rtl, 'icon');
    expect(Math.abs(icon.width - icon.height)).toBeLessThan(1);
  });
});

describe('reduced motion', () => {
  it('collapses the color transition to 0s; normal motion uses the fast duration', async () => {
    const normal = await open();
    expect((await style(normal, 'root', ['transition-duration']))['transition-duration']).toBe(
      '0.15s',
    );
    const reduced = await open({ media: { reducedMotion: 'reduce' } });
    expect((await style(reduced, 'root', ['transition-duration']))['transition-duration']).toBe(
      '0s',
    );
  });
});

describe('sizes', () => {
  it('the three sizes grow the font', async () => {
    const body = SIZES.map(
      (s) =>
        `<button id="s-${s}" class="sj-button__root" data-part="root" ${attrs('solid', 'primary', s)}>x</button>`,
    ).join('');
    const page = await open({}, body);
    const f = [];
    for (const s of SIZES)
      f.push(Number.parseFloat((await style(page, `s-${s}`, ['font-size']))['font-size']));
    expect(f[0]).toBeLessThan(f[1]);
    expect(f[1]).toBeLessThan(f[2]);
  });
});
