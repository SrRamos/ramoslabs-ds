// Shared by the ARIA specs: opens the runner host page and mounts the probe fixtures.
import type { Page } from '@playwright/test';

export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];

/** Contract fixture name -> props (the component author's map, same as the runner's). */
export const FIXTURES: Record<string, Record<string, unknown>> = {
  off: {},
  on: { defaultPressed: true },
  disabled: { disabled: true },
};

export async function openHost(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  return errors;
}

export async function mountProbe(
  page: Page,
  adapter: Adapter,
  fixture: string,
  defect = 'none',
): Promise<void> {
  const props = FIXTURES[fixture];
  if (!props) throw new Error(`unknown fixture "${fixture}"`);
  await page.evaluate(
    ([a, p, d]) => window.__sj.mount(a as 'react', p as never, d as 'none').then(() => undefined),
    [adapter, props, defect] as const,
  );
  await page.locator('[data-part="root"]').waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 40)));
}
