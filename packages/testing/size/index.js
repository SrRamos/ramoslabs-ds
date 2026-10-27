// @ts-check
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIB, externalizeShared, measure } from './measure.js';

const here = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = resolve(here, '../../..');

/** @typedef {{ id: string, label: string, kind: 'shared' | 'component' | 'fixture' | 'adapter', gzipBytes: number, rawBytes: number, ceilingKiB: number | null, status: 'pass' | 'fail' | 'reported', detail?: string, bundleRawBytes?: number, graph: string[] }} Row */

/** @param {number} bytes */
const kib = (bytes) => bytes / KIB;

/**
 * Measure every ADR-011 row: shared kernel modules, component ceilings from contracts, the
 * unused-component fixture, and adapters (reported only).
 *
 * @param {object} [options]
 * @param {string} [options.root] repo root
 * @param {any} [options.budgets] parsed budgets.json (defaults to the shipped file)
 * @returns {Promise<{ rows: Row[], failed: boolean }>}
 */
export async function runSize(options = {}) {
  const root = options.root ?? defaultRoot;
  const budgets = options.budgets ?? JSON.parse(readFileSync(join(here, 'budgets.json'), 'utf8'));
  /** @type {Row[]} */
  const rows = [];

  for (const row of budgets.rows) {
    if (row.fixture) {
      const entry = resolve(root, row.fixture.entry);
      const unused = relativeKey(root, row.fixture.unused);
      const r = await measure({
        root,
        resolveDir: dirname(entry),
        contents: `export * from ${JSON.stringify(entry)};`,
      });
      const bytes = r.bytesInOutput[unused] ?? 0;
      const ok = kib(bytes) <= row.ceilingKiB;
      rows.push({
        id: row.id,
        label: row.label,
        kind: 'fixture',
        gzipBytes: bytes,
        rawBytes: bytes,
        ceilingKiB: row.ceilingKiB,
        status: ok ? 'pass' : 'fail',
        detail: `bytes of the unused component in the bundle: ${bytes}`,
        bundleRawBytes: r.rawBytes,
        graph: r.graph,
      });
      continue;
    }
    const files = row.entries.map((/** @type {string} */ e) => resolve(root, e));
    const missing = files.filter((/** @type {string} */ f) => !existsSync(f));
    if (missing.length) {
      rows.push({
        id: row.id,
        label: row.label,
        kind: 'shared',
        gzipBytes: 0,
        rawBytes: 0,
        ceilingKiB: row.ceilingKiB,
        status: 'fail',
        detail: `entry missing: ${missing.map((/** @type {string} */ m) => relativeKey(root, m)).join(', ')}`,
        graph: [],
      });
      continue;
    }
    const r = await measure({
      root,
      resolveDir: root,
      contents: files
        .map((/** @type {string} */ f) => `export * from ${JSON.stringify(f)};`)
        .join('\n'),
      external: budgets.peers,
    });
    rows.push({
      id: row.id,
      label: row.label,
      kind: 'shared',
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      ceilingKiB: row.ceilingKiB,
      status: kib(r.gzipBytes) <= row.ceilingKiB ? 'pass' : 'fail',
      graph: r.graph,
    });
  }

  // Component ceilings come from each contract's `budgets` block (ADR-010).
  const contractsDir = resolve(root, 'packages/contracts/contracts');
  const contractFiles = existsSync(contractsDir)
    ? readdirSync(contractsDir).filter((f) => f.endsWith('.contract.json'))
    : [];
  for (const file of contractFiles) {
    const contract = JSON.parse(readFileSync(join(contractsDir, file), 'utf8'));
    const slug = file.replace(/\.contract\.json$/, '');
    const ceiling = contract.budgets?.gzipKiB;
    const entry = resolve(root, 'packages/core/src', slug, 'index.ts');
    if (typeof ceiling !== 'number' || !existsSync(entry)) {
      rows.push({
        id: slug,
        label: `Component ${slug}`,
        kind: 'component',
        gzipBytes: 0,
        rawBytes: 0,
        ceilingKiB: typeof ceiling === 'number' ? ceiling : null,
        status: 'fail',
        detail:
          typeof ceiling !== 'number' ? 'contract has no budgets.gzipKiB' : 'core entry missing',
        graph: [],
      });
      continue;
    }
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${JSON.stringify(entry)};`,
      external: budgets.peers,
      plugins: [externalizeShared(root, budgets.sharedModules, dirname(entry))],
    });
    rows.push({
      id: slug,
      label: `Component ${slug} (excl. shared kernel)`,
      kind: 'component',
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      ceilingKiB: ceiling,
      status: kib(r.gzipBytes) <= ceiling ? 'pass' : 'fail',
      graph: r.graph,
    });
  }

  // Adapters are reported separately; peer framework code is never counted.
  for (const adapter of budgets.adapters) {
    const entry = resolve(root, 'packages', adapter, 'src/index.ts');
    if (!existsSync(entry)) continue;
    const r = await measure({
      root,
      resolveDir: root,
      contents: `export * from ${JSON.stringify(entry)};`,
      external: budgets.peers,
    });
    rows.push({
      id: `adapter:${adapter}`,
      label: `@ramoslabs/${adapter} barrel (reported, peers excluded)`,
      kind: 'adapter',
      gzipBytes: r.gzipBytes,
      rawBytes: r.rawBytes,
      ceilingKiB: null,
      status: 'reported',
      graph: r.graph,
    });
  }

  return { rows, failed: rows.some((r) => r.status === 'fail') };
}

/**
 * @param {string} root
 * @param {string} path
 */
function relativeKey(root, path) {
  return resolve(root, path)
    .slice(resolve(root).length + 1)
    .split('\\')
    .join('/');
}

/** @param {Row[]} rows */
export function formatReport(rows) {
  const pad = (/** @type {string} */ s, /** @type {number} */ n) => s.padEnd(n);
  const lines = [
    `${pad('artifact', 22)} ${pad('gzip', 11)} ${pad('raw', 9)} ${pad('ceiling', 9)} ${pad('graph', 6)} status`,
  ];
  for (const r of rows) {
    lines.push(
      `${pad(r.id, 22)} ${pad(`${kib(r.gzipBytes).toFixed(3)} KiB`, 11)} ${pad(`${r.rawBytes} B`, 9)} ${pad(
        r.ceilingKiB === null ? '-' : `${r.ceilingKiB} KiB`,
        9,
      )} ${pad(String(r.graph.length), 6)} ${r.status}${r.detail ? `  (${r.detail})` : ''}`,
    );
  }
  return lines.join('\n');
}
