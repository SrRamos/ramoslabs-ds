// L3 config (W1-310, ADR-013 L3). Three engines, `retries: 0` (retries diagnose, never certify).
// Titles carry `@pr` or `@release`; `test:a11y` runs @pr, `test:a11y:release` runs everything.
import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', 'node_modules', '.cache', 'a11y');
const port = Number(process.env['A11Y_PORT'] ?? 4180);

export default defineConfig({
  testDir: here,
  testMatch: '**/*.e2e.ts',
  outputDir: join(cache, 'artifacts'),
  globalSetup: join(here, 'global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: join(cache, 'a11y-results.json') }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node serve.mjs',
    cwd: here,
    url: `http://127.0.0.1:${port}/a11y-host.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
