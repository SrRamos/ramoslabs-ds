/* global document, getComputedStyle, matchMedia */
// C11.b: SJState stylesheet. Anatomy against the contract, stylelint (tokens only), text and icon contrast on every
// page surface (WCAG 1.4.3 and 1.4.11), one rule set per empty kind and per live kind, forced-colors and RTL fixtures,
// and no animation under prefers-reduced-motion. Runs in Chromium through the shared css helpers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkContrastMatrix, extractLayerUses, loadTokens } from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const contract = JSON.parse(
  readFileSync(new URL('../../contracts/contracts/state.contract.json', import.meta.url), 'utf8'),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const stateCss = readFileSync(join(srcDir, 'state.css'), 'utf8');
const VARIANTS = ['first-use', 'no-results', 'cleared', 'loading', 'error'];

/** A state root as core emits it, one per variant: root, icon (aria-hidden), title, description and actions. */
function stateHtml({ variant = 'first-use', spinner = false, withActions = true } = {}) {
  const glyph = spinner
    ? `<span class="sj-icon" data-spin="true" style="display:block;inline-size:24px;block-size:24px;border:3px solid currentColor;border-block-start-color:transparent;border-radius:50%"></span>`
    : `<span class="sj-icon" style="display:block;inline-size:24px;block-size:24px;background:currentColor;border-radius:4px"></span>`;
  return `<div id="root" class="sj-state" data-part="root" data-variant="${variant}"${variant === 'loading' ? ' aria-busy="true"' : ''}>
    <span id="icon" class="sj-state__icon" data-part="icon" data-variant="${variant}" aria-hidden="true">${glyph}</span>
    <p id="title" class="sj-state__title" data-part="title" data-variant="${variant}">Title for ${variant}</p>
    <p id="desc" class="sj-state__description" data-part="description" data-variant="${variant}">Supporting copy for ${variant}</p>
    ${withActions ? `<div id="actions" class="sj-state__actions" data-part="actions" data-variant="${variant}"><button type="button">Next step</button></div>` : ''}
  </div>`;
}

const hexOf = (rgb) =>
  `#${rgb
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

let b;
let css;
beforeAll(async () => {
  b = await launch();
  css = buildReal().index;
});
afterAll(() => b.browser.close());

const open = (body, opts = {}, attrs = '', sheet = css, extra = '') =>
  b.page(opts, doc({ css: sheet, extra, body, attrs }));

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
    return { x: r.x, y: r.y, width: r.width, height: r.height, centre: r.x + r.width / 2 };
  }, sel);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(readFileSync(join(outDir, 'state.css'), 'utf8')).toContain('.sj-state__icon');
    expect(index).toContain('.sj-state__title');
  });

  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('state', stateCss).sort()).toEqual(contract.anatomy.map((a) => a.part).sort());
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules (tokens only, logical properties)', async () => {
    const { results } = await stylelint.lint({ files: join(srcDir, 'state.css'), configFile });
    expect(results[0].warnings).toEqual([]);
  });

  it('has no raw colour, px or physical direction in the source', () => {
    expect(stateCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(stateCss).not.toMatch(/\b\d+(\.\d+)?px\b/);
    expect(stateCss).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
  });
});

describe('contrast on every page surface (shared matrix: text and glyph at 4.5:1, WCAG 1.4.3 and 1.4.11)', () => {
  it('the shared contrast matrix reports no failure for a state id', () => {
    const { failures } = checkContrastMatrix(tokens, { css });
    expect(failures.filter((f) => f.id.startsWith('state'))).toEqual([]);
  });

  it('the shared pass reads the state colours (title, description, root, every glyph kind)', () => {
    const uses = extractLayerUses(css).filter((u) => u.component === 'state');
    expect(uses.map((u) => u.part)).toEqual(
      expect.arrayContaining(['root', 'title', 'description', 'icon']),
    );
    for (const theme of ['light', 'dark'])
      expect(uses.filter((u) => u.part === 'icon' && u.theme === theme)).toHaveLength(
        VARIANTS.length,
      );
  });
});

describe('one rule set per variant, and every variant renders its text', () => {
  it('each variant paints its glyph with its own token and renders a non-empty title', async () => {
    const expected = {
      'first-use': 'color-primary',
      'no-results': 'color-text-secondary',
      cleared: 'color-text-muted',
      loading: 'color-primary',
      error: 'color-error-text',
    };
    for (const variant of VARIANTS) {
      const page = await open(stateHtml({ variant }));
      const glyph = await cs(page, '#icon', ['color']);
      expect(hexOf(glyph.color), variant).toBe(tokens[expected[variant]]);
      const title = await page.evaluate(() => document.getElementById('title').textContent.trim());
      expect(title).not.toBe('');
      expect((await rect(page, '#title')).height).toBeGreaterThan(0);
    }
  });

  it('the three empty kinds keep distinct variant hooks (no kind falls back to another)', async () => {
    const page = await open(stateHtml({ variant: 'no-results' }));
    const kinds = await page.evaluate(() =>
      ['first-use', 'no-results', 'cleared'].map(
        (v) => document.querySelector(`.sj-state__icon[data-variant='${v}']`) !== null,
      ),
    );
    expect(kinds).toEqual([false, true, false]);
  });

  it('the icon slot is aria-hidden and sized, so the kind is carried by text as well as the glyph', async () => {
    const page = await open(stateHtml({ variant: 'error' }));
    const icon = await page.evaluate(() => {
      const el = document.getElementById('icon');
      return { hidden: el.getAttribute('aria-hidden'), w: el.getBoundingClientRect().width };
    });
    expect(icon.hidden).toBe('true');
    expect(icon.w).toBeGreaterThan(0);
  });
});

describe('forced colours keep the text and the glyph visible', () => {
  it('under forced-colors: active every variant still has a visible title and glyph', async () => {
    for (const variant of VARIANTS) {
      const page = await open(stateHtml({ variant }), { media: { forcedColors: 'active' } });
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      const title = await cs(page, '#title', ['color']);
      expect(title.color, variant).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect((await rect(page, '#icon')).width, variant).toBeGreaterThan(0);
    }
  });

  it('the glyph shape, not the colour, tells the kinds apart under forced colours', async () => {
    const page = await open(stateHtml({ variant: 'loading', spinner: true }), {
      media: { forcedColors: 'active' },
    });
    const r = await rect(page, '#icon');
    const clip = { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 };
    const spinner = await page.screenshot({ clip });
    await page.evaluate(() => {
      document.querySelector('#icon .sj-icon').outerHTML =
        '<span class="sj-icon" style="display:block;inline-size:24px;block-size:24px;background:currentColor"></span>';
    });
    expect(Buffer.compare(spinner, await page.screenshot({ clip }))).not.toBe(0);
  });
});

describe('RTL geometry (logical properties, symmetric centring)', () => {
  it('LTR and RTL both centre the title and the glyph in the root', async () => {
    for (const attrs of ['', 'dir="rtl"']) {
      const page = await open(stateHtml({ variant: 'no-results' }), {}, attrs);
      const root = await rect(page, '#root');
      const title = await rect(page, '#title');
      const icon = await rect(page, '#icon');
      expect(Math.abs(title.centre - (root.x + root.width / 2)), attrs || 'ltr').toBeLessThan(1);
      expect(Math.abs(icon.centre - (root.x + root.width / 2)), attrs || 'ltr').toBeLessThan(1);
    }
  });
});

describe('reduced motion: a loading spinner is static', () => {
  // A plain spinner, as an SJIcon with data-spin renders it. Its animation sits in sj.component, so the
  // sj.state rule in state.css is what removes it (and the test does not depend on icon.css).
  const spin = `@layer sj.component { .sj-icon[data-spin] { animation: sj-test-spin 1s linear infinite; } }
    @keyframes sj-test-spin { to { rotate: 360deg; } }`;

  it('the spinner animates without reduced motion', async () => {
    const page = await open(
      stateHtml({ variant: 'loading', spinner: true }),
      {},
      '',
      stateCss,
      spin,
    );
    const name = (await cs(page, '#icon .sj-icon', ['animation-name']))['animation-name'];
    expect(name).toBe('sj-test-spin');
  });

  it('under prefers-reduced-motion the loading spinner has no animation', async () => {
    const page = await open(
      stateHtml({ variant: 'loading', spinner: true }),
      { media: { reducedMotion: 'reduce' } },
      '',
      stateCss,
      spin,
    );
    const name = (await cs(page, '#icon .sj-icon', ['animation-name']))['animation-name'];
    expect(name).toBe('none');
  });

  it('a seeded removal of the reduced-motion rule leaves the spinner animating', async () => {
    const seeded = stateCss.replace(
      'animation: none;',
      'animation: sj-test-spin 1s linear infinite;',
    );
    expect(seeded).not.toBe(stateCss);
    const page = await open(
      stateHtml({ variant: 'loading', spinner: true }),
      { media: { reducedMotion: 'reduce' } },
      '',
      seeded,
      spin,
    );
    const name = (await cs(page, '#icon .sj-icon', ['animation-name']))['animation-name'];
    expect(name).toBe('sj-test-spin');
  });
});
