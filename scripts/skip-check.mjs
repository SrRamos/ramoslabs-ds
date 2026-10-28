// Skip rule (W1-314, ADR-013: no skipped test without issue and owner). Exits 1 on any skip,
// fixme, todo or x-prefixed test that lacks BOTH of these, on the call, its arguments, or the two
// lines above it:
//   1. An issue reference: `#123` or a github.com/.../issues/N URL. A reason is optional.
//   2. An owner: `@handle`, or `owner: <name>` (write it without an @ to avoid notifying anyone).
// Playwright conditional skips (`test.skip(cond, 'why')`) follow the same rule.
// Usage: node scripts/skip-check.mjs [--selftest]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_CALL = /\b(?:(?:test|it|describe|suite)\.(?:skip|fixme|todo)|xit|xdescribe|xtest)\s*\(/g;
const OWNER = /(?:^|[^\w@])@[A-Za-z][\w-]*|\bowner:\s*[A-Za-z][\w-]*/;
const ISSUE_REF = /(?:^|[^\w&])#\d+\b|github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/;

/** Returns the text between the call's parentheses, or null when unbalanced. */
function callArgs(text, openIndex) {
  let depth = 0;
  let quote = '';
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return text.slice(openIndex + 1, i);
  }
  return null;
}

/** @returns {{line: number, text: string}[]} skips that lack an issue reference or an owner. */
export function findUnjustifiedSkips(source) {
  const lines = source.split('\n');
  const found = [];
  for (const m of source.matchAll(SKIP_CALL)) {
    const line = source.slice(0, m.index).split('\n').length;
    const args = callArgs(source, m.index + m[0].length - 1);
    const near = [lines[line - 3], lines[line - 2], lines[line - 1], args ?? ''].join('\n');
    if (ISSUE_REF.test(near) && OWNER.test(near)) continue;
    found.push({ line, text: lines[line - 1].trim() });
  }
  return found;
}

function selftest() {
  const bad = [
    "it.skip('later', () => {});",
    'test.skip();',
    "test.skip(browserName !== 'x', 'a long enough reason');",
    "// skip-reason: waiting on upstream\nit.skip('x', () => {});",
    "it.skip('blocked, see #123', () => {});", // issue, no owner
    "// owner: SrRamos\nit.skip('x', () => {});", // owner, no issue
    "// #123 skip-reason: later\nit.skip('x', () => {});", // reason, issue, no owner
    "xit('x', () => {});",
    "describe.todo('x');",
  ];
  const good = [
    "// #12 owner: SrRamos\ntest.skip(browserName !== 'chromium');",
    "// https://github.com/SrRamos/ramoslabs-ds/issues/9 @SrRamos\nit.fixme('x', () => {});",
    "it.skip('blocked #123 owner: SrRamos', () => {});",
    "// #7 owner: Someone, reason optional\nit.skip('x', () => {});",
  ];
  for (const s of bad)
    if (findUnjustifiedSkips(s).length !== 1) throw new Error(`selftest: missed ${s}`);
  for (const s of good)
    if (findUnjustifiedSkips(s).length !== 0) throw new Error(`selftest: false positive ${s}`);
  console.log(
    `skip-check selftest: ${bad.length} seeded skips caught, ${good.length} justified accepted`,
  );
}

selftest();
if (process.argv.includes('--selftest')) process.exit(0);

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync(
  'git',
  ['ls-files', '*.ts', '*.tsx', '*.js', '*.mjs', '*.mts', '*.vue'],
  {
    cwd: repo,
    encoding: 'utf8',
  },
)
  .split('\n')
  .filter((f) => f && !f.endsWith('scripts/skip-check.mjs') && !/(^|\/)fixtures\//.test(f));

let problems = 0;
for (const f of files) {
  for (const s of findUnjustifiedSkips(readFileSync(join(repo, f), 'utf8'))) {
    console.error(
      `${relative(repo, join(repo, f))}:${s.line}: skip without issue or owner: ${s.text}`,
    );
    problems++;
  }
}
if (problems) {
  console.error(
    `skip-check: ${problems} skipped test(s) without an issue and an owner. Reference a GitHub issue (\`#123\` or its URL) AND name an owner (\`owner: <name>\` or \`@handle\`) on the call or the two lines above it. A reason alone is not enough.`,
  );
  process.exit(1);
}
console.log(`skip-check: ${files.length} files scanned, every skip has an issue and an owner.`);
