// @ts-check
// Bundle gate for SJSkeleton (ADR-011):
//  - the core `skeleton` module is within its contract ceiling (`budgets.gzipKiB`, via the size harness rows);
//  - each adapter's `skeleton` entry (ungated by the harness) contains SJSkeleton and the shared runtime only: no other
//    component, no CSS, no @ramoslabs/icons;
//    bytes are recorded and held to a spec-local regression ceiling. Adapter rows exclude @ramoslabs/core and
//    peers by construction (ADR-011, G1 ruling).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { measure } from '../../size/measure.js';
import { defaultRoot, runSize } from '../../size/index.js';
import { contract } from './matrix';

const root = defaultRoot;
const KIB = 1024;
const PEERS = ['react', 'react-dom', 'react/jsx-runtime', 'vue', '@ramoslabs/core/*'];
const OTHER_COMPONENTS =
  /packages\/(core|react|vue|vanilla)\/src\/(?!skeleton\/|runtime\/|generated\/)[a-z-]+\/.*/;
const cache = join(root, 'packages', 'testing', 'node_modules', '.cache', 'specs-skeleton');
const record = (name: string, value: unknown) => {
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, name), JSON.stringify(value, null, 2));
};

/**
 * Spec-local regression ceilings for the adapter skeleton entries (gzip bytes, runtime included, core and peers
 * excluded). ADR-011 gives adapters no ceiling (reported rows); these hold the measured figure plus about 15%
 * so growth is noticed. Measured: react 1263 B, vue 1699 B, vanilla 1662 B (core `skeleton` 1.116 KiB vs the 1.5 KiB budget).
 */
const ADAPTER_CEILING_BYTES = { react: 1450, vue: 1950, vanilla: 1910 } as const;

const rowsOnce = runSize({ root });

describe('SJSkeleton bundle', () => {
  it('the core part is within the contract ceiling (size harness row)', async () => {
    const { rows } = await rowsOnce;
    const row = rows.find((r) => r.id === 'skeleton');
    expect(row, 'size harness has a skeleton row').toBeTruthy();
    expect(row?.status).toBe('pass');
    expect(row?.gzipBytes).toBeGreaterThan(0);
    expect(row?.gzipBytes).toBeLessThanOrEqual(contract.budgets.gzipKiB * KIB);
    record('core.json', { gzipBytes: row?.gzipBytes, ceiling: contract.budgets.gzipKiB * KIB });
  });

  it.each(['react', 'vue', 'vanilla'] as const)(
    '%s: the skeleton entry contains SJSkeleton and the shared runtime only, within its regression ceiling',
    async (adapter) => {
      const entry = join(root, 'packages', adapter, 'src', 'skeleton', 'index.ts');
      const r = await measure({
        root,
        resolveDir: root,
        contents: `export * from ${JSON.stringify(entry)};`,
        external: PEERS,
      });
      expect(r.gzipBytes).toBeGreaterThan(0);
      expect(r.graph.some((p) => p.includes(`${adapter}/src/skeleton/`))).toBe(true);
      expect(r.graph.filter((p) => OTHER_COMPONENTS.test(p))).toEqual([]);
      expect(r.graph.filter((p) => p.endsWith('.css'))).toEqual([]);
      expect(r.graph.filter((p) => p.includes('packages/icons/'))).toEqual([]);
      expect(r.gzipBytes).toBeLessThanOrEqual(ADAPTER_CEILING_BYTES[adapter]);
      record(`bundle-${adapter}.json`, {
        adapter,
        gzipBytes: r.gzipBytes,
        rawBytes: r.rawBytes,
        graph: r.graph,
      });
    },
  );

  it('seeded: the other-component check flags a component module and passes the skeleton and runtime', () => {
    expect(OTHER_COMPONENTS.test('packages/react/src/switch/index.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/vue/src/button/SJButton.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/vue/src/icon/SJIcon.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/react/src/skeleton/index.ts')).toBe(false);
    expect(OTHER_COMPONENTS.test('packages/react/src/runtime/machine.ts')).toBe(false);
  });

  it('seeded: a ceiling below the measured size fails', async () => {
    const entry = join(root, 'packages', 'react', 'src', 'skeleton', 'index.ts');
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${JSON.stringify(entry)};`,
      external: PEERS,
    });
    expect(r.gzipBytes <= 100).toBe(false);
  });
});
