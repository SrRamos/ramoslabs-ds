/* global document, getComputedStyle, matchMedia */
// C06.b: SJDisclosure stylesheet. Anatomy against the contract, stylelint (tokens only), native collapse left to the UA,
// chevron state from the native open attribute, text and chevron contrast on every surface, 2.4.13 focus on the summary,
// 44 px target, forced colours, RTL end-side chevron, reduced motion, and disabled. Runs in Chromium via the css helpers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkContrastMatrix, extractLayerUses, loadTokens } from '../../testing/contrast/index.js';
import { checkStylesheets, cssParts } from '../src/_template/generate.mjs';
import { buildReal, doc, launch, srcDir } from './helpers.js';

const tokens = loadTokens();
const px = (rem) => Number.parseFloat(rem) * 16;
const contract = JSON.parse(
  readFileSync(
    new URL('../../contracts/contracts/disclosure.contract.json', import.meta.url),
    'utf8',
  ),
);
const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;
const disclosureCss = readFileSync(join(srcDir, 'disclosure.css'), 'utf8');

/**
 * The disclosure as core emits it: root <details> (class, data-part, data-state, optional open/name), summary trigger,
 * panel div. `long` gives a title that wraps in a narrow column; `disabled` sets the inert state.
 */
function disclosureHtml({ open = false, disabled = false, name = '', long = false } = {}) {
  const title = long
    ? 'A long disclosure title that wraps across several lines in a narrow column so the chevron must stay at the end'
    : 'Shipping details';
  const st = open ? 'open' : 'closed';
  const dis = disabled ? ' data-disabled="true"' : '';
  const nameAttr = name ? ` name="${name}"` : '';
  return `<div style="inline-size:260px">
    <details id="root" class="sj-disclosure__root" data-part="root" data-state="${st}"${open ? ' open' : ''}${nameAttr}${dis}>
      <summary id="trig" class="sj-disclosure__trigger" data-part="trigger" data-state="${st}"${dis}${disabled ? ' aria-disabled="true"' : ''}><span id="title">${title}</span></summary>
      <div id="panel" class="sj-disclosure__content" data-part="content" data-state="${st}"${dis}>Panel body text.</div>
    </details></div>`;
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
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      right: r.right,
      centre: r.x + r.width / 2,
    };
  }, sel);

describe('anatomy and build', () => {
  it('is part of the full build and the per-file output', () => {
    const { outDir, index } = buildReal();
    expect(readFileSync(join(outDir, 'disclosure.css'), 'utf8')).toContain(
      '.sj-disclosure__trigger',
    );
    expect(index).toContain('.sj-disclosure__content');
  });

  it('uses exactly the contract anatomy parts (ADR-002, ADR-009)', () => {
    expect(cssParts('disclosure', disclosureCss).sort()).toEqual(
      contract.anatomy.map((a) => a.part).sort(),
    );
    expect(checkStylesheets(srcDir, realContracts)).toEqual([]);
  });

  it('passes the W1-202 sj stylelint rules (tokens only, logical properties)', async () => {
    const { results } = await stylelint.lint({ files: join(srcDir, 'disclosure.css'), configFile });
    expect(results[0].warnings).toEqual([]);
  });

  it('has no raw colour, px or physical direction in the source', () => {
    expect(disclosureCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(disclosureCss).not.toMatch(/\b\d+(\.\d+)?px\b/);
    expect(disclosureCss).not.toMatch(/(^|[\s;{])(left|right|top|bottom)\s*:/m);
  });
});

describe('native first: the browser still collapses and expands the panel', () => {
  it('a closed panel is hidden and an open one is shown (the stylesheet sets no display on content)', async () => {
    // Chromium collapses the panel through the details slot, so the panel's own display stays `block`; the
    // rendered visibility is what the reader sees.
    const visible = (page) =>
      page.evaluate(() => document.getElementById('panel').checkVisibility());
    const closed = await open(disclosureHtml({ open: false }));
    expect(await visible(closed)).toBe(false);
    const shown = await open(disclosureHtml({ open: true }));
    expect(await visible(shown)).toBe(true);
    expect(disclosureCss).not.toMatch(/\.sj-disclosure__content\s*\{[^}]*\bdisplay\s*:/);
    expect(disclosureCss).not.toMatch(/\.sj-disclosure__root\s*\{[^}]*\bdisplay\s*:/);
  });

  it('the native disclosure triangle is hidden and the summary is a flex row', async () => {
    const page = await open(disclosureHtml());
    const s = await cs(page, '#trig', ['display', 'list-style-type']);
    expect(s['display']).toBe('flex');
    expect(s['list-style-type']).toBe('none');
  });

  it('a native click opens the panel and the chevron turns with it, without any script', async () => {
    const page = await open(disclosureHtml());
    const closedRot = (await cs(page, '#trig', ['rotate'], '::after'))['rotate'];
    await page.click('#trig');
    expect(await page.evaluate(() => document.getElementById('root').open)).toBe(true);
    await page.waitForTimeout(300); // let the 150 ms chevron transition finish before reading the computed value
    const openRot = (await cs(page, '#trig', ['rotate'], '::after'))['rotate'];
    expect(openRot).not.toBe(closedRot);
  });
});

describe('target size and focus (ADR-008, WCAG 2.4.13) on the summary', () => {
  it('the summary is at least the 44 px target', async () => {
    const page = await open(disclosureHtml());
    expect((await rect(page, '#trig')).height).toBeGreaterThanOrEqual(px(tokens['target-min']));
  });

  it('keyboard focus draws the shared ring on the summary', async () => {
    const page = await open(disclosureHtml());
    const r = await rect(page, '#trig');
    const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('trig');
    expect(Buffer.compare(before, await page.screenshot({ clip }))).not.toBe(0);
  });
});

describe('colour pairs on every page surface (WCAG 1.4.3 text 4.5:1, 1.4.11 chevron 3:1)', () => {
  it('the shared contrast matrix reads the text and chevron colours and reports no failure', () => {
    const uses = extractLayerUses(css).filter((u) => u.component === 'disclosure');
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.some((u) => u.part === 'trigger' && /::after/.test(u.selector))).toBe(true);
    expect(uses.some((u) => u.token === 'color-text-disabled')).toBe(false); // inactive: exempt
    const { failures } = checkContrastMatrix(tokens, { css });
    expect(failures.filter((f) => f.id.startsWith('disclosure'))).toEqual([]);
  });

  it('a seeded weak chevron colour (slate 300) fails on every surface', () => {
    const seeded = css.replace(
      /(\.sj-disclosure__trigger::after\s*\{[^}]*?)color:\s*var\(--color-text-secondary\)/,
      '$1color: var(--color-slate-300)',
    );
    expect(seeded).not.toBe(css);
    const f = checkContrastMatrix(tokens, { css: seeded }).failures.filter((x) =>
      x.id.startsWith('disclosure/trigger/component/text-on-'),
    );
    expect(f).toHaveLength(3);
  });
});

describe('open and closed chevron, disabled', () => {
  it('the chevron points down when closed and up when open (distinct rotate values)', async () => {
    const closed = await open(disclosureHtml({ open: false }));
    const open_ = await open(disclosureHtml({ open: true }));
    const c = (await cs(closed, '#trig', ['rotate'], '::after'))['rotate'];
    const o = (await cs(open_, '#trig', ['rotate'], '::after'))['rotate'];
    expect(c).not.toBe(o);
    expect(c).toBe('45deg');
    expect(o).toBe('-135deg');
  });

  it('in RTL the chevron turns the other way, so it still points down when closed and up when open', async () => {
    // The glyph is a logical corner (inline-end + block-end): in RTL it is the bottom-LEFT corner, so the same
    // rotate would point it sideways. The turn flips with the direction (found by the SJDisclosure .f visuals).
    for (const [dir, sign] of [
      ['ltr', 1],
      ['rtl', -1],
    ]) {
      const closed = await open(disclosureHtml({ open: false }), {}, `dir="${dir}"`);
      const open_ = await open(disclosureHtml({ open: true }), {}, `dir="${dir}"`);
      expect((await cs(closed, '#trig', ['rotate'], '::after'))['rotate'], dir).toBe(
        `${45 * sign}deg`,
      );
      expect((await cs(open_, '#trig', ['rotate'], '::after'))['rotate'], dir).toBe(
        `${-135 * sign}deg`,
      );
    }
  });

  it('an rtl island inside an ltr page flips too (the computed direction decides, not the page attribute)', async () => {
    const page = await open(`<div dir="rtl">${disclosureHtml()}</div>`);
    expect((await cs(page, '#trig', ['rotate'], '::after'))['rotate']).toBe('-45deg');
  });

  it('a disabled trigger uses the inactive text colour and the not-allowed cursor', async () => {
    const page = await open(disclosureHtml({ disabled: true }));
    expect((await cs(page, '#trig', ['cursor']))['cursor']).toBe('not-allowed');
    const colour = (await cs(page, '#trig', ['color']))['color'];
    const hex = `#${colour
      .match(/\d+/g)
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`;
    expect(hex).toBe(tokens['color-text-disabled']);
  });
});

describe('forced colours keep the summary text and the chevron visible', () => {
  it('under forced-colors: active the chevron border is a system colour, not transparent', async () => {
    const page = await open(disclosureHtml({ open: false }), { media: { forcedColors: 'active' } });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const border = await cs(
      page,
      '#trig',
      ['border-inline-end-color', 'border-inline-end-style'],
      '::after',
    );
    expect(border['border-inline-end-style']).toBe('solid');
    expect(border['border-inline-end-color']).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

  it('a seeded chevron with no border style is caught by the forced-colours check', async () => {
    // Forced colours overrides author border colours, so the seed removes the style, which the check reads.
    const seeded = disclosureCss.replace(
      'border-inline-end: calc(var(--border-width-hairline) * 2) solid currentColor;',
      'border-inline-end: 0 none currentColor;',
    );
    expect(seeded).not.toBe(disclosureCss);
    const page = await open(
      disclosureHtml({ open: false }),
      { media: { forcedColors: 'active' } },
      '',
      seeded,
    );
    const border = await cs(page, '#trig', ['border-inline-end-style'], '::after');
    expect(border['border-inline-end-style']).not.toBe('solid');
  });
});

describe('RTL: the chevron sits at the inline end in both directions', () => {
  it('the title is at the start edge and the chevron at the end, mirrored in RTL', async () => {
    // Summary is a space-between flex row: the title takes the start edge, the chevron (a flex item) the end edge.
    const ltr = await open(disclosureHtml());
    const ltrTitle = await rect(ltr, '#title');
    const ltrSummary = await rect(ltr, '#trig');
    expect(ltrTitle.x - ltrSummary.x).toBeLessThan(ltrSummary.right - ltrTitle.right);
    const rtl = await open(disclosureHtml(), {}, 'dir="rtl"');
    const rtlTitle = await rect(rtl, '#title');
    const rtlSummary = await rect(rtl, '#trig');
    expect(rtlSummary.right - rtlTitle.right).toBeLessThan(rtlTitle.x - rtlSummary.x);
  });

  it('the long title wraps onto several lines and stays inside the summary', async () => {
    const page = await open(disclosureHtml({ long: true }));
    const title = await rect(page, '#title');
    const summary = await rect(page, '#trig');
    expect(title.height).toBeGreaterThan(px(tokens['font-size-base']) * 1.5);
    expect(title.right).toBeLessThanOrEqual(summary.right);
    expect(title.x).toBeGreaterThanOrEqual(summary.x);
  });
});

describe('exclusive groups look the same as plain disclosures', () => {
  it('a name group renders pixel-identical to the same group without name (no CSS keyed on name)', async () => {
    expect(disclosureCss).not.toMatch(/\[name/);
    const plain = await open(`${disclosureHtml()}${disclosureHtml()}`);
    const grouped = await open(
      `${disclosureHtml({ name: 'faq' })}${disclosureHtml({ name: 'faq' })}`,
    );
    const r = await rect(plain, '#trig');
    const clip = { x: r.x - 4, y: r.y - 4, width: 300, height: 120 };
    expect(
      Buffer.compare(await plain.screenshot({ clip }), await grouped.screenshot({ clip })),
    ).toBe(0);
  });
});

describe('reduced motion (ADR-009)', () => {
  it('the chevron transition uses the motion token', async () => {
    const page = await open(disclosureHtml());
    expect(
      (await cs(page, '#trig', ['transition-duration'], '::after'))['transition-duration'],
    ).toBe('0.15s');
  });

  it('reduced motion collapses the chevron transition to 0s', async () => {
    const page = await open(disclosureHtml(), { media: { reducedMotion: 'reduce' } });
    expect(
      (await cs(page, '#trig', ['transition-duration'], '::after'))['transition-duration'],
    ).toBe('0s');
  });

  it('the chevron transitions both rotate and translate, so the glyph does not hop mid-turn', async () => {
    const page = await open(disclosureHtml({ open: true }));
    const props = (await cs(page, '#trig', ['transition-property'], '::after'))[
      'transition-property'
    ];
    expect(props.split(',').map((s) => s.trim())).toEqual(['rotate', 'translate']);
  });

  it('reduced motion also stops the translate part of the chevron (duration 0s covers both properties)', async () => {
    const page = await open(disclosureHtml({ open: true }), { media: { reducedMotion: 'reduce' } });
    const t = await cs(page, '#trig', ['transition-duration', 'transition-property'], '::after');
    expect(t['transition-duration']).toBe('0s');
    expect(t['transition-property']).toContain('translate');
  });
});

describe('content part and forced-colour disabled state (review NICE items)', () => {
  it('the content part has a token block-start padding', async () => {
    const page = await open(disclosureHtml({ open: true }));
    const pad = (await cs(page, '#panel', ['padding-block-start']))['padding-block-start'];
    expect(pad).toBe(`${px(tokens['space-2'])}px`);
  });

  it('under forced colours a disabled trigger uses the system GrayText colour', async () => {
    const page = await open(disclosureHtml({ disabled: true }), {
      media: { forcedColors: 'active' },
    });
    const got = (await cs(page, '#trig', ['color']))['color'];
    const gray = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'GrayText';
      document.body.appendChild(probe);
      return getComputedStyle(probe).color;
    });
    expect(got).toBe(gray);
  });

  it('a seeded removal of the forced-colours disabled rule is caught', async () => {
    const seeded = disclosureCss.replace(
      /\.sj-disclosure__trigger\[data-disabled\]:not\(\[data-disabled='false'\]\)::after \{\s*border-color: GrayText;\s*\}/,
      '',
    );
    expect(seeded).not.toBe(disclosureCss);
    const page = await open(
      disclosureHtml({ disabled: true }),
      { media: { forcedColors: 'active' } },
      '',
      seeded,
    );
    const got = (await cs(page, '#trig', ['color']))['color'];
    const gray = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'GrayText';
      document.body.appendChild(probe);
      return getComputedStyle(probe).color;
    });
    // The seed removes only the ::after GrayText border rule. The trigger text keeps GrayText from the shared rule,
    // so the chevron border is what must differ from GrayText.
    const border = await cs(page, '#trig', ['border-inline-end-color'], '::after');
    expect(border['border-inline-end-color']).not.toBe(gray);
    expect(got).toBe(gray);
  });
});
