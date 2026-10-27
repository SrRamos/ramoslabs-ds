// @ts-check
// `bun run honesty:check`: exit 1 when any scanned file claims hands-on testing of an
// evidence-only AT, or lists a tested-real entry without date, log, or on a non-VoiceOver AT (W1-319).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFiles } from './index.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKIP = new Set(['node_modules', 'dist', '.astro', '.turbo', '.wrangler', 'coverage', '.git']);
// Audit records review the docs; they are not published claims about AT testing.
const EXEMPT = /^docs\/architecture\/audits\//;
const EXT = /\.(md|mdx|json|txt|astro|ts|js|mjs|html)$/;

/** @param {string} dir @param {string[]} acc */
function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (EXT.test(name)) acc.push(p);
  }
  return acc;
}

const roots = [
  join(repo, 'packages', 'contracts', 'contracts'),
  join(repo, 'docs'),
  join(repo, 'apps', 'site', 'src'),
  join(repo, 'apps', 'site', 'agentic'),
  join(repo, 'apps', 'site', 'public'),
];
/** @type {string[]} */
const paths = [];
for (const r of roots) {
  try {
    walk(r, paths);
  } catch {
    // root absent: nothing to scan
  }
}
for (const f of ['llms.txt', 'llms-full.txt', 'registry.json', 'README.md', 'AGENTS.md'])
  paths.push(join(repo, f));

const files = paths
  .map((p) => ({ file: relative(repo, p), content: readFileSync(p, 'utf8') }))
  .filter((f) => !EXEMPT.test(f.file));
const { violations, realVoiceOver } = scanFiles(files);
if (violations.length > 0) {
  for (const v of violations)
    console.error(`honesty:check: ${v.file}:${v.line} [${v.rule}] ${v.text}`);
  console.error(`honesty:check: ${violations.length} violation(s) in ${files.length} file(s).`);
  process.exit(1);
}
console.log(
  `honesty:check: ${files.length} file(s) clean; ${realVoiceOver ? 'real VoiceOver entries present' : 'no tested-real entries (all AT support is evidence-only or pending)'}.`,
);
