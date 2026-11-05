// Automated accessibility for SJCheckbox (W1-C03c.f, ADR-013 L3): axe in every state on every adapter and
// engine with `target-size` enabled by name, zero untriaged violations (the shared triage file, which
// requires issue and owner per entry), the WCAG 2.2 named gates that apply (1.4.11 via the contrast
// matrix in css, 2.4.13 focus appearance, 2.5.8 target size), forced-colors visibility and RTL mirroring.
// The gate verdicts and collectors are the L3 harness's own (a11y/), reused unchanged.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFocusAppearance, collectTargets } from '../../a11y/collectors.js';
import { applyAxeTriage, focusAppearance, targetSize, type Triage } from '../../a11y/verdicts.js';
import { contrastRatio } from '../../contrast/wcag.js';
import { ADAPTERS, FIXTURES, type Adapter } from './fixtures';
import { CONTROL } from './open';

const hex = (rgb: string): string =>
  '#' +
  (rgb.match(/\d+/g) ?? ['0', '0', '0'])
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('');

/**
 * axe may report the label's contrast as `incomplete` (messageKey `pseudoContent`) because the indicator
 * owns ::before / ::after pseudo elements and axe will not resolve a background under a pseudo element. That
 * is a tool limit, not a finding: the label sits outside the box (inline-start padding), on the page
 * background. The ratio is measured here instead, from computed colours, and the incomplete is accepted only
 * if it passes 4.5:1.
 */
async function pseudoContrastOk(page: Page): Promise<boolean> {
  const c = await page.evaluate(() => {
    const label = document.querySelector('[data-part="label"]')!;
    return {
      fg: getComputedStyle(label).color,
      bg: getComputedStyle(document.body).backgroundColor,
    };
  });
  return contrastRatio(hex(c.fg), /rgba\(.*, 0\)$/.test(c.bg) ? '#ffffff' : hex(c.bg)) >= 4.5;
}

const here = dirname(fileURLToPath(import.meta.url));
const triage: Triage = JSON.parse(
  readFileSync(join(here, '..', '..', 'a11y', 'triage.json'), 'utf8'),
);

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .options({ rules: { 'target-size': { enabled: true } } });

async function mount(page: Page, adapter: Adapter, fixture: string): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  await page.evaluate(
    ([a, p]) => window.__sj.mount(a as 'react', p as never).then(() => undefined),
    [adapter, FIXTURES[fixture]!] as const,
  );
  await page.locator('[data-part="control"]').waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
}

/** Keyboard modality so :focus-visible applies (WebKit skips some controls on Tab; focus after one Tab). */
async function focusControl(page: Page, browserName: string): Promise<void> {
  await page.keyboard.press('Tab');
  if (browserName === 'webkit') await page.locator('[data-part="control"]').focus();
  expect(await page.evaluate(() => document.activeElement?.matches('input[type=checkbox]'))).toBe(
    true,
  );
}

const STATES = [
  { name: 'unchecked', fixture: 'unchecked', focus: false },
  { name: 'checked', fixture: 'checked', focus: false },
  { name: 'indeterminate', fixture: 'indeterminate', focus: false },
  { name: 'disabled', fixture: 'disabled', focus: false },
  { name: 'long-label', fixture: 'long-label', focus: false },
  { name: 'checked + focused', fixture: 'checked', focus: true },
  { name: 'indeterminate + focused', fixture: 'indeterminate', focus: true },
] as const;

for (const adapter of ADAPTERS) {
  for (const state of STATES) {
    test(`@pr axe | checkbox ${adapter} | ${state.name} | zero untriaged violations`, async ({
      page,
      browserName,
    }) => {
      await mount(page, adapter, state.fixture);
      if (state.focus) await focusControl(page, browserName);
      const results = await axe(page).analyze();
      const ran = [
        ...results.passes,
        ...results.violations,
        ...results.incomplete,
        ...results.inapplicable,
      ].some((r) => r.id === 'target-size');
      expect(ran, 'axe target-size did not run').toBe(true);
      const id = `checkbox-${state.name}`;
      expect(
        applyAxeTriage(results.violations, id, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      const open = applyAxeTriage(results.incomplete, id, triage, 'incomplete').untriaged.filter(
        (v) =>
          !(
            v.id === 'color-contrast' &&
            v.nodes.every((n) => n.any.every((a) => a.data?.messageKey === 'pseudoContent'))
          ),
      );
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
      if (results.incomplete.some((v) => v.id === 'color-contrast'))
        expect(await pseudoContrastOk(page), 'label contrast measured >= 4.5:1').toBe(true);
    });
  }

  test(`@pr 2.4.13 | checkbox ${adapter} | focus ring is >= 2px and >= 3:1`, async ({
    page,
    browserName,
  }) => {
    await mount(page, adapter, 'checked');
    await focusControl(page, browserName);
    const v = focusAppearance(await page.evaluate(collectFocusAppearance));
    expect(v.failures).toEqual([]);
  });

  test(`@pr 2.5.8 | checkbox ${adapter} | the control is at least 24px, the design target 44px`, async ({
    page,
  }) => {
    await mount(page, adapter, 'unchecked');
    const targets = await page.evaluate(collectTargets);
    const v = targetSize(targets, triage.targetSize, 'checkbox');
    expect(v.failures).toEqual([]);
    // The control is selected by its part, never as "the first target with a height" (G3A NICE-5).
    expect(targets.length).toBe(1);
    const box = (await page.locator(CONTROL).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  });

  test(`@pr forced-colors | checkbox ${adapter} | the box stays visible and unchecked, checked and indeterminate stay distinguishable by shape`, async ({
    page,
  }) => {
    await mount(page, adapter, 'unchecked');
    await page.emulateMedia({ forcedColors: 'active' });
    const read = () =>
      page.evaluate(() => {
        const box = document.querySelector('[data-part="indicator"]') as HTMLElement;
        const b = getComputedStyle(box);
        const g = getComputedStyle(box, '::after');
        return {
          forced: matchMedia('(forced-colors: active)').matches,
          boxBorder: [b.borderTopStyle, parseFloat(b.borderTopWidth), b.borderTopColor],
          glyph: {
            display: g.display,
            color: g.borderTopColor,
            end: parseFloat(g.borderInlineEndWidth) + parseFloat(g.borderBlockEndWidth),
            dash: parseFloat(g.borderBlockStartWidth),
          },
        };
      });
    const input = page.locator(CONTROL);
    const unchecked = await read();
    expect(unchecked.forced, 'forced-colors emulation is active').toBe(true);
    expect(unchecked.boxBorder[0]).not.toBe('none');
    expect(unchecked.boxBorder[1] as number).toBeGreaterThan(0);
    expect(unchecked.boxBorder[2]).not.toBe('rgba(0, 0, 0, 0)');
    expect(unchecked.glyph.display).toBe('none');
    await input.click();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 80)));
    const checked = await read();
    await page.evaluate(
      ([a]) => window.__sj.mount(a as 'react', { defaultIndeterminate: true, label: 'x' } as never),
      [adapter] as const,
    );
    await page.locator(CONTROL).waitFor();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 80)));
    const mixed = await read();
    // State is carried by the glyph, never by colour alone: none / an L / a dash, in a system colour.
    expect(checked.glyph.display).toBe('block');
    expect(checked.glyph.end).toBeGreaterThan(0);
    expect(checked.glyph.dash).toBe(0);
    expect(checked.glyph.color).not.toBe('rgba(0, 0, 0, 0)');
    expect(mixed.glyph.display).toBe('block');
    expect(mixed.glyph.dash).toBeGreaterThan(0);
    expect(mixed.glyph.end).toBe(0);
    expect(mixed.glyph.color).not.toBe('rgba(0, 0, 0, 0)');
  });

  test(`@pr rtl | checkbox ${adapter} | the box mirrors to the inline end`, async ({ page }) => {
    await mount(page, adapter, 'unchecked');
    const x = (dir: 'ltr' | 'rtl') =>
      page.evaluate((d) => {
        document.documentElement.dir = d;
        const root = document.querySelector('[data-part="root"]') as HTMLElement;
        const box = document.querySelector('[data-part="indicator"]') as HTMLElement;
        const r = root.getBoundingClientRect();
        const t = box.getBoundingClientRect();
        return { fromStart: d === 'ltr' ? t.left - r.left : r.right - t.right };
      }, dir);
    const ltr = await x('ltr');
    const rtl = await x('rtl');
    expect(Math.abs(ltr.fromStart - rtl.fromStart)).toBeLessThan(2);
  });
}

// Seeded: axe must be able to fail on this control. An input with no name is reported.
test('@pr axe | seeded | a checkbox without an accessible name is reported', async ({ page }) => {
  await mount(page, 'react', 'unchecked');
  await page.evaluate(() => {
    document.querySelector('.sj-checkbox__root')!.lastChild!.textContent = '';
  });
  const { violations } = await axe(page).analyze();
  expect(violations.map((v) => v.id)).toContain('label');
});
