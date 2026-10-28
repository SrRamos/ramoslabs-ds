import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

// Browser probes (Chromium via playwright) need more than the 5 s default on a cold start or under load (W1-314: 60 s, no retries).
export default defineConfig({
  test: { ...sharedTestConfig, name: 'css', testTimeout: 60_000, hookTimeout: 60_000 },
});
