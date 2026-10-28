// Shared by the SJSwitch Playwright specs: open the host and collect page errors (every spec asserts the
// list is empty), pause for a frame-safe settle, and the one control selector.
import type { Page } from '@playwright/test';

/** The native switch input, the keyboard and pointer target. */
export const CONTROL = '[data-part="control"]';

/** Collects page errors; every spec asserts the list is empty. */
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

export const settle = (page: Page, ms = 40) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
