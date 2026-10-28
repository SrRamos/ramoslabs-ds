import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    name: 'testing',
    // ssr/ is TypeScript (it drives the adapters' typed runtimes); the rest of testing is JS.
    include: [...sharedTestConfig.include, 'ssr/**/*.test.ts', 'specs/**/*.test.ts'],
  },
});
