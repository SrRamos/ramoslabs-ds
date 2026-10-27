// L2/L6 supports-path run (W1-309b). Reuses the runner's config (three engines, one host page,
// `retries: 0`) and only changes the tests it runs and where results land. The results file is
// separate from the runner's so the two never overwrite each other; the parity matrix reads both.
import { defineConfig } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '../runner/playwright.config';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
const retries = Number(process.env['SJ_E2E_RETRIES'] ?? 0);
/** Manifest input only when `retries: 0`; a retried run writes a different file (ADR-013). */
export const SUPPORTS_RESULTS =
  retries === 0 ? 'e2e-supports-results.json' : 'e2e-supports-diagnose.json';
export const EXPECTED_FILE = 'e2e-supports-expected.json';

export default defineConfig({
  ...base,
  testDir: here,
  testMatch: '**/*.e2e.ts',
  globalSetup: join(here, 'global-setup.ts'),
  reporter: [['list'], ['json', { outputFile: join(cache, SUPPORTS_RESULTS) }]],
  webServer: {
    ...(base.webServer as object),
    cwd: join(here, '..', 'runner'),
  } as never,
});
