import { defineConfig } from 'vitest/config';
import { projects } from './vitest.workspace';

// Root entry for editors and ad-hoc `vitest` runs. CI uses the per-package `test` scripts via Turbo.
export default defineConfig({ test: { projects } });
