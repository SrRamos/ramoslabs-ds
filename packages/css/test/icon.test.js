/* global document, getComputedStyle, matchMedia */
// C12.b: SJIcon stylesheet. Anatomy against the contract, stylelint, size tokens, baseline, RTL mirror via
// data-mirror only, spin with motion tokens, forced-colors visibility, 1.4.11 3:1 for the documented recipes
// (ADR-009, PLAN-ICONS decisions 4, 8, 10). Runs in Chromium through the shared css helpers.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkContrastMatrix, contrastRatio, loadTokens } from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const px = (rem) => Number.parseFloat(rem) * 16;
const contract = JSON.parse(
  readFileSync(new URL('../../contracts/contracts/icon.contract.json', import.meta.url), 'utf8'),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const iconCss = readFileSync(join(srcDir, 'icon.css'), 'utf8');

/** The root exactly as core getRootProps renders it (class, data-part, markup fallback, presentation attrs). */
function iconHtml({ size, mirror = false, spin = false, id = 'i', css = '', box = true } = {}) {
  const attrs = [
    `id="${id}"`,
    'class="sj-icon"',
    'data-part="root"',
    size ? `data-size="${size}"` : '',
    mirror ? 'data-mirror="true"' : '',
    spin ? 'data-spin' : '',
    box ? 'width="1em" height="1em"' : '',
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"',
    'aria-hidden="true"',
    css ? `style="${css}"` : '',
  ];
  return `<svg ${attrs.filter(Boolean).join(' ')}><path d="M4 12h16"/><path d="m14 6 6 6-6 6"/></svg>`;
}

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (body, opts = {}, attrs = '', extra = '') =>
  b.page(opts, doc({ css, body, attrs, extra }));

const cs = (page, sel, props) =>
  page.evaluate(
    ([s, p]) => {
      const c = getComputedStyle(document.querySelector(s));
      return Object.fromEntries(p.map((k) => [k, c.getPropertyValue(k)]));
    },
    [sel, props],
  );

/** Pixels of an element's box via a page clip (works while it animates). */
const shot = async (page, sel) => {
  const r = await rect(page, sel);
  return page.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: r.height } });
};

const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  }, sel);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(existsSync(join(outDir, 'icon.css'))).toBe(true);
    expect(index).toContain('.sj-icon');
  });

  it('names exactly the contract anatomy part (root)', () => {
    expect(cssParts('icon', iconCss).sort()).toEqual(contract.anatomy.map((a) => a.part).sort());
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules, and a seeded raw px size is caught', async () => {
    const { results } = await stylelint.lint({ files: join(srcDir, 'icon.css'), configFile });
    expect(results[0].warnings).toEqual([]);
    const seeded = await stylelint.lint({
      code: iconCss.replace('var(--icon-size-md)', '20px'),
      codeFilename: join(srcDir, 'icon.css'),
      configFile,
    });
    expect(seeded.results[0].warnings.length).toBeGreaterThan(0);
  });

  it('is token-only: no raw colour, no physical property, no colour or forced-color override', () => {
    const code = iconCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(code).not.toMatch(/[\d.]\s*px\b/);
    expect(code).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
    expect(code).not.toMatch(/margin-(left|right)|padding-(left|right)|(min|max)-(width|height)/);
    expect(code).not.toMatch(/forced-color-adjust|(^|[\s;{])(fill|stroke|filter|color)\s*:/m);
  });
});

describe('size tokens (PLAN-ICONS decision 4)', () => {
  it.each([
    ['sm', 'icon-size-sm'],
    ['md', 'icon-size-md'],
    ['lg', 'icon-size-lg'],
  ])('data-size=%s is the %s token box, overriding the 1em markup box', async (size, tok) => {
    const page = await open(`<p style="font-size:40px">${iconHtml({ size })}</p>`);
    const r = await rect(page, '#i');
    expect(r.width).toBe(px(tokens[tok]));
    expect(r.height).toBe(px(tokens[tok]));
  });

  it('the token sizes are 14, 20 and 24 px', () => {
    expect(['sm', 'md', 'lg'].map((s) => px(tokens[`icon-size-${s}`]))).toEqual([14, 20, 24]);
  });

  it('no data-size (unknown sizes resolve to md in core) and data-size=md agree', async () => {
    const page = await open(iconHtml());
    expect((await rect(page, '#i')).width).toBe(px(tokens['icon-size-md']));
  });

  it('fit fills the parent box on both axes', async () => {
    const page = await open(
      `<div style="inline-size:50px;block-size:30px;display:block">${iconHtml({ size: 'fit' })}</div>`,
    );
    const r = await rect(page, '#i');
    expect([r.width, r.height]).toEqual([50, 30]);
  });

  it('does not shrink in a flex row (flex: none)', async () => {
    const page = await open(
      `<div style="display:flex;inline-size:8px">${iconHtml({ size: 'lg' })}</div>`,
    );
    expect((await rect(page, '#i')).width).toBe(px(tokens['icon-size-lg']));
  });

  it('stroke width comes from the token and the --sj-icon-stroke hook overrides it', async () => {
    const page = await open(iconHtml());
    expect((await cs(page, '#i', ['stroke-width']))['stroke-width']).toBe(
      `${tokens['icon-stroke-width']}px`,
    );
    const hooked = await open(iconHtml({ css: '--sj-icon-stroke: 1.5' }));
    expect((await cs(hooked, '#i', ['stroke-width']))['stroke-width']).toBe('1.5px');
  });

  it('without the stylesheet the 1em markup box still sizes the glyph (the CSS-less fallback)', async () => {
    const page = await b.page(
      {},
      `<!doctype html><body><p style="font-size:32px;margin:0">${iconHtml()}</p></body>`,
    );
    const r = await rect(page, '#i');
    expect([r.width, r.height]).toEqual([32, 32]);
  });
});

describe('text baseline', () => {
  it('an sm icon in 16px / 1.5 text does not grow the line box; md (20px) grows it by at most 1px', async () => {
    const line = (inner) =>
      `<p id="p" style="margin:0;font-size:16px;line-height:1.5;font-family:sans-serif">Label ${inner}</p>`;
    const base = await rect(await open(line('')), '#p');
    expect(base.height).toBe(24);
    expect((await rect(await open(line(iconHtml({ size: 'sm' }))), '#p')).height).toBe(24);
    // md is 20px in 16px text: taller than the strut above the baseline, so the line may grow, never shift.
    const md = await rect(await open(line(iconHtml({ size: 'md' }))), '#p');
    expect(md.height - base.height).toBeLessThanOrEqual(1);
  });

  it('the glyph bottom sits below the baseline by the em offset, not on the line bottom', async () => {
    const page = await open(
      `<p style="margin:0;font-size:16px;line-height:1.5;font-family:sans-serif">Label <span id="b" style="display:inline-block;inline-size:0;block-size:0"></span>${iconHtml({ size: 'sm' })}</p>`,
    );
    const base = await rect(page, '#b');
    const icon = await rect(page, '#i');
    expect(icon.bottom - base.bottom).toBeCloseTo(0.125 * 16, 1);
  });
});

describe('RTL mirror (ADR-009: only through data-mirror, never from dir)', () => {
  const matrix = (page) =>
    page.evaluate(() => getComputedStyle(document.getElementById('i')).transform);

  it('data-mirror flips the glyph horizontally', async () => {
    const page = await open(iconHtml({ mirror: true }));
    expect(await matrix(page)).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  });

  it('dir=rtl alone does not mirror (core decides, from the icon flag and the resolved dir)', async () => {
    const page = await open(iconHtml(), {}, 'dir="rtl"');
    expect(await matrix(page)).toBe('none');
  });

  it('a mirrored icon in an rtl document points the other way in pixels', async () => {
    const plain = await open(iconHtml(), {}, 'dir="rtl"');
    const mirrored = await open(iconHtml({ mirror: true }), {}, 'dir="rtl"');
    const sel = '#i';
    const a = await plain.locator(sel).screenshot();
    const m = await mirrored.locator(sel).screenshot();
    expect(Buffer.compare(a, m)).not.toBe(0);
  });

  it('data-mirror="false" does not mirror, and the mirror composes with data-spin (rotate, not transform)', async () => {
    const page = await open(iconHtml().replace('aria-hidden', 'data-mirror="false" aria-hidden'));
    expect(await matrix(page)).toBe('none');
    const both = await open(iconHtml({ mirror: true, spin: true }));
    expect(await matrix(both)).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  });
});

describe('spin (data-spin) and reduced motion', () => {
  it('rotates with the slow motion token (x3) and the linear easing token', async () => {
    const page = await open(iconHtml({ spin: true, size: 'lg' }));
    const s = await cs(page, '#i', [
      'animation-name',
      'animation-duration',
      'animation-timing-function',
      'animation-iteration-count',
    ]);
    expect(s['animation-name']).toBe('sj-icon-spin');
    expect(s['animation-duration']).toBe('0.9s');
    expect(s['animation-timing-function']).toBe('cubic-bezier(0, 0, 1, 1)'); // --easing-linear
    expect(s['animation-iteration-count']).toBe('infinite');
  });

  it('without data-spin there is no animation', async () => {
    const page = await open(iconHtml());
    expect((await cs(page, '#i', ['animation-name']))['animation-name']).toBe('none');
  });

  it('under prefers-reduced-motion the spinner is static', async () => {
    const page = await open(iconHtml({ spin: true }), { media: { reducedMotion: 'reduce' } });
    expect((await cs(page, '#i', ['animation-name']))['animation-name']).toBe('none');
    const r1 = await shot(page, '#i');
    await page.waitForTimeout(250);
    expect(Buffer.compare(r1, await shot(page, '#i'))).toBe(0);
  });

  it('with motion allowed the pixels change over time', async () => {
    const page = await open(iconHtml({ spin: true, size: 'lg' }));
    const r1 = await shot(page, '#i');
    await page.waitForTimeout(250);
    expect(Buffer.compare(r1, await shot(page, '#i'))).not.toBe(0);
  });

  it('a seeded raw duration is caught by stylelint', async () => {
    const seeded = await stylelint.lint({
      code: iconCss.replace('calc(var(--sj-duration-slow) * 3)', '900ms'),
      codeFilename: join(srcDir, 'icon.css'),
      configFile,
    });
    expect(seeded.results[0].warnings.length).toBeGreaterThan(0);
  });
});

describe('forced colors keeps the glyph visible (PLAN-ICONS decision 10)', () => {
  it('the stroke resolves to a system colour that differs from the canvas, and pixels are drawn', async () => {
    const page = await open(
      `<div id="host" style="color:#e11d48;background:#fff">${iconHtml({ size: 'lg' })}</div>`,
      { media: { forcedColors: 'active' } },
    );
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const { stroke, canvas, host } = await page.evaluate(() => ({
      stroke: getComputedStyle(document.getElementById('i')).stroke,
      canvas: getComputedStyle(document.body).backgroundColor,
      host: getComputedStyle(document.getElementById('host')).color,
    }));
    expect(stroke).toBe(host); // currentColor follows the system text colour
    expect(host).not.toBe('rgb(225, 29, 72)'); // the author colour was replaced by CanvasText
    expect(stroke).not.toBe(canvas);
    expect(stroke).not.toMatch(/none|rgba\(0, 0, 0, 0\)/);
    const drawn = await shot(page, '#i');
    const blank = await open(`<div style="inline-size:24px;block-size:24px"></div>`, {
      media: { forcedColors: 'active' },
    });
    expect(Buffer.compare(drawn, await blank.locator('div').screenshot())).not.toBe(0);
  });

  it('the stylesheet does not opt out of forced colors, and a seeded opt-out is detectable', async () => {
    const page = await open(iconHtml(), { media: { forcedColors: 'active' } });
    expect((await cs(page, '#i', ['forced-color-adjust']))['forced-color-adjust']).not.toBe('none');
    const seeded = await open(
      iconHtml(),
      { media: { forcedColors: 'active' } },
      '',
      '.sj-icon{forced-color-adjust:none}',
    );
    expect((await cs(seeded, '#i', ['forced-color-adjust']))['forced-color-adjust']).toBe('none');
  });
});

describe('drawn glyph contrast (WCAG 1.4.11, 3:1) for the documented recipes', () => {
  // The icon draws no colour of its own: the stroke is currentColor. The recipe is "a meaningful icon takes
  // the parent text colour, or a token at least as strong as the 3:1 UI-component floor on its surface".
  const surfaces = ['color-background', 'color-surface', 'color-surface-secondary'];
  const recipes = ['color-slate-900', 'color-slate-700', 'color-slate-500', 'color-primary'];

  it.each(recipes)('stroke %s meets 3:1 on every surface', (fg) => {
    for (const s of surfaces)
      expect(contrastRatio(tokens[fg], tokens[s])).toBeGreaterThanOrEqual(3);
  });

  it('a seeded weak recipe (slate 300) fails 3:1', () => {
    expect(contrastRatio(tokens['color-slate-300'], tokens['color-background'])).toBeLessThan(3);
  });

  it('the stroke is exactly the parent colour, so the recipe holds in the browser', async () => {
    const page = await open(
      `<div id="host" style="color:${tokens['color-primary']}">${iconHtml()}</div>`,
    );
    const { stroke, host } = await page.evaluate(() => ({
      stroke: getComputedStyle(document.getElementById('i')).stroke,
      host: getComputedStyle(document.getElementById('host')).color,
    }));
    expect(stroke).toBe(host);
  });

  it('adds no component colour pair of its own to the contrast extractor, and breaks none', () => {
    const { pairs, failures } = checkContrastMatrix(tokens, { css });
    expect(pairs.filter((p) => p.id.startsWith('icon/'))).toEqual([]);
    expect(failures.filter((f) => f.id.startsWith('icon/'))).toEqual([]);
    // Seeded: a fill on the icon part would be picked up as a pair and could fail; the stylesheet has none.
    expect(iconCss).not.toMatch(/background-color|border-color/);
  });
});
