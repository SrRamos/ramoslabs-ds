/* global document, getComputedStyle, matchMedia */
// C03c.b: SJCheckbox stylesheet. Anatomy against the contract, stylelint, drawn-pair contrast (WCAG 1.4.11) through
// the extractor on every surface, 2.4.13 focus, 44 px target with the 24 px floor (ADR-008), forced-colors glyphs,
// RTL geometry and reduced motion (ADR-009). Runs in Chromium through the shared css helpers.
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
  readFileSync(
    new URL('../../contracts/contracts/checkbox.contract.json', import.meta.url),
    'utf8',
  ),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const checkboxCss = readFileSync(join(srcDir, 'checkbox.css'), 'utf8');

/** A native checkbox as the adapters render it: label root, real input, indicator span, label span. */
function checkboxHtml({
  state = 'unchecked',
  disabled = false,
  density = '',
  label = 'Notify me',
} = {}) {
  const attr = disabled ? ' data-disabled="true"' : '';
  const checked = state === 'checked' ? ' checked' : '';
  const inner = `<label id="root" class="sj-checkbox__root" data-part="root" data-state="${state}"${attr}>
    <input id="ctl" class="sj-checkbox__control" type="checkbox" data-part="control" data-state="${state}"${attr}${checked}${disabled ? ' disabled' : ''}>
    <span id="ind" class="sj-checkbox__indicator" data-part="indicator" data-state="${state}"${attr}></span>
    <span id="lbl" class="sj-checkbox__label" data-part="label">${label}</span></label>`;
  return density ? `<div data-density="${density}">${inner}</div>` : inner;
}

const hexOf = (rgb) =>
  `#${rgb
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

/** Parses `rgb(..) 0px 0px 0px 2px, ...` into [{ color, spread }] (same shape as switch.test.js). */
const shadows = (v) =>
  [
    ...v.matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g),
  ].map((m) => ({ color: m[1], spread: Number.parseFloat(m[5]) }));

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (body, opts = {}, attrs = '', sheet = css) =>
  b.page(opts, doc({ css: sheet, body, attrs }));

/** Computed style of a selector, or of its pseudo-element when `pseudo` is given. */
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

/** Moves the fixture to a state. `indeterminate` has no attribute, so it is set as the property. */
const setState = (page, state) =>
  page.evaluate((s) => {
    const ctl = document.getElementById('ctl');
    for (const el of [document.getElementById('root'), ctl, document.getElementById('ind')])
      el.dataset.state = s;
    ctl.checked = s === 'checked';
    ctl.indeterminate = s === 'indeterminate';
  }, state);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(existsSync(join(outDir, 'checkbox.css'))).toBe(true);
    expect(index).toContain('.sj-checkbox__indicator');
  });

  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('checkbox', checkboxCss).sort()).toEqual(
      contract.anatomy.map((a) => a.part).sort(),
    );
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules', async () => {
    const { results } = await stylelint.lint({
      files: join(srcDir, 'checkbox.css'),
      configFile,
    });
    expect(results[0].warnings).toEqual([]);
  });

  it('the native checkbox is the real control (no role override, no aria-checked)', async () => {
    const page = await open(checkboxHtml());
    const c = await page.evaluate(() => {
      const el = document.getElementById('ctl');
      return { type: el.type, role: el.getAttribute('role'), tag: el.tagName };
    });
    expect(c).toEqual({ type: 'checkbox', role: null, tag: 'INPUT' });
  });
});

describe('target size (ADR-008: 44 px, 24 px floor)', () => {
  it('the input hit area and the label root are at least the 44 px token on fine pointers', async () => {
    const page = await open(checkboxHtml());
    const min = px(tokens['target-min']);
    expect(min).toBe(44);
    const input = await rect(page, '#ctl');
    expect(input.width).toBeGreaterThanOrEqual(min);
    expect(input.height).toBeGreaterThanOrEqual(min);
    expect((await rect(page, '#root')).height).toBeGreaterThanOrEqual(min);
  });

  it('compact density drops to the 24 px floor on fine pointers only', async () => {
    const fine = await open(checkboxHtml({ density: 'compact' }));
    const floor = px(tokens['target-floor']);
    expect(floor).toBe(24);
    expect((await rect(fine, '#ctl')).height).toBe(floor);
    const coarse = await b.page(
      { hasTouch: true, isMobile: true },
      doc({ css, body: checkboxHtml({ density: 'compact' }) }),
    );
    expect((await rect(coarse, '#ctl')).height).toBe(px(tokens['target-min']));
  });

  it('on a wrapping label the input stays centred on the box and contains it (G3A MUST-3 pattern)', async () => {
    const long =
      'Send me a notification whenever someone replies to a thread that I started or follow, including mentions and reactions from the whole team';
    const page = await open(
      `<div style="inline-size:180px">${checkboxHtml({ label: long })}</div>`,
    );
    const root = await rect(page, '#root');
    const input = await rect(page, '#ctl');
    const box = await rect(page, '#ind');
    expect(root.height).toBeGreaterThan(px(tokens['target-min']) * 2); // the label really wrapped
    expect(input.x).toBeLessThanOrEqual(box.x);
    expect(input.x + input.width).toBeGreaterThanOrEqual(box.x + box.width);
    expect(input.y).toBeLessThanOrEqual(box.y);
    expect(input.y + input.height).toBeGreaterThanOrEqual(box.y + box.height);
    expect(Math.abs(input.y + input.height / 2 - (box.y + box.height / 2))).toBeLessThan(0.5);
  });

  it('a seeded control pinned to the top edge fails the centring check', async () => {
    const seeded = css.replace(
      /(\.sj-checkbox__control\s*\{[^}]*?)inset-block-start:\s*50%;([^}]*?)translate:\s*0 -50%;/,
      '$1inset-block-start: 0;$2translate: none;',
    );
    expect(seeded).not.toBe(css);
    const page = await open(
      `<div style="inline-size:180px">${checkboxHtml({ label: 'A long label that wraps across several lines in this narrow box so the root grows tall' })}</div>`,
      {},
      '',
      seeded,
    );
    const input = await rect(page, '#ctl');
    const box = await rect(page, '#ind');
    expect(input.y + input.height).toBeLessThan(box.y + box.height); // the hit area no longer reaches the box
  });

  it('the native input is reachable with Tab and clicking the label toggles it', async () => {
    const page = await open(checkboxHtml());
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('ctl');
    await page.click('#root');
    expect(await page.evaluate(() => document.getElementById('ctl').checked)).toBe(true);
  });
});

describe('drawn colour pairs (WCAG 1.4.11, 3:1) through the extractor', () => {
  // Every drawn fill of the box (unchecked boundary, checked and indeterminate fills) is read from the built css
  // and checked at 3:1 against every page surface. The white field and the glyphs are not on the page; see notes.
  it('the box meets 3:1 on every surface in every state, read from the built css', () => {
    const { pairs, failures } = checkContrastMatrix(tokens, { css });
    const box = pairs.filter((p) => p.id.startsWith('checkbox/indicator'));
    expect(box).toHaveLength(9); // unchecked, checked, indeterminate x three surfaces
    expect(box.every((p) => p.min === 3 && p.pass)).toBe(true);
    expect(failures.filter((f) => f.id.startsWith('checkbox/'))).toEqual([]);
  });

  it('a seeded weak unchecked boundary fails the extractor pairs', () => {
    const weak = css.replace(
      /(\.sj-checkbox__indicator\[data-state='unchecked'\]\s*\{\s*background-color:\s*)var\(--color-slate-500\)/,
      '$1var(--color-slate-300)',
    );
    expect(weak).not.toBe(css);
    const { failures } = checkContrastMatrix(tokens, { css: weak });
    expect(
      failures.some((f) => f.id.startsWith('checkbox/indicator') && f.id.includes('unchecked')),
    ).toBe(true);
  });

  it('a seeded weak checked fill fails the extractor pairs', () => {
    const weak = css.replace(
      /(\.sj-checkbox__indicator\[data-state='checked'\],[\s\S]*?background-color:\s*)var\(--color-primary\)/,
      '$1var(--color-slate-300)',
    );
    expect(weak).not.toBe(css);
    const { failures } = checkContrastMatrix(tokens, { css: weak });
    expect(
      failures.some((f) => f.id.startsWith('checkbox/indicator') && f.id.includes('checked')),
    ).toBe(true);
  });

  it('the box fills use the token colours, and the check glyph meets 3:1 on the checked fill', async () => {
    const off = await open(checkboxHtml({ state: 'unchecked' }));
    expect(hexOf((await cs(off, '#ind', ['background-color']))['background-color'])).toBe(
      tokens['color-slate-500'],
    );
    const on = await open(checkboxHtml({ state: 'checked' }));
    const fill = hexOf((await cs(on, '#ind', ['background-color']))['background-color']);
    expect(fill).toBe(tokens['color-primary']);
    const glyph = hexOf(
      (await cs(on, '#ind', ['border-top-color'], '::after'))['border-top-color'],
    );
    expect(glyph).toBe(tokens['color-white']);
    expect(contrastRatio(glyph, fill)).toBeGreaterThanOrEqual(3);
  });
});

describe('focus indicator (WCAG 2.4.7, 2.4.13) on the checkbox', () => {
  it('keyboard focus draws the shared two-tone ring on the input', async () => {
    const page = await open(checkboxHtml());
    await page.keyboard.press('Tab');
    const s = await cs(page, '#ctl', ['box-shadow']);
    const [gap, edge] = shadows(s['box-shadow']);
    expect(gap.spread).toBe(px(tokens['focus-ring-offset']));
    expect(edge.spread - gap.spread).toBeGreaterThanOrEqual(px(tokens['focus-ring-width']));
  });

  it('the ring is visible in pixels around the checkbox', async () => {
    const page = await open(checkboxHtml());
    const r = await rect(page, '#root');
    const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab');
    expect(Buffer.compare(before, await page.screenshot({ clip }))).not.toBe(0);
  });
});

describe('glyphs: checked and indeterminate are visible, and differ from each other', () => {
  it('the check shows only when checked and the dash only when indeterminate', async () => {
    const page = await open(checkboxHtml());
    const shown = async (state) => {
      await setState(page, state);
      return {
        check: (await cs(page, '#ind', ['display'], '::after')).display,
        dashW: await page.evaluate(
          () => getComputedStyle(document.getElementById('ind'), '::after').borderBlockStartWidth,
        ),
      };
    };
    expect((await shown('unchecked')).check).toBe('none');
    expect((await shown('checked')).check).toBe('block');
    const dash = await shown('indeterminate');
    expect(dash.check).toBe('block'); // the same pseudo, a different stroke
    expect(Number.parseFloat(dash.dashW)).toBeGreaterThan(0);
    expect(
      (await cs(page, '#ind', ['border-inline-end-width'], '::after'))['border-inline-end-width'],
    ).toBe('0px');
  });

  it('the indeterminate dash and the checked glyph paint different pixels', async () => {
    const page = await open(checkboxHtml());
    const r = await rect(page, '#ind');
    const clip = { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 };
    await setState(page, 'checked');
    const checked = await page.screenshot({ clip });
    await setState(page, 'indeterminate');
    expect(Buffer.compare(checked, await page.screenshot({ clip }))).not.toBe(0);
  });
});

describe('forced colors keeps the box and its glyphs visible', () => {
  it('the box and the glyph carry a solid system-colour border under forced-colors: active', async () => {
    const page = await open(checkboxHtml({ state: 'checked' }), {
      media: { forcedColors: 'active' },
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const box = await cs(page, '#ind', [
      'border-top-style',
      'border-top-width',
      'border-top-color',
    ]);
    expect(box['border-top-style']).toBe('solid');
    expect(Number.parseFloat(box['border-top-width'])).toBeGreaterThanOrEqual(1);
    expect(box['border-top-color']).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    const glyph = await cs(
      page,
      '#ind',
      ['border-inline-end-style', 'border-inline-end-width', 'border-inline-end-color'],
      '::after',
    );
    expect(glyph['border-inline-end-style']).toBe('solid');
    expect(Number.parseFloat(glyph['border-inline-end-width'])).toBeGreaterThanOrEqual(1);
    expect(glyph['border-inline-end-color']).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

  it('the state is visible without background colour: unchecked, checked and indeterminate differ', async () => {
    const page = await open(checkboxHtml({ state: 'unchecked' }), {
      media: { forcedColors: 'active' },
    });
    const r = await rect(page, '#root');
    const clip = { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 };
    const off = await page.screenshot({ clip });
    await setState(page, 'checked');
    const on = await page.screenshot({ clip });
    await setState(page, 'indeterminate');
    const mixed = await page.screenshot({ clip });
    expect(Buffer.compare(off, on)).not.toBe(0);
    expect(Buffer.compare(on, mixed)).not.toBe(0);
  });

  it('the focus indicator stays visible under forced colors', async () => {
    const page = await open(checkboxHtml(), { media: { forcedColors: 'active' } });
    await page.keyboard.press('Tab');
    const f = await cs(page, '#ctl', ['outline-style', 'outline-width']);
    expect(f['outline-style']).toBe('solid');
    expect(Number.parseFloat(f['outline-width'])).toBeGreaterThanOrEqual(2);
  });

  it('a seeded removal of the forced-colors box border fails the check', async () => {
    const seeded = css.replace('border: var(--border-width-hairline) solid CanvasText;', '');
    expect(seeded).not.toBe(css);
    const page = await open(
      checkboxHtml({ state: 'checked' }),
      { media: { forcedColors: 'active' } },
      '',
      seeded,
    );
    expect((await cs(page, '#ind', ['border-top-style']))['border-top-style']).not.toBe('solid');
  });
});

describe('RTL geometry (logical properties)', () => {
  // The box sits centred in the 44 px slot at the start edge: (44 - 20) / 2 = 12 px in.
  const inset = (px(tokens['target-min']) - px(tokens['space-5'])) / 2;

  it('LTR: the box sits 12 px in from the left and the input covers it', async () => {
    const page = await open(checkboxHtml());
    const root = await rect(page, '#root');
    const box = await rect(page, '#ind');
    expect(box.x - root.x).toBeCloseTo(inset, 1);
  });

  it('RTL: the same inset mirrors from the right edge, and the input sits at the start (right) edge', async () => {
    const page = await open(checkboxHtml(), {}, 'dir="rtl"');
    const root = await rect(page, '#root');
    const box = await rect(page, '#ind');
    const input = await rect(page, '#ctl');
    expect(root.right - box.right).toBeCloseTo(inset, 1);
    expect(root.right - input.right).toBeCloseTo(0, 1);
  });

  it('the stylesheet uses no physical directional property', () => {
    expect(checkboxCss).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
    expect(checkboxCss).not.toMatch(
      /margin-(left|right)|padding-(left|right)|(min|max)-(width|height)/,
    );
  });
});

describe('reduced motion (ADR-009)', () => {
  it('the box transition uses the motion token', async () => {
    const page = await open(checkboxHtml());
    expect((await cs(page, '#ind', ['transition-duration']))['transition-duration']).toBe('0.15s');
  });

  it('reduced motion collapses the box transition to 0s', async () => {
    const page = await open(checkboxHtml(), { media: { reducedMotion: 'reduce' } });
    expect((await cs(page, '#ind', ['transition-duration']))['transition-duration']).toBe('0s');
  });
});

describe('disabled state', () => {
  it('a disabled checkbox uses the disabled box colour and the not-allowed cursor', async () => {
    const page = await open(checkboxHtml({ state: 'checked', disabled: true }));
    expect(hexOf((await cs(page, '#ind', ['background-color']))['background-color'])).toBe(
      tokens['color-slate-300'],
    );
    expect((await cs(page, '#root', ['cursor']))['cursor']).toBe('not-allowed');
  });
});
