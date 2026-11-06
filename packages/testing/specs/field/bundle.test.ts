// @ts-check
// Bundle gate for SJField, SJInput and SJForm (W1-C02.f, ADR-011): each core part is within its contract ceiling
// (read from `budgets.gzipKiB`, via the size harness's own rows), the three together stay inside SJField's
// ceiling (plan 6.2: the form context is part of the field set), and each adapter's one-component fixture imports
// nothing but this set (SJField draws an SJIcon, so `icon` is part of it), the shared runtime and generated code,
// no other component and no CSS, with its bytes reported. Adapter rows exclude @ramoslabs/core and peers by
// construction (ADR-011, G1 ruling).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { measure } from '../../size/measure.js';
import { defaultRoot, runSize } from '../../size/index.js';
import { contracts } from './matrix';

const root = defaultRoot;
const PEERS = ['react', 'react-dom', 'react/jsx-runtime', 'vue', '@ramoslabs/core/*'];
const OTHER_COMPONENTS =
  /packages\/(core|react|vue|vanilla)\/src\/(?!field\/|form\/|input\/|icon\/|runtime\/|generated\/)[a-z-]+\/.*/;
const SET = ['field', 'form', 'input'] as const;

describe('SJField, SJInput and SJForm bundle', () => {
  it.each(SET)('the %s core part is within its contract ceiling (size harness row)', async (id) => {
    const { rows } = await runSize({ root });
    const row = rows.find((r) => r.id === id);
    expect(row, `size harness has a ${id} row`).toBeTruthy();
    expect(row?.status).toBe('pass');
    expect(row?.gzipBytes).toBeGreaterThan(0);
    expect(row?.gzipBytes).toBeLessThanOrEqual(contracts[id].budgets.gzipKiB * 1024);
  });

  it('the three core parts together stay inside the field ceiling (the form context is inside SJField, plan 6.2)', async () => {
    const { rows } = await runSize({ root });
    const total = SET.reduce((n, id) => n + (rows.find((r) => r.id === id)?.gzipBytes ?? 0), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(contracts.field.budgets.gzipKiB * 1024);
  });

  it.each(['react', 'vue', 'vanilla'] as const)(
    '%s: the one-entry fixture contains the field set and the shared runtime only',
    async (adapter) => {
      const entries = SET.map((c) => join(root, 'packages', adapter, 'src', c, 'index.ts'));
      const r = await measure({
        root,
        resolveDir: root,
        contents: entries.map((e) => `export * from ${JSON.stringify(e)};`).join('\n'),
        external: PEERS,
      });
      expect(r.gzipBytes).toBeGreaterThan(0);
      for (const c of SET)
        expect(r.graph.some((p) => p.includes(`${adapter}/src/${c}/`))).toBe(true);
      expect(r.graph.filter((p) => OTHER_COMPONENTS.test(p))).toEqual([]);
      expect(r.graph.filter((p) => p.endsWith('.css'))).toEqual([]);
      const dir = join(root, 'packages', 'testing', 'node_modules', '.cache', 'specs-field');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `bundle-${adapter}.json`),
        JSON.stringify(
          { adapter, gzipBytes: r.gzipBytes, rawBytes: r.rawBytes, graph: r.graph },
          null,
          2,
        ),
      );
    },
  );

  it('seeded: the other-component check flags a component module and passes the field set and runtime', () => {
    expect(OTHER_COMPONENTS.test('packages/react/src/button/index.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/vue/src/popover/Popover.ts')).toBe(true);
    expect(OTHER_COMPONENTS.test('packages/react/src/field/index.ts')).toBe(false);
    expect(OTHER_COMPONENTS.test('packages/react/src/icon/index.ts')).toBe(false);
    expect(OTHER_COMPONENTS.test('packages/react/src/runtime/machine.ts')).toBe(false);
  });
});
