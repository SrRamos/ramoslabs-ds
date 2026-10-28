// @ts-check
// ADR-016 / ADR-011 icon rows: per-icon ceilings, the unused-icon fixture, one icon through the
// barrel, and the whole-set rows (barrel and by-name) that are reported and never gated.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KIB, measure } from './measure.js';

/**
 * @param {string} root repo root
 * @returns {Promise<import('./index.js').Row[]>} empty when the icons package is absent
 */
export async function measureIcons(root) {
  const listPath = resolve(root, 'packages/icons/src/icons.list.json');
  if (!existsSync(listPath)) return [];
  const list = JSON.parse(readFileSync(listPath, 'utf8'));
  const exPath = resolve(root, 'packages/testing/size/icons-exceptions.json');
  const cfg = existsSync(exPath)
    ? JSON.parse(readFileSync(exPath, 'utf8'))
    : { ceilingKiB: 0.4, exceptionCeilingKiB: 0.75, exceptions: [] };
  const excepted = new Set(
    (cfg.exceptions ?? []).map((/** @type {{ name: string }} */ e) => e.name),
  );
  /** @type {import('./index.js').Row[]} */
  const rows = [];
  const gen = resolve(root, 'packages/icons/src/generated');

  for (const { name } of list.icons) {
    const entry = resolve(gen, 'icons', `${name}.ts`);
    const ceiling = excepted.has(name) ? cfg.exceptionCeilingKiB : cfg.ceilingKiB;
    if (!existsSync(entry)) {
      rows.push({
        id: `icon:${name}`,
        label: `Icon ${name}`,
        kind: 'icon',
        gzipBytes: 0,
        rawBytes: 0,
        ceilingKiB: ceiling,
        status: 'fail',
        detail: 'generated module missing',
        graph: [],
      });
      continue;
    }
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${JSON.stringify(entry)};`,
    });
    rows.push({
      id: `icon:${name}`,
      label: `Icon ${name}${excepted.has(name) ? ' (reviewed exception)' : ''}`,
      kind: 'icon',
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      ceilingKiB: ceiling,
      status: r.gzipBytes / KIB <= ceiling ? 'pass' : 'fail',
      graph: r.graph,
    });
  }

  // One icon through the barrel; the others must contribute nothing.
  const consumer = resolve(root, 'packages/testing/size/fixtures/unused-icon/consumer.ts');
  if (existsSync(consumer)) {
    const unusedKey = 'packages/icons/src/generated/icons/star.ts';
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${JSON.stringify(consumer)};`,
    });
    const unused = r.bytesInOutput[unusedKey] ?? 0;
    rows.push({
      id: 'icons:unused',
      label: 'Unused icon in a fixture importing another (barrel)',
      kind: 'fixture',
      gzipBytes: unused,
      rawBytes: unused,
      ceilingKiB: 0,
      status: unused === 0 && r.rawBytes > 0 ? 'pass' : 'fail',
      detail: `bytes of the unused icon in the bundle: ${unused}`,
      bundleRawBytes: r.rawBytes,
      graph: r.graph,
    });
    rows.push({
      id: 'icons:one',
      label: 'One icon imported through the barrel',
      kind: 'fixture',
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      ceilingKiB: cfg.ceilingKiB,
      status: r.gzipBytes / KIB <= cfg.ceilingKiB ? 'pass' : 'fail',
      graph: r.graph,
    });
  }

  for (const [id, label, entryFile] of /** @type {const} */ ([
    [
      'icons:by-name',
      'by-name helper, whole set in one module (reported, not tree-shakeable)',
      'packages/icons/src/by-name.ts',
    ],
    [
      'icons:all',
      'Every icon through the barrel (reported)',
      'packages/icons/src/generated/index.ts',
    ],
  ])) {
    const entry = resolve(root, entryFile);
    if (!existsSync(entry)) continue;
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${JSON.stringify(entry)};`,
    });
    rows.push({
      id,
      label,
      kind: 'icon',
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      ceilingKiB: null,
      status: 'reported',
      graph: r.graph,
    });
  }
  return rows;
}
