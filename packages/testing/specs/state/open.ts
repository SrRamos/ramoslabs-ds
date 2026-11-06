// Shared by the SJState Playwright specs: open the host, mount a fixture, find the parts and the live regions.
import type { Page } from '@playwright/test';
import type { AdapterName, MountOptions } from './host/entry';
import type { LiveRegionInfo, Spoken } from './host/ssr-tree';

export type { AdapterName, LiveRegionInfo, Spoken };

/** Collects page errors; every spec asserts the list is empty. */
export async function openHost(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__state?.ready === true);
  return errors;
}

export async function mountState(
  page: Page,
  adapter: AdapterName,
  fixture: string,
  path = 'native',
  opts: MountOptions = {},
): Promise<void> {
  await page.evaluate(
    ([a, f, p, o]) => window.__state.mount(a as AdapterName, f as string, p as string, o as never),
    [adapter, fixture, path, opts] as const,
  );
  await page.locator('#mount > [data-part="root"]').waitFor();
}

/** Re-renders the mounted instance with these props merged over the current ones. */
export async function updateState(page: Page, props: Record<string, unknown>): Promise<void> {
  await page.evaluate((p) => window.__state.update(p as never), props);
}

/** Everything the live hosts received since the last mount. */
export const spoken = (page: Page): Promise<Spoken[]> =>
  page.evaluate(() => [...window.__state.spoken]);

/** The live regions in the document. */
export const regions = (page: Page): Promise<LiveRegionInfo[]> =>
  page.evaluate(() => window.__state.regions());

/** The root part. */
export const root = (page: Page) => page.locator('#mount > [data-part="root"]');
export const part = (page: Page, name: string) =>
  root(page).locator(`:scope > [data-part="${name}"]`);

export const settle = (page: Page, ms = 80) => page.waitForTimeout(ms);
