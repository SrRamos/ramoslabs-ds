// SJIcon x SJButton composition (W1-C12.f, PLAN-ICONS decisions 8 and 9). The button is `beta` and frozen: an icon
// goes in its existing `icon` part, which is a decorative, aria-hidden box. Asserts, on 3 engines x 3 adapters:
//  - button with visible text and an SJIcon (size fit): the glyph fills the 1.25em icon box and the name is the text;
//  - icon-only button: the accessible name is the BUTTON's `label`, the SJIcon stays decorative;
//  - an SJIcon `label` inside the icon part is ignored (aria-hidden on the part wins) and reported as such;
//  - the `link` variant renders the same icon part inside an <a>;
//  - axe is clean (this closes the C01 axe-`incomplete` item for the icon-only composition: the glyph is an svg,
//    not a text character), 1.4.11 3:1 for the glyph on the button fill, forced colors, keyboard focus on the button.
// Title format: SJIcon x SJButton | <adapter> | <composition> | <check> (not a parity matrix row).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAxeTriage, parseCssColor, type Triage } from '../../../a11y/verdicts.js';
import { contrastRatio } from '../../../contrast/index.js';
import { ADAPTERS } from '../matrix';
import { mountComposition, openHost } from '../open';
import { COMPOSITIONS, EXPECTED_NAME } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const triage: Triage = JSON.parse(
  readFileSync(join(here, '..', '..', '..', 'a11y', 'triage.json'), 'utf8'),
);
const NAMES = Object.keys(COMPOSITIONS);
const T = (adapter: string, name: string, check: string) =>
  `SJIcon x SJButton | ${adapter} | ${name} | ${check}`;

const control = (page: Page) => page.locator('#mount > :is(button, a)');
const iconPart = (page: Page) => control(page).locator('[data-part="icon"]');
const svg = (page: Page) => iconPart(page).locator('svg');

const ROLE: Record<string, 'button' | 'link'> = {
  'button-icon': 'button',
  'icon-only': 'button',
  'icon-label-ignored': 'button',
  link: 'link',
};

/** Same snapshot on every adapter and engine (inline: composition/ holds no yml). */
const SNAPSHOT: Record<string, string> = {
  'button-icon': '- button "Add item"',
  'icon-only': '- button "Close dialog"',
  'icon-label-ignored': '- button "Close dialog"',
  link: '- link "Read the documentation":\n  - /url: "#activated"',
};

for (const adapter of ADAPTERS) {
  for (const name of NAMES) {
    test(
      T(adapter, name, 'icon sits in the decorative icon part and fills its box'),
      async ({ page }) => {
        const errors = await openHost(page);
        await mountComposition(page, adapter, name);
        const c = COMPOSITIONS[name]!;
        const el = control(page);
        expect(await el.evaluate((n) => n.localName)).toBe(c.href ? 'a' : 'button');
        // The button's own part hides the icon from the tree; the SJIcon inside is a normal sj-icon, size fit.
        const part = iconPart(page);
        expect(await part.count()).toBe(1);
        expect(await part.getAttribute('aria-hidden')).toBe('true');
        const g = svg(page);
        expect(await g.count()).toBe(1);
        expect(await g.getAttribute('data-size')).toBe('fit');
        expect(await g.evaluate((n) => n.classList.contains('sj-icon'))).toBe(true);
        const box = await part.evaluate((n) => {
          const r = n.getBoundingClientRect();
          const s = n.firstElementChild!.getBoundingClientRect();
          return { pw: r.width, ph: r.height, sw: s.width, sh: s.height };
        });
        // 1.25em at the button font size, glyph filling it exactly (no stylesheet edit in the button).
        expect(Math.abs(box.sw - box.pw)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(box.sh - box.ph)).toBeLessThanOrEqual(0.5);
        expect(box.pw).toBeGreaterThan(0);
        expect(errors).toEqual([]);
      },
    );

    test(T(adapter, name, 'accessible name and tree'), async ({ page }) => {
      const errors = await openHost(page);
      await mountComposition(page, adapter, name);
      await expect(page.locator('#mount')).toMatchAriaSnapshot(SNAPSHOT[name]!);
      const byRole = page.getByRole(ROLE[name]!, { name: EXPECTED_NAME[name]!, exact: true });
      await expect(byRole).toHaveCount(1);
      // No image role is exposed anywhere in the composition: the glyph is decorative inside the button.
      await expect(page.getByRole('img')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test(T(adapter, name, 'axe: zero untriaged violations and incomplete'), async ({ page }) => {
      await openHost(page);
      await mountComposition(page, adapter, name);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .include('#root')
        .options({ rules: { 'target-size': { enabled: true } } })
        .analyze();
      const fixture = `composition-${name}`;
      expect(
        applyAxeTriage(results.violations, fixture, triage).untriaged.map((v) => v.id),
      ).toEqual([]);
      expect(
        applyAxeTriage(results.incomplete, fixture, triage, 'incomplete').untriaged.map(
          (v) => v.id,
        ),
      ).toEqual([]);
    });

    test(
      T(adapter, name, '1.4.11 glyph stroke is at least 3:1 on the button fill'),
      async ({ page }) => {
        await openHost(page);
        await mountComposition(page, adapter, name);
        const m = await control(page).evaluate((n) => ({
          stroke: getComputedStyle(n.querySelector('svg path')!).stroke,
          bg: getComputedStyle(n).backgroundColor,
        }));
        const s = parseCssColor(m.stroke)!;
        const b = parseCssColor(m.bg)!;
        expect(b.alpha, `button fill ${m.bg}`).toBe(1);
        expect(contrastRatio(s.hex, b.hex), `${m.stroke} on ${m.bg}`).toBeGreaterThanOrEqual(3);
      },
    );

    test(
      T(adapter, name, 'forced colors: glyph follows the button text colour'),
      async ({ page }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await openHost(page);
        await mountComposition(page, adapter, name);
        const m = await control(page).evaluate((n) => {
          const path = getComputedStyle(n.querySelector('svg path')!);
          const s = getComputedStyle(n);
          return {
            stroke: path.stroke,
            text: s.color,
            bg: s.backgroundColor,
            adjust: s.forcedColorAdjust,
          };
        });
        expect(m.adjust).not.toBe('none');
        expect(m.stroke).toBe(m.text);
        const a = parseCssColor(m.stroke)!;
        const b = parseCssColor(m.bg)!;
        expect(contrastRatio(a.hex, b.hex), `${m.stroke} on ${m.bg}`).toBeGreaterThanOrEqual(3);
      },
    );

    test(
      T(adapter, name, 'keyboard focus lands on the control, never on the glyph'),
      async ({ page }) => {
        await openHost(page);
        await mountComposition(page, adapter, name);
        await page.keyboard.press('Tab');
        const el = control(page);
        // WebKit skips controls on Tab unless a Safari setting is on: one Tab sets keyboard modality, then focus.
        if (!(await el.evaluate((n) => n === document.activeElement))) await el.focus();
        expect(await el.evaluate((n) => n === document.activeElement)).toBe(true);
        expect(await svg(page).getAttribute('tabindex')).toBeNull();
        expect(
          await svg(page).evaluate((n) => (n as unknown as { tabIndex: number }).tabIndex),
        ).toBe(-1);
      },
    );
  }

  test(
    T(adapter, 'icon-label-ignored', 'the SJIcon label is rendered but ignored by the tree'),
    async ({ page }) => {
      await openHost(page);
      await mountComposition(page, adapter, 'icon-label-ignored');
      const g = svg(page);
      // The adapter did what SJIcon promises on its own: role=img and the label...
      expect([await g.getAttribute('role'), await g.getAttribute('aria-label')]).toEqual([
        'img',
        COMPOSITIONS['icon-label-ignored']!.iconLabel,
      ]);
      // ...and the button's aria-hidden part wins, so the label is never exposed (reported here, not announced).
      await expect(page.getByRole('img', { includeHidden: false })).toHaveCount(0);
      await expect(page.getByRole('img', { includeHidden: true })).toHaveCount(1);
      await expect(page.getByRole('img', { name: 'Dismiss' })).toHaveCount(0);
      expect(
        await page
          .locator('#mount')
          .evaluate((n) => (n as HTMLElement).innerText.includes('Dismiss')),
      ).toBe(false);
    },
  );

  test(
    T(adapter, 'icon-only', 'seeded: dropping the button label leaves the button unnamed'),
    async ({ page }) => {
      await openHost(page);
      await mountComposition(page, adapter, 'icon-only');
      await control(page).evaluate((n) => n.removeAttribute('aria-label'));
      const results = await new AxeBuilder({ page }).include('#root').analyze();
      // An SJIcon child cannot name the button (lint contract/icon-only-name counts only label/aria-label/aria-labelledby).
      expect(results.violations.map((v) => v.id)).toContain('button-name');
    },
  );
}
