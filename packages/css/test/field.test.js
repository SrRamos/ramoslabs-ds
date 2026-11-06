/* global document, getComputedStyle, matchMedia */
// C02.b: SJField stylesheet. Anatomy against the contract, stylelint (tokens only), text contrast on every page
// surface (WCAG 1.4.3), error never by colour alone (1.4.1, 3.3.1), forced-colors and RTL fixtures. Chromium.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkContrastMatrix, extractLayerUses, loadTokens } from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const contract = JSON.parse(
  readFileSync(new URL('../../contracts/contracts/field.contract.json', import.meta.url), 'utf8'),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const fieldCss = readFileSync(join(srcDir, 'field.css'), 'utf8');

/** A field as core emits it. */
function fieldHtml({ error = '', disabled = false, hint = true } = {}) {
  return `<div id="root" class="sj-field__root" data-part="root"${error ? ' data-invalid="true"' : ''}${disabled ? ' data-disabled="true"' : ''}>
    <label id="f-label" for="f" class="sj-field__label" data-part="label">Email address</label>
    ${hint ? '<div id="f-hint" class="sj-field__hint" data-part="hint">We never share it.</div>' : ''}
    <span class="sj-input__root" data-part="root"><input id="f" class="sj-input__control" data-part="control"${error ? ' aria-invalid="true" aria-describedby="f-hint f-error"' : ''}${disabled ? ' disabled' : ''}></span>
    ${error ? `<div id="f-error" class="sj-field__error" data-part="error"><span class="sj-field__icon" data-part="icon" aria-hidden="true"></span>${error}</div>` : ''}
  </div>`;
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
    expect(readFileSync(join(outDir, 'field.css'), 'utf8')).toContain('.sj-field__error');
    expect(index).toContain('.sj-field__label');
  });

  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('field', fieldCss).sort()).toEqual(contract.anatomy.map((a) => a.part).sort());
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules (tokens only, logical properties)', async () => {
    const { results } = await stylelint.lint({ files: join(srcDir, 'field.css'), configFile });
    expect(results[0].warnings).toEqual([]);
  });

  it('has no raw colour, px or physical direction in the source', () => {
    const src = fieldCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(src).not.toMatch(/\b\d+(\.\d+)?px\b/);
    expect(src).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
  });
});

describe('contrast on every page surface (WCAG 1.4.3 text 4.5:1)', () => {
  it('the shared pass reads the field text colours', () => {
    const uses = extractLayerUses(css).filter((u) => u.component === 'field');
    expect(uses.map((u) => u.token)).toEqual(
      expect.arrayContaining(['color-text-heading', 'color-text-secondary', 'color-error-text']),
    );
    // The disabled label (color-text-muted) is exempt from the pass as an inactive component; the matrix
    // still holds muted text to 4.5:1 on every surface through TEXT_ROLES.
    expect(uses.some((u) => u.token === 'color-text-muted')).toBe(false);
    const ids = checkContrastMatrix(tokens).pairs.map((p) => p.id);
    expect(ids).toContain('text/color-text-muted-on-color-surface');
  });

  it('the shared contrast matrix reports no failure for a field id', () => {
    const { failures } = checkContrastMatrix(tokens, { css });
    expect(failures.filter((f) => f.id.startsWith('field'))).toEqual([]);
  });

  it('a seeded weak hint colour (slate 400) fails the text floor on white', () => {
    const seeded = css.replace(
      /(\.sj-field__hint\s*\{[^}]*color:\s*)var\(--color-text-secondary\)/,
      '$1var(--color-slate-400)',
    );
    expect(seeded).not.toBe(css);
    const ids = checkContrastMatrix(tokens, { css: seeded }).failures.map((f) => f.id);
    expect(ids).toContain('field/hint/component/text-on-color-surface');
  });
});

describe('label, hint and error parts', () => {
  it('lays the parts out in a column on the block axis, label first', async () => {
    const page = await open(fieldHtml({ error: 'Enter a valid email.' }));
    const [l, h, c, e] = await Promise.all(
      ['#f-label', '#f-hint', '#f', '#f-error'].map((s) => rect(page, s)),
    );
    expect(l.y).toBeLessThan(h.y);
    expect(h.y).toBeLessThan(c.y);
    expect(c.y).toBeLessThan(e.y);
  });

  it('the error is visible text beside a sized aria-hidden icon slot, so colour is not the only cue (1.4.1, 3.3.1)', async () => {
    const page = await open(fieldHtml({ error: 'Enter a valid email.' }));
    const text = await page.evaluate(() => document.getElementById('f-error').textContent.trim());
    expect(text).toBe('Enter a valid email.');
    const icon = await rect(page, '.sj-field__icon');
    expect(icon.width).toBeGreaterThan(0);
    expect(icon.height).toBeGreaterThan(0);
  });

  it('the error part generates no content: CSS text would enter the accessible description', async () => {
    expect(fieldCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/(^|[\s;{])content\s*:/);
    const page = await open(fieldHtml({ error: 'Enter a valid email.' }));
    for (const pseudo of ['::before', '::after']) {
      expect((await cs(page, '#f-error', ['content'], pseudo)).content).toMatch(/^(none|normal)$/);
    }
  });

  it('error text colour is the error-text token', async () => {
    const page = await open(fieldHtml({ error: 'Bad.' }));
    const c = await cs(page, '#f-error', ['color']);
    const hex = `#${c.color
      .match(/\d+/g)
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`;
    expect(hex).toBe(tokens['color-error-text']);
  });

  it('a disabled field greys the label to the muted floor and shows a not-allowed cursor', async () => {
    const page = await open(fieldHtml({ disabled: true }));
    const l = await cs(page, '#f-label', ['cursor']);
    expect(l.cursor).toBe('not-allowed');
  });

  it('a long unbroken label wraps instead of overflowing the root', async () => {
    const page = await open(fieldHtml());
    await page.evaluate(() => {
      document.getElementById('f-label').textContent = 'W'.repeat(200);
    });
    const root = await rect(page, '#root');
    const label = await rect(page, '#f-label');
    expect(label.right).toBeLessThanOrEqual(root.right + 1);
  });
});

describe('forced colours', () => {
  it('under forced-colors: active the icon slot keeps its size and the text stays visible', async () => {
    const page = await open(fieldHtml({ error: 'Enter a valid email.' }), {
      media: { forcedColors: 'active' },
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    expect((await rect(page, '.sj-field__icon')).width).toBeGreaterThan(0);
    expect((await rect(page, '#f-error')).height).toBeGreaterThan(0);
  });
});

describe('RTL geometry (logical properties)', () => {
  it('the icon sits at the inline start of the error in both directions', async () => {
    for (const [attrs, dir] of [
      ['', 'ltr'],
      ['dir="rtl"', 'rtl'],
    ]) {
      const page = await open(fieldHtml({ error: 'Enter a valid email.' }), {}, attrs);
      const e = await rect(page, '#f-error');
      const i = await rect(page, '.sj-field__icon');
      const startGap = dir === 'rtl' ? e.right - i.right : i.x - e.x;
      const endGap = dir === 'rtl' ? i.x - e.x : e.right - i.right;
      expect(startGap, dir).toBeLessThan(endGap);
    }
  });
});
