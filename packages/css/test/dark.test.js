/* global document, getComputedStyle, matchMedia */
// Dark theme for the remaining components (checkbox, switch, disclosure, icon, skeleton) and the shared focus ring.
// Real cascade in Chromium under a [data-theme='dark'] ancestor against the semantic dark tokens, the dark
// contrast floors (4.5:1 text, 3:1 UI), a visible focus ring on dark surfaces, and forced colors still working.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkContrastMatrix, contrastRatio, loadTokens } from '../../testing/contrast/index.js';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const rgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (body, opts = {}, attrs = 'data-theme="dark"') =>
  b.page(opts, doc({ css, body: `<div data-theme="dark">${body}</div>`, attrs }));
const cs = (page, sel, props, pseudo = null) =>
  page.evaluate(
    ([s, p, ps]) => {
      const c = getComputedStyle(document.querySelector(s), ps);
      return Object.fromEntries(p.map((k) => [k, c.getPropertyValue(k)]));
    },
    [sel, props, pseudo],
  );

const checkbox = (state, extra = '') =>
  `<label id="root" class="sj-checkbox__root" data-part="root" data-state="${state}"${extra}>
    <input id="ctl" class="sj-checkbox__control" type="checkbox" data-part="control" data-state="${state}"${extra}${state === 'checked' ? ' checked' : ''}>
    <span id="ind" class="sj-checkbox__indicator" data-part="indicator" data-state="${state}"${extra}></span>
    <span class="sj-checkbox__label" data-part="label">Notify me</span></label>`;
const sw = (state, extra = '') =>
  `<label id="root" class="sj-switch__root" data-part="root" data-state="${state}"${extra}>
    <input id="ctl" class="sj-switch__control" type="checkbox" role="switch" data-part="control" data-state="${state}"${extra}${state === 'on' ? ' checked' : ''}>
    <span id="thumb" class="sj-switch__thumb" data-part="thumb" data-state="${state}"${extra}></span>Wi-Fi</label>`;

describe('dark contrast floors from the built CSS', () => {
  const built = buildReal().index;
  const { pairs, failures } = checkContrastMatrix(tokens, { css: built });
  const dark = pairs.filter((p) => p.id.startsWith('dark/'));

  it('has no failing pair', () => {
    expect(failures.map((f) => f.id)).toEqual([]);
  });

  it('checks every new component on both dark surfaces', () => {
    for (const c of ['checkbox', 'switch', 'disclosure'])
      for (const s of ['color-surface-dark', 'color-background-dark'])
        expect(
          dark.some((p) => p.id.startsWith(`dark/${c}/`) && p.bg === s),
          `${c} on ${s}`,
        ).toBe(true);
    for (const id of [
      'dark/checkbox/indicator/unchecked/ui-on-color-surface-dark',
      'dark/checkbox/indicator/checked/ui-on-color-background-dark',
      'dark/switch/root::before/off/ui-on-color-surface-dark',
      'dark/switch/root::before/on/ui-on-color-background-dark',
      'dark/disclosure/trigger/state/text-on-color-surface-dark',
      'dark/checkbox/glyph-on-checked',
      'dark/switch/knob-on-on-track',
      'dark/switch/knob-on-off-track',
      'focus/ring-dark-on-color-surface-dark',
      'dark/skeleton/base-on-surface-dark',
    ])
      expect(
        pairs.some((p) => p.id === id),
        id,
      ).toBe(true);
  });

  it('floors: 3:1 for UI and focus, 4.5:1 for text', () => {
    for (const p of dark) expect(p.ratio).toBeGreaterThanOrEqual(p.kind === 'text' ? 4.5 : 1.1);
    for (const p of dark.filter((x) => x.kind === 'ui' && !x.id.includes('skeleton')))
      expect(p.ratio, p.id).toBeGreaterThanOrEqual(3);
  });

  it('fails a seeded weak checked fill (indigo 600) on slate 900, naming the pair', () => {
    const weak = checkContrastMatrix(
      { ...tokens, 'color-control-fill-dark': tokens['color-primary'] },
      { css: built },
    ).failures.map((f) => f.id);
    expect(weak).toContain('dark/checkbox/indicator/checked/ui-on-color-surface-dark');
  });

  it('icon declares no colour of its own, so it follows the dark text colour', () => {
    expect(
      readFileSync(join(srcDir, 'icon.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
    ).not.toMatch(/(^|[;{\s])(color|fill|stroke|border-color)\s*:/);
  });
});

describe('checkbox and switch under data-theme=dark (real cascade)', () => {
  it('checkbox: box, field and glyph read the dark control roles', async () => {
    const t = (n) => rgb(tokens[n]);
    let page = await open(checkbox('unchecked'));
    expect((await cs(page, '#ind', ['background-color']))['background-color']).toBe(
      t('color-control-border-dark'),
    );
    expect((await cs(page, '#ind', ['background-color'], '::before'))['background-color']).toBe(
      t('color-control-field-dark'),
    );
    page = await open(checkbox('checked'));
    expect((await cs(page, '#ind', ['background-color']))['background-color']).toBe(
      t('color-control-fill-dark'),
    );
    expect(
      (await cs(page, '#ind', ['border-bottom-color'], '::after'))['border-bottom-color'],
    ).toBe(t('color-control-glyph-dark'));
    expect((await cs(page, '#root', ['color']))['color']).toBe(t('color-text-body-dark'));
    page = await open(checkbox('checked', ' data-disabled="true"'));
    expect((await cs(page, '#ind', ['background-color']))['background-color']).toBe(
      t('color-control-disabled-dark'),
    );
  });

  it('switch: track, knob and label read the dark control roles', async () => {
    const t = (n) => rgb(tokens[n]);
    let page = await open(sw('off'));
    expect((await cs(page, '#root', ['background-color'], '::before'))['background-color']).toBe(
      t('color-control-border-dark'),
    );
    expect((await cs(page, '#thumb', ['background-color']))['background-color']).toBe(
      t('color-control-glyph-dark'),
    );
    page = await open(sw('on'));
    expect((await cs(page, '#root', ['background-color'], '::before'))['background-color']).toBe(
      t('color-control-fill-dark'),
    );
    expect((await cs(page, '#root', ['color']))['color']).toBe(t('color-text-body-dark'));
    page = await open(sw('on', ' data-disabled="true"'));
    expect((await cs(page, '#root', ['background-color'], '::before'))['background-color']).toBe(
      t('color-control-disabled-dark'),
    );
  });

  it('light stays unchanged outside a dark ancestor', async () => {
    const page = await b.page({}, doc({ css, body: checkbox('checked') }));
    expect((await cs(page, '#ind', ['background-color']))['background-color']).toBe(
      rgb(tokens['color-primary']),
    );
  });
});

describe('disclosure under data-theme=dark', () => {
  const html = (
    extra = '',
  ) => `<div style="inline-size:260px"><details id="root" class="sj-disclosure__root" data-part="root" open>
    <summary id="trig" class="sj-disclosure__trigger" data-part="trigger"${extra}>Shipping</summary>
    <div id="panel" class="sj-disclosure__content" data-part="content">Body</div></details></div>`;
  it('trigger, chevron and panel use the dark text roles', async () => {
    const page = await open(html());
    const t = (n) => rgb(tokens[n]);
    expect((await cs(page, '#trig', ['color']))['color']).toBe(t('color-text-heading-dark'));
    expect((await cs(page, '#trig', ['color'], '::after'))['color']).toBe(
      t('color-text-secondary-dark'),
    );
    expect((await cs(page, '#panel', ['color']))['color']).toBe(t('color-text-body-dark'));
  });
  it('disabled trigger uses the dark disabled text', async () => {
    const page = await open(html(' data-disabled="true" aria-disabled="true"'));
    expect((await cs(page, '#trig', ['color']))['color']).toBe(
      rgb(tokens['color-text-disabled-dark']),
    );
  });
});

describe('skeleton under data-theme=dark', () => {
  const shapes = `<div id="s" class="sj-skeleton" data-part="root" data-shape="rect" data-animation="shimmer" aria-hidden="true"></div>
    <div id="t" class="sj-skeleton" data-part="root" data-shape="text" data-lines="2" aria-hidden="true"><div id="l0" class="sj-skeleton__line" data-part="line"></div></div>`;
  it('fill and sweep use the dark roles, on shapes and on lines', async () => {
    const page = await open(shapes, { media: { reducedMotion: 'no-preference' } });
    expect((await cs(page, '#s', ['background-color']))['background-color']).toBe(
      rgb(tokens['skeleton-color-base-dark']),
    );
    expect((await cs(page, '#l0', ['background-color']))['background-color']).toBe(
      rgb(tokens['skeleton-color-base-dark']),
    );
    expect((await cs(page, '#s', ['background-image']))['background-image']).toContain(
      rgb(tokens['skeleton-color-highlight-dark']),
    );
  });
  it('forced colors still draws the shape with a border', async () => {
    const page = await open(shapes, { media: { forcedColors: 'active' } });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const s = await cs(page, '#s', ['border-top-style', 'background-image']);
    expect(s['border-top-style']).toBe('solid');
    expect(s['background-image']).toBe('none');
  });
});

describe('focus ring on dark surfaces', () => {
  it('draws a slate 900 gap inside an indigo 400 edge, each at least 3:1 against the surface it touches', async () => {
    const page = await open(sw('off'));
    await page.keyboard.press('Tab');
    const { 'box-shadow': bs } = await cs(page, '#ctl', ['box-shadow']);
    expect(bs).toContain(rgb(tokens['color-focus-dark']));
    expect(bs).toContain(rgb(tokens['color-surface-dark']));
    expect(bs).not.toContain('rgb(255, 255, 255)');
    for (const s of ['color-surface-dark', 'color-background-dark'])
      expect(contrastRatio(tokens['color-focus-dark'], tokens[s])).toBeGreaterThanOrEqual(3);
  });
  it('forced colors keeps an outline and drops the shadow on dark too', async () => {
    const page = await open(sw('off'), { media: { forcedColors: 'active' } });
    await page.keyboard.press('Tab');
    const f = await cs(page, '#ctl', ['outline-style', 'outline-width', 'box-shadow']);
    expect(f['outline-style']).toBe('solid');
    expect(Number.parseFloat(f['outline-width'])).toBeGreaterThanOrEqual(2);
    expect(f['box-shadow']).toBe('none');
  });
  it('forced colors keeps the dark checkbox and switch drawn', async () => {
    const page = await open(
      checkbox('checked') +
        sw('on')
          .replace('id="root"', 'id="r2"')
          .replace('id="ctl"', 'id="c2"')
          .replace('id="thumb"', 'id="th2"'),
      { media: { forcedColors: 'active' } },
    );
    expect((await cs(page, '#ind', ['border-top-style']))['border-top-style']).toBe('solid');
    expect((await cs(page, '#th2', ['border-top-style']))['border-top-style']).toBe('solid');
  });
});
