// Cold-start warm-up (W1-314). Every browser suite starts three engines in parallel right after a
// fresh install or a fresh CI runner. The first launch of an engine pays one-off costs (profile
// creation, dynamic linking, font cache, first TLS-free page load), and Playwright charges a
// worker's browser launch to the first test that needs it, inside that test's 30 s budget. Under
// 3 engines x N workers that burst occasionally exceeded it (2 of 87 failed cold, 5/5 warm passes).
//
// The fix is to pay that cost once, before the first test, outside any test timeout: launch each
// engine, load the page, close. No retries and no longer test timeout: a test that is slow when
// warm is still a failure.
import { chromium, firefox, webkit, type BrowserType } from '@playwright/test';

const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit };
const BUDGET_MS = 120_000;

/** Launches each named engine once, optionally loads `url`, and closes it. Throws on failure. */
export async function warmEngines(url?: string, engines = Object.keys(ENGINES)): Promise<void> {
  await Promise.all(
    engines.map(async (name) => {
      const type = ENGINES[name];
      if (!type) throw new Error(`warmup: unknown engine ${name}`);
      const browser = await type.launch({ timeout: BUDGET_MS });
      try {
        const page = await browser.newPage();
        if (url) await page.goto(url, { timeout: BUDGET_MS });
        await page.close();
      } finally {
        await browser.close();
      }
    }),
  );
}
