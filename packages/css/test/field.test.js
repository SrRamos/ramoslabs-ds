/* global document, getComputedStyle, matchMedia */
// C02.b: SJField stylesheet. Anatomy against the contract, stylelint (tokens only), text contrast on every page
// surface (WCAG 1.4.3), error never by colour alone (1.4.1, 3.3.1), forced-colors and RTL fixtures. Chromium.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SURFACES,
  checkContrastMatrix,
  contrastRatio,
  loadTokens,
} from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const contract = JSON.parse(
  readFileSync(new URL('../../contracts/contracts/field.contract.json', import.meta.url), 'utf8'),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const fieldCss = readFileSync(join(srcDir, 'field.css'), 'utf8');

/** Every `color: var(--color-*)` use with its selector. All of them are text on the page: 4.5:1. */
function colourUses(src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const d of m[2].matchAll(/(?<![-\w])color:\s*var\(--(color-[\w-]+)\)/g)) {
      out.push({ token: d[1], selector: m[1].trim() });
    }
  }
  return out;
}

/** A field as core emits it. */
function fieldHtml({ error = '', disabled = false, hint = true } = {}) {
  return `<div id="root" class="sj-field__root" data-part="root"${error ? ' data-invalid="true"' : ''}${disabled ? ' data-disabled="true"' : ''}>
    <label id="f-label" for="f" class="sj-field__label" data-part="label">Email address</label>
    ${hint ? '<div id="f-hint" class="sj-field__hint" data-part="hint">We never share it.</div>' : ''}
    <span class="sj-input__root" data-part="root"><input id="f" class="sj-input__control" data-part="control"${error ? ' aria-invalid="true" aria-describedby="f-hint f-error"' : ''}${disabled ? ' disabled' : ''}></span>
    ${error ? `<div id="f-error" class="sj-field__error" data-part="error">${error}</div>` : ''}
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
  it('every text colour the field stylesheet uses clears 4.5:1 on every surface', () => {
    const uses = colourUses(fieldCss);
    expect(uses.map((u) => u.token)).toEqual(
      expect.arrayContaining([
        'color-text-heading',
        'color-text-secondary',
        'color-error-text',
        'color-text-muted',
      ]),
    );
    for (const u of uses) {
      for (const s of SURFACES) {
        expect(
          contrastRatio(tokens[u.token], tokens[s]),
          `${u.token} on ${s} (${u.selector})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('the shared contrast matrix reports no failure for a field id', () => {
    const { failures } = checkContrastMatrix(tokens, { css });
    expect(failures.filter((f) => f.id.startsWith('field'))).toEqual([]);
  });

  it('a seeded weak hint colour (slate 400) fails the text floor on white', () => {
    const seeded = fieldCss.replace(
      /(\.sj-field__hint\s*\{[^}]*color:\s*)var\(--color-text-secondary\)/,
      '$1var(--color-slate-400)',
    );
    expect(seeded).not.toBe(fieldCss);
    expect(colourUses(seeded).some((u) => u.token === 'color-slate-400')).toBe(true);
    expect(contrastRatio(tokens['color-slate-400'], tokens['color-white'])).toBeLessThan(4.5);
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

  it('the error is visible text with a drawn marker, so colour is not the only cue (1.4.1, 3.3.1)', async () => {
    const page = await open(fieldHtml({ error: 'Enter a valid email.' }));
    const text = await page.evaluate(() => document.getElementById('f-error').textContent.trim());
    expect(text).toBe('Enter a valid email.');
    const marker = await cs(
      page,
      '#f-error',
      ['content', 'inline-size', 'border-top-style'],
      '::before',
    );
    expect(marker.content).toMatch(/!/);
    expect(parseFloat(marker['inline-size'])).toBeGreaterThan(0);
    expect(marker['border-top-style']).toBe('solid');
  });

  it('the marker has an empty accessible text so it is not announced as "exclamation mark"', () => {
    expect(fieldCss).toMatch(/content:\s*'!'\s*\/\s*''/);
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
  it('under forced-colors: active the error marker keeps its shape and the text stays visible', async () => {
    const page = await open(fieldHtml({ error: 'Enter a valid email.' }), {
      media: { forcedColors: 'active' },
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const m = await cs(
      page,
      '#f-error',
      ['inline-size', 'border-top-style', 'border-top-width'],
      '::before',
    );
    expect(parseFloat(m['inline-size'])).toBeGreaterThan(0);
    expect(m['border-top-style']).toBe('solid');
    expect(parseFloat(m['border-top-width'])).toBeGreaterThan(0);
    expect((await rect(page, '#f-error')).height).toBeGreaterThan(0);
  });
});

describe('RTL geometry (logical properties)', () => {
  it('the error marker sits at the inline start: the text is pushed away from that edge in both directions', async () => {
    for (const [attrs, dir] of [
      ['', 'ltr'],
      ['dir="rtl"', 'rtl'],
    ]) {
      const page = await open(fieldHtml({ error: 'Enter a valid email.' }), {}, attrs);
      const g = await page.evaluate(() => {
        const e = document.getElementById('f-error');
        const r = e.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(e);
        const t = range.getBoundingClientRect();
        return {
          startGap: document.documentElement.dir === 'rtl' ? r.right - t.right : t.left - r.left,
        };
      });
      expect(g.startGap, dir).toBeGreaterThanOrEqual(16);
    }
  });
});
