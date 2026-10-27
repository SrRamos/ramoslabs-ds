// @ts-check
// `bun run size`: measure every ADR-011 row, print a report, exit 1 on any ceiling breach.
import { writeFileSync } from 'node:fs';
import { formatReport, runSize } from './index.js';

const jsonIndex = process.argv.indexOf('--json');
const { rows, failed } = await runSize();
console.log(formatReport(rows));
if (process.argv.includes('--graph')) {
  for (const r of rows)
    console.log(`\n${r.id} import graph:\n  ${r.graph.join('\n  ') || '(empty)'}`);
}
if (jsonIndex !== -1) writeFileSync(process.argv[jsonIndex + 1], JSON.stringify(rows, null, 2));
if (failed) {
  console.error('\nsize: a ceiling was exceeded or an entry is missing (ADR-011).');
  process.exit(1);
}
