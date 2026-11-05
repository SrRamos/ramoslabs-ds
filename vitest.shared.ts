// Shared Vitest settings for every package (W1-002).
//
// Vitest 5 no longer reads a workspace file on its own; projects are declared in
// `vitest.config.ts` (`test.projects`). This file (formerly named vitest.workspace.ts in the plan) holds the one shared
// definition that the root config and every `packages/*/vitest.config.ts` import.
//
// Default environment is `node` (jsdom-free, ADR-002): a core module that touches `document`
// at import time throws a ReferenceError and fails its test.
export const projects = ['packages/*'];

export const sharedTestConfig = {
  environment: 'node',
  passWithNoTests: false,
  // Tests that build bundles or spawn the codegen CLI (size icon rows, contracts --check, icons generate) take
  // 5-10 s on a loaded machine; the 5 s default made `TURBO_FORCE=1 bun run gate` flaky under load (C12.f).
  testTimeout: 30_000,
  // Per-package module cache (R2-SHOULD-2): `vitest run` clears the shared root cache on startup,
  // so parallel packages under Turbo raced on one directory (ENOTEMPTY). Relative = package root.
  fsModuleCachePath: 'node_modules/.vitest-cache',
  include: ['src/**/*.test.{ts,js}', 'test/**/*.test.{ts,js}', '**/*.test.js'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/fixtures/**'],
  coverage: {
    provider: 'v8' as const,
    reporter: ['text-summary', 'lcov'],
    include: ['src/**/*.{ts,js}'],
    exclude: ['**/*.test.*', '**/index.ts'],
  },
};
