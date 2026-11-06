// SJSkeleton x SJState composition. The state's `skeleton` part (loading variant only) holds SJSkeleton shapes.
// Asserts, on 3 engines x 3 adapters:
//  - the part is a div, aria-hidden, between the heading and the end of the state, and holds the shapes;
//  - the accessibility tree is the heading and nothing else (shapes are hidden, a group inside is hidden with them);
//  - the state is busy and speaks its heading exactly once, through the one polite status region;
//  - a group inside the slot with `announce` equal to the heading does not double-announce (the registry drops
//    identical text); with a DIFFERENT announce both messages are spoken (documented: omit `announce` inside a state);
//  - the group inside the state still owns its timing: pending (invisible, reserves space), then visible;
//  - axe is clean, in a left-to-right and a right-to-left document.
// Title format: SJSkeleton x SJState | <adapter> | <composition> | <check> (not a parity matrix row).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAxeTriage, type Triage } from '../../../a11y/verdicts.js';
import { ADAPTERS } from '../matrix';
import { mountComposition, openHost, regions, root, settle, spoken } from '../open';
import { COMPOSITIONS, HEADING } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const triage: Triage = JSON.parse(
  readFileSync(join(here, '..', '..', '..', 'a11y', 'triage.json'), 'utf8'),
);
const T = (adapter: string, name: string, check: string) =>
  `SJSkeleton x SJState | ${adapter} | ${name} | ${check}`;

async function mount(page: Page, adapter: (typeof ADAPTERS)[number], name: string) {
  const errors = await openHost(page);
  await mountComposition(page, adapter, COMPOSITIONS[name]!.props, 'native', { settle: false });
  return errors;
}

/** Long enough for the delay (60 ms), the group's announcement and the registry's deferred write. */
const done = (page: Page) => settle(page, 450);
const skeletonPart = (page: Page) => root(page).locator(':scope > [data-part="skeleton"]');

for (const adapter of ADAPTERS) {
  for (const name of Object.keys(COMPOSITIONS)) {
    test(
      T(
        adapter,
        name,
        'the skeleton part is an aria-hidden div holding the shapes; the tree is the heading alone',
      ),
      async ({ page }) => {
        const errors = await mount(page, adapter, name);
        await done(page);
        const part = skeletonPart(page);
        await expect(part).toHaveCount(1);
        await expect(part).toHaveAttribute('aria-hidden', 'true');
        await expect(part).toHaveAttribute('data-variant', 'loading');
        expect(await part.evaluate((n) => n.localName)).toBe('div');
        expect(await part.evaluate((n) => n.className.split(' '))).toContain('sj-state__skeleton');
        await expect(part.locator('[data-shape="circle"]')).toHaveCount(1);
        await expect(part.locator('[data-shape="text"]')).toHaveCount(1);
        // Order: heading first, then the skeleton part.
        expect(
          await root(page).evaluate((n) => [...n.children].map((c) => c.getAttribute('data-part'))),
        ).toEqual(['title', 'skeleton']);
        expect((await page.locator('#root').ariaSnapshot()).replace(/^\s+/gm, '').trim()).toBe(
          `- main:\n- paragraph: ${HEADING}\n- paragraph: Content after the skeleton`,
        );
        await expect(root(page)).toHaveAttribute('aria-busy', 'true');
        expect(errors).toEqual([]);
      },
    );

    test(
      T(
        adapter,
        name,
        'speaks through the one polite status region, with the announcements this composition documents',
      ),
      async ({ page }) => {
        const errors = await mount(page, adapter, name);
        await done(page);
        expect(await spoken(page)).toEqual(COMPOSITIONS[name]!.spoken);
        const live = await regions(page);
        expect(live.filter((r) => r.role === 'status')).toHaveLength(1);
        expect(live.filter((r) => r.role === 'alert')).toHaveLength(0);
        expect(await page.locator('#mount [aria-live], #mount [role="status"]').count()).toBe(0);
        // Later nothing more is said.
        await settle(page, 300);
        expect(await spoken(page)).toEqual(COMPOSITIONS[name]!.spoken);
        expect(errors).toEqual([]);
      },
    );

    test(T(adapter, name, 'axe is clean, left-to-right and right-to-left'), async ({ page }) => {
      const errors = await mount(page, adapter, name);
      await done(page);
      for (const dir of [null, 'rtl'] as const) {
        if (dir) await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .include('#root')
          .analyze();
        const n = `skeleton-state-${name}`;
        expect(applyAxeTriage(results.violations, n, triage).untriaged).toEqual([]);
        expect(applyAxeTriage(results.incomplete, n, triage, 'incomplete').untriaged).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }

  test(
    T(
      adapter,
      'group-silent',
      'the group inside the state keeps its own timing: pending first, shown after the delay',
    ),
    async ({ page }) => {
      const errors = await openHost(page);
      await mountComposition(
        page,
        adapter,
        { ...COMPOSITIONS['group-silent']!.props, delay: 250 },
        'native',
        {
          settle: false,
        },
      );
      const group = page.locator('#mount [data-shape="group"]');
      await expect(group).toHaveAttribute('data-state', 'pending');
      expect(await group.evaluate((n) => getComputedStyle(n).visibility)).toBe('hidden');
      expect((await group.boundingBox())!.height).toBeGreaterThan(0);
      await expect(group).toHaveAttribute('data-state', 'visible');
      expect(await group.evaluate((n) => getComputedStyle(n).visibility)).toBe('visible');
      expect(errors).toEqual([]);
    },
  );
}
