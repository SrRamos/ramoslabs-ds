// SJButton conformance run (W1-C01.f, ADR-013 L2/L3/L6). Same shape as the runner's config: three engines,
// one host page, `retries: 0` (retries diagnose, they never certify). Own port and own results file so it can
// run beside the other suites; `bun run parity:button` reads the results plus the expected declaration.
import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
const port = Number(process.env['E2E_BUTTON_PORT'] ?? 4181);
const retries = Number(process.env['SJ_E2E_RETRIES'] ?? 0);
export const RESULTS_FILE = retries === 0 ? 'e2e-button-results.json' : 'e2e-button-diagnose.json';

export default defineConfig({
  testDir: here,
  testMatch: '**/*.e2e.ts',
  outputDir: join(cache, 'button-artifacts'),
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
    timeout: 120_000,
  },
});
