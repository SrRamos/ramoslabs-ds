// ARIA snapshots for SJState (W1-C11.f, ADR-013 L2): one YAML file per fixture, shared by every adapter and engine.
// The tree is the headline paragraph, the description and the action; the decorative icon contributes nothing and
// the live regions sit outside the mounted tree (they are checked in l2.e2e.ts). An adapter that diverges in role
// or name fails against the same file; markup noise does not.
// Title format: <component> | <adapter> | <scenario> (not a matrix row: the parity matrix ignores it).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './fixtures';
import { ADAPTERS, COMPONENT } from './matrix';
import { mountState, openHost, part } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (fixture: string) => readFileSync(join(here, 'aria', `${fixture}.yml`), 'utf8');

/** Nothing inside the mounted tree may be an image, a status or an alert (the icon is decorative, live markup is outside). */
async function noExtraRoles(page: import('@playwright/test').Page) {
  for (const role of ['img', 'status', 'alert'] as const)
    await expect(page.locator('#mount').getByRole(role), role).toHaveCount(0);
}

for (const adapter of ADAPTERS) {
  for (const fixture of Object.keys(FIXTURES)) {
    test(`${COMPONENT} | ${adapter} | aria snapshot ${fixture}`, async ({ page }) => {
      const errors = await openHost(page);
      await mountState(page, adapter, fixture);
      await expect(page.locator('#mount')).toMatchAriaSnapshot(yaml(fixture));
      // A snapshot template matches as a subset, so the roles that must be absent are counted too.
      await noExtraRoles(page);
      expect(errors).toEqual([]);
    });
  }
}

// A snapshot is only evidence if a regression fails it. Each case breaks the accessible tree of a mounted fixture
// on purpose and asserts the shared snapshot (plus the absent-role counts) no longer holds.
const SEEDED = [
  {
    fixture: 'error',
    why: 'decorative icon exposed as an image',
    break: (root: Element) => {
      const icon = root.querySelector('[data-part="icon"]')!;
      icon.removeAttribute('aria-hidden');
      icon.querySelector('svg')!.removeAttribute('aria-hidden');
      icon.querySelector('svg')!.setAttribute('role', 'img');
      icon.querySelector('svg')!.setAttribute('aria-label', 'Alert');
    },
  },
  {
    fixture: 'loading',
    why: 'live markup rendered on the root',
    break: (root: Element) => {
      const r = root.querySelector('[data-part="root"]')!;
      r.setAttribute('role', 'status');
      r.setAttribute('aria-live', 'polite');
    },
  },
  {
    fixture: 'no-results',
    why: 'heading text replaced',
    break: (root: Element) => {
      root.querySelector('[data-part="title"]')!.textContent = 'Something else';
    },
  },
  {
    fixture: 'first-use',
    why: 'action removed',
    break: (root: Element) => root.querySelector('[data-part="actions"]')!.remove(),
  },
] as const;

for (const adapter of ADAPTERS) {
  for (const s of SEEDED) {
    test(`seeded aria regression | ${adapter} | ${s.why} fails the ${s.fixture} snapshot`, async ({
      page,
    }) => {
      await openHost(page);
      await mountState(page, adapter, s.fixture);
      await part(page, 'title').waitFor();
      await page.locator('#mount').evaluate(s.break);
      const snapshotMatches = await expect(page.locator('#mount'))
        .toMatchAriaSnapshot(yaml(s.fixture), { timeout: 1000 })
        .then(
          () => true,
          () => false,
        );
      const extras = await page
        .locator('#mount')
        .evaluate(
          (n) => n.querySelectorAll('[role="img"], [role="status"], [role="alert"]').length,
        );
      expect(snapshotMatches && extras === 0, 'the regression went unnoticed').toBe(false);
    });
  }
}
