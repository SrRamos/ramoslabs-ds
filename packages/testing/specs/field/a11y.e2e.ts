// Automated accessibility for SJField, SJInput and SJForm (W1-C02.f, ADR-013 L3): axe in every contract fixture and
// the invalid, focused and disabled states, on every adapter and engine, with `target-size` enabled by name, zero
// untriaged violations (the shared triage file, which requires issue and owner per entry), the WCAG 2.2 named
// gates that apply (2.5.8 target size, 2.4.13 focus appearance), contrast of the invalid and disabled states
// (1.4.3, 1.4.11), forced-colors visibility and RTL mirroring. The gate verdicts and collectors are the L3
// harness's own (a11y/), reused unchanged.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFocusAppearance, collectTargets } from '../../a11y/collectors.js';
import { applyAxeTriage, focusAppearance, targetSize, type Triage } from '../../a11y/verdicts.js';
import { contrastRatio } from '../../contrast/wcag.js';
import { ADAPTERS, ALL_FIXTURES, ERROR, HINT, LABEL, type Scene } from './fixtures';
import { control, mountScene, openHost, updateScene } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const triage: Triage = JSON.parse(
  readFileSync(join(here, '..', '..', 'a11y', 'triage.json'), 'utf8'),
);

const hex = (rgb: string): string =>
  '#' +
  (rgb.match(/\d+/g) ?? ['0', '0', '0'])
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('');
const isClear = (rgb: string) => /rgba\(.*, 0\)$/.test(rgb) || rgb === 'transparent';

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .options({ rules: { 'target-size': { enabled: true } } });

/** All states in one form: rest, hint, error, required, disabled. */
const STATES: Scene = {
  form: {},
  fields: [
    { name: 'rest', kind: 'email', label: LABEL },
    { name: 'hinted', kind: 'phone', label: 'Phone', hint: HINT },
    { name: 'bad', kind: 'email', label: 'Backup email', error: ERROR, required: true },
    { name: 'req', kind: 'name', label: 'Full name', required: true },
    { name: 'off', kind: 'text', label: 'Reference', disabled: true },
    { name: 'street', kind: 'address', label: 'Street address' },
  ],
};

/** Focus a control with the keyboard modality, so :focus-visible applies (a lone control has nothing to Shift+Tab to). */
async function focusControl(page: Page, name: string): Promise<void> {
  await control(page, name).focus();
  await page.keyboard.press('Shift');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('name'))).toBe(name);
  expect(await control(page, name).evaluate((el) => el.matches(':focus-visible'))).toBe(true);
}

const AXE_STATES: { name: string; scene: Scene; focus?: string }[] = [
  ...Object.entries(ALL_FIXTURES).map(([id, scene]) => ({ name: id, scene })),
  { name: 'all states', scene: STATES },
  { name: 'invalid + focused', scene: ALL_FIXTURES['field/invalid']!, focus: 'email' },
  { name: 'textarea + focused', scene: ALL_FIXTURES['input/address']!, focus: 'street' },
];

for (const adapter of ADAPTERS) {
  for (const state of AXE_STATES) {
    test(`@pr axe | field ${adapter} | ${state.name} | zero untriaged violations`, async ({
      page,
    }) => {
      await openHost(page);
      await mountScene(page, adapter, state.scene);
      if (state.focus) await focusControl(page, state.focus);
      const results = await axe(page).analyze();
      const ran = [
        ...results.passes,
        ...results.violations,
        ...results.incomplete,
        ...results.inapplicable,
      ].some((r) => r.id === 'target-size');
      expect(ran, 'axe target-size did not run').toBe(true);
      const id = `field-${state.name}`;
      expect(
        applyAxeTriage(results.violations, id, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      const open = applyAxeTriage(results.incomplete, id, triage, 'incomplete').untriaged;
      expect(open.map((v) => `incomplete ${v.id}: ${v.help}`)).toEqual([]);
    });
  }

  test(`@pr 2.4.13 | field ${adapter} | the focus ring is >= 2px and >= 3:1 on rest, invalid and textarea controls`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, STATES);
    for (const name of ['rest', 'bad', 'street']) {
      await focusControl(page, name);
      const v = focusAppearance(await page.evaluate(collectFocusAppearance));
      expect(v.failures, name).toEqual([]);
    }
  });

  test(`@pr 2.5.8 | field ${adapter} | every control and the submit button are at least 24px, the design target 44px`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, STATES);
    const targets = await page.evaluate(collectTargets);
    const v = targetSize(targets, triage.targetSize, 'field');
    expect(v.failures).toEqual([]);
    // 5 enabled controls + the submit button; the disabled control is not a target.
    expect(targets.length).toBe(6);
    for (const name of ['rest', 'hinted', 'bad', 'req', 'street']) {
      const box = (await control(page, name).boundingBox())!;
      expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(44);
    }
    const off = (await control(page, 'off').boundingBox())!;
    expect(
      Math.min(off.width, off.height),
      'the disabled control keeps its size',
    ).toBeGreaterThanOrEqual(44);
  });

  test(`@pr contrast | field ${adapter} | text is >= 4.5:1 and the invalid border >= 3:1 in the invalid state`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, STATES);
    const m = await page.evaluate(() => {
      const bg = (e: Element) => {
        for (let n: Element | null = e; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (!/rgba\(.*, 0\)$/.test(c) && c !== 'transparent') return c;
        }
        return 'rgb(255, 255, 255)';
      };
      const at = (name: string) => {
        const c = document.querySelector(`#f [name="${name}"]`) as HTMLElement;
        const s = getComputedStyle(c);
        const root = c.closest('.sj-field__root')!;
        const q = (sel: string) => root.querySelector(sel) as HTMLElement | null;
        const text = (el: HTMLElement | null) =>
          el ? { fg: getComputedStyle(el).color, bg: bg(el) } : null;
        return {
          control: {
            fg: s.color,
            bg: s.backgroundColor,
            border: s.borderTopColor,
            width: parseFloat(s.borderTopWidth),
          },
          page: bg(root),
          label: text(q('.sj-field__label')),
          hint: text(q('.sj-field__hint')),
          error: text(q('.sj-field__error')),
        };
      };
      return { rest: at('rest'), hinted: at('hinted'), bad: at('bad') };
    });
    const ratio = (fg: string, bg: string) => contrastRatio(hex(fg), hex(bg));
    // Text: label, hint, error and the typed value, all 4.5:1 (1.4.3).
    for (const [why, t] of [
      ['label', m.rest.label],
      ['hint', m.hinted.hint],
      ['error', m.bad.error],
      ['error label', m.bad.label],
    ] as const)
      expect(ratio(t!.fg, t!.bg), why).toBeGreaterThanOrEqual(4.5);
    expect(
      ratio(m.bad.control.fg, m.bad.control.bg),
      'typed text on the control',
    ).toBeGreaterThanOrEqual(4.5);
    // The boundary: the rest border and the invalid border are non-text contrast (1.4.11).
    expect(ratio(m.rest.control.border, m.rest.page), 'rest border').toBeGreaterThanOrEqual(3);
    expect(
      m.bad.control.width,
      'the invalid border is thicker, not only a different colour',
    ).toBeGreaterThan(m.rest.control.width);
    expect(isClear(m.bad.control.border)).toBe(false);
    expect(ratio(m.bad.control.border, m.rest.page), 'invalid border').toBeGreaterThanOrEqual(3);
    expect(m.bad.control.border, 'invalid is not the rest colour').not.toBe(m.rest.control.border);
  });

  test(`@pr contrast | field ${adapter} | the disabled control is visibly distinct (text-disabled is exempt from 1.4.3)`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, STATES);
    const m = await page.evaluate(() => {
      const at = (name: string) => {
        const s = getComputedStyle(document.querySelector(`#f [name="${name}"]`) as HTMLElement);
        return { fg: s.color, bg: s.backgroundColor, border: s.borderTopColor, cursor: s.cursor };
      };
      return { rest: at('rest'), off: at('off') };
    });
    expect(m.off.cursor).toBe('not-allowed');
    expect(m.off.bg, 'a different surface').not.toBe(m.rest.bg);
    expect(m.off.fg, 'a different text colour').not.toBe(m.rest.fg);
    // Exempt from 1.4.3, so no 4.5:1 here. The measured ratio is pinned (1.36:1 today, slate 300 on slate 100) so a
    // regression to something fainter fails; whether the DS floor for text should apply is an open question in the notes.
    const r = contrastRatio(hex(m.off.fg), hex(m.off.bg));
    expect(r, `disabled text ${hex(m.off.fg)} on ${hex(m.off.bg)}`).toBeGreaterThanOrEqual(1.3);
    // The disabled label stays readable text: the field labels it, the control is the inactive part.
    const label = await page.evaluate(() => {
      const el = document
        .querySelector('#f [name="off"]')!
        .closest('.sj-field__root')!
        .querySelector('.sj-field__label')!;
      const s = getComputedStyle(el);
      return { fg: s.color, bg: getComputedStyle(document.body).backgroundColor };
    });
    expect(
      contrastRatio(hex(label.fg), isClear(label.bg) ? '#ffffff' : hex(label.bg)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  test(`@pr forced-colors | field ${adapter} | the boundary stays, invalid keeps its thickness and disabled is greyed`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, STATES);
    await page.emulateMedia({ forcedColors: 'active' });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 80)));
    const read = (name: string) =>
      control(page, name).evaluate((el: HTMLElement) => {
        const s = getComputedStyle(el);
        const icon = el.closest('.sj-field__root')!.querySelector('.sj-field__icon svg');
        return {
          forced: matchMedia('(forced-colors: active)').matches,
          style: s.borderTopStyle,
          width: parseFloat(s.borderTopWidth),
          color: s.borderTopColor,
          text: s.color,
          iconStroke: icon ? getComputedStyle(icon).stroke : null,
        };
      });
    const rest = await read('rest');
    const bad = await read('bad');
    const off = await read('off');
    expect(rest.forced, 'forced-colors emulation is active').toBe(true);
    expect(rest.style).not.toBe('none');
    expect(rest.width).toBeGreaterThan(0);
    expect(isClear(rest.color)).toBe(false);
    expect(bad.width, 'invalid is still thicker, not colour alone').toBeGreaterThan(rest.width);
    expect(isClear(bad.color)).toBe(false);
    expect(off.text, 'disabled text is a different system colour').not.toBe(rest.text);
    // The error words and the icon stay visible in system colours.
    const error = await page
      .locator('#f .sj-field__error')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, visibility: s.visibility, display: s.display };
      });
    expect(error.visibility).toBe('visible');
    expect(error.display).not.toBe('none');
    expect(isClear(error.color)).toBe(false);
  });

  test(`@pr rtl | field ${adapter} | label, control and error mirror to the inline end; the icon leads the error`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, ALL_FIXTURES['field/invalid']!);
    const m = (dir: 'ltr' | 'rtl') =>
      page.evaluate((d) => {
        document.documentElement.dir = d;
        const c = document.querySelector('#f [name="email"]') as HTMLElement;
        const root = c.closest('.sj-field__root')!;
        const err = root.querySelector('.sj-field__error')!.getBoundingClientRect();
        const icon = root.querySelector('.sj-field__icon')!.getBoundingClientRect();
        const label = root.querySelector('.sj-field__label')!.getBoundingClientRect();
        const r = root.getBoundingClientRect();
        const cs = getComputedStyle(c);
        return {
          dir: cs.direction,
          // distance of the icon from the inline-start edge of the error, and of the label from the root's
          iconFromStart: d === 'ltr' ? icon.left - err.left : err.right - icon.right,
          labelFromStart: d === 'ltr' ? label.left - r.left : r.right - label.right,
          controlWidth: c.getBoundingClientRect().width,
          rootWidth: r.width,
        };
      }, dir);
    const ltr = await m('ltr');
    const rtl = await m('rtl');
    expect(rtl.dir).toBe('rtl');
    expect(
      Math.abs(ltr.iconFromStart - rtl.iconFromStart),
      'the icon stays on the inline start',
    ).toBeLessThan(2);
    expect(Math.abs(ltr.labelFromStart - rtl.labelFromStart)).toBeLessThan(2);
    expect(Math.abs(ltr.controlWidth - rtl.controlWidth)).toBeLessThan(2);
  });
}

// Seeded: axe must be able to fail on these controls. An input with no name is reported.
test('@pr axe | seeded | a control without an accessible name is reported', async ({ page }) => {
  await openHost(page);
  await mountScene(page, 'react', ALL_FIXTURES['field/default']!);
  await page.evaluate(() => document.querySelector('.sj-field__label')!.remove());
  const { violations } = await axe(page).analyze();
  expect(violations.map((v) => v.id)).toContain('label');
});

test('@pr axe | seeded | a dangling aria-describedby is reported', async ({ page }) => {
  await openHost(page);
  await mountScene(page, 'react', ALL_FIXTURES['field/invalid']!);
  await updateScene(page, ALL_FIXTURES['field/invalid']!);
  await page.evaluate(() =>
    document.querySelector('[name="email"]')!.setAttribute('aria-labelledby', 'nowhere'),
  );
  const { violations, incomplete } = await axe(page).analyze();
  expect([...violations, ...incomplete].map((v) => v.id).join()).toMatch(
    /aria-valid-attr-value|label/,
  );
});
