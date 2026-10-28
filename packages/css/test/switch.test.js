/* global document, getComputedStyle, matchMedia */
// C03s.b: SJSwitch stylesheet. Anatomy against the contract, stylelint, drawn-pair contrast (WCAG 1.4.11),
// 2.4.13 focus, 44 px target with the 24 px floor (ADR-008), forced-colors visibility, RTL geometry and
// reduced motion (ADR-009). Runs in Chromium through the shared css helpers.
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
  readFileSync(new URL('../../contracts/contracts/switch.contract.json', import.meta.url), 'utf8'),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const switchCss = readFileSync(join(srcDir, 'switch.css'), 'utf8');

/** A native switch as the adapters render it: label root, real checkbox, thumb span. */
function switchHtml({ state = 'off', disabled = false, density = '', label = 'Wi-Fi' } = {}) {
  const attr = disabled ? ' data-disabled="true"' : '';
  const checked = state === 'on' ? ' checked' : '';
  const inner = `<label id="root" class="sj-switch__root" data-part="root" data-state="${state}"${attr}>
    <input id="ctl" class="sj-switch__control" type="checkbox" role="switch" data-part="control" data-state="${state}"${attr}${checked}${disabled ? ' disabled' : ''}>
    <span id="thumb" class="sj-switch__thumb" data-part="thumb" data-state="${state}"${attr}></span>
    ${label}</label>`;
  return density ? `<div data-density="${density}">${inner}</div>` : inner;
}

const hexOf = (rgb) =>
  `#${rgb
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

/** Parses `rgb(..) 0px 0px 0px 2px, ...` into [{ color, spread }] (same shape as base.test.js). */
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

const open = (body, opts = {}, attrs = '') => b.page(opts, doc({ css, body, attrs }));

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

const setState = (page, state) =>
  page.evaluate((s) => {
    const root = document.getElementById('root');
    const ctl = document.getElementById('ctl');
    for (const el of [root, ctl, document.getElementById('thumb')]) el.dataset.state = s;
    ctl.checked = s === 'on';
  }, state);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(existsSync(join(outDir, 'switch.css'))).toBe(true);
    expect(index).toContain('.sj-switch__thumb');
  });

  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('switch', switchCss).sort()).toEqual(
      contract.anatomy.map((a) => a.part).sort(),
    );
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules', async () => {
    const { results } = await stylelint.lint({
      files: join(srcDir, 'switch.css'),
      configFile,
    });
    expect(results[0].warnings).toEqual([]);
  });

  it('exposes the native checkbox as the real control with role switch', async () => {
    const page = await open(switchHtml());
    const c = await page.evaluate(() => {
      const el = document.getElementById('ctl');
      return { type: el.type, role: el.getAttribute('role'), tag: el.tagName };
    });
    expect(c).toEqual({ type: 'checkbox', role: 'switch', tag: 'INPUT' });
  });
});

describe('target size (ADR-008: 44 px, 24 px floor)', () => {
  it('the input hit area and the label are at least the 44 px token on fine pointers', async () => {
    const page = await open(switchHtml());
    const min = px(tokens['target-min']);
    expect(min).toBe(44);
    const input = await rect(page, '#ctl');
    expect(input.width).toBeGreaterThanOrEqual(min);
    expect(input.height).toBeGreaterThanOrEqual(min);
    expect((await rect(page, '#root')).height).toBeGreaterThanOrEqual(min);
  });

  it('compact density drops to the 24 px floor on fine pointers only', async () => {
    const fine = await open(switchHtml({ density: 'compact' }));
    const floor = px(tokens['target-floor']);
    expect(floor).toBe(24);
    expect((await rect(fine, '#ctl')).height).toBe(floor);
    const coarse = await b.page(
      { hasTouch: true, isMobile: true },
      doc({ css, body: switchHtml({ density: 'compact' }) }),
    );
    expect((await rect(coarse, '#ctl')).height).toBe(px(tokens['target-min']));
  });

  it('on a wrapping label the input stays centred on the track and contains it (G3A MUST-3)', async () => {
    const long =
      'Send me a notification whenever someone replies to a thread that I started or follow, including mentions and reactions from the whole team';
    const page = await open(`<div style="inline-size:180px">${switchHtml({ label: long })}</div>`);
    const root = await rect(page, '#root');
    const input = await rect(page, '#ctl');
    const track = await page.evaluate(() => {
      const r = document.getElementById('root');
      const cs = getComputedStyle(r, '::before');
      const rr = r.getBoundingClientRect();
      const top = rr.y + rr.height / 2; // track is centred on the root block axis
      return { y: top - Number.parseFloat(cs.height) / 2, height: Number.parseFloat(cs.height) };
    });
    expect(root.height).toBeGreaterThan(px(tokens['target-min']) * 2); // the label really wrapped
    expect(input.y).toBeLessThanOrEqual(track.y);
    expect(input.y + input.height).toBeGreaterThanOrEqual(track.y + track.height);
    const thumb = await rect(page, '#thumb');
    expect(input.y).toBeLessThanOrEqual(thumb.y);
    expect(input.y + input.height).toBeGreaterThanOrEqual(thumb.y + thumb.height);
  });

  it('the native input is reachable with Tab and clicking the label toggles it', async () => {
    const page = await open(switchHtml());
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('ctl');
    await page.click('#root');
    expect(await page.evaluate(() => document.getElementById('ctl').checked)).toBe(true);
  });
});

describe('drawn colour pairs (WCAG 1.4.11, 3:1)', () => {
  // G3A SHOULD-2: the track-on-page pairs come from the built CSS through the extractor, on every surface.
  it('the track meets 3:1 on every surface, read from the built css (not in-test literals)', () => {
    const { pairs, failures } = checkContrastMatrix(tokens, { css });
    const track = pairs.filter((p) => p.id.startsWith('switch/root::before/'));
    expect(track.map((p) => p.id).sort()).toEqual(
      ['off', 'on']
        .flatMap((st) =>
          ['color-background', 'color-surface', 'color-surface-secondary'].map(
            (sf) => `switch/root::before/${st}/ui-on-${sf}`,
          ),
        )
        .sort(),
    );
    expect(track.every((p) => p.min === 3 && p.pass)).toBe(true);
    expect(failures.filter((f) => f.id.startsWith('switch/'))).toEqual([]);
  });

  it('a seeded weak off-track fill fails the extractor pairs', () => {
    const weak = css.replace(
      /(\.sj-switch__root\[data-state='off'\]::before\s*\{\s*background-color:\s*)var\(--color-slate-500\)/,
      '$1var(--color-slate-300)',
    );
    expect(weak).not.toBe(css);
    const { failures } = checkContrastMatrix(tokens, { css: weak });
    expect(failures.some((f) => f.id.startsWith('switch/root::before/off/ui-on-'))).toBe(true);
  });

  it('track, knob and their boundary meet 3:1 and use the token colours', async () => {
    const off = await open(switchHtml({ state: 'off' }));
    const trackOff = hexOf(
      (await cs(off, '#root', ['background-color'], '::before'))['background-color'],
    );
    const knobOff = hexOf((await cs(off, '#thumb', ['background-color']))['background-color']);
    expect(trackOff).toBe(tokens['color-slate-500']);
    expect(knobOff).toBe(tokens['color-white']);
    expect(contrastRatio(knobOff, trackOff)).toBeGreaterThanOrEqual(3);

    const on = await open(switchHtml({ state: 'on' }));
    const trackOn = hexOf(
      (await cs(on, '#root', ['background-color'], '::before'))['background-color'],
    );
    expect(trackOn).toBe(tokens['color-primary']);
    const knobOn = hexOf((await cs(on, '#thumb', ['background-color']))['background-color']);
    expect(contrastRatio(knobOn, trackOn)).toBeGreaterThanOrEqual(3);
  });
});

describe('focus indicator (WCAG 2.4.7, 2.4.13) on the switch', () => {
  it('keyboard focus draws the shared two-tone ring on the input', async () => {
    const page = await open(switchHtml());
    await page.keyboard.press('Tab');
    const s = await cs(page, '#ctl', ['box-shadow']);
    const [gap, edge] = shadows(s['box-shadow']);
    expect(gap.spread).toBe(px(tokens['focus-ring-offset']));
    expect(edge.spread - gap.spread).toBeGreaterThanOrEqual(px(tokens['focus-ring-width']));
  });

  it('the ring is visible in pixels around the switch', async () => {
    const page = await open(switchHtml());
    const r = await rect(page, '#root');
    const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab');
    expect(Buffer.compare(before, await page.screenshot({ clip }))).not.toBe(0);
  });
});

describe('forced colors keeps the track and knob visible', () => {
  it('track and knob carry a solid system-colour border under forced-colors: active', async () => {
    const page = await open(switchHtml({ state: 'on' }), { media: { forcedColors: 'active' } });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const track = await cs(
      page,
      '#root',
      ['border-top-style', 'border-top-width', 'border-top-color'],
      '::before',
    );
    expect(track['border-top-style']).toBe('solid');
    expect(Number.parseFloat(track['border-top-width'])).toBeGreaterThanOrEqual(1);
    expect(track['border-top-color']).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    const knob = await cs(page, '#thumb', ['border-top-style', 'border-top-width']);
    expect(knob['border-top-style']).toBe('solid');
    expect(Number.parseFloat(knob['border-top-width'])).toBeGreaterThanOrEqual(1);
    const k = await rect(page, '#thumb');
    expect(k.width).toBeGreaterThan(0);
  });

  it('the knob moves in forced colors, so the state is visible without background colour', async () => {
    const page = await open(switchHtml({ state: 'off' }), { media: { forcedColors: 'active' } });
    const r = await rect(page, '#root');
    const clip = { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 };
    const off = await page.screenshot({ clip });
    await setState(page, 'on');
    expect(Buffer.compare(off, await page.screenshot({ clip }))).not.toBe(0);
  });

  it('the focus indicator stays visible under forced colors', async () => {
    const page = await open(switchHtml(), { media: { forcedColors: 'active' } });
    await page.keyboard.press('Tab');
    const f = await cs(page, '#ctl', ['outline-style', 'outline-width']);
    expect(f['outline-style']).toBe('solid');
    expect(Number.parseFloat(f['outline-width'])).toBeGreaterThanOrEqual(2);
  });
});

describe('RTL geometry (logical properties)', () => {
  // Knob offset from the track's start edge: off = space-1, on = track - knob + space-1 (24 px).
  const offOff = px(tokens['space-1']);
  const onOff = px(tokens['target-min']) - px(tokens['target-floor']) + px(tokens['space-1']);

  it('LTR: the knob sits 4 px in from the left when off and 24 px in when on', async () => {
    for (const [state, expected] of [
      ['off', offOff],
      ['on', onOff],
    ]) {
      const page = await open(switchHtml({ state }));
      const root = await rect(page, '#root');
      const knob = await rect(page, '#thumb');
      expect(knob.x - root.x).toBeCloseTo(expected, 1);
    }
  });

  it('RTL: the same offsets mirror from the right edge, and the input sits at the start (right) edge', async () => {
    for (const [state, expected] of [
      ['off', offOff],
      ['on', onOff],
    ]) {
      const page = await open(switchHtml({ state }), {}, 'dir="rtl"');
      const root = await rect(page, '#root');
      const knob = await rect(page, '#thumb');
      const input = await rect(page, '#ctl');
      expect(root.right - knob.right).toBeCloseTo(expected, 1);
      expect(root.right - input.right).toBeCloseTo(0, 1);
    }
  });

  it('the stylesheet uses no physical directional property', () => {
    expect(switchCss).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
    expect(switchCss).not.toMatch(
      /margin-(left|right)|padding-(left|right)|(min|max)-(width|height)/,
    );
  });
});

describe('reduced motion (ADR-009)', () => {
  it('the knob and track transitions use the motion token', async () => {
    const page = await open(switchHtml());
    const s = await cs(page, '#thumb', ['transition-duration']);
    expect(s['transition-duration']).toBe('0.15s');
  });

  it('reduced motion collapses the knob and track transitions to 0s', async () => {
    const page = await open(switchHtml(), { media: { reducedMotion: 'reduce' } });
    expect((await cs(page, '#thumb', ['transition-duration']))['transition-duration']).toBe('0s');
    expect(
      (await cs(page, '#root', ['transition-duration'], '::before'))['transition-duration'],
    ).toBe('0s');
  });
});

describe('disabled state', () => {
  it('a disabled switch uses the disabled track colour and the not-allowed cursor', async () => {
    const page = await open(switchHtml({ disabled: true }));
    const track = await cs(page, '#root', ['background-color'], '::before');
    expect(hexOf(track['background-color'])).toBe(tokens['color-slate-300']);
    expect((await cs(page, '#root', ['cursor']))['cursor']).toBe('not-allowed');
  });
});
