// Shared by the SJDisclosure Playwright specs: open the host and collect page errors (every spec asserts the
// list is empty), pause for a frame-safe settle, and the part selectors.
import type { Page } from '@playwright/test';

/** The `<details>` root, the `<summary>` trigger and the panel. */
export const ROOT = '[data-part="root"]';
export const TRIGGER = '[data-part="trigger"]';
export const PANEL = '[data-part="content"]';

/**
 * The group-scan probe (Fable ruling: prove the native path runs different code). The owned exclusive-group
 * fallback finds its peers with `querySelectorAll('details[name]...')`; native grouping never scans. The
 * probe counts such calls, so a spec can assert the fallback ran (fallback paths) or did not (native).
 * Installed before any page script; `window.__scans` is the count.
 */
export const installScanProbe = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __scans: number };
    w.__scans = 0;
    for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
      const orig = proto.querySelectorAll;
      proto.querySelectorAll = function (this: ParentNode, sel: string) {
        if (typeof sel === 'string' && sel.includes('details[name')) w.__scans++;
        return orig.call(this, sel);
      } as typeof orig;
    }
  });

/** Collects page errors; every spec asserts the list is empty. */
export async function openHost(page: Page, opts: { probe?: boolean } = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  if (opts.probe) await installScanProbe(page);
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  return errors;
}

export const settle = (page: Page, ms = 40) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
