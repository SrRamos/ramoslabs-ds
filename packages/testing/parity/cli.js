// @ts-check
// `bun run parity`: reads Playwright JSON results plus the matrix declaration, writes the matrix
// (JSON and Markdown) and exits 1 on a failed, missing, invalid or undeclared cell (W1-313).
//   node parity/cli.js [--results <file>]... [--expected <file>] [--out <dir>]
// Defaults: the supports run in node_modules/.cache/e2e. A `*diagnose*` file (a retried run) is refused.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMatrix, collectResults, renderMarkdown } from './index.js';

const cache = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.cache', 'e2e');
const args = process.argv.slice(2);
/** @param {string} flag */
const all = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
const files = all('--results');
if (files.length === 0) files.push(join(cache, 'e2e-supports-results.json'));
const expectedFile = all('--expected')[0] ?? join(cache, 'e2e-supports-expected.json');
const out = all('--out')[0] ?? join(cache, 'parity');

for (const f of files)
  if (basename(f).includes('diagnose')) {
    console.error(`parity: ${f} is a retried (diagnose) run; it can never feed the matrix.`);
    process.exit(1);
  }
let results;
let expected;
try {
  results = files.map((f) => collectResults(JSON.parse(readFileSync(f, 'utf8')), basename(f)));
  expected = JSON.parse(readFileSync(expectedFile, 'utf8'));
} catch (e) {
  console.error(`parity: cannot read inputs: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
const m = buildMatrix({ expected, results });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'parity-matrix.json'), JSON.stringify(m, null, 2) + '\n');
writeFileSync(join(out, 'parity-matrix.md'), renderMarkdown(m));
const s = m.summary;
console.log(
  `parity: ${m.ok ? 'PASS' : 'FAIL'}: ${s.cells} cells, ${s.executed} executed (${s.passed} passed, ${s.failed} failed), ${s.notApplicable} not-applicable, ${s.notRun} not run, ${s.missing} missing, ${m.invalid.length} invalid, ${s.extra} undeclared. Wrote ${out}`,
);
if (!m.ok) process.exit(1);
