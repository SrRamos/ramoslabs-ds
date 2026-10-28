// Playwright config for the SJSwitch conformance suites (W1-C03s.f). Reuses the L2 runner's config
// (three engines, `retries: 0`, JSON reporter) and only changes the tests, the server and where results
// land. Retries diagnose, they never certify: a retried run writes a different file the parity CLI refuses.
import { defineConfig } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '../../e2e/runner/playwright.config';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
const port = Number(process.env['SWITCH_PORT'] ?? 4193);
const retries = Number(process.env['SJ_E2E_RETRIES'] ?? 0);
export const RESULTS_FILE = retries === 0 ? 'switch-results.json' : 'switch-diagnose.json';
export const EXPECTED_FILE = 'switch-expected.json';

export default defineConfig({
  ...base,
  testDir: here,
  testMatch: '**/*.e2e.ts',
  outputDir: join(cache, 'switch-artifacts'),
  globalSetup: join(here, 'global-setup.ts'),
  retries,
  reporter: [['list'], ['json', { outputFile: join(cache, RESULTS_FILE) }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'off', screenshot: 'off' },
  webServer: {
    command: 'node serve.mjs',
    cwd: here,
    url: `http://127.0.0.1:${port}/host.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
