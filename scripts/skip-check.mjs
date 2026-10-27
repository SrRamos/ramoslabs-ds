// Skip-without-issue check (W1-314). A skipped test must say why or link an issue, otherwise it is
// a hole that nobody can audit. Exits 1 on any skip, fixme, todo or x-prefixed test without one.
//
// A skip is accepted when ANY of these holds:
//   1. Playwright conditional form with a reason string: test.skip(browserName !== 'x', 'why ...')
//   2. A comment on the same line or the two lines above: `// skip-reason: <text>`
//   3. An issue reference on the same call or those lines: `#123` or a github.com/.../issues/N URL
// Usage: node scripts/skip-check.mjs [--selftest]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_CALL = /\b(?:(?:test|it|describe|suite)\.(?:skip|fixme|todo)|xit|xdescribe|xtest)\s*\(/g;
const REASON_COMMENT = /skip-reason:\s*\S.{4,}/;
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

/** Splits at top-level commas (outside quotes and brackets). */
function splitArgs(args) {
  const out = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (let i = 0; i < args.length; i++) {
    const c = args[i];
    if (quote) {
      cur += c;
      if (c === '\\') cur += args[++i] ?? '';
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const isString = (s) => /^(['"`])[\s\S]*\1$/.test(s);

/** @returns {{line: number, text: string}[]} skips that give no reason and no issue. */
export function findUnjustifiedSkips(source) {
  const lines = source.split('\n');
  const found = [];
  for (const m of source.matchAll(SKIP_CALL)) {
    const line = source.slice(0, m.index).split('\n').length;
    const args = callArgs(source, m.index + m[0].length - 1);
    const parts = args === null ? [] : splitArgs(args);
    // Form 1: test.skip(<condition>, '<reason>'). The first argument is not a title string.
    if (parts.length >= 2 && !isString(parts[0]) && isString(parts[1]) && parts[1].length >= 10) {
      continue;
    }
    const near = [lines[line - 3], lines[line - 2], lines[line - 1], args ?? ''].join('\n');
    if (REASON_COMMENT.test(near) || ISSUE_REF.test(near)) continue;
    found.push({ line, text: lines[line - 1].trim() });
  }
  return found;
}

function selftest() {
  const bad = [
    "it.skip('later', () => {});",
    'test.skip();',
    'test.skip(true);',
    "test.skip(browserName !== 'x', 'no');",
    "xit('x', () => {});",
    "describe.todo('x');",
  ];
  const good = [
    "test.skip(browserName !== 'chromium', 'CDP exists on Chromium only');",
    "// skip-reason: no reducer yet\nit.skip('x', () => {});",
    "it.skip('blocked, see #123', () => {});",
    "// https://github.com/SrRamos/ramoslabs-ds/issues/9\nit.fixme('x', () => {});",
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
      `${relative(repo, join(repo, f))}:${s.line}: skip without reason or issue: ${s.text}`,
    );
    problems++;
  }
}
if (problems) {
  console.error(
    `skip-check: ${problems} skipped test(s) without a reason. Add \`// skip-reason: <why>\`, a reason string, or an issue link.`,
  );
  process.exit(1);
}
console.log(`skip-check: ${files.length} files scanned, every skip has a reason or issue.`);
