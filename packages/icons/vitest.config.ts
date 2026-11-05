import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

// The seeded-failure tests copy the package and re-check every generated file; under a forced
// full gate the default 5 s timed out (W1-C11.a run), so the ceiling matches the css package.
export default defineConfig({
  test: { ...sharedTestConfig, name: 'icons', testTimeout: 60_000, hookTimeout: 60_000 },
});
