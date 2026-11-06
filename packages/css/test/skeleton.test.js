/* global document, getComputedStyle, matchMedia */
// SJSkeleton stylesheet: anatomy against the contract, stylelint (tokens only), the pending/visible rules, the shapes
// (text lines with a shorter last line, circle sizes, rect aspect ratios, block variables), reduced motion (flat fill),
// forced colours (border, no gradient), RTL (sweep reversed) and the decorative-fill contrast decision.
// Runs in Chromium through the shared css helpers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkContrastMatrix, loadTokens } from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const contract = JSON.parse(
  readFileSync(
    new URL('../../contracts/contracts/skeleton.contract.json', import.meta.url),
    'utf8',
  ),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const skeletonCss = readFileSync(join(srcDir, 'skeleton.css'), 'utf8');

const shape = (shapeName, extra = '') =>
  `<div id="s" class="sj-skeleton" data-part="root" data-shape="${shapeName}" data-animation="shimmer" aria-hidden="true" ${extra}></div>`;
const text = (lines) =>
  `<div id="s" class="sj-skeleton" data-part="root" data-shape="text" data-lines="${lines}" data-animation="shimmer" aria-hidden="true">${Array.from(
    { length: lines },
    (_, i) => `<div id="l${i}" class="sj-skeleton__line" data-part="line"></div>`,
  ).join('')}</div>`;
const group = (state) =>
  `<div id="g" class="sj-skeleton" data-part="root" data-shape="group" data-state="${state}"${state === 'idle' ? '' : ' aria-busy="true"'}><div id="in" style="block-size:40px">content</div></div>`;

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (body, opts = {}, attrs = '', sheet = css) =>
  b.page(opts, doc({ css: sheet, body, attrs }));
const cs = (page, sel, props) =>
  page.evaluate(
    ([s, p]) => {
      const c = getComputedStyle(document.querySelector(s));
      return Object.fromEntries(p.map((k) => [k, c.getPropertyValue(k)]));
    },
    [sel, props],
  );
const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { width: r.width, height: r.height };
  }, sel);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(readFileSync(join(outDir, 'skeleton.css'), 'utf8')).toContain('.sj-skeleton__line');
    expect(index).toContain('sj-skeleton-shimmer');
  });
  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('skeleton', skeletonCss).sort()).toEqual(
      contract.anatomy.map((a) => a.part).sort(),
    );
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });
  it('passes the sj stylelint rules (tokens only, logical properties)', async () => {
    const { results } = await stylelint.lint({ files: join(srcDir, 'skeleton.css'), configFile });
    expect(results[0].warnings).toEqual([]);
  });
  it('has no raw colour, px, duration or physical direction in the source', () => {
    const code = skeletonCss.replace(/\/\*[^]*?\*\//g, '');
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(code).not.toMatch(/\b\d+(\.\d+)?px\b/);
    expect(code).not.toMatch(/\b\d+(\.\d+)?m?s\b(?!\))/);
    expect(code).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
  });
});

describe('contrast decision', () => {
  it('the shared contrast matrix reports no failure for a skeleton id', () => {
    const { failures } = checkContrastMatrix(tokens, { css });
    expect(failures.filter((f) => f.id.startsWith('skeleton'))).toEqual([]);
  });
  it('the fill is the neutral base token; it is decorative, so it stays below 3:1 by decision', async () => {
    const page = await open(shape('block'));
    const { 'background-color': bg } = await cs(page, '#s', ['background-color']);
    expect(bg).toBe('rgb(226, 232, 240)');
    expect(tokens['skeleton-color-base']).toBe('#e2e8f0');
  });
});

describe('group: pending is invisible but reserves its space', () => {
  it('pending hides the group, visible and holding show it, idle shows the content', async () => {
    const seen = {};
    for (const state of ['pending', 'visible', 'holding', 'idle']) {
      const page = await open(group(state));
      seen[state] = (await cs(page, '#g', ['visibility'])).visibility;
      expect((await rect(page, '#in')).height).toBe(40);
    }
    expect(seen).toEqual({
      pending: 'hidden',
      visible: 'visible',
      holding: 'visible',
      idle: 'visible',
    });
  });
  it('without script a pending group is shown (the server render has no timer)', async () => {
    const page = await b.page({ javaScriptEnabled: false }, doc({ css, body: group('pending') }));
    expect(
      await page.evaluate(() => getComputedStyle(document.getElementById('g')).visibility),
    ).toBe('visible');
  });
});

describe('shapes', () => {
  it('text: lines stack with a gap and only the last one is shorter', async () => {
    const page = await open(text(3));
    const widths = await page.evaluate(() =>
      ['l0', 'l1', 'l2'].map((id) => document.getElementById(id).getBoundingClientRect().width),
    );
    expect(widths[0]).toBe(widths[1]);
    expect(widths[2]).toBeLessThan(widths[0]);
    expect(Math.round((widths[2] / widths[0]) * 100)).toBe(60);
    const single = await open(text(1));
    const w = await single.evaluate(() => [
      document.getElementById('l0').getBoundingClientRect().width,
      document.getElementById('s').getBoundingClientRect().width,
    ]);
    expect(w[0]).toBe(w[1]);
  });
  it('circle: each size is square from the avatar token', async () => {
    const sizes = { sm: 32, md: 40, lg: 48, xl: 64 };
    for (const [size, px] of Object.entries(sizes)) {
      const page = await open(shape('circle', `data-size="${size}"`));
      expect(await rect(page, '#s'), size).toEqual({ width: px, height: px });
      expect((await cs(page, '#s', ['border-radius']))['border-radius']).not.toBe('0px');
    }
  });
  it('rect: the aspect ratio reserves the height before any media loads', async () => {
    const page = await open(
      `<div style="inline-size:320px">${shape('rect', 'data-ratio="4/3"')}</div>`,
    );
    expect(await rect(page, '#s')).toEqual({ width: 320, height: 240 });
    const wide = await open(`<div style="inline-size:320px">${shape('rect')}</div>`);
    expect((await rect(wide, '#s')).height).toBe(180);
  });
  it('block: sized by the variables, with a token default', async () => {
    const dflt = await open(shape('block'));
    expect((await rect(dflt, '#s')).height).toBe(64);
    const sized = await open(
      shape('block', 'style="--sj-skeleton-width:120px;--sj-skeleton-height:20px"'),
    );
    expect(await rect(sized, '#s')).toEqual({ width: 120, height: 20 });
  });
});

describe('shimmer', () => {
  it('sweeps with the motion token duration, and not at all with animation none', async () => {
    const page = await open(shape('block'));
    const a = await cs(page, '#s', [
      'animation-name',
      'animation-duration',
      'animation-iteration-count',
    ]);
    expect(a['animation-name']).toBe('sj-skeleton-shimmer');
    expect(a['animation-duration']).toBe('1.6s');
    expect(a['animation-iteration-count']).toBe('3'); // 3 x 1.6s = 4.8s: under the 5s of WCAG 2.2.2
    const off = await open(
      shape('block').replace('data-animation="shimmer"', 'data-animation="none"'),
    );
    const o = await cs(off, '#s', ['animation-name', 'background-image']);
    expect(o).toEqual({ 'animation-name': 'none', 'background-image': 'none' });
  });
  it('under prefers-reduced-motion the fill is flat: no animation, no gradient (static)', async () => {
    const page = await open(text(2), { media: { reducedMotion: 'reduce' } });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );
    for (const sel of ['#l0', '#l1']) {
      expect(await cs(page, sel, ['animation-name', 'background-image'])).toEqual({
        'animation-name': 'none',
        'background-image': 'none',
      });
      expect((await cs(page, sel, ['background-color']))['background-color']).toBe(
        'rgb(226, 232, 240)',
      );
    }
  });
  it('a seeded removal of the reduced-motion rule leaves the sweep running', async () => {
    const seeded = skeletonCss.replace(
      /(@media \(prefers-reduced-motion: reduce\) \{[^]*?animation:) none;/,
      '$1 sj-skeleton-shimmer 1s infinite;',
    );
    expect(seeded).not.toBe(skeletonCss);
    const page = await open(
      shape('block'),
      { media: { reducedMotion: 'reduce' } },
      '',
      `${css}\n${seeded}`,
    );
    expect((await cs(page, '#s', ['animation-name']))['animation-name']).toBe(
      'sj-skeleton-shimmer',
    );
  });
  it('RTL reverses the sweep direction; LTR does not', async () => {
    const ltr = await open(shape('block'));
    const rtl = await open(shape('block'), {}, 'dir="rtl"');
    expect((await cs(ltr, '#s', ['animation-direction']))['animation-direction']).toBe('normal');
    expect((await cs(rtl, '#s', ['animation-direction']))['animation-direction']).toBe('reverse');
    const lines = await open(text(2), {}, 'dir="rtl"');
    expect((await cs(lines, '#l0', ['animation-direction']))['animation-direction']).toBe(
      'reverse',
    );
  });
});

describe('forced colours keep the structure visible', () => {
  it('every drawn shape gets a system-colour border and no gradient or sweep', async () => {
    for (const body of [shape('block'), shape('circle'), shape('rect'), text(2)]) {
      const page = await open(body, { media: { forcedColors: 'active' } });
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      const sel = body.includes('data-lines') ? '#l0' : '#s';
      const c = await cs(page, sel, [
        'border-top-width',
        'border-top-style',
        'background-image',
        'animation-name',
      ]);
      expect(c['border-top-width']).toBe('1px');
      expect(c['border-top-style']).toBe('solid');
      expect(c['background-image']).toBe('none');
      expect(c['animation-name']).toBe('none');
    }
  });
  it('the border does not change the box size (border-box), so nothing shifts', async () => {
    const normal = await open(shape('circle'));
    const forced = await open(shape('circle'), { media: { forcedColors: 'active' } });
    expect(await rect(forced, '#s')).toEqual(await rect(normal, '#s'));
  });
});
