// Text-safety runner (W1-311, ADR-013 L2). Same three engines as the L2 runner (W1-309a), one attempt.
// Run: `bunx playwright test -c text-safety/playwright.config.ts` from packages/testing.
import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: here,
  testMatch: '**/*.e2e.ts',
  // Keep run output in the git-ignored cache, as the L2 runner does.
  outputDir: join(here, '..', 'node_modules', '.cache', 'text-safety'),
  globalSetup: join(here, 'global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: { trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
