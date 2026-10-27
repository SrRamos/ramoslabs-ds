import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

// Browser probes (Chromium via playwright) need more than the 5 s default on a cold start.
export default defineConfig({
  test: { ...sharedTestConfig, name: 'css', testTimeout: 30_000, hookTimeout: 30_000 },
});
