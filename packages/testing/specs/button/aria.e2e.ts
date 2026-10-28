// ARIA snapshots for SJButton (W1-C01.f, ADR-013 L2): one YAML file per fixture, shared by every adapter and
// engine. An adapter that diverges in role, name or state fails against the same file; markup noise does not.
// Title format: <component> | <adapter> | <scenario> (not a matrix row: the parity matrix ignores it).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './fixtures';
import { ADAPTERS, COMPONENT } from './matrix';
import { control, mountButton, openHost } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (fixture: string) => readFileSync(join(here, 'aria', `${fixture}.yml`), 'utf8');

for (const adapter of ADAPTERS) {
  for (const fixture of Object.keys(FIXTURES)) {
    test(`${COMPONENT} | ${adapter} | aria snapshot ${fixture}`, async ({ page }) => {
      const errors = await openHost(page);
      await mountButton(page, adapter, fixture, 'native', { form: fixture === 'submit' });
      await expect(page.locator('#box')).toMatchAriaSnapshot(yaml(fixture));
      expect(errors).toEqual([]);
    });
  }
}

// A snapshot is only evidence if a regression fails it. Each case breaks the accessible tree of a mounted
// fixture on purpose and asserts the shared snapshot of that fixture no longer matches.
const SEEDED = [
  {
    fixture: 'icon-only',
    why: 'accessible name removed',
    break: (n: Element) => n.removeAttribute('aria-label'),
  },
  {
    fixture: 'default',
    why: 'role changed to link',
    break: (n: Element) => n.setAttribute('role', 'link'),
  },
  {
    fixture: 'disabled',
    why: 'disabled state dropped',
    break: (n: Element) => n.removeAttribute('disabled'),
  },
] as const;

for (const adapter of ADAPTERS) {
  for (const s of SEEDED) {
    test(`seeded aria regression | ${adapter} | ${s.why} fails the ${s.fixture} snapshot`, async ({
      page,
    }) => {
      await openHost(page);
      await mountButton(page, adapter, s.fixture);
      await control(page).evaluate(s.break);
      await expect(page.locator('#box')).not.toMatchAriaSnapshot(yaml(s.fixture));
    });
  }
}
