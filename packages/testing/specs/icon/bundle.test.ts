// @ts-check
// Bundle gate for SJIcon (W1-C12.f, ADR-011, ADR-016, PLAN-ICONS decision 14):
//  - the core `icon` module is within its contract ceiling (`budgets.gzipKiB`, via the size harness rows);
//  - every one of the 78 icon modules is within 0.4 KiB (per-icon max), an unused icon adds 0 bytes, and one icon
//    through the barrel is within the same ceiling; `by-name` (whole set, one module) is measured and recorded, not gated;
//  - the one-icon fixture (SJIcon core + one icon, shared kernel excluded as for every component) is measured;
//  - each adapter's `icon` entry (ungated by the harness until now) contains the icon and the shared runtime only: no
//    other component, no CSS, no @ramoslabs/icons (ADR-016 boundary); bytes are recorded and held to a spec-local
//    regression ceiling. Adapter rows exclude @ramoslabs/core and peers by construction (ADR-011, G1 ruling).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { externalizeShared, measure } from '../../size/measure.js';
import { defaultRoot, runSize } from '../../size/index.js';
import { contract } from './matrix';

const root = defaultRoot;
const KIB = 1024;
const budgets = JSON.parse(
  readFileSync(join(root, 'packages', 'testing', 'size', 'budgets.json'), 'utf8'),
);
const PEERS = ['react', 'react-dom', 'react/jsx-runtime', 'vue', '@ramoslabs/core/*'];
const OTHER_COMPONENTS =
  /packages\/(core|react|vue|vanilla)\/src\/(?!icon\/|runtime\/|generated\/)[a-z-]+\/.*/;
const cache = join(root, 'packages', 'testing', 'node_modules', '.cache', 'specs-icon');
const record = (name: string, value: unknown) => {
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, name), JSON.stringify(value, null, 2));
};

/**
 * Spec-local regression ceilings for the adapter icon entries (gzip bytes, runtime included, core and peers
 * excluded). ADR-011 gives adapters no ceiling (reported rows); these hold the measured figure plus about 15%
 * so growth is noticed. Measured at W1-C12.f: react 816 B, vue 1062 B, vanilla 2252 B.
 */
const ADAPTER_CEILING_BYTES = { react: 960, vue: 1240, vanilla: 2600 } as const;
/** One-icon fixture (SJIcon core + `search`, `merge` excluded as shared): measured, plus about 10%. */
const ONE_ICON_CEILING_KIB = 1.1;

const rowsOnce = runSize({ root });

describe('SJIcon bundle', () => {
  it('the core part is within the contract ceiling (size harness row)', async () => {
    const { rows } = await rowsOnce;
    const row = rows.find((r) => r.id === 'icon');
    expect(row, 'size harness has an icon row').toBeTruthy();
    expect(row?.status).toBe('pass');
    expect(row?.gzipBytes).toBeGreaterThan(0);
    expect(row?.gzipBytes).toBeLessThanOrEqual(contract.budgets.gzipKiB * KIB);
  });

  it('per-icon max <= 0.4 KiB over all icons; unused icon is 0 KiB; one icon through the barrel is within 0.4 KiB', async () => {
    const { rows } = await rowsOnce;
    const icons = rows.filter((r) => r.kind === 'icon' && r.id.startsWith('icon:'));
    expect(icons.length).toBeGreaterThanOrEqual(78);
    expect(icons.filter((r) => r.status !== 'pass').map((r) => r.id)).toEqual([]);
    const max = icons.reduce((a, r) => (r.gzipBytes > a.gzipBytes ? r : a));
    expect(max.gzipBytes / KIB).toBeLessThanOrEqual(0.4);

    const unused = rows.find((r) => r.id === 'icons:unused');
    expect(unused?.status).toBe('pass');
    expect(unused?.gzipBytes).toBe(0);
    const one = rows.find((r) => r.id === 'icons:one');
    expect(one?.status).toBe('pass');
    expect((one?.gzipBytes ?? Infinity) / KIB).toBeLessThanOrEqual(0.4);

    const byName = rows.find((r) => r.id === 'icons:by-name');
    expect(byName?.status).toBe('reported');
    expect(byName?.gzipBytes).toBeGreaterThan(0);
    record('icons.json', {
      count: icons.length,
      max: { id: max.id, gzipBytes: max.gzipBytes },
      one: one?.gzipBytes,
      unused: unused?.gzipBytes,
      byName: byName?.gzipBytes,
    });
  });

  it('the one-icon fixture (SJIcon core + one icon, no shared kernel) is measured and bounded', async () => {
    const entry = (p: string) => JSON.stringify(join(root, 'packages', p));
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${entry('core/src/icon/index.ts')};\nexport { Search } from ${entry('icons/src/generated/icons/search.ts')};`,
      plugins: [
        externalizeShared(
          root,
          budgets.sharedModules,
          join(root, 'packages', 'core', 'src', 'icon'),
        ),
      ],
    });
    expect(r.graph.some((p) => p.endsWith('icons/search.ts'))).toBe(true);
    expect(r.graph.filter((p) => p.endsWith('icons/star.ts'))).toEqual([]);
    expect(r.gzipBytes / KIB).toBeLessThanOrEqual(ONE_ICON_CEILING_KIB);
    record('one-icon-fixture.json', {
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      graph: r.graph,
    });
  });

  it.each(['react', 'vue', 'vanilla'] as const)(
    '%s: the icon entry contains SJIcon and the shared runtime only, within its regression ceiling',
    async (adapter) => {
      const entry = join(root, 'packages', adapter, 'src', 'icon', 'index.ts');
      const r = await measure({
        root,
        resolveDir: root,
        contents: `export * from ${JSON.stringify(entry)};`,
        external: PEERS,
      });
      expect(r.gzipBytes).toBeGreaterThan(0);
      expect(r.graph.some((p) => p.includes(`${adapter}/src/icon/`))).toBe(true);
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

  it('seeded: the other-component check flags a component module and passes the icon and runtime', () => {
    expect(OTHER_COMPONENTS.test('packages/react/src/switch/index.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/vue/src/button/SJButton.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/react/src/icon/index.ts')).toBe(false);
    expect(OTHER_COMPONENTS.test('packages/react/src/runtime/machine.ts')).toBe(false);
  });
});
