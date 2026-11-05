// L3 automated accessibility for SJIcon (W1-C12.f, ADR-013 L3): axe in every fixture on every adapter and engine
// (zero untriaged violations, zero untriaged `incomplete`), the WCAG 1.4.11 3:1 check for the documented colour
// recipes (SJIcon has no tone axis: colour is inherited, PLAN-ICONS "Color contrast"), forced colors and RTL.
// SJIcon is never interactive, so 2.5.8 target size and 2.4.13 focus appearance do not apply: instead the icon is
// asserted to be NOT a target and NOT focusable. Every gate also has a SEEDED failing case.
// Reuses the L3 verdicts (packages/testing/a11y) and the contrast module.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAxeTriage, parseCssColor, validateTriage, type Triage } from '../../a11y/verdicts.js';
import { contrastRatio } from '../../contrast/index.js';
import { collectTargets } from '../../a11y/collectors.js';
import { FIXTURES } from './fixtures';
import { ADAPTERS } from './matrix';
import { glyph, mountIcon, openHost } from './open';

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
  await mountIcon(page, adapter, fixture, 'native');
  return errors;
}

test('@pr triage file is valid: every entry names an issue and an owner', () => {
  expect(validateTriage(triage)).toEqual([]);
});

for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES) {
    test(`@pr axe | icon ${adapter} | ${fixture} | zero untriaged violations`, async ({ page }) => {
      const errors = await mount(page, adapter, fixture);
      const results = await axe(page).analyze();
      const name = `icon-${fixture}`;
      expect(
        applyAxeTriage(results.violations, name, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      // `incomplete` is an unreviewed finding: it fails unless triaged with reviewed: "pass", an issue and an owner.
      const open = applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged;
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test(`@pr axe | icon ${adapter} | seeded: a meaningful icon without a name is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'labelled');
    await glyph(page).evaluate((n) => n.removeAttribute('aria-label'));
    const results = await axe(page).analyze();
    expect(results.violations.map((v) => v.id)).toContain('svg-img-alt');
  });

  test(`@pr axe | icon ${adapter} | seeded: a focusable decorative icon is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'default');
    await glyph(page).evaluate((n) => n.setAttribute('tabindex', '0'));
    const results = await axe(page).analyze();
    expect(results.violations.map((v) => v.id)).toContain('aria-hidden-focus');
  });

  test(`@pr 2.5.8 | icon ${adapter} | not a pointer target: the page has no focusable or clickable control`, async ({
    page,
  }) => {
    await mount(page, adapter, 'labelled');
    expect(await page.evaluate(collectTargets)).toEqual([]);
  });
}

// ---- 1.4.11 Non-text contrast: the documented recipes, measured in the browser --------------------------------

/** Stroke (a token) on a background (a token): the recipes the docs state for standalone use. */
const FG = ['color-slate-900', 'color-slate-700', 'color-slate-500', 'color-primary'];
const BG = ['color-background', 'color-surface', 'color-surface-secondary'];

async function strokeOn(page: Page, fg: string, bg: string): Promise<number> {
  await page.evaluate(
    ([f, b]) => {
      const box = document.getElementById('box')!;
      box.style.color = `var(--${f})`;
      box.style.backgroundColor = `var(--${b})`;
    },
    [fg, bg] as const,
  );
  const m = await glyph(page).evaluate((n) => ({
    stroke: getComputedStyle(n.firstElementChild!).stroke,
    bg: getComputedStyle(document.getElementById('box')!).backgroundColor,
  }));
  const s = parseCssColor(m.stroke);
  const b = parseCssColor(m.bg);
  expect(s, m.stroke).not.toBeNull();
  expect(b, m.bg).not.toBeNull();
  return contrastRatio(s!.hex, b!.hex);
}

for (const adapter of ADAPTERS) {
  test(`@pr 1.4.11 | icon ${adapter} | labelled | every documented recipe is at least 3:1`, async ({
    page,
  }) => {
    await mount(page, adapter, 'labelled');
    for (const fg of FG)
      for (const bg of BG) {
        const ratio = await strokeOn(page, fg, bg);
        expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
      }
  });

  test(`@pr 1.4.11 | icon ${adapter} | seeded: slate-300 on the page background is reported (< 3:1)`, async ({
    page,
  }) => {
    await mount(page, adapter, 'labelled');
    expect(await strokeOn(page, 'color-slate-300', 'color-background')).toBeLessThan(3);
  });
}

// ---- forced colors (ADR-009): the stroke follows the system palette and stays visible -----------------------

const measureForced = (page: Page) =>
  glyph(page).evaluate((n) => {
    const s = getComputedStyle(n);
    const path = getComputedStyle(n.firstElementChild!);
    return {
      adjust: s.forcedColorAdjust,
      color: s.color,
      stroke: path.stroke,
      strokeWidth: parseFloat(path.strokeWidth),
      canvas: getComputedStyle(document.body).backgroundColor,
      forced: matchMedia('(forced-colors: active)').matches,
    };
  });

/** Verdict over one measurement; empty means the stroke follows the system palette and is visible. */
function forcedProblems(m: Awaited<ReturnType<typeof measureForced>>): string[] {
  const out: string[] = [];
  if (!m.forced) out.push('forced colors not active');
  if (m.adjust === 'none')
    out.push('forced-color-adjust: none opts the icon out of the system palette');
  if (m.stroke === 'none') out.push('stroke is none');
  if (m.stroke !== m.color) out.push(`stroke ${m.stroke} is not the system text colour ${m.color}`);
  if (!(m.strokeWidth > 0)) out.push('stroke width is 0');
  const s = parseCssColor(m.stroke);
  const c = parseCssColor(m.canvas);
  if (!s || !c || contrastRatio(s.hex, c.hex) < 3)
    out.push(`stroke ${m.stroke} on ${m.canvas} < 3:1`);
  return out;
}

for (const adapter of ADAPTERS) {
  for (const fixture of ['default', 'labelled', 'rtl-mirror']) {
    test(`@pr forced-colors | icon ${adapter} | ${fixture} | stroke maps to a system colour and stays visible`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await mount(page, adapter, fixture);
      expect(forcedProblems(await measureForced(page))).toEqual([]);
    });
  }

  test(`@pr forced-colors | icon ${adapter} | seeded: opting out with forced-color-adjust none is reported`, async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await mount(page, adapter, 'default');
    await glyph(page).evaluate((n) => {
      (n as SVGElement).style.forcedColorAdjust = 'none';
      (n as SVGElement).style.color = 'rgb(255, 255, 255)';
    });
    // Under forced colors the opted-out icon keeps white `currentColor` on the white canvas. WebKit does not
    // implement `forced-color-adjust`, so only the contrast verdict is common to the three engines.
    const problems = forcedProblems(await measureForced(page));
    expect(problems.length).toBeGreaterThan(0);
  });
}

// ---- RTL: axe in a right-to-left document, and the mirrored glyph stays an exposed-or-hidden icon as before ----

for (const adapter of ADAPTERS) {
  test(`@pr rtl | icon ${adapter} | rtl-mirror and rtl-runtime in a dir=rtl document: axe clean`, async ({
    page,
  }) => {
    for (const fixture of ['rtl-mirror', 'rtl-runtime']) {
      const errors = await mount(page, adapter, fixture);
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      const results = await axe(page).analyze();
      const name = `icon-${fixture}`;
      expect(applyAxeTriage(results.violations, name, triage).untriaged).toEqual([]);
      expect(applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged).toEqual([]);
      expect(errors).toEqual([]);
    }
  });
}
