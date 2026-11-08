// Automated accessibility for SJDisclosure (W1-C06.f, ADR-013 L3): axe in every state on every adapter and
// engine with `target-size` enabled by name, zero untriaged violations (the shared triage file, which requires
// issue and owner per entry), the WCAG 2.2 named gates that apply (1.4.11 via the contrast matrix in css,
// 2.4.13 focus appearance and 2.5.8 target size on the summary), and the properties the CSS promises that no
// other layer measures: the native marker hidden in every engine, no motion under reduced motion, the
// disabled trigger in GrayText under forced colors, the chevron at the inline end in RTL. The gate verdicts
// and collectors are the L3 harness's own (a11y/), reused unchanged.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFocusAppearance, collectTargets } from '../../a11y/collectors.js';
import { applyAxeTriage, focusAppearance, targetSize, type Triage } from '../../a11y/verdicts.js';
import { contrastRatio } from '../../contrast/wcag.js';
import { ADAPTERS, FIXTURES, type Adapter } from './fixtures';
import { ROOT, TRIGGER } from './open';

const hex = (rgb: string): string =>
  '#' +
  (rgb.match(/\d+/g) ?? ['0', '0', '0'])
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('');

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
  await page.locator(TRIGGER).first().waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
}
const settle = (page: Page, ms = 80) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

/** Keyboard modality so :focus-visible applies (WebKit skips some controls on Tab; focus after one Tab). */
async function focusTrigger(page: Page, browserName: string): Promise<void> {
  await page.keyboard.press('Tab');
  if (browserName === 'webkit') await page.locator(TRIGGER).first().focus();
  expect(await page.evaluate(() => document.activeElement?.localName)).toBe('summary');
}

/** The dark theme as the toolbar sets it: data-theme on the root and the dark page surface behind the control. */
async function setDark(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.style.backgroundColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-surface-dark')
      .trim();
  });
  // Let the colour transition (--sj-duration-fast) finish before measuring.
  await page.waitForTimeout(300);
}

const STATES = [
  { name: 'closed', fixture: 'closed', focus: false },
  { name: 'open', fixture: 'open', focus: false },
  { name: 'disabled', fixture: 'disabled', focus: false },
  { name: 'long-title', fixture: 'long-title', focus: false },
  { name: 'exclusive-group', fixture: 'exclusive-group', focus: false },
  { name: 'closed + focused', fixture: 'closed', focus: true },
  { name: 'open + focused', fixture: 'open', focus: true },
  { name: 'disabled + focused', fixture: 'disabled', focus: true },
] as const;

for (const adapter of ADAPTERS) {
  for (const state of STATES) {
    test(`@pr axe | disclosure ${adapter} | ${state.name} | zero untriaged violations`, async ({
      page,
      browserName,
    }) => {
      await mount(page, adapter, state.fixture);
      if (state.focus) await focusTrigger(page, browserName);
      const results = await axe(page).analyze();
      const ran = [
        ...results.passes,
        ...results.violations,
        ...results.incomplete,
        ...results.inapplicable,
      ].some((r) => r.id === 'target-size');
      expect(ran, 'axe target-size did not run').toBe(true);
      const id = `disclosure-${state.name}`;
      expect(
        applyAxeTriage(results.violations, id, triage).untriaged.map((v) => `${v.id}: ${v.help}`),
      ).toEqual([]);
      expect(
        applyAxeTriage(results.incomplete, id, triage, 'incomplete').untriaged.map(
          (v) => `incomplete ${v.id}: ${v.help}`,
        ),
      ).toEqual([]);
    });
  }

  test(`@pr 2.4.13 | disclosure ${adapter} | the summary focus ring is >= 2px and >= 3:1`, async ({
    page,
    browserName,
  }) => {
    await mount(page, adapter, 'closed');
    await focusTrigger(page, browserName);
    const m = await page.evaluate(collectFocusAppearance);
    expect(m.focusVisible, 'the ring is drawn for keyboard focus').toBe(true);
    expect(focusAppearance(m).failures).toEqual([]);
  });

  test(`@pr 2.4.13 | disclosure ${adapter} | a disabled trigger keeps the focus ring (it stays reachable)`, async ({
    page,
    browserName,
  }) => {
    await mount(page, adapter, 'disabled');
    await focusTrigger(page, browserName);
    const m = await page.evaluate(collectFocusAppearance);
    expect(focusAppearance(m).failures).toEqual([]);
  });

  test(`@pr dark | disclosure ${adapter} | text 4.5:1, ring >= 2px and >= 3:1 on a dark surface`, async ({
    page,
    browserName,
  }) => {
    await mount(page, adapter, 'closed');
    await setDark(page);
    const dark = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      fg: getComputedStyle(document.querySelector('[data-part="trigger"]')!).color,
    }));
    expect(
      contrastRatio(hex(dark.fg), hex(dark.bg)),
      'label on the dark page',
    ).toBeGreaterThanOrEqual(4.5);
    await focusTrigger(page, browserName);
    const v = focusAppearance(await page.evaluate(collectFocusAppearance));
    expect(v.failures).toEqual([]);
  });

  test(`@pr 2.5.8 | disclosure ${adapter} | the summary is at least 24px, the design target 44px`, async ({
    page,
  }) => {
    await mount(page, adapter, 'closed');
    const targets = await page.evaluate(collectTargets);
    expect(targetSize(targets, triage.targetSize, 'disclosure').failures).toEqual([]);
    // The trigger is selected by its part, never as "the first target with a height" (G3A NICE-5).
    expect(targets.length).toBe(1);
    const box = (await page.locator(TRIGGER).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  });

  test(`@pr 2.5.8 | disclosure ${adapter} | every summary of an exclusive group is a 44px target`, async ({
    page,
  }) => {
    await mount(page, adapter, 'exclusive-group');
    const targets = await page.evaluate(collectTargets);
    expect(targets).toHaveLength(3);
    expect(targetSize(targets, triage.targetSize, 'disclosure').failures).toEqual([]);
    for (const t of targets) expect(Math.min(t.w, t.h)).toBeGreaterThanOrEqual(44);
  });

  test(`@pr marker | disclosure ${adapter} | the native summary marker is hidden in every engine`, async ({
    page,
  }) => {
    for (const fixture of ['closed', 'open', 'disabled']) {
      await mount(page, adapter, fixture);
      expect(await markerProblems(page), fixture).toEqual([]);
    }
  });

  test(`@pr reduced-motion | disclosure ${adapter} | nothing animates when the user asks for no motion`, async ({
    page,
  }) => {
    await mount(page, adapter, 'closed');
    // Positive control first: without the preference the chevron really transitions, so the check below can
    // fail (a vacuous "no animation" would also pass on a browser that cannot animate at all).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const normal = await motionOf(page);
    expect(normal.duration, 'chevron transition duration without the preference').toBeGreaterThan(
      0,
    );
    expect(normal.running, 'a transition starts on toggle without the preference').toBeGreaterThan(
      0,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(page, adapter, 'closed');
    const reduced = await motionOf(page);
    expect(reduced.duration, 'chevron transition duration under reduced motion').toBe(0);
    expect(reduced.running, 'animations that ran on toggle under reduced motion').toBe(0);
    expect(reduced.panelDuration).toBe(0);
  });

  test(`@pr forced-colors | disclosure ${adapter} | the disabled trigger is GrayText, the chevron stays visible and still shows the state by shape`, async ({
    page,
  }) => {
    await mount(page, adapter, 'disabled');
    await page.emulateMedia({ forcedColors: 'active' });
    const d = await forcedOf(page);
    expect(d.forced, 'forced-colors emulation is active').toBe(true);
    expect(d.triggerColor, 'disabled trigger text').toBe(d.grayText);
    expect(d.chevronBorder, 'disabled chevron').toBe(d.grayText);
    expect(d.chevronStyle).toBe('solid');
    expect(d.chevronWidth).toBeGreaterThan(0);
    // The enabled trigger is not GrayText: the colour distinguishes inactive from active, not only a tint.
    await mount(page, adapter, 'closed');
    const closed = await forcedOf(page);
    expect(closed.triggerColor).not.toBe(closed.grayText);
    expect(closed.chevronBorder).toBe(closed.canvasText);
    expect(closed.chevronBorder).not.toBe('rgba(0, 0, 0, 0)');
    await page.locator(TRIGGER).click();
    await settle(page);
    const open = await forcedOf(page);
    // State is carried by the chevron's direction, never by colour alone.
    expect(open.rotate).not.toBe(closed.rotate);
    expect(open.chevronBorder).toBe(open.canvasText);
  });

  test(`@pr rtl | disclosure ${adapter} | the title starts at the inline start and the chevron sits at the inline end`, async ({
    page,
  }) => {
    await mount(page, adapter, 'closed');
    const read = async (dir: 'ltr' | 'rtl') => {
      await page.evaluate((d) => void (document.documentElement.dir = d), dir);
      await settle(page, 500); // the chevron's turn is a transition; read the settled value
      return page.evaluate(
        ([d, trigger]) => {
          const s = document.querySelector(trigger!) as HTMLElement;
          const cs = getComputedStyle(s);
          const after = getComputedStyle(s, '::after');
          const range = document.createRange();
          range.selectNodeContents(s.firstChild!);
          const t = range.getBoundingClientRect();
          const b = s.getBoundingClientRect();
          const pad = parseFloat(cs.paddingInlineStart);
          const chevron = parseFloat(after.inlineSize);
          return {
            display: cs.display,
            direction: cs.direction,
            order: after.order,
            content: after.content,
            rotate: after.rotate,
            titleStartGap: d === 'ltr' ? t.left - b.left : b.right - t.right,
            titleEndGap: d === 'ltr' ? b.right - t.right : t.left - b.left,
            pad,
            chevron,
          };
        },
        [dir, TRIGGER] as const,
      );
    };
    for (const dir of ['ltr', 'rtl'] as const) {
      const r = await read(dir);
      expect(r.direction).toBe(dir);
      expect(r.display).toBe('flex');
      expect(r.content, 'the chevron exists').not.toBe('none');
      // The glyph is a logical corner that mirrors with the direction, so the turn flips with it: still a V.
      expect(r.rotate, `${dir}: chevron turn`).toBe(dir === 'ltr' ? '45deg' : '-45deg');
      expect(r.order, 'the chevron is the last flex item').toBe('0');
      expect(Math.abs(r.titleStartGap - r.pad), `${dir}: title at the inline start`).toBeLessThan(
        2,
      );
      // Room for the chevron beyond the padding at the inline end (it is not on the title's side).
      expect(
        r.titleEndGap,
        `${dir}: the inline end is free for the chevron`,
      ).toBeGreaterThanOrEqual(r.pad + r.chevron);
    }
  });
}

/** Marker problems: the title must start exactly at the padding (a visible marker would push it), and the
 *  list marker must be off in every engine's own mechanism. Empty when clean. */
async function markerProblems(page: Page): Promise<string[]> {
  return page.evaluate((trigger) => {
    const s = document.querySelector(trigger) as HTMLElement;
    const cs = getComputedStyle(s);
    const out: string[] = [];
    if (cs.listStyleType !== 'none') out.push(`list-style-type is ${cs.listStyleType}`);
    if (cs.display !== 'flex') out.push(`display is ${cs.display} (a list-item shows a marker)`);
    const range = document.createRange();
    range.selectNodeContents(s.firstChild!);
    const gap = Math.abs(
      range.getBoundingClientRect().left -
        s.getBoundingClientRect().left -
        parseFloat(cs.paddingLeft),
    );
    if (gap > 1.5)
      out.push(`the title is ${gap.toFixed(1)}px past the padding: something precedes it`);
    return out;
  }, TRIGGER);
}

/** Transition duration of the chevron, whether a transition actually ran on toggle, and the panel's. */
async function motionOf(page: Page) {
  const duration = await page.evaluate(
    (trigger) =>
      parseFloat(
        getComputedStyle(document.querySelector(trigger)!, '::after').transitionDuration.split(
          ',',
        )[0]!,
      ),
    TRIGGER,
  );
  const panelDuration = await page.evaluate(
    (root) =>
      parseFloat(
        getComputedStyle(document.querySelector(root)!.querySelector('[data-part="content"]')!)
          .transitionDuration,
      ),
    ROOT,
  );
  await page.locator(TRIGGER).click();
  const running = await page.evaluate(
    () =>
      new Promise<number>((r) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            r(document.getAnimations().filter((a) => a.playState !== 'finished').length),
          ),
        ),
      ),
  );
  await settle(page, 400);
  return { duration, running, panelDuration };
}

async function forcedOf(page: Page) {
  return page.evaluate(
    ([trigger]) => {
      const s = document.querySelector(trigger!) as HTMLElement;
      const probe = (color: string) => {
        const p = document.createElement('i');
        p.style.color = color;
        document.body.appendChild(p);
        const c = getComputedStyle(p).color;
        p.remove();
        return c;
      };
      const after = getComputedStyle(s, '::after');
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        triggerColor: getComputedStyle(s).color,
        grayText: probe('GrayText'),
        canvasText: probe('CanvasText'),
        chevronBorder: after.borderBlockEndColor,
        chevronStyle: after.borderBlockEndStyle,
        chevronWidth: parseFloat(after.borderBlockEndWidth),
        rotate: after.rotate,
      };
    },
    [TRIGGER] as const,
  );
}

// Seeded: axe must be able to fail on this control, and each CSS promise must be able to fail.
test('@pr axe | seeded | a disclosure without an accessible name is reported', async ({ page }) => {
  await mount(page, 'react', 'closed');
  await page.evaluate(() => {
    document.querySelector('[data-part="trigger"]')!.textContent = '';
  });
  const { violations } = await axe(page).analyze();
  expect(violations.map((v) => v.id)).toContain('summary-name');
});

test('@pr marker | seeded | a visible native marker is reported', async ({ page }) => {
  await mount(page, 'react', 'closed');
  await page.addStyleTag({
    content:
      '.sj-disclosure__trigger{display:list-item !important;list-style:disclosure-closed inside !important;justify-content:normal}',
  });
  expect((await markerProblems(page)).length).toBeGreaterThan(0);
});

test('@pr reduced-motion | seeded | a chevron that still transitions under reduced motion is reported', async ({
  page,
}) => {
  await mount(page, 'react', 'closed');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '.sj-disclosure__trigger::after{transition-duration:300ms !important;transition-property:rotate !important}',
  });
  const m = await motionOf(page);
  expect(m.duration).toBeGreaterThan(0);
  expect(m.running).toBeGreaterThan(0);
});

test('@pr forced-colors | seeded | a disabled trigger that is not GrayText is reported', async ({
  page,
}) => {
  await mount(page, 'react', 'disabled');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.addStyleTag({
    content: '.sj-disclosure__trigger{color:CanvasText !important}',
  });
  const d = await forcedOf(page);
  expect(d.triggerColor).not.toBe(d.grayText);
});
