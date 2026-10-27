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
  include: ['src/**/*.test.{ts,js}', 'test/**/*.test.{ts,js}', '**/*.test.js'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/fixtures/**'],
  coverage: {
    provider: 'v8' as const,
    reporter: ['text-summary', 'lcov'],
    include: ['src/**/*.{ts,js}'],
    exclude: ['**/*.test.*', '**/index.ts'],
  },
};
