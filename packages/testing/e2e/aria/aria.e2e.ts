// ARIA snapshots (W1-309c, ADR-013 L2): one YAML file per contract state, shared by every adapter
// and every engine. Playwright derives the tree from the accessibility semantics, so an adapter
// that diverges in role, name or state fails against the same file; markup noise does not.
// Title format (parsed by the parity matrix, W1-313): `<component> | <adapter> | <scenario>`.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, mountProbe, openHost } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (state: string) => readFileSync(join(here, 'snapshots', `${state}.yml`), 'utf8');
/** One file per state: `off`, `on` and the inert `disabled` fixture. */
const STATES = ['off', 'on', 'disabled'] as const;

for (const adapter of ADAPTERS) {
  for (const state of STATES) {
    test(`SJProbe | ${adapter} | aria snapshot ${state}`, async ({ page }) => {
      const errors = await openHost(page);
      await mountProbe(page, adapter, state);
      await expect(page.locator('[data-part="root"]')).toMatchAriaSnapshot(yaml(state));
      expect(errors).toEqual([]);
    });
  }
}

// The snapshot is only evidence if a regression fails it. Each case seeds a wrapper defect (host
// DEFECTS) and asserts the snapshot of the state it breaks does NOT match.
const SEEDED = [
  // aria-checked stuck at "false" after the first change: after toggling off -> on, the `on`
  // snapshot must reject it.
  { adapter: 'vue', defect: 'vue-wrong-aria', state: 'on', from: 'off' },
] as const;

for (const s of SEEDED) {
  test(`seeded aria regression | ${s.adapter} | ${s.defect} fails the ${s.state} snapshot`, async ({
    page,
  }) => {
    await openHost(page);
    await mountProbe(page, s.adapter, s.from, s.defect);
    await page.locator('[data-part="root"]').click();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    await expect(page.locator('[data-part="root"]')).not.toMatchAriaSnapshot(yaml(s.state));
  });
}
