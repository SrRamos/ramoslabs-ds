/* global document, getComputedStyle, matchMedia */
// C02.b: SJInput stylesheet. Anatomy against the contract, stylelint (tokens only), text and border contrast on every
// page surface (WCAG 1.4.3, 1.4.11), invalid paint through all three triggers (aria-invalid, :user-invalid and the
// [data-touched]:invalid fallback) and never by colour alone (1.4.1), 2.4.13 focus, 2.5.8 target, textarea for address,
// forced-colors and RTL fixtures. Chromium.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkContrastMatrix,
  contrastRatio,
  extractLayerUses,
  loadTokens,
} from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const contract = JSON.parse(
  readFileSync(new URL('../../contracts/contracts/input.contract.json', import.meta.url), 'utf8'),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const inputCss = readFileSync(join(srcDir, 'input.css'), 'utf8');

const hexOf = (rgb) =>
  `#${rgb
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

/** An input as core emits it. `attrs` go on the control. */
function inputHtml({ tag = 'input', attrs = '', value = '' } = {}) {
  const control =
    tag === 'textarea'
      ? `<textarea id="c" class="sj-input__control" data-part="control" ${attrs}>${value}</textarea>`
      : `<input id="c" class="sj-input__control" data-part="control" ${attrs} value="${value}">`;
  return `<span id="root" class="sj-input__root" data-part="root" data-kind="${tag === 'textarea' ? 'address' : 'text'}">${control}</span>`;
}

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (body, opts = {}, attrs = '', sheet = css) =>
  b.page(opts, doc({ css: sheet, body, attrs }));

const cs = (page, sel, props, pseudo = null) =>
  page.evaluate(
    ([s, p, ps]) => {
      const c = getComputedStyle(document.querySelector(s), ps);
      return Object.fromEntries(p.map((k) => [k, c.getPropertyValue(k)]));
    },
    [sel, props, pseudo],
  );

const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
  }, sel);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(readFileSync(join(outDir, 'input.css'), 'utf8')).toContain('.sj-input__control');
    expect(index).toContain('.sj-input__root');
  });

  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('input', inputCss).sort()).toEqual(contract.anatomy.map((a) => a.part).sort());
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules (tokens only, logical properties)', async () => {
    const { results } = await stylelint.lint({ files: join(srcDir, 'input.css'), configFile });
    expect(results[0].warnings).toEqual([]);
  });

  it('has no raw colour, px or physical direction in the source', () => {
    const src = inputCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(src).not.toMatch(/\b\d+(\.\d+)?px\b/);
    expect(src).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
    expect(src).not.toMatch(/outline:\s*(none|0)\b|box-shadow:/);
  });
});

describe('contrast on every page surface (WCAG 1.4.3 text 4.5:1, 1.4.11 boundary 3:1)', () => {
  it('the shared pass reads the input text and boundary colours', () => {
    const uses = extractLayerUses(css).filter((u) => u.component === 'input');
    expect(uses.map((u) => u.token)).toEqual(
      expect.arrayContaining([
        'color-slate-500',
        'color-error-strong',
        'color-text-body',
        'color-text-muted',
      ]),
    );
    expect(uses.some((u) => u.token === 'color-border')).toBe(false); // disabled boundary is exempt
  });

  it('the control text clears 4.5:1 on its own surface fill', () => {
    expect(
      contrastRatio(tokens['color-text-body'], tokens['color-surface']),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(tokens['color-text-muted'], tokens['color-surface']),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('the shared contrast matrix reports no failure for an input id', () => {
    const { failures } = checkContrastMatrix(tokens, { css });
    expect(failures.filter((f) => f.id.startsWith('input'))).toEqual([]);
  });

  it('a seeded weak border (slate 300) fails the 3:1 boundary floor on every surface', () => {
    const seeded = css.replace(
      /(\.sj-input__control\s*\{[^}]*border-color:\s*)var\(--color-slate-500\)/,
      '$1var(--color-slate-300)',
    );
    expect(seeded).not.toBe(css);
    const f = checkContrastMatrix(tokens, { css: seeded }).failures.filter(
      (x) => x.id.startsWith('input/control/component/border-on-') && x.min === 3,
    );
    expect(f).toHaveLength(3);
  });
});

describe('control shape, target and text size', () => {
  it('is 48 px tall (control.height.field), above the 2.5.8 floor, and keeps 16 px text so iOS does not zoom', async () => {
    const page = await open(inputHtml());
    const r = await rect(page, '#c');
    expect(r.height).toBe(48);
    const f = await cs(page, '#c', ['font-size']);
    expect(parseFloat(f['font-size'])).toBeGreaterThanOrEqual(16);
  });

  it('a coarse pointer makes the field 56 px (control.height.field-coarse) and the textarea twice that', async () => {
    const touch = { hasTouch: true, isMobile: true };
    const page = await open(inputHtml(), touch);
    expect((await rect(page, '#c')).height).toBe(56);
    const area = await open(inputHtml({ tag: 'textarea', value: 'Line one' }), touch);
    expect((await rect(area, '#c')).height).toBeGreaterThanOrEqual(112);
  });

  it('density does not shrink a field: compact stays 48 px, and 56 px on a coarse pointer', async () => {
    const page = await open(inputHtml(), {}, 'data-density="compact"');
    expect((await rect(page, '#c')).height).toBe(48);
    const touch = await open(
      inputHtml(),
      { hasTouch: true, isMobile: true },
      'data-density="compact"',
    );
    expect((await rect(touch, '#c')).height).toBe(56);
  });

  it('the invalid state keeps the same height on a coarse pointer', async () => {
    const touch = { hasTouch: true, isMobile: true };
    const rest = await open(inputHtml(), touch);
    const bad = await open(inputHtml({ attrs: 'aria-invalid="true"' }), touch);
    expect((await rect(bad, '#c')).height).toBe((await rect(rest, '#c')).height);
  });

  it('fills the inline size of its root', async () => {
    const page = await open(inputHtml());
    const root = await rect(page, '#root');
    const c = await rect(page, '#c');
    expect(Math.abs(c.width - root.width)).toBeLessThan(1);
  });

  it('address renders a textarea: taller than the input, resizable on the block axis only', async () => {
    const page = await open(inputHtml({ tag: 'textarea', value: 'Line one' }));
    const r = await rect(page, '#c');
    expect(r.height).toBeGreaterThanOrEqual(96);
    const c = await cs(page, '#c', ['resize']);
    expect(c.resize).toBe('block');
  });

  it('the placeholder is the muted floor (slate 500), not browser grey', async () => {
    const page = await open(inputHtml({ attrs: 'placeholder="you@example.com"' }));
    const p = await cs(page, '#c', ['color'], '::placeholder');
    expect(hexOf(p.color)).toBe(tokens['color-text-muted']);
  });
});

describe('invalid state: three triggers, never colour alone', () => {
  const width = async (page) =>
    parseFloat((await cs(page, '#c', ['border-top-width']))['border-top-width']);
  const colour = async (page) =>
    hexOf((await cs(page, '#c', ['border-top-color']))['border-top-color']);

  it('the rest border is slate 500 and one hairline thick', async () => {
    const page = await open(inputHtml());
    expect(await colour(page)).toBe(tokens['color-slate-500']);
    expect(await width(page)).toBe(1);
  });

  it('aria-invalid=true gives the error border, doubles its thickness and does not move the text', async () => {
    const rest = await open(inputHtml());
    const invalid = await open(inputHtml({ attrs: 'aria-invalid="true"' }));
    expect(await colour(invalid)).toBe(tokens['color-error-strong']);
    expect(await width(invalid)).toBe(2);
    const a = await cs(rest, '#c', ['padding-left']);
    const z = await cs(invalid, '#c', ['padding-left']);
    expect(parseFloat(z['padding-left']) + 2).toBe(parseFloat(a['padding-left']) + 1);
    expect((await rect(invalid, '#c')).height).toBe((await rect(rest, '#c')).height);
  });

  it(':user-invalid paints only after the user edits (native path)', async () => {
    const page = await open(inputHtml({ attrs: 'type="email" required' }));
    expect(await colour(page)).toBe(tokens['color-slate-500']);
    await page.fill('#c', 'not-an-email');
    await page.press('#c', 'Tab');
    expect(await colour(page)).toBe(tokens['color-error-strong']);
    expect(await width(page)).toBe(2);
  });

  it('the touched fallback paints a native :invalid control only once data-touched is set', async () => {
    const page = await open(inputHtml({ attrs: 'required' }));
    expect(await colour(page)).toBe(tokens['color-slate-500']);
    await page.evaluate(() => document.getElementById('c').setAttribute('data-touched', 'true'));
    expect(await colour(page)).toBe(tokens['color-error-strong']);
    expect(await width(page)).toBe(2);
  });

  it('data-touched on a valid control paints nothing', async () => {
    const page = await open(inputHtml({ attrs: 'required data-touched="true"', value: 'ok' }));
    expect(await colour(page)).toBe(tokens['color-slate-500']);
  });

  it('a seeded sheet without the fallback rule leaves a touched invalid control unpainted', async () => {
    const seeded = inputCss.replace(
      /\.sj-input__control\[data-touched\]:invalid/,
      '.sj-input__control[data-never]:invalid',
    );
    expect(seeded).not.toBe(inputCss);
    const page = await open(inputHtml({ attrs: 'required data-touched="true"' }), {}, '', seeded);
    expect(await colour(page)).toBe(tokens['color-slate-500']);
  });

  it('the invalid cue is thickness as well as colour, so a colour-blind user still sees it (1.4.1)', async () => {
    const page = await open(inputHtml({ attrs: 'aria-invalid="true"' }));
    expect(await width(page)).toBeGreaterThan(1);
  });
});

describe('disabled', () => {
  it('uses the disabled surface, the light border and a not-allowed cursor', async () => {
    const page = await open(inputHtml({ attrs: 'disabled' }));
    const c = await cs(page, '#c', ['background-color', 'cursor', 'border-top-color']);
    expect(hexOf(c['background-color'])).toBe(tokens['color-surface-hover']);
    expect(hexOf(c['border-top-color'])).toBe(tokens['color-border']);
    expect(c.cursor).toBe('not-allowed');
  });

  it('a disabled control never shows the invalid border', async () => {
    const page = await open(inputHtml({ attrs: 'disabled aria-invalid="true"' }));
    // Invalid is still reported to AT, but the disabled paint wins on colour (a disabled control cannot be fixed).
    const c = await cs(page, '#c', ['border-top-color']);
    expect(hexOf(c['border-top-color'])).toBe(tokens['color-border']);
  });
});

describe('focus (WCAG 2.4.7, 2.4.13)', () => {
  it('keyboard focus draws the shared two-layer ring and the input does not remove it', async () => {
    const page = await open(inputHtml());
    await page.keyboard.press('Tab');
    const f = await cs(page, '#c', ['box-shadow', 'outline-style', 'outline-width']);
    expect(f['box-shadow']).not.toBe('none');
    expect(f['outline-style']).not.toBe('none');
    expect(parseFloat(f['outline-width'])).toBeGreaterThan(0);
  });

  it('an invalid control still shows the ring on focus', async () => {
    const page = await open(inputHtml({ attrs: 'aria-invalid="true"' }));
    await page.keyboard.press('Tab');
    expect((await cs(page, '#c', ['box-shadow']))['box-shadow']).not.toBe('none');
  });

  it('a textarea gets the ring too', async () => {
    const page = await open(inputHtml({ tag: 'textarea' }));
    await page.keyboard.press('Tab');
    expect((await cs(page, '#c', ['box-shadow']))['box-shadow']).not.toBe('none');
  });
});

describe('forced colours', () => {
  it('keeps a visible ButtonBorder boundary and a Highlight border when invalid', async () => {
    const opts = { media: { forcedColors: 'active' } };
    const rest = await open(inputHtml(), opts);
    expect(await rest.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const r = await cs(rest, '#c', ['border-top-style', 'border-top-width']);
    expect(r['border-top-style']).toBe('solid');
    expect(parseFloat(r['border-top-width'])).toBeGreaterThan(0);
    const inv = await open(inputHtml({ attrs: 'aria-invalid="true"' }), opts);
    const i = await cs(inv, '#c', ['border-top-width', 'border-top-color']);
    expect(parseFloat(i['border-top-width'])).toBe(2);
    expect(i['border-top-color']).not.toBe(
      (await cs(rest, '#c', ['border-top-color']))['border-top-color'],
    );
  });

  it('a disabled control is grey (GrayText) under forced colours', async () => {
    const page = await open(inputHtml({ attrs: 'disabled' }), {
      media: { forcedColors: 'active' },
    });
    const c = await cs(page, '#c', ['color']);
    const gray = await page.evaluate(() => {
      const s = document.createElement('span');
      s.style.color = 'GrayText';
      document.body.append(s);
      return getComputedStyle(s).color;
    });
    expect(c.color).toBe(gray);
  });
});

describe('RTL geometry (logical properties)', () => {
  it('the inline padding mirrors: the text starts at the right edge in RTL', async () => {
    const ltr = await open(inputHtml(), {}, '');
    const rtl = await open(inputHtml(), {}, 'dir="rtl"');
    const p = async (page) => cs(page, '#c', ['padding-left', 'padding-right', 'direction']);
    const l = await p(ltr);
    const r = await p(rtl);
    expect(l['padding-left']).toBe(l['padding-right']);
    expect(r.direction).toBe('rtl');
    expect(r['padding-left']).toBe(r['padding-right']);
  });

  it('the invalid padding compensation is symmetric in RTL', async () => {
    const page = await open(inputHtml({ attrs: 'aria-invalid="true"' }), {}, 'dir="rtl"');
    const c = await cs(page, '#c', [
      'padding-left',
      'padding-right',
      'border-left-width',
      'border-right-width',
    ]);
    expect(c['padding-left']).toBe(c['padding-right']);
    expect(c['border-left-width']).toBe(c['border-right-width']);
  });
});
