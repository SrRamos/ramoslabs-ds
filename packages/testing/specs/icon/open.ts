// Shared by the SJIcon Playwright specs: open the host, mount a fixture or a composition, find the glyph.
import type { Page } from '@playwright/test';
import type { AdapterName, MountOptions } from './host/entry';

export type { AdapterName };

/** Collects page errors; every spec asserts the list is empty. */
export async function openHost(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__icon?.ready === true);
  return errors;
}

export async function mountIcon(
  page: Page,
  adapter: AdapterName,
  fixture: string,
  path = 'native',
  opts: MountOptions = {},
): Promise<void> {
  await page.evaluate(
    ([a, f, p, o]) => window.__icon.mount(a as AdapterName, f as string, p as string, o as never),
    [adapter, fixture, path, opts] as const,
  );
  await page.locator('#mount > svg').waitFor();
}

/** Mounts an SJIcon inside an SJButton (the `icon` slot). Composition specs only. */
export async function mountComposition(
  page: Page,
  adapter: AdapterName,
  name: string,
  path = 'native',
): Promise<void> {
  await page.evaluate(
    ([a, n, p]) => window.__icon.mountComposition(a as AdapterName, n as string, p as string),
    [adapter, name, path] as const,
  );
  await page.locator('#mount :is(button, a)').waitFor();
}

/** The mounted `<svg>`. */
export const glyph = (page: Page) => page.locator('#mount svg').first();

export const settle = (page: Page, ms = 80) => page.waitForTimeout(ms);
