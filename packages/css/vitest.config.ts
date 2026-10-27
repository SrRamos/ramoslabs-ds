import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.workspace';

export default defineConfig({ test: { ...sharedTestConfig, name: 'css' } });
