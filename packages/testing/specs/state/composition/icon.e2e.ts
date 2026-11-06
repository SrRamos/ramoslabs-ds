// SJState x SJIcon composition (W1-C11.f). The state's `icon` part is a decorative, aria-hidden box that holds an
// SJIcon (size lg). Asserts, on 3 engines x 3 adapters:
//  - the part holds exactly one SJIcon and is aria-hidden, so the glyph is not in the accessibility tree whatever
//    the SJIcon's own `label` says (the part wins, and it is reported as ignored);
//  - the glyph takes its colour from the part (currentColor) and has the lg token size;
//  - the state's data-variant stays on the state's own parts and never reaches the SJIcon;
//  - axe is clean for each composition (a labelled icon inside an aria-hidden part is not an `img` without a name);
//  - the spinner keeps announcing through the heading only, and stops moving under prefers-reduced-motion.
// Title format: SJState x SJIcon | <adapter> | <composition> | <check> (not a parity matrix row).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAxeTriage, type Triage } from '../../../a11y/verdicts.js';
import { loadTokens } from '../../../contrast/index.js';
import { FIXTURES, headingOf } from '../fixtures';
import { ADAPTERS } from '../matrix';
import { mountState, openHost, part, spoken } from '../open';
import { COMPOSITIONS } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const triage: Triage = JSON.parse(
  readFileSync(join(here, '..', '..', '..', 'a11y', 'triage.json'), 'utf8'),
);
const tokens = loadTokens();
const lgPx = parseFloat(tokens['icon-size-lg']!) * 16;
const T = (adapter: string, name: string, check: string) =>
  `SJState x SJIcon | ${adapter} | ${name} | ${check}`;

async function mount(page: Page, adapter: (typeof ADAPTERS)[number], name: string) {
  const c = COMPOSITIONS[name]!;
  const errors = await openHost(page);
  await mountState(page, adapter, c.base, 'native', { props: c.props });
  return errors;
}

for (const adapter of ADAPTERS) {
  for (const name of Object.keys(COMPOSITIONS)) {
    test(
      T(adapter, name, 'one SJIcon in a decorative part; hidden from the accessibility tree'),
      async ({ page }) => {
        const errors = await mount(page, adapter, name);
        const c = COMPOSITIONS[name]!;
        const holder = part(page, 'icon');
        await expect(holder).toHaveAttribute('aria-hidden', 'true');
        expect(await holder.evaluate((n) => n.localName)).toBe('span');
        await expect(holder.locator('svg.sj-icon')).toHaveCount(1);
        // No image role anywhere in the tree: the part hides the glyph even when the SJIcon carries a label.
        await expect(page.locator('#mount').getByRole('img')).toHaveCount(0);
        if (c.props.icon?.label) {
          // The SJIcon itself still renders its label markup (it is the part that hides it).
          expect(await holder.locator('svg').getAttribute('aria-label')).toBe(c.props.icon.label);
          expect(await page.locator('#mount').ariaSnapshot()).not.toContain(c.props.icon.label);
        }
        // The heading is the only name for the kind.
        await expect(part(page, 'title')).toHaveText(headingOf(FIXTURES[c.base]!)!);
        // The state's data-variant stays on its own parts.
        expect(await holder.locator('svg').getAttribute('data-variant')).toBeNull();
        expect(errors).toEqual([]);
      },
    );

    test(
      T(adapter, name, 'glyph takes the part colour (currentColor) and the lg token size'),
      async ({ page }) => {
        await mount(page, adapter, name);
        const m = await part(page, 'icon').evaluate((n) => {
          const svg = n.querySelector('svg')!;
          // Computed size, not the bounding box: the spinner is rotating and its box grows.
          const s = getComputedStyle(svg);
          return {
            partColor: getComputedStyle(n).color,
            stroke: getComputedStyle(svg.firstElementChild!).stroke,
            w: parseFloat(s.width),
            h: parseFloat(s.height),
          };
        });
        expect(m.stroke).toBe(m.partColor);
        expect(Math.abs(m.w - lgPx)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(m.h - lgPx)).toBeLessThanOrEqual(0.5);
      },
    );

    test(T(adapter, name, 'axe is clean'), async ({ page }) => {
      const errors = await mount(page, adapter, name);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .include('#root')
        .analyze();
      expect(
        applyAxeTriage(results.violations, `state-${name}`, triage).untriaged.map((v) => v.id),
      ).toEqual([]);
      expect(
        applyAxeTriage(results.incomplete, `state-${name}`, triage, 'incomplete').untriaged.map(
          (v) => v.id,
        ),
      ).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test(
    T(
      adapter,
      'icon-spinner',
      'announced by the heading once; the glyph is static under reduced motion',
    ),
    async ({ page }) => {
      await mount(page, adapter, 'icon-spinner');
      expect(await spoken(page)).toEqual([{ role: 'status', text: 'Loading projects' }]);
      const name = () =>
        part(page, 'icon')
          .locator('svg')
          .evaluate((n) => getComputedStyle(n).animationName);
      expect(await name()).toBe('sj-icon-spin');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await name()).toBe('none');
    },
  );
}
