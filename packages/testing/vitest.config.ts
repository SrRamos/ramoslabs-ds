import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    name: 'testing',
    // Bundle-building and CLI-spawning tests exceed the 5 s default on a loaded machine (C12.f).
    testTimeout: 30_000,
    // ssr/ is TypeScript (it drives the adapters' typed runtimes); the rest of testing is JS.
    include: [...sharedTestConfig.include, 'ssr/**/*.test.ts', 'specs/**/*.test.ts'],
  },
});
