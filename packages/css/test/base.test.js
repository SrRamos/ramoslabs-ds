/* global document, getComputedStyle, matchMedia */
// W1-204: base styles proven in a probe fixture (ADR-013 L3 geometry/contrast, L5 forced-colors).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contrastRatio, loadTokens } from '../../testing/contrast/index.js';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const px = (rem) => Number.parseFloat(rem) * 16;

const BODY = `
  <div data-part="root">
    <button id="b1" data-part="trigger">One</button>
    <button id="b2" data-part="trigger">Two</button>
    <ul role="listbox" data-part="list">
      <li id="o1" role="option" data-part="option" data-active="true">One</li>
      <li id="o2" role="option" data-part="option" data-active="false">Two</li>
    </ul>
    <div style="font-size:12px"><input id="in" data-part="input" type="text" /></div>
    <input id="cb" data-part="check" type="checkbox" />
    <div data-density="compact"><button id="c1" data-part="trigger">C</button></div>
  </div>`;

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (opts = {}, extra = '', body = BODY) => b.page(opts, doc({ css, extra, body }));
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
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, id);

describe('touch targets (ADR-008)', () => {
  it('default controls are at least the 44px token, above the 24px floor', async () => {
    const page = await open();
    const min = px(tokens['target-min']);
    for (const id of ['b1', 'b2', 'in']) {
      const r = await box(page, id);
      expect(r.width).toBeGreaterThanOrEqual(min);
      expect(r.height).toBeGreaterThanOrEqual(min);
    }
    expect(min).toBe(44);
    expect(px(tokens['target-floor'])).toBe(24);
  });

  it('compact density uses the 24px floor on fine pointers and 44px on coarse pointers', async () => {
    const fine = await open();
    expect((await style(fine, 'c1', ['min-block-size']))['min-block-size']).toBe('24px');
    const coarse = await open({ hasTouch: true, isMobile: true });
    expect((await style(coarse, 'c1', ['min-block-size']))['min-block-size']).toBe('44px');
  });

  it('adjacent targets never overlap (no pseudo-element hit areas)', async () => {
    const page = await open();
    const [a, c] = [await box(page, 'b1'), await box(page, 'b2')];
    const overlap =
      a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
    expect(overlap).toBe(false);
  });

  it('base source expands no hit area through ::before or ::after', () => {
    for (const f of readdirSync(join(srcDir, 'base'))) {
      const root = postcss.parse(readFileSync(join(srcDir, 'base', f), 'utf8'));
      root.walkRules((rule) => {
        if (/::?(before|after)/.test(rule.selector)) {
          rule.walkDecls((d) => {
            expect(d.prop, `${f}: ${rule.selector}`).not.toMatch(/^(inset|top|left|right|bottom)/);
            expect(d.value, `${f}: ${rule.selector}`).not.toMatch(/-\s*\d|calc\(-/);
          });
        }
      });
    }
  });

  it('reports the Android 48 dp check separately (advisory: no 48px token exists)', async () => {
    const page = await open();
    const { height } = await box(page, 'b1');
    // dp is not px (ADR-008): 1 dp = 1 CSS px only at Android's default density, so this is advisory.
    const android48dp = { measuredCssPx: height, requiredDp: 48, enforced: false };
    expect(android48dp.measuredCssPx).toBeGreaterThanOrEqual(44);
    expect(android48dp.measuredCssPx).toBeLessThan(48 + 0.01); // when a --target-comfortable token lands, enforce
  });
});

describe('control text (16px)', () => {
  it('text-entry controls never render below the token, even in a small parent', async () => {
    const page = await open();
    const s = await style(page, 'in', ['font-size']);
    expect(Number.parseFloat(s['font-size'])).toBeGreaterThanOrEqual(
      px(tokens['control-text-min']),
    );
  });
  it('does not resize buttons-as-checkboxes text (checkbox keeps its own size)', async () => {
    const page = await open();
    expect((await box(page, 'cb')).width).toBeGreaterThanOrEqual(44);
  });
});

/** Parses `rgb(..) 0px 0px 0px 2px, rgb(..) 0px 0px 0px 4px` into [{color, spread}]. */
const shadows = (v) =>
  [
    ...v.matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g),
  ].map((m) => ({
    color: m[1],
    spread: Number.parseFloat(m[5]),
  }));
const hex = (rgb) =>
  `#${rgb
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

describe('focus indicator (WCAG 2.4.7, 2.4.13)', () => {
  it('keyboard focus draws the two-tone ring: >= 2px thick edge, >= 3:1 against surfaces and its gap', async () => {
    const page = await open();
    await page.keyboard.press('Tab');
    const s = await style(page, 'b1', ['box-shadow']);
    const [gap, edge] = shadows(s['box-shadow']);
    expect(gap.spread).toBe(px(tokens['focus-ring-offset']));
    const thickness = edge.spread - gap.spread;
    expect(thickness).toBeGreaterThanOrEqual(px(tokens['focus-ring-width']));
    expect(thickness).toBeGreaterThanOrEqual(2);
    for (const surface of ['color-surface', 'color-surface-secondary', 'color-background']) {
      expect(contrastRatio(hex(edge.color), tokens[surface])).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(hex(edge.color), hex(gap.color))).toBeGreaterThanOrEqual(3);
    // Area >= a 2px-thick perimeter of the unfocused control.
    const { width, height } = await box(page, 'b1');
    const area = 2 * (width + height) * thickness + 4 * thickness * thickness;
    expect(area).toBeGreaterThanOrEqual(2 * (width + height) * 2);
  });

  it('data-active draws the same ring without DOM focus, data-active=false does not', async () => {
    const page = await open();
    const on = await style(page, 'o1', ['box-shadow']);
    const off = await style(page, 'o2', ['box-shadow']);
    expect(shadows(on['box-shadow'])).toHaveLength(2);
    expect(off['box-shadow']).toBe('none');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  it('pointer click on a button draws no ring (focus-visible heuristics)', async () => {
    const page = await open();
    await page.click('#b1');
    expect((await style(page, 'b1', ['box-shadow']))['box-shadow']).toBe('none');
  });

  it('survives a component rule that sets its own box-shadow', async () => {
    const page = await open(
      {},
      '@layer sj.component { [data-part="trigger"] { box-shadow: 0 1px 2px rgb(0 0 0 / 0.2); } }',
    );
    await page.keyboard.press('Tab');
    expect(shadows((await style(page, 'b1', ['box-shadow']))['box-shadow'])).toHaveLength(2);
  });

  it('the ring is visible in pixels', async () => {
    const page = await open();
    const r = await box(page, 'b1');
    const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab');
    const after = await page.screenshot({ clip });
    expect(Buffer.compare(before, after)).not.toBe(0);
  });
});

describe('forced colors (L5 fixture)', () => {
  it('focus and borders stay visible under forced-colors: active', async () => {
    const page = await open({ media: { forcedColors: 'active' } });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await page.keyboard.press('Tab');
    const f = await style(page, 'b1', ['outline-style', 'outline-width', 'outline-color']);
    expect(f['outline-style']).toBe('solid');
    expect(Number.parseFloat(f['outline-width'])).toBeGreaterThanOrEqual(2);
    expect(f['outline-color']).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    const i = await style(page, 'in', ['border-top-style', 'border-top-width']);
    expect(i['border-top-style']).toBe('solid');
    expect(Number.parseFloat(i['border-top-width'])).toBeGreaterThan(0);
    // data-active (no DOM focus) is visible as well.
    const o = await style(page, 'o1', ['outline-style', 'outline-width']);
    expect(o['outline-style']).toBe('solid');
    expect(Number.parseFloat(o['outline-width'])).toBeGreaterThanOrEqual(2);
  });

  it('the forced-colors focus indicator changes the rendered pixels', async () => {
    const page = await open({ media: { forcedColors: 'active' } });
    const r = await box(page, 'b1');
    const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab');
    expect(Buffer.compare(before, await page.screenshot({ clip }))).not.toBe(0);
  });
});

describe('reduced motion (ADR-009)', () => {
  const extra =
    '@layer sj.component { [data-part="trigger"] { transition: opacity 300ms ease; animation: spin 2s linear infinite; } } @keyframes spin { to { opacity: 0.5 } }';
  it('collapses motion tokens and a component shorthand when reduced motion is requested', async () => {
    const page = await open({ media: { reducedMotion: 'reduce' } }, extra);
    const s = await style(page, 'b1', [
      'transition-duration',
      'animation-duration',
      'animation-iteration-count',
    ]);
    expect(s).toEqual({
      'transition-duration': '0s',
      'animation-duration': '0s',
      'animation-iteration-count': '1',
    });
    expect((await style(page, 'b1', ['--sj-duration-fast']))['--sj-duration-fast'].trim()).toBe(
      '0s',
    );
  });
  it('keeps motion by default and exposes the tokens', async () => {
    const page = await open({}, extra);
    const s = await style(page, 'b1', [
      'transition-duration',
      'animation-duration',
      '--sj-duration-fast',
    ]);
    expect(s['transition-duration']).toBe('0.3s');
    expect(s['animation-duration']).toBe('2s');
    expect(s['--sj-duration-fast'].trim()).toBe('150ms');
  });
});

describe('logical properties, RTL, viewport, containment', () => {
  it('base sources use no physical directional property (also enforced by sj/logical-properties)', () => {
    for (const f of readdirSync(join(srcDir, 'base'))) {
      postcss.parse(readFileSync(join(srcDir, 'base', f), 'utf8')).walkDecls((d) => {
        expect(d.prop, f).not.toMatch(/(^|-)(left|right)(-|$)|^(top|bottom)$|-(top|bottom)(-|$)/);
      });
    }
  });
  it('text aligns to the start edge in RTL', async () => {
    const page = await b.page(
      {},
      doc({
        css,
        attrs: 'dir="rtl"',
        body: '<div id="t" data-part="x" style="inline-size:200px">x</div>',
      }),
    );
    expect((await style(page, 't', ['text-align']))['text-align']).toBe('start');
    expect(
      await page.evaluate(() => getComputedStyle(document.getElementById('t')).direction),
    ).toBe('rtl');
  });
  it('exposes svh first and dvh for the keyboard viewport', async () => {
    const page = await open();
    const v = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return [
        s.getPropertyValue('--sj-viewport-block-size').trim(),
        s.getPropertyValue('--sj-viewport-block-size-dynamic').trim(),
      ];
    });
    expect(v).toEqual(['100svh', '100dvh']);
  });
  it('contains layout and style on rows and panels but never paint (focus rings are not clipped)', async () => {
    const page = await open();
    const c = (await style(page, 'o1', ['contain']))['contain'];
    expect(c).toContain('layout');
    expect(c).not.toContain('paint');
    for (const f of readdirSync(join(srcDir, 'base'))) {
      postcss.parse(readFileSync(join(srcDir, 'base', f), 'utf8')).walkDecls('contain', (d) => {
        expect(d.value, f).not.toMatch(/paint|content|strict/);
      });
    }
  });
  it('a child ring at the edge of a contained row stays visible', async () => {
    const page = await open(
      {},
      '',
      '<div id="row" data-part="row"><button id="k" data-part="trigger" style="margin:0">k</button></div>',
    );
    const r = await box(page, 'row');
    const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab');
    expect(Buffer.compare(before, await page.screenshot({ clip }))).not.toBe(0);
    // Ring pixels exist outside the row box: compare a strip just outside the row.
    const strip = { x: r.x - 3, y: r.y, width: 2, height: r.height };
    const outside = await page.screenshot({ clip: strip });
    const plain = await (
      await open(
        {},
        '',
        '<div id="row" data-part="row"><button id="k" data-part="trigger">k</button></div>',
      )
    ).screenshot({ clip: strip });
    expect(Buffer.compare(outside, plain)).not.toBe(0);
  });
});

describe('scroll margin', () => {
  it('active items clear sticky bars by the --scroll-margin token', async () => {
    const page = await open();
    expect(
      (await style(page, 'o1', ['scroll-margin-block-start']))['scroll-margin-block-start'],
    ).toBe(`${px(tokens['scroll-margin'])}px`);
  });
});
