// Duplicate-key rule for tracked JSON. JSON.parse keeps the LAST of two equal keys without a
// word, so `{"a": 1, "a": 2}` parses cleanly and a bad merge slips through. This tokenizer tracks
// the keys of each object separately, so it catches the duplicate and nothing else:
//   - a duplicate key in the same object fails (the seeded case: a second "./checkbox" export);
//   - the same key at different levels or in sibling objects is fine;
//   - text inside a string value, or a key-looking string inside an array, is ignored.
// Comments (// and /* */) and trailing commas are tolerated so JSONC files such as tsconfig.json
// are scanned too. Malformed structure throws, which the CLI reports as a failure.
// Usage: node scripts/json-dupes.mjs [--selftest]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Index of the next character that is not whitespace or a comment (or source.length). */
function nextSignificant(source, i) {
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
    else if (c === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? source.length : nl + 1;
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) throw new SyntaxError(`unterminated comment at offset ${i}`);
      i = end + 2;
    } else return i;
  }
  return i;
}

/** Index just past the closing quote of the string literal that opens at `start`. */
function stringEnd(source, start) {
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') i++;
    else if (c === '"') return i + 1;
    else if (c === '\n') break;
  }
  throw new SyntaxError(`unterminated string at offset ${start}`);
}

/**
 * @returns {{key: string, index: number}[]} every key that repeats an earlier key of the same
 *   object. `index` is the offset of the repeated key's opening quote.
 */
export function findDuplicateKeys(source) {
  const dupes = [];
  const stack = []; // one frame per open container: { open, keys } (keys is null for arrays)
  let i = 0;
  for (;;) {
    i = nextSignificant(source, i);
    if (i >= source.length) break;
    const c = source[i];
    const top = stack[stack.length - 1];
    if (c === '{') {
      stack.push({ open: '{', keys: new Set() });
      i++;
    } else if (c === '[') {
      stack.push({ open: '[', keys: null });
      i++;
    } else if (c === '}' || c === ']') {
      const expected = c === '}' ? '{' : '[';
      if (!top || top.open !== expected) throw new SyntaxError(`unexpected '${c}' at offset ${i}`);
      stack.pop();
      i++;
    } else if (c === '"') {
      const end = stringEnd(source, i);
      // In JSON a string is an object key exactly when a colon follows it inside an object.
      if (top?.open === '{' && source[nextSignificant(source, end)] === ':') {
        const key = JSON.parse(source.slice(i, end)); // decodes escapes, so "A" equals "A"
        if (top.keys.has(key)) dupes.push({ key, index: i });
        else top.keys.add(key);
      }
      i = end;
    } else i++; // colons, commas, numbers and literals need no tracking
  }
  if (stack.length)
    throw new SyntaxError(`unclosed '${stack[stack.length - 1].open}' at end of file`);
  return dupes;
}

function selftest() {
  const bad = [
    '{"./checkbox": "a", "./checkbox": "b"}', // the seeded case: second key, same object
    '{\n  "exports": {\n    "./checkbox": 1,\n    "./checkbox": 2\n  }\n}',
    '{"a": 1, // note\n "a": 2}', // a comment does not hide the repeat
    '{"\\u0061": 1, "a": 2}', // escapes decode first, so these are the same key
    '[{"x": 1, "x": 2}]', // duplicate inside an array element
  ];
  const good = [
    '{"a": {"name": 1}, "b": {"name": 2}}', // same key in sibling objects
    '{"name": {"name": {"name": 1}}}', // same key at different nesting levels
    '{"list": ["key", "key", "key"]}', // repeated string values in an array
    '{"text": "\\"a\\": 1, \\"a\\": 2", "other": 3}', // key-looking text inside a string value
    '{"a": "x", "b": "x"}', // repeated values, distinct keys
    '// header\n{\n  "a": 1, /* block */ "b": 2,\n}', // JSONC: comments and trailing comma
  ];
  for (const s of bad)
    if (findDuplicateKeys(s).length === 0) throw new Error(`selftest: missed ${s}`);
  for (const s of good)
    if (findDuplicateKeys(s).length !== 0) throw new Error(`selftest: false positive ${s}`);
  // The duplicate has to be reported exactly once, not once per repeat.
  if (findDuplicateKeys('{"k": 1, "k": 2, "k": 3}').length !== 2)
    throw new Error('selftest: a key repeated twice must report each repeat');
  console.log(
    `json-dupes selftest: ${bad.length} seeded duplicates caught, ${good.length} valid shapes accepted`,
  );
}

selftest();
if (process.argv.includes('--selftest')) process.exit(0);

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '*.json'], { cwd: repo, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/(^|\/)node_modules\//.test(f));

let problems = 0;
for (const f of files) {
  const source = readFileSync(join(repo, f), 'utf8');
  let dupes;
  try {
    dupes = findDuplicateKeys(source);
  } catch (err) {
    console.error(`${relative(repo, join(repo, f))}: cannot scan: ${err.message}`);
    problems++;
    continue;
  }
  for (const d of dupes) {
    const line = source.slice(0, d.index).split('\n').length;
    console.error(`${f}:${line}: duplicate key "${d.key}"`);
    problems++;
  }
}
if (problems) {
  console.error(
    `json-dupes: ${problems} problem(s). JSON.parse keeps the last duplicate silently; remove the extra key.`,
  );
  process.exit(1);
}
console.log(`json-dupes: ${files.length} tracked JSON files scanned, no duplicate keys.`);
