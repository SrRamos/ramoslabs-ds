import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

  it('fails when an unused fixture component leaks into the bundle', async () => {
    const root = mkdtempSync(join(tmpdir(), 'size-leak-'));
    writeFileSync(join(root, 'b.ts'), `export const b = () => 'leaked' + Date.now();`);
    writeFileSync(join(root, 'consumer.ts'), `import { b } from './b';\nconsole.log(b());`);
    const { failed } = await runSize({
      root,
      budgets: {
        rows: [
          {
            id: 'fixture',
            label: 'leak',
            ceilingKiB: 0,
            fixture: { entry: 'consumer.ts', unused: 'b.ts' },
          },
        ],
        sharedModules: [],
        adapters: [],
        peers: [],
      },
    });
    expect(failed).toBe(true);
  });
});
