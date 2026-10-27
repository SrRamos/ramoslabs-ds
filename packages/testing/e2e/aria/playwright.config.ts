// ARIA layer of L2 (W1-309c, ADR-013 L2). Same three engines and `retries: 0` rule as the runner;
// its own config and port so it can run beside the runner, and its own server because it also
// serves the IME fixture. Results go to a separate file, so the manifest consumer reads both.
import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
const port = Number(process.env['E2E_ARIA_PORT'] ?? 4180);
const retries = Number(process.env['SJ_E2E_RETRIES'] ?? 0);
export const RESULTS_FILE = retries === 0 ? 'aria-results.json' : 'aria-diagnose.json';

export default defineConfig({
  testDir: here,
  testMatch: '**/*.e2e.ts',
  outputDir: join(cache, 'aria-artifacts'),
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
