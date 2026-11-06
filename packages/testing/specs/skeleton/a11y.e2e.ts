// L3 automated accessibility for SJSkeleton (ADR-013 L3): axe in every fixture on every adapter and engine (zero
// untriaged violations, zero untriaged `incomplete`), also with the group's placeholder VISIBLE; reduced motion (2.2.2:
// no sweep, no gradient, a flat fill); forced colors (ADR-009: a 1px CanvasText border, no gradient); RTL (the sweep
// runs the other way and the layout mirrors); the placeholder is decorative, so no contrast floor is asserted for the
// fill, only that it is the token colour. Every gate also has a SEEDED failing case. Reuses the L3 verdicts.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAxeTriage, validateTriage, type Triage } from '../../a11y/verdicts.js';
import { FIXTURES, SHAPE_FIXTURES } from './fixtures';
import { ADAPTERS } from './matrix';
import { mountSkeleton, openHost, waitState } from './open';

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
) {
  const errors = await openHost(page);
  await mountSkeleton(page, adapter, fixture, 'native', { props: props as never });
  return errors;
}

async function expectClean(page: Page, name: string) {
  const results = await axe(page).analyze();
  expect(
    applyAxeTriage(results.violations, name, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
  ).toEqual([]);
  // `incomplete` is an unreviewed finding: it fails unless triaged with reviewed: "pass", an issue and an owner.
  expect(
    applyAxeTriage(results.incomplete, name, triage, 'incomplete').untriaged.map(
      (v) => `incomplete ${v.id}: ${v.help}`,
    ),
  ).toEqual([]);
}

test('@pr triage file is valid: every entry names an issue and an owner', () => {
  expect(validateTriage(triage)).toEqual([]);
});

for (const adapter of ADAPTERS) {
  for (const fixture of FIXTURE_NAMES) {
    test(`@pr axe | skeleton ${adapter} | ${fixture} | zero untriaged violations`, async ({
      page,
    }) => {
      const errors = await mount(page, adapter, fixture);
      await expectClean(page, `skeleton-${fixture}`);
      expect(errors).toEqual([]);
    });
  }

  test(`@pr axe | skeleton ${adapter} | group-loading | placeholder visible (busy), zero untriaged violations`, async ({
    page,
  }) => {
    const errors = await mount(page, adapter, 'group-loading', { delay: 0, minDuration: 60000 });
    await waitState(page, 'visible');
    await expectClean(page, 'skeleton-group-loading');
    expect(errors).toEqual([]);
  });

  test(`@pr axe | skeleton ${adapter} | seeded: a focusable placeholder shape is reported`, async ({
    page,
  }) => {
    await mount(page, adapter, 'circle');
    await page
      .locator('#mount [data-shape="circle"]')
      .evaluate((n) => n.setAttribute('tabindex', '0'));
    const results = await axe(page).analyze();
    expect(results.violations.map((v) => v.id)).toContain('aria-hidden-focus');
  });
}

// ---- what a drawn box looks like under each media setting ------------------------------------------------------

const BOXES =
  '#mount [data-shape="circle"], #mount [data-shape="rect"], #mount [data-shape="block"], #mount .sj-skeleton__line';

const measureBoxes = (page: Page) =>
  page.evaluate((sel) => {
    const probe = document.createElement('span');
    probe.style.color = 'CanvasText';
    document.body.append(probe);
    const canvasText = getComputedStyle(probe).color;
    probe.remove();
    return {
      forced: matchMedia('(forced-colors: active)').matches,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      canvasText,
      boxes: [...document.querySelectorAll(sel)].map((el) => {
        const s = getComputedStyle(el);
        return {
          animation: s.animationName,
          iterations: s.animationIterationCount,
          direction: s.animationDirection,
          image: s.backgroundImage,
          color: s.backgroundColor,
          borderWidth: s.borderTopWidth,
          borderStyle: s.borderTopStyle,
          borderColor: s.borderTopColor,
        };
      }),
    };
  }, BOXES);

type Measure = Awaited<ReturnType<typeof measureBoxes>>;

/** Verdicts: empty means the setting is honoured. */
const reducedProblems = (m: Measure): string[] =>
  m.boxes.flatMap((b, i) => [
    ...(b.animation !== 'none' ? [`box ${i} still animates (${b.animation})`] : []),
    ...(b.image !== 'none' ? [`box ${i} still has a gradient`] : []),
  ]);
const forcedProblems = (m: Measure): string[] => [
  ...(m.forced ? [] : ['forced colors not active']),
  ...m.boxes.flatMap((b, i) => [
    ...(b.borderWidth !== '1px' || b.borderStyle !== 'solid'
      ? [`box ${i} has no 1px solid border (${b.borderWidth} ${b.borderStyle})`]
      : []),
    ...(b.borderColor !== m.canvasText
      ? [`box ${i} border ${b.borderColor} is not CanvasText`]
      : []),
    ...(b.image !== 'none' ? [`box ${i} still has a gradient`] : []),
    ...(b.animation !== 'none' ? [`box ${i} still animates`] : []),
  ]),
];

const SAMPLE = ['text', 'circle', 'rect', 'block'] as const;

for (const adapter of ADAPTERS) {
  for (const fixture of SHAPE_FIXTURES) {
    test(`@pr reduced-motion | skeleton ${adapter} | ${fixture} | no animation, no gradient, a flat fill (2.2.2)`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mount(page, adapter, fixture);
      const m = await measureBoxes(page);
      expect(m.reduced).toBe(true);
      expect(m.boxes.length).toBeGreaterThan(0);
      expect(reducedProblems(m)).toEqual([]);
      // Still drawn: the fill is the base token colour (slate 200), not transparent.
      for (const b of m.boxes) expect(b.color).toBe('rgb(226, 232, 240)');
    });
  }

  test(`@pr reduced-motion | skeleton ${adapter} | the sweep is finite when motion is allowed (2.2.2) and removed by the media query`, async ({
    page,
  }) => {
    await mount(page, adapter, 'rect');
    const on = await measureBoxes(page);
    expect(on.boxes[0]!.animation).toBe('sj-skeleton-shimmer');
    expect(on.boxes[0]!.iterations).not.toBe('infinite');
    expect(on.boxes[0]!.image).toContain('linear-gradient');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(reducedProblems(await measureBoxes(page))).toEqual([]);
  });

  test(`@pr reduced-motion | skeleton ${adapter} | seeded: without the preference the verdict reports the sweep`, async ({
    page,
  }) => {
    await mount(page, adapter, 'rect');
    expect(reducedProblems(await measureBoxes(page)).length).toBeGreaterThan(0);
  });

  for (const fixture of [...SAMPLE, 'circle-xl', 'block-static'] as const) {
    test(`@pr forced-colors | skeleton ${adapter} | ${fixture} | a 1px CanvasText border draws the shape, no gradient, no sweep`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await mount(page, adapter, fixture);
      const m = await measureBoxes(page);
      expect(m.boxes.length).toBeGreaterThan(0);
      expect(forcedProblems(m)).toEqual([]);
    });
  }

  test(`@pr forced-colors | skeleton ${adapter} | group-loading | the visible placeholder keeps its borders; the container paints nothing`, async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await mount(page, adapter, 'group-loading', { delay: 0, minDuration: 60000 });
    await waitState(page, 'visible');
    const m = await measureBoxes(page);
    expect(m.boxes.length).toBeGreaterThan(1);
    expect(forcedProblems(m)).toEqual([]);
    const container = await page.locator('#mount [data-shape="group"]').evaluate((n) => {
      const s = getComputedStyle(n);
      return [s.borderTopWidth, s.backgroundImage];
    });
    expect(container).toEqual(['0px', 'none']);
  });

  test(`@pr forced-colors | skeleton ${adapter} | seeded: a box without the border is reported`, async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await mount(page, adapter, 'rect');
    await page
      .locator('#mount [data-shape="rect"]')
      .evaluate((n) => ((n as HTMLElement).style.border = '0'));
    expect(forcedProblems(await measureBoxes(page)).length).toBeGreaterThan(0);
  });

  // ---- RTL ----------------------------------------------------------------------------------------------------

  test(`@pr rtl | skeleton ${adapter} | dir=rtl reverses the sweep; ltr runs it forward`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    for (const fixture of SAMPLE) {
      await mountSkeleton(page, adapter, fixture);
      const ltr = await measureBoxes(page);
      expect(
        ltr.boxes.every((b) => b.direction === 'normal'),
        `${fixture} ltr`,
      ).toBe(true);
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      const rtl = await measureBoxes(page);
      expect(rtl.boxes.length).toBeGreaterThan(0);
      expect(
        rtl.boxes.every((b) => b.direction === 'reverse'),
        `${fixture} rtl`,
      ).toBe(true);
      await page.evaluate(() => document.documentElement.removeAttribute('dir'));
    }
    expect(errors).toEqual([]);
  });

  test(`@pr rtl | skeleton ${adapter} | dir=rtl mirrors the layout (avatar on the right) and axe stays clean`, async ({
    page,
  }) => {
    const errors = await mount(page, adapter, 'group-loading', { delay: 0, minDuration: 60000 });
    await waitState(page, 'visible');
    const sides = () =>
      page.evaluate(() => {
        const c = document.querySelector('#mount [data-shape="circle"]')!.getBoundingClientRect();
        const t = document.querySelector('#mount [data-shape="text"]')!.getBoundingClientRect();
        const g = document.querySelector('#mount [data-shape="group"]')!.getBoundingClientRect();
        return {
          circleLeft: c.left,
          circleRight: c.right,
          textLeft: t.left,
          groupRight: g.right,
          groupLeft: g.left,
        };
      });
    const ltr = await sides();
    expect(ltr.circleLeft).toBe(ltr.groupLeft);
    expect(ltr.textLeft).toBeGreaterThan(ltr.circleLeft);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const rtl = await sides();
    expect(rtl.circleRight).toBeCloseTo(rtl.groupRight, 0);
    expect(rtl.textLeft).toBeLessThan(rtl.circleLeft);
    await expectClean(page, 'skeleton-group-loading');
    expect(errors).toEqual([]);
  });
}
