// Shared by the SJSkeleton Playwright specs: open the host, mount a fixture, find the parts, read the trace.
import type { Page } from '@playwright/test';
import type { AdapterName, MountOptions, Sample, TraceEntry } from './host/entry';
import type { StateCompositionProps } from './host/ssr-tree';
import type { LiveRegionInfo, Spoken } from './host/ssr-tree';
import type { FixtureProps } from './fixtures';

export type { AdapterName, LiveRegionInfo, Sample, Spoken, StateCompositionProps, TraceEntry };

/** Collects page errors; every spec asserts the list is empty. */
export async function openHost(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__skeleton?.ready === true);
  return errors;
}

export async function mountSkeleton(
  page: Page,
  adapter: AdapterName,
  fixture: string,
  path = 'native',
  opts: MountOptions = {},
): Promise<void> {
  await page.evaluate(
    ([a, f, p, o]) =>
      window.__skeleton.mount(a as AdapterName, f as string, p as string, o as never),
    [adapter, fixture, path, opts] as const,
  );
  await page.locator('#mount > [data-part="root"]').waitFor({ state: 'attached' });
}

export async function mountComposition(
  page: Page,
  adapter: AdapterName,
  comp: StateCompositionProps,
  path = 'native',
  opts: { settle?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ([a, c, p, o]) =>
      window.__skeleton.mountComposition(a as AdapterName, c as never, p as string, o),
    [adapter, comp, path, opts] as const,
  );
  await page.locator('#mount > [data-part="root"]').waitFor({ state: 'attached' });
}

/** Re-renders the mounted instance with these props merged over the current ones. */
export async function updateSkeleton(
  page: Page,
  props: Partial<FixtureProps>,
  opts: { settle?: boolean } = {},
): Promise<void> {
  await page.evaluate(([p, o]) => window.__skeleton.update(p as never, o), [props, opts] as const);
}

/** Everything the live hosts received since the last mount. */
export const spoken = (page: Page): Promise<Spoken[]> =>
  page.evaluate(() => [...window.__skeleton.spoken]);

/** The live regions in the document. */
export const regions = (page: Page): Promise<LiveRegionInfo[]> =>
  page.evaluate(() => window.__skeleton.regions());

/** The state changes of the group since the mount call, with timestamps. */
export const trace = (page: Page): Promise<TraceEntry[]> =>
  page.evaluate(() => [...window.__skeleton.trace]);
/** One sample per animation frame since the mount call. */
export const samples = (page: Page): Promise<Sample[]> =>
  page.evaluate(() => [...window.__skeleton.samples]);

/** Waits (polling in the page) until the group reaches this data-state. */
export const waitState = (page: Page, state: string, timeout = 5000) =>
  page.waitForFunction(
    (s) => document.querySelector('#mount [data-shape="group"]')?.getAttribute('data-state') === s,
    state,
    { timeout, polling: 'raf' },
  );

/** The root part. */
export const root = (page: Page) => page.locator('#mount > [data-part="root"]');
export const settle = (page: Page, ms = 80) => page.waitForTimeout(ms);
