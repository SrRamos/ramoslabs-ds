// L2 runner config (W1-309a, ADR-013 L2). Three engines, one host page, `retries: 0`.
//
// Retries diagnose, they never certify: a run that feeds the manifest must be a single attempt.
// SJ_E2E_RETRIES is a local diagnosis switch; it writes a DIFFERENT results file so a retried run
// can never be mistaken for manifest input.
import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
const port = Number(process.env['E2E_PORT'] ?? 4179);
const retries = Number(process.env['SJ_E2E_RETRIES'] ?? 0);
export const RESULTS_FILE = retries === 0 ? 'e2e-results.json' : 'e2e-diagnose.json';

export default defineConfig({
  testDir: here,
  testMatch: '**/*.e2e.ts',
  outputDir: join(cache, 'artifacts'),
  globalSetup: join(here, 'global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: join(cache, RESULTS_FILE) }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node serve.mjs',
    cwd: here,
    url: `http://127.0.0.1:${port}/host.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
