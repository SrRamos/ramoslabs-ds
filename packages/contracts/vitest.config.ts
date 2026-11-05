import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: { ...sharedTestConfig, name: 'contracts', testTimeout: 30_000 },
});
