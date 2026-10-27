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
      // Storybook is stories only; the site's .astro/.vue files use stylelint. Site TypeScript is linted.
      'apps/storybook/**',
      'apps/site/public/**',
      'apps/site/src/components/icons/icons.generated.ts',
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
    files: ['apps/site/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Browser-facing sources may use DOM globals; core is held to the boundary rules below.
    files: ['packages/{react,vue,vanilla}/**/*.{ts,vue}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  ...boundariesConfigs(),
);
