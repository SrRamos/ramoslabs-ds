// L3 automated accessibility for SJState (W1-C11.f, ADR-013 L3): axe in every fixture on every adapter and engine
// (zero untriaged violations, zero untriaged `incomplete`), WCAG 1.4.3 / 1.4.11 contrast of the text and the glyph
// per variant, 2.5.8 target size and 2.4.13 focus appearance of the action (the only control; the state itself is
// never a target), 1.4.1 no meaning by colour alone (forced colors: the text stays and the glyph shape differs per
// kind), RTL. Every gate also has a SEEDED failing case. Reuses the L3 verdicts (packages/testing/a11y) and the
// contrast module.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyAxeTriage,
  focusAppearance,
  parseCssColor,
  targetSize,
  validateTriage,
  type Triage,
} from '../../a11y/verdicts.js';
import { collectFocusAppearance, collectTargets } from '../../a11y/collectors.js';
import { contrastRatio } from '../../contrast/index.js';
import { FIXTURES, VARIANT_FIXTURES } from './fixtures';
import { ADAPTERS } from './matrix';
import { mountState, openHost, part, root } from './open';

const here = dirname(fileURLToPath(import.meta.url));
// The shared triage list is the only one (G3A ruling (c)): every entry needs an issue and an owner.
const triage: Triage = JSON.parse(
  readFileSync(join(here, '..', '..', 'a11y', 'triage.json'), 'utf8'),
);
const FIXTURE_NAMES = Object.keys(FIXTURES);

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .include('#root')
    .options({ rules: { 'target-size': { enabled: true } } });

async function mount(page: Page, adapter: (typeof ADAPTERS)[number], fixture: string) {
  const errors = await openHost(page);
  await mountState(page, adapter, fixture, 'native');
  return errors;
}

/** Keyboard modality so :focus-visible applies (WebKit skips some controls on Tab; focus after one Tab). */
async function focusAction(page: Page, browserName: string): Promise<void> {
  await page.keyboard.press('Tab');
  const button = part(page, 'actions').locator('button');
  if (browserName === 'webkit') await button.focus();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
}

test('@pr triage file is valid: every entry names an issue and an owner', () => {
  expect(validateTriage(triage)).toEqual([]);
});

for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES) {
    test(`@pr axe | state ${adapter} | ${fixture} | zero untriaged violations`, async ({
      page,
    }) => {
      const errors = await mount(page, adapter, fixture);
      const results = await axe(page).analyze();
      const name = `state-${fixture}`;
      expect(
        applyAxeTriage(results.violations, name, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      // `incomplete` is an unreviewed finding: it fails unless triaged with reviewed: "pass", an issue and an owner.
      const open = applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged;
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test(`@pr axe | state ${adapter} | seeded: a focusable decorative icon is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'error');
    await part(page, 'icon').evaluate((n) => n.setAttribute('tabindex', '0'));
    const results = await axe(page).analyze();
    expect(results.violations.map((v) => v.id)).toContain('aria-hidden-focus');
  });

  test(`@pr axe | state ${adapter} | seeded: a low-contrast description is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'error');
    await part(page, 'description').evaluate((n) => {
      (n as HTMLElement).style.color = '#cbd5e1';
    });
    const results = await axe(page).analyze();
    expect(results.violations.map((v) => v.id)).toContain('color-contrast');
  });
}

// ---- 1.4.3 / 1.4.11 contrast per variant, measured in the browser ---------------------------------------------

async function colours(page: Page) {
  return page.evaluate(() => {
    const color = (sel: string, prop: 'color' | 'stroke') => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : null;
    };
    return {
      title: color('[data-part="title"]', 'color'),
      description: color('[data-part="description"]', 'color'),
      stroke: color('[data-part="icon"] svg > *', 'stroke'),
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
}
const hexOf = (css: string | null): string => {
  const c = css ? parseCssColor(css) : null;
  expect(c, String(css)).not.toBeNull();
  return c!.hex;
};

for (const adapter of ADAPTERS) {
  for (const fixture of VARIANT_FIXTURES) {
    test(`@pr 1.4.3 + 1.4.11 | state ${adapter} | ${fixture} | text >= 4.5:1, glyph >= 3:1 on the page background`, async ({
      page,
    }) => {
      await mount(page, adapter, fixture);
      const c = await colours(page);
      const bg = /rgba\(.*, 0\)$/.test(c.page) ? '#ffffff' : hexOf(c.page);
      expect(contrastRatio(hexOf(c.title), bg), 'title').toBeGreaterThanOrEqual(4.5);
      if (c.description)
        expect(contrastRatio(hexOf(c.description), bg), 'description').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hexOf(c.stroke), bg), 'glyph').toBeGreaterThanOrEqual(3);
    });
  }

  test(`@pr 1.4.3 | state ${adapter} | seeded: slate-300 text on the page background is reported (< 4.5:1)`, async ({
    page,
  }) => {
    await mount(page, adapter, 'error');
    await part(page, 'title').evaluate(
      (n) => ((n as HTMLElement).style.color = 'var(--color-slate-300)'),
    );
    const c = await colours(page);
    expect(contrastRatio(hexOf(c.title), '#ffffff')).toBeLessThan(4.5);
  });
}

// ---- 2.5.8 target size and 2.4.13 focus appearance: the action is the only control -----------------------------

for (const adapter of ADAPTERS) {
  test(`@pr 2.5.8 | state ${adapter} | the action is the only target and is at least 24px (design target 44px); the state is not a target`, async ({
    page,
  }) => {
    await mount(page, adapter, 'first-use');
    const targets = await page.evaluate(collectTargets);
    expect(targets).toHaveLength(1);
    expect(targetSize(targets, triage.targetSize, 'state').failures).toEqual([]);
    const box = (await part(page, 'actions').locator('button').boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    // Without an action the state offers no target at all.
    await mountState(page, adapter, 'loading');
    expect(await page.evaluate(collectTargets)).toEqual([]);
  });

  test(`@pr 2.4.13 | state ${adapter} | the action's focus ring is >= 2px and >= 3:1`, async ({
    page,
    browserName,
  }) => {
    await mount(page, adapter, 'first-use');
    await focusAction(page, browserName);
    expect(focusAppearance(await page.evaluate(collectFocusAppearance)).failures).toEqual([]);
  });
}

// ---- forced colors (ADR-009) and 1.4.1: the kind is carried by text and glyph shape, never colour alone ---------

const measureForced = (page: Page) =>
  page.evaluate(() => {
    const cs = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el) : null;
    };
    const title = cs('[data-part="title"]')!;
    const svg = cs('[data-part="icon"] svg')!;
    const path = cs('[data-part="icon"] svg > *')!;
    return {
      forced: matchMedia('(forced-colors: active)').matches,
      titleColor: title.color,
      titleAdjust: title.forcedColorAdjust,
      titleVisible: title.visibility !== 'hidden' && title.display !== 'none',
      stroke: path.stroke,
      svgColor: svg.color,
      canvas: getComputedStyle(document.body).backgroundColor,
    };
  });

/** Verdict over one measurement; empty means the text and the glyph follow the system palette and stay visible. */
function forcedProblems(m: Awaited<ReturnType<typeof measureForced>>): string[] {
  const out: string[] = [];
  if (!m.forced) out.push('forced colors not active');
  if (!m.titleVisible) out.push('title is not visible');
  if (m.titleAdjust === 'none')
    out.push('forced-color-adjust: none opts the title out of the system palette');
  const t = parseCssColor(m.titleColor);
  const s = parseCssColor(m.stroke);
  const c = parseCssColor(m.canvas);
  if (!t || !c || contrastRatio(t.hex, c.hex) < 4.5)
    out.push(`title ${m.titleColor} on ${m.canvas} < 4.5:1`);
  if (m.stroke === 'none' || !s || !c || contrastRatio(s.hex, c.hex) < 3)
    out.push(`glyph ${m.stroke} on ${m.canvas} < 3:1`);
  return out;
}

/** The drawn shape of the icon part: the path data of every node, joined. */
const glyphShape = (page: Page) =>
  part(page, 'icon').evaluate((n) =>
    [...n.querySelectorAll('svg > *')].map((e) => e.getAttribute('d') ?? e.outerHTML).join('|'),
  );

for (const adapter of ADAPTERS) {
  for (const fixture of VARIANT_FIXTURES) {
    test(`@pr forced-colors | state ${adapter} | ${fixture} | text and glyph follow the system palette and stay visible`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await mount(page, adapter, fixture);
      expect(forcedProblems(await measureForced(page))).toEqual([]);
    });
  }

  test(`@pr 1.4.1 | state ${adapter} | the kind is carried by text and glyph shape, not colour: five variants render distinct text and distinct glyphs under forced colors`, async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openHost(page);
    const texts: string[] = [];
    const shapes: string[] = [];
    for (const fixture of VARIANT_FIXTURES) {
      await mountState(page, adapter, fixture);
      texts.push((await part(page, 'title').textContent()) ?? '');
      shapes.push(await glyphShape(page));
    }
    for (const t of texts) expect(t.trim().length).toBeGreaterThan(0);
    expect(new Set(texts).size).toBe(5);
    // first-use (folder), no-results (search), cleared (trash), loading (spinner), error (alert): all different.
    expect(new Set(shapes).size).toBe(5);
  });

  test(`@pr forced-colors | state ${adapter} | seeded: opting out with forced-color-adjust none and white text is reported`, async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await mount(page, adapter, 'error');
    await part(page, 'title').evaluate((n) => {
      (n as HTMLElement).style.forcedColorAdjust = 'none';
      (n as HTMLElement).style.color = 'rgb(255, 255, 255)';
    });
    // WebKit does not implement `forced-color-adjust`, so only the contrast verdict is common to the engines.
    expect(forcedProblems(await measureForced(page)).length).toBeGreaterThan(0);
  });
}

// ---- RTL: axe in a right-to-left document, and the content stays centred --------------------------------------

for (const adapter of ADAPTERS) {
  test(`@pr rtl | state ${adapter} | a dir=rtl document: axe clean, title and glyph centred`, async ({
    page,
  }) => {
    for (const fixture of ['error', 'no-results']) {
      const errors = await mount(page, adapter, fixture);
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      const results = await axe(page).analyze();
      const name = `state-${fixture}`;
      expect(applyAxeTriage(results.violations, name, triage).untriaged).toEqual([]);
      expect(applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged).toEqual([]);
      const m = await root(page).evaluate((n) => {
        const r = n.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        const centre = (sel: string) => {
          const b = n.querySelector(sel)!.getBoundingClientRect();
          return b.left + b.width / 2 - mid;
        };
        return { title: centre('[data-part="title"]'), icon: centre('[data-part="icon"]') };
      });
      expect(Math.abs(m.title)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.icon)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    }
  });
}
