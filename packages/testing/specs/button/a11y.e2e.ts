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
import { contrastRatio } from '../../contrast/wcag.js';
import { FIXTURES, SIZE_PX } from './fixtures';
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

async function mount(
  page: Page,
  adapter: (typeof ADAPTERS)[number],
  fixture: string,
  props: Record<string, unknown> = {},
  sentence?: string,
) {
  const errors = await openHost(page);
  await mountButton(page, adapter, fixture, 'native', {
    form: fixture === 'submit',
    props: props as never,
  });
  // The link variant is inline text: surround it with a sentence so the text-block rules apply to it.
  if (sentence)
    await page.locator('#box').evaluate((box, text) => {
      box.prepend(text);
      box.append(' for details.');
      (box as HTMLElement).style.fontSize = '1.25rem';
    }, sentence);
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

  // The new sizes and the link variant get the same axe pass (color-contrast, link-in-text-block, target-size).
  for (const size of Object.keys(SIZE_PX)) {
    test(`@pr axe | button ${adapter} | size ${size} | zero untriaged violations`, async ({
      page,
    }) => {
      const errors = await mount(page, adapter, 'default', { size });
      const results = await axe(page).analyze();
      const name = `button-size-${size}`;
      expect(
        applyAxeTriage(results.violations, name, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      const open = applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged;
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  for (const tone of ['primary', 'neutral', 'success', 'warning', 'error', 'info']) {
    test(`@pr axe | button ${adapter} | link variant ${tone} | zero untriaged violations, text at 4.5:1`, async ({
      page,
    }) => {
      const errors = await mount(
        page,
        adapter,
        'default',
        { variant: 'link', tone, href: '#details' },
        'Read the docs or ',
      );
      // WebKit-only axe false positive: any inline <a> in a text block is "partially obscured"
      // (elmPartiallyObscured), plain links included. So color-contrast is measured below instead of by axe.
      const results = await axe(page).disableRules(['color-contrast']).analyze();
      const name = `button-link-${tone}`;
      expect(
        applyAxeTriage(results.violations, name, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      const open = applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged;
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
      const colors = await control(page).evaluate((n) => {
        let bg = 'rgba(0, 0, 0, 0)';
        for (let e: Element | null = n; e && bg === 'rgba(0, 0, 0, 0)'; e = e.parentElement)
          bg = getComputedStyle(e).backgroundColor;
        return { fg: getComputedStyle(n).color, bg };
      });
      const hex = (c: string) =>
        '#' +
        (c.match(/\d+(\.\d+)?/g) ?? [])
          .slice(0, 3)
          .map((v) => Number(v).toString(16).padStart(2, '0'))
          .join('');
      expect(
        contrastRatio(hex(colors.fg), hex(colors.bg)),
        `${colors.fg} on ${colors.bg}`,
      ).toBeGreaterThanOrEqual(4.5);
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

// 2.5.8 Target Size (AA): the visual box is at least 24 CSS px at every size (the floor), md is 36. The 44px touch
// target is a pointer: coarse hit area, asserted in touch.e2e.ts.
for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES.filter((f) => f !== 'disabled')) {
    test(`@pr 2.5.8 | button ${adapter} | ${fixture} | measured bounds >= 24px (visual floor)`, async ({
      page,
    }) => {
      await mount(page, adapter, fixture);
      const targets = await page.evaluate(collectTargets);
      expect(targets.length).toBe(1);
      const t = targets[0]!;
      expect(Math.min(t.w, t.h), `${t.w}x${t.h}`).toBeGreaterThanOrEqual(24);
      expect(targetSize(targets, [], fixture).failures).toEqual([]);
    });
  }

  for (const [size, px] of Object.entries(SIZE_PX)) {
    test(`@pr 2.5.8 | button ${adapter} | size ${size} | ${px}px high, never under the 24px floor`, async ({
      page,
    }) => {
      await mount(page, adapter, 'default', { size });
      const targets = await page.evaluate(collectTargets);
      const t = targets[0]!;
      expect(Math.round(t.h), `${t.w}x${t.h}`).toBe(px);
      expect(t.h).toBeGreaterThanOrEqual(24);
      expect(targetSize(targets, [], `size-${size}`).failures).toEqual([]);
    });

    test(`@pr 2.5.8 | button ${adapter} | size ${size} icon-only | a ${px}px square`, async ({
      page,
    }) => {
      await mount(page, adapter, 'icon-only', { size });
      const t = (await page.evaluate(collectTargets))[0]!;
      expect(Math.round(t.w)).toBe(px);
      expect(Math.round(t.h)).toBe(px);
      expect(targetSize([t], [], `icon-${size}`).failures).toEqual([]);
    });
  }

  test(`@pr 2.5.8 | button ${adapter} | link variant | inline, exempt from the target-size minimum`, async ({
    page,
  }) => {
    await mount(page, adapter, 'default', { variant: 'link' }, 'Read the docs or ');
    const el = control(page);
    const m = await el.evaluate((n) => {
      const s = getComputedStyle(n);
      return {
        display: s.display,
        padL: s.paddingLeft,
        minH: s.minHeight,
        line: s.textDecorationLine,
      };
    });
    expect(m).toEqual({ display: 'inline', padL: '0px', minH: '0px', line: 'underline' });
  });

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

  for (const size of Object.keys(SIZE_PX)) {
    test(`@pr 2.4.13 | button ${adapter} | size ${size} | keyboard focus ring meets the floor`, async ({
      page,
    }) => {
      await mount(page, adapter, 'default', { size });
      expect(await focusByKeyboard(page)).toBe(true);
      const v = focusAppearance(await page.evaluate(collectFocusAppearance));
      expect(v.failures).toEqual([]);
      expect(v.thickness).toBeGreaterThanOrEqual(2);
    });
  }

  for (const tone of ['primary', 'neutral', 'error']) {
    test(`@pr 2.4.13 | button ${adapter} | link variant ${tone} | keyboard focus ring meets the floor`, async ({
      page,
    }) => {
      await mount(page, adapter, 'default', { variant: 'link', tone }, 'Read the docs or ');
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
  test(`@pr forced-colors | button ${adapter} | link variant | underline and focus indicator remain`, async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await mount(page, adapter, 'default', { variant: 'link' }, 'Read the docs or ');
    expect(await focusByKeyboard(page)).toBe(true);
    const m = await page.evaluate(collectFocusAppearance);
    expect(m.forcedColors).toBe(true);
    expect(m.outline.style).not.toBe('none');
    expect(m.outline.width).toBeGreaterThanOrEqual(2);
    const line = await control(page).evaluate((n) => getComputedStyle(n).textDecorationLine);
    expect(line).toBe('underline');
  });

  for (const size of ['xs', 'lg']) {
    test(`@pr forced-colors | button ${adapter} | size ${size} | boundary and gradient-free fill`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await mount(page, adapter, 'default', { size });
      const s = await control(page).evaluate((n) => {
        const c = getComputedStyle(n);
        return { style: c.borderStyle, width: parseFloat(c.borderWidth), image: c.backgroundImage };
      });
      expect(s.style).not.toBe('none');
      expect(s.width).toBeGreaterThan(0);
      expect(s.image).toBe('none');
    });
  }

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
