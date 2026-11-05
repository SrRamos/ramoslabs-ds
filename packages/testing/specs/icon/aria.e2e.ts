// ARIA snapshots for SJIcon (W1-C12.f, ADR-013 L2): one YAML file per fixture, shared by every adapter and
// engine. A decorative icon leaves only the surrounding text in the tree; a labelled icon is one `img`. An
// adapter that diverges in role or name fails against the same file; markup noise does not.
// Title format: <component> | <adapter> | <scenario> (not a matrix row: the parity matrix ignores it).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, LABELLED } from './fixtures';
import { ADAPTERS, COMPONENT } from './matrix';
import { glyph, mountIcon, openHost } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (fixture: string) => readFileSync(join(here, 'aria', `${fixture}.yml`), 'utf8');

for (const adapter of ADAPTERS) {
  for (const fixture of Object.keys(FIXTURES)) {
    test(`${COMPONENT} | ${adapter} | aria snapshot ${fixture}`, async ({ page }) => {
      const errors = await openHost(page);
      await mountIcon(page, adapter, fixture);
      await expect(page.locator('#box')).toMatchAriaSnapshot(yaml(fixture));
      // A snapshot template matches as a subset, so the images in the tree are counted too: a decorative icon
      // contributes none, a labelled icon exactly one.
      await expect(page.getByRole('img')).toHaveCount(LABELLED.includes(fixture) ? 1 : 0);
      expect(errors).toEqual([]);
    });
  }
}

// A snapshot is only evidence if a regression fails it. Each case breaks the accessible tree of a mounted
// fixture on purpose and asserts the shared snapshot of that fixture no longer matches.
const SEEDED = [
  {
    fixture: 'labelled',
    why: 'accessible name removed',
    break: (n: Element) => n.removeAttribute('aria-label'),
    images: 1,
  },
  {
    fixture: 'labelled',
    why: 'role changed to link',
    break: (n: Element) => n.setAttribute('role', 'link'),
    images: 1,
  },
  {
    fixture: 'default',
    why: 'decorative icon exposed as an image',
    break: (n: Element) => {
      n.removeAttribute('aria-hidden');
      n.setAttribute('role', 'img');
      n.setAttribute('aria-label', 'Search');
    },
    images: 0,
  },
] as const;

for (const adapter of ADAPTERS) {
  for (const s of SEEDED) {
    test(`seeded aria regression | ${adapter} | ${s.why} fails the ${s.fixture} snapshot`, async ({
      page,
    }) => {
      await openHost(page);
      await mountIcon(page, adapter, s.fixture);
      await glyph(page).evaluate(s.break);
      // Either the subset snapshot no longer matches, or the image count differs from the fixture's contract.
      const snapshotMatches = await expect(page.locator('#box'))
        .toMatchAriaSnapshot(yaml(s.fixture), { timeout: 1000 })
        .then(
          () => true,
          () => false,
        );
      const images = await page.getByRole('img').count();
      expect(snapshotMatches && images === s.images, 'the regression went unnoticed').toBe(false);
    });
  }
}
