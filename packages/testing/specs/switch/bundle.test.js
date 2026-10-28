// @ts-check
// Bundle gate for SJSwitch (W1-C03s.f, ADR-011): the core part is within its contract ceiling (read from
// `budgets.gzipKiB`, via the size harness's own rows), and each adapter's one-component fixture imports
// nothing but the Switch and the shared runtime (no other component, no CSS), with its bytes reported.
// Adapter rows exclude @ramoslabs/core and peers by construction (ADR-011, G1 ruling).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { measure } from '../../size/measure.js';
import { defaultRoot, runSize } from '../../size/index.js';

const root = defaultRoot;
const PEERS = ['react', 'react-dom', 'react/jsx-runtime', 'vue', '@ramoslabs/core/*'];
const OTHER_COMPONENTS =
  /packages\/(core|react|vue|vanilla)\/src\/(?!switch\/|runtime\/|generated\/)[a-z-]+\/.*/;

describe('SJSwitch bundle', () => {
  it('the core part is within the contract ceiling (size harness row)', async () => {
    const { rows } = await runSize({ root });
    const row = rows.find((r) => r.id === 'switch');
    expect(row, 'size harness has a switch row').toBeTruthy();
    expect(row?.status).toBe('pass');
    expect(row?.gzipBytes).toBeGreaterThan(0);
    expect(row?.gzipBytes).toBeLessThanOrEqual(1 * 1024);
  });

  it.each(['react', 'vue', 'vanilla'])(
    '%s: the one-component fixture contains the Switch and the shared runtime only',
    async (adapter) => {
      const entry = join(root, 'packages', adapter, 'src', 'switch', 'index.ts');
      const r = await measure({
        root,
        resolveDir: root,
        contents: `export * from ${JSON.stringify(entry)};`,
        external: PEERS,
      });
      expect(r.gzipBytes).toBeGreaterThan(0);
      expect(r.graph.some((p) => p.includes(`${adapter}/src/switch/`))).toBe(true);
      expect(r.graph.filter((p) => OTHER_COMPONENTS.test(p))).toEqual([]);
      expect(r.graph.filter((p) => p.endsWith('.css'))).toEqual([]);
      mkdirSync(join(root, 'packages', 'testing', 'node_modules', '.cache', 'specs-switch'), {
        recursive: true,
      });
      writeFileSync(
        join(
          root,
          'packages',
          'testing',
          'node_modules',
          '.cache',
          'specs-switch',
          `bundle-${adapter}.json`,
        ),
        JSON.stringify(
          { adapter, gzipBytes: r.gzipBytes, rawBytes: r.rawBytes, graph: r.graph },
          null,
          2,
        ),
      );
    },
  );

  it('seeded: the other-component check flags a component module and passes the switch and runtime', () => {
    expect(OTHER_COMPONENTS.test('packages/react/src/button/index.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/vue/src/popover/Popover.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/react/src/switch/index.ts')).toBe(false);
    expect(OTHER_COMPONENTS.test('packages/react/src/runtime/machine.ts')).toBe(false);
  });
});
