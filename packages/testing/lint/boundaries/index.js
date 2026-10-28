// @ts-check
import { corePurity } from './core-purity.js';
import { listenerSignal, passiveListeners } from './listeners.js';
import { noCssImport } from './no-css-import.js';
import { noIconsImport } from './no-icons-import.js';
import { presetsPublicOnly } from './presets-public-only.js';
import { storeViaRuntime } from './store-via-runtime.js';

export const rules = {
  'core-purity': corePurity,
  'no-css-import': noCssImport,
  'no-icons-import': noIconsImport,
  'presets-public-only': presetsPublicOnly,
  'store-via-runtime': storeViaRuntime,
  'listener-signal': listenerSignal,
  'passive-listeners': passiveListeners,
};

/** ESLint plugin object, usable as `plugins: { 'sj-boundaries': plugin }`. */
export const plugin = { meta: { name: 'sj-boundaries' }, rules };

/**
 * Flat-config blocks that enforce the seven boundary rules on the monorepo layout.
 * @returns {import('eslint').Linter.Config[]}
 */
export function boundariesConfigs() {
  const adapters = ['react', 'vue', 'vanilla'];
  const adapterFiles = adapters.map((a) => `packages/${a}/src/**/*.{js,ts,vue}`);
  return [
    {
      files: ['packages/core/src/**/*.{js,ts}'],
      plugins: { 'sj-boundaries': plugin },
      rules: { 'sj-boundaries/core-purity': 'error' },
    },
    {
      files: adapterFiles,
      plugins: { 'sj-boundaries': plugin },
      rules: {
        'sj-boundaries/no-css-import': 'error',
        'sj-boundaries/listener-signal': 'error',
        'sj-boundaries/store-via-runtime': 'error',
      },
    },
    {
      // ADR-016: icon data is passed in by consumers; core and the adapters never import it.
      files: ['packages/{core,react,vue,vanilla}/src/**/*.{js,ts,vue}'],
      plugins: { 'sj-boundaries': plugin },
      rules: { 'sj-boundaries/no-icons-import': 'error' },
    },
    {
      // The runtime directory is the one place an adapter may reach the store.
      files: adapters.map((a) => `packages/${a}/src/runtime/**/*.{js,ts,vue}`),
      plugins: { 'sj-boundaries': plugin },
      rules: { 'sj-boundaries/store-via-runtime': 'off' },
    },
    {
      files: ['packages/*/src/**/presets/**/*.{js,ts,vue}'],
      plugins: { 'sj-boundaries': plugin },
      rules: { 'sj-boundaries/presets-public-only': 'error' },
    },
    {
      files: ['packages/*/src/**/*.{js,ts,vue}'],
      plugins: { 'sj-boundaries': plugin },
      rules: { 'sj-boundaries/passive-listeners': 'error' },
    },
  ];
}
