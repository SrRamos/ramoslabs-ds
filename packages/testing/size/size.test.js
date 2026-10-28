import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultRoot, formatReport, runSize } from './index.js';

describe('size harness (ADR-011)', () => {
  it('reports every shared-kernel row, the fixture row and the adapters, all passing today', async () => {
    const { rows, failed } = await runSize({ root: defaultRoot });
    const ids = rows.map((r) => r.id);
    for (const id of ['store', 'overlay', 'collection', 'live', 'kinds', 'fixture']) {
      expect(ids).toContain(id);
    }
    expect(ids).toEqual(
      expect.arrayContaining(['adapter:react', 'adapter:vue', 'adapter:vanilla']),
    );
    expect(failed).toBe(false);
    expect(formatReport(rows)).toContain('raw');
  });

  it('measures zero bytes of an unused component (0 KiB fixture)', async () => {
    const { rows } = await runSize({ root: defaultRoot });
    const fixture = rows.find((r) => r.id === 'fixture');
    expect(fixture?.gzipBytes).toBe(0);
    // The bundle itself must be non-empty, otherwise 0 would prove nothing.
    expect(fixture?.bundleRawBytes).toBeGreaterThan(0);
    expect(fixture?.graph.some((p) => p.endsWith('consumer.ts'))).toBe(true);
  });

  it('records the import graph for kernel rows', async () => {
    const { rows } = await runSize({ root: defaultRoot });
    expect(rows.find((r) => r.id === 'store')?.graph).toContain('packages/core/src/store/index.ts');
  });

  it('fails a seeded oversize module', async () => {
    const root = mkdtempSync(join(tmpdir(), 'size-seed-'));
    mkdirSync(join(root, 'big'));
    writeFileSync(
      join(root, 'big/index.ts'),
      `export const blob = ${JSON.stringify(randomBytes(4096).toString('base64'))};`,
    );
    const { rows, failed } = await runSize({
      root,
      budgets: {
        rows: [{ id: 'big', label: 'Seeded oversize', ceilingKiB: 1, entries: ['big/index.ts'] }],
        sharedModules: [],
        adapters: [],
        peers: [],
      },
    });
    expect(failed).toBe(true);
    expect(rows[0].status).toBe('fail');
    expect(rows[0].gzipBytes).toBeGreaterThan(1024);
  });

  it('fails when the shipped fixture leaks its unused component', async () => {
    const root = mkdtempSync(join(tmpdir(), 'size-leak-'));
    const rel = 'packages/testing/size/fixtures/unused-component';
    cpSync(join(defaultRoot, rel), join(root, rel), { recursive: true });
    writeFileSync(
      join(root, rel, 'consumer.ts'),
      `import { componentA, componentB } from './index';\nexport const used = [componentA(), componentB()];\n`,
    );
    const { rows, failed } = await runSize({
      root,
      budgets: {
        rows: [
          {
            id: 'fixture',
            label: 'leak',
            ceilingKiB: 0,
            fixture: { entry: `${rel}/consumer.ts`, unused: `${rel}/b.ts` },
          },
        ],
        sharedModules: [],
        adapters: [],
        peers: [],
      },
    });
    expect(failed).toBe(true);
    expect(rows[0].gzipBytes).toBeGreaterThan(0);
  });
});

describe('icon rows (ADR-016)', () => {
  const noBudgets = { rows: [], sharedModules: [], adapters: [], peers: [] };

  it('measures every icon, gates each at 0.4 KiB, and an unused icon adds 0 KiB', async () => {
    const { rows } = await runSize({ root: defaultRoot, budgets: noBudgets });
    const perIcon = rows.filter((r) => r.id.startsWith('icon:'));
    expect(perIcon).toHaveLength(78);
    for (const r of perIcon) {
      expect(r.status, r.id).toBe('pass');
      expect(r.gzipBytes / 1024, r.id).toBeLessThanOrEqual(0.4);
    }
    const unused = rows.find((r) => r.id === 'icons:unused');
    expect(unused?.gzipBytes).toBe(0);
    expect(unused?.bundleRawBytes).toBeGreaterThan(0);
    expect(rows.find((r) => r.id === 'icons:one')?.gzipBytes).toBeGreaterThan(0);
    expect(rows.find((r) => r.id === 'icons:by-name')?.status).toBe('reported');
    expect(rows.find((r) => r.id === 'icons:all')?.status).toBe('reported');
    expect(rows.filter((r) => r.status === 'fail' && /^icons?:/.test(r.id))).toEqual([]);
  });

  /** Scratch repo root holding a copy of the icons package inputs. */
  function scratchRoot() {
    const root = mkdtempSync(join(tmpdir(), 'size-icons-'));
    for (const rel of [
      'packages/icons/src',
      'packages/icons/package.json',
      'packages/testing/size/fixtures/unused-icon',
      'packages/testing/size/icons-exceptions.json',
    ]) {
      cpSync(join(defaultRoot, rel), join(root, rel), { recursive: true });
    }
    return root;
  }

  it('fails a seeded oversize icon, and the reviewed exception list lifts it to 0.75 KiB', async () => {
    const root = scratchRoot();
    const file = join(root, 'packages/icons/src/generated/icons/star.ts');
    writeFileSync(
      file,
      `export const Star = { name: 'star', nodes: [['path', { d: ${JSON.stringify(randomBytes(500).toString('base64'))} }]] };\nexport { Star as StarIcon };\n`,
    );
    let res = await runSize({ root, budgets: noBudgets });
    expect(res.failed).toBe(true);
    expect(res.rows.find((r) => r.id === 'icon:star')?.status).toBe('fail');

    writeFileSync(
      join(root, 'packages/testing/size/icons-exceptions.json'),
      JSON.stringify({
        ceilingKiB: 0.4,
        exceptionCeilingKiB: 0.75,
        exceptions: [{ name: 'star', reason: 'test' }],
      }),
    );
    res = await runSize({ root, budgets: noBudgets });
    expect(res.rows.find((r) => r.id === 'icon:star')?.status).toBe('pass');
  });

  it('fails when the barrel leaks an unused icon (side-effecting module)', async () => {
    const root = scratchRoot();
    // Without `sideEffects: false` a module with a top-level effect cannot be dropped.
    writeFileSync(
      join(root, 'packages/icons/package.json'),
      JSON.stringify({ name: '@ramoslabs/icons', type: 'module' }),
    );
    const star = join(root, 'packages/icons/src/generated/icons/star.ts');
    writeFileSync(star, `${readFileSync(star, 'utf8')}console.log('star');\n`);
    const res = await runSize({ root, budgets: noBudgets });
    expect(res.rows.find((r) => r.id === 'icons:unused')?.status).toBe('fail');
  });
});
