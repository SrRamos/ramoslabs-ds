import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { boundariesConfigs } from './packages/testing/lint/index.js';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/storybook-static/**',
      // Docs site and Storybook are linted by their own toolchain (stylelint, Astro).
      'apps/**',
      // Seeded-violation fixtures are inputs to tests, not source.
      '**/fixtures/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Browser-facing sources may use DOM globals; core is held to the boundary rules below.
    files: ['packages/{react,vue,vanilla}/**/*.{ts,vue}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  ...boundariesConfigs(),
);
