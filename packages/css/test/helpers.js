// Shared helpers for the css tests: build into a temp dir, load tokens, drive Chromium.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildCss } from '../scripts/build.mjs';

export const srcDir = fileURLToPath(new URL('../src', import.meta.url));

/** Builds the real sources into a temp dir (tests never depend on a prior `dist`). */
export function buildReal() {
  const outDir = mkdtempSync(join(tmpdir(), 'sj-css-'));
  buildCss({ srcDir, outDir });
  return { outDir, index: readFileSync(join(outDir, 'index.css'), 'utf8') };
}

/** The generated tokens.css (requires the tokens build, which Turbo runs first). */
export function tokensCss() {
  return readFileSync(fileURLToPath(import.meta.resolve('@ramoslabs/tokens/css')), 'utf8');
}

/**
 * Launches Chromium. Returns `{ browser, page(opts, html) }`; `opts` are Playwright context options
 * plus `media` for `page.emulateMedia`.
 */
export async function launch() {
  const browser = await chromium.launch().catch((/** @type {Error} */ e) => {
    if (/Executable doesn't exist/.test(e.message)) {
      throw new Error(
        'Chromium is missing. Run `bunx playwright install chromium` (CI does this too).',
      );
    }
    throw e;
  });
  return {
    browser,
    /** @param {Record<string, any>} opts @param {string} html */
    async page(opts, html) {
      const { media, ...ctxOpts } = opts;
      const context = await browser.newContext({
        viewport: { width: 480, height: 640 },
        ...ctxOpts,
      });
      const page = await context.newPage();
      if (media) await page.emulateMedia(media);
      await page.setContent(html);
      return page;
    },
  };
}

/** A complete document: tokens, the built sj css, optional extra CSS, then the body. */
export function doc({ css, extra = '', body, attrs = '' }) {
  return `<!doctype html><html ${attrs}><head><style>${tokensCss()}</style><style>${css}</style><style>${extra}</style></head><body>${body}</body></html>`;
}
