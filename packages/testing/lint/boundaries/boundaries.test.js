// Each rule has a seeded failure (invalid) and a clean pass (valid).
import { RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rules } from './index.js';
import { iconsManifestViolations } from './no-icons-import.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

tester.run('core-purity', rules['core-purity'], {
  valid: [
    { code: `export const add = (a, b) => a + b;` },
    { code: `export function read() { return document.body; }` },
    { code: `export const read = () => window.innerWidth;` },
    { code: `export const hasDom = typeof document !== 'undefined';` },
    { code: `import { createStore } from './store/index.js'; export { createStore };` },
  ],
  invalid: [
    { code: `import { ref } from 'vue';`, errors: [{ messageId: 'framework' }] },
    { code: `import React from 'react';`, errors: [{ messageId: 'framework' }] },
    {
      code: `import { createRoot } from 'react-dom/client';`,
      errors: [{ messageId: 'framework' }],
    },
    { code: `export * from '@vue/reactivity';`, errors: [{ messageId: 'framework' }] },
    { code: `const mod = import('vue');`, errors: [{ messageId: 'framework' }] },
    { code: `export const title = document.title;`, errors: [{ messageId: 'domGlobal' }] },
    {
      code: `export const mq = window.matchMedia('(any-pointer: coarse)');`,
      errors: [{ messageId: 'domGlobal' }],
    },
    { code: `export const nav = navigator.userAgent;`, errors: [{ messageId: 'domGlobal' }] },
  ],
});

tester.run('no-css-import', rules['no-css-import'], {
  valid: [
    { code: `import { h } from 'vue';` },
    { code: `import { x } from './button.js';` },
    { code: `const s = require('./thing.js');` },
  ],
  invalid: [
    { code: `import './button.css';`, errors: [{ messageId: 'css' }] },
    { code: `import styles from './button.module.scss';`, errors: [{ messageId: 'css' }] },
    { code: `import '@ramoslabs/css/button.css';`, errors: [{ messageId: 'css' }] },
    { code: `import '@ramoslabs/tokens/css';`, errors: [{ messageId: 'css' }] },
    { code: `import('./late.css');`, errors: [{ messageId: 'css' }] },
    { code: `require('./x.css');`, errors: [{ messageId: 'css' }] },
  ],
});

tester.run('presets-public-only', rules['presets-public-only'], {
  valid: [
    { code: `import { SelectRoot } from '../primitives';` },
    { code: `import { SelectRoot } from '../primitives/select';` },
    { code: `import { Item } from './select-item';` },
    { code: `import { createSelect } from '@ramoslabs/core/select';` },
  ],
  invalid: [
    { code: `import { x } from '../runtime/store';`, errors: [{ messageId: 'internal' }] },
    { code: `import { x } from '../internal/helpers';`, errors: [{ messageId: 'internal' }] },
    {
      code: `import { x } from '../primitives/select/internal';`,
      errors: [{ messageId: 'internal' }],
    },
    { code: `import { x } from '../primitives/_private';`, errors: [{ messageId: 'internal' }] },
    { code: `import { x } from '../../core/src/select';`, errors: [{ messageId: 'internal' }] },
    {
      code: `import { x } from '@ramoslabs/core/src/select';`,
      errors: [{ messageId: 'internal' }],
    },
  ],
});

tester.run('store-via-runtime', rules['store-via-runtime'], {
  valid: [
    { code: `import { createSelect } from '@ramoslabs/core/select';` },
    { code: `import { useRuntime } from './runtime/index.js';` },
  ],
  invalid: [
    {
      code: `import { createStore } from '@ramoslabs/core/store';`,
      errors: [{ messageId: 'store' }],
    },
    {
      code: `import { createStore } from '../../core/src/store';`,
      errors: [{ messageId: 'store' }],
    },
    {
      code: `export { createStore } from '@ramoslabs/core/store';`,
      errors: [{ messageId: 'store' }],
    },
  ],
});

tester.run('listener-signal', rules['listener-signal'], {
  valid: [
    { code: `el.addEventListener('click', onClick, { signal: ac.signal });` },
    { code: `el.addEventListener('keydown', h, { signal: ctl.signal, capture: true });` },
  ],
  invalid: [
    { code: `el.addEventListener('click', onClick);`, errors: [{ messageId: 'signal' }] },
    {
      code: `el.addEventListener('click', onClick, { capture: true });`,
      errors: [{ messageId: 'signal' }],
    },
    { code: `el.addEventListener('click', onClick, true);`, errors: [{ messageId: 'signal' }] },
  ],
});

tester.run('passive-listeners', rules['passive-listeners'], {
  valid: [
    { code: `el.addEventListener('wheel', h, { passive: true, signal });` },
    {
      code: `el.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });`,
    },
    {
      code: `el.addEventListener('pointerdown', function (e) { e.preventDefault(); }, { signal });`,
    },
    { code: `el.addEventListener('click', h, { signal });` },
  ],
  invalid: [
    { code: `el.addEventListener('wheel', h);`, errors: [{ messageId: 'passive' }] },
    {
      code: `el.addEventListener('touchstart', h, { signal });`,
      errors: [{ messageId: 'passive' }],
    },
    {
      code: `el.addEventListener('pointermove', (e) => track(e), { passive: false });`,
      errors: [{ messageId: 'passive' }],
    },
    {
      code: `el.addEventListener('pointerdown', handler, { signal });`,
      errors: [{ messageId: 'passive' }],
    },
  ],
});

tester.run('no-icons-import', rules['no-icons-import'], {
  valid: [
    { code: `import { createButton } from '@ramoslabs/core/button';` },
    { code: `import { x } from './icon';` },
    { code: `import { x } from '../icon/index';` },
    { code: `import { x } from '@ramoslabs/iconsx';` },
  ],
  invalid: [
    { code: `import { Search } from '@ramoslabs/icons';`, errors: [{ messageId: 'icons' }] },
    { code: `import { Search } from '@ramoslabs/icons/search';`, errors: [{ messageId: 'icons' }] },
    {
      code: `import { getIcon } from '@ramoslabs/icons/by-name';`,
      errors: [{ messageId: 'icons' }],
    },
    { code: `export * from '@ramoslabs/icons';`, errors: [{ messageId: 'icons' }] },
    { code: `const m = import('@ramoslabs/icons/star');`, errors: [{ messageId: 'icons' }] },
    { code: `const m = require('@ramoslabs/icons');`, errors: [{ messageId: 'icons' }] },
    {
      code: `import { Star } from '../../../icons/src/generated/index';`,
      errors: [{ messageId: 'icons' }],
    },
    {
      code: `import { Star } from '../../packages/icons/src/by-name';`,
      errors: [{ messageId: 'icons' }],
    },
  ],
});

describe('icons manifest boundary (ADR-016)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  for (const pkg of ['core', 'vue', 'react', 'vanilla']) {
    it(`${pkg} does not list @ramoslabs/icons`, () => {
      const manifest = JSON.parse(readFileSync(join(root, pkg, 'package.json'), 'utf8'));
      expect(iconsManifestViolations(manifest)).toEqual([]);
    });
  }

  it('seeded failure: dependencies, peerDependencies and optionalDependencies are caught', () => {
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const bad = { name: '@ramoslabs/vue', [field]: { '@ramoslabs/icons': '0.0.0' } };
      expect(iconsManifestViolations(bad)).toEqual([
        `@ramoslabs/vue lists @ramoslabs/icons under ${field}`,
      ]);
    }
    // devDependencies are tolerated (a story or test may use the icons).
    expect(
      iconsManifestViolations({ name: 'x', devDependencies: { '@ramoslabs/icons': '1' } }),
    ).toEqual([]);
  });
});
