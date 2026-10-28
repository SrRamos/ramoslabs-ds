// L3 automated accessibility for SJButton (W1-C01.f, ADR-013 L3): axe in every fixture on every adapter and
// engine with `target-size` enabled explicitly, plus the named WCAG 2.2 gates the button owns (2.5.8 target
// size, 2.4.13 focus appearance) and forced-colors. Every gate also has a SEEDED failing case: the gate passes
// its test only when it reports the seeded defect. Reuses the L3 collectors and verdicts (packages/testing/a11y).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFocusAppearance, collectTargets } from '../../a11y/collectors.js';
import {
  applyAxeTriage,
  focusAppearance,
  targetSize,
  validateTriage,
  type Triage,
} from '../../a11y/verdicts.js';
import { FIXTURES } from './fixtures';
import { ADAPTERS } from './matrix';
import { control, focusByKeyboard, mountButton, openHost } from './open';

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
  await mountButton(page, adapter, fixture, 'native', { form: fixture === 'submit' });
  return errors;
}

test('@pr triage file is valid: every entry names an issue and an owner', () => {
  expect(validateTriage(triage)).toEqual([]);
});

for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES) {
    test(`@pr axe | button ${adapter} | ${fixture} | zero untriaged violations`, async ({
      page,
    }) => {
      const errors = await mount(page, adapter, fixture);
      const results = await axe(page).analyze();
      // `target-size` must have been evaluated or declared inapplicable, never silently absent.
      const ran = [
        ...results.passes,
        ...results.violations,
        ...results.incomplete,
        ...results.inapplicable,
      ].some((r) => r.id === 'target-size');
      expect(ran, 'axe target-size did not run').toBe(true);
      const name = `button-${fixture}`;
      expect(
        applyAxeTriage(results.violations, name, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      // `incomplete` is an unreviewed finding: it fails unless triaged with reviewed: "pass", an issue and an owner.
      const open = applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged;
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test(`@pr axe | button ${adapter} | seeded: icon-only without a name is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'icon-only');
    await control(page).evaluate((n) => n.removeAttribute('aria-label'));
    const results = await axe(page).analyze();
    expect(results.violations.map((v) => v.id)).toContain('button-name');
  });
}

// 2.5.8 Target Size: the button's own contract is 44 CSS px (ADR-008); the WCAG floor is 24.
for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES.filter((f) => f !== 'disabled')) {
    test(`@pr 2.5.8 | button ${adapter} | ${fixture} | measured bounds >= 44px`, async ({
      page,
    }) => {
      await mount(page, adapter, fixture);
      const targets = await page.evaluate(collectTargets);
      expect(targets.length).toBe(1);
      const t = targets[0]!;
      // Long label wraps to several lines: height only grows. Width of a narrow box may be below 44? Not here.
      expect(Math.min(t.w, t.h), `${t.w}x${t.h}`).toBeGreaterThanOrEqual(44);
      expect(targetSize(targets, [], fixture).failures).toEqual([]);
      expect(targetSize(targets, [], fixture, 44).failures).toEqual([]);
    });
  }

  test(`@pr 2.5.8 | button ${adapter} | seeded: two 10px controls close together are reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'default');
    const tiny =
      'position:fixed;inset-block-start:0;min-inline-size:0;min-block-size:0;padding:0;inline-size:10px;block-size:10px';
    await control(page).evaluate(
      (n, st) => n.setAttribute('style', `${st};inset-inline-start:0`),
      tiny,
    );
    // Alone, an undersized target is exempt by spacing (its 24px circle meets nothing).
    expect(targetSize(await page.evaluate(collectTargets), [], 'seeded').failures).toEqual([]);
    await page.evaluate((st) => {
      const b = document.createElement('button');
      b.setAttribute('style', `${st};inset-inline-start:12px`);
      b.textContent = 'x';
      document.body.appendChild(b);
    }, tiny);
    expect(targetSize(await page.evaluate(collectTargets), [], 'seeded').failures).toHaveLength(2);
  });
}

// 2.4.13 Focus Appearance (adopted as the internal floor): keyboard focus ring >= 2px and >= 3:1.
for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES.filter((f) => f !== 'disabled')) {
    test(`@pr 2.4.13 | button ${adapter} | ${fixture} | keyboard focus ring meets the floor`, async ({
      page,
    }) => {
      await mount(page, adapter, fixture);
      expect(await focusByKeyboard(page)).toBe(true);
      const v = focusAppearance(await page.evaluate(collectFocusAppearance));
      expect(v.failures).toEqual([]);
      expect(v.thickness).toBeGreaterThanOrEqual(2);
    });
  }

  test(`@pr 2.4.13 | button ${adapter} | seeded: removing the indicator is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'default');
    await control(page).evaluate((n) =>
      (n as HTMLElement).setAttribute(
        'style',
        'outline:none !important;box-shadow:none !important',
      ),
    );
    expect(await focusByKeyboard(page)).toBe(true);
    const v = focusAppearance(await page.evaluate(collectFocusAppearance));
    expect(v.failures.join(' ')).toContain('no visible focus indicator');
  });
}

// Forced colors (ADR-009): the boundary and the focus indicator must survive the system palette.
for (const adapter of ADAPTERS) {
  for (const fixture of ['default', 'link', 'icon-only']) {
    test(`@pr forced-colors | button ${adapter} | ${fixture} | focus indicator and boundary remain`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await mount(page, adapter, fixture);
      expect(await focusByKeyboard(page)).toBe(true);
      const m = await page.evaluate(collectFocusAppearance);
      expect(m.forcedColors).toBe(true);
      expect(m.outline.style).not.toBe('none');
      expect(m.outline.width).toBeGreaterThanOrEqual(2);
      const border = await control(page).evaluate((n) => {
        const s = getComputedStyle(n);
        return { style: s.borderStyle, width: parseFloat(s.borderWidth) };
      });
      expect(border.style).not.toBe('none');
      expect(border.width).toBeGreaterThan(0);
    });
  }
}
