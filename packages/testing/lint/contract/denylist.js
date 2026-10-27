// @ts-check
// Prior-brand deny-list scan (W1-307, BRIEF constraint 1, NICE-4). The terms must never appear
// in clear text in this repo, so the scan holds only SHA-256 hashes of normalized terms
// (trimmed, lower case). Hashes come from the environment or a file kept outside the repo:
//   RAMOSLABS_DENYLIST_SHA256   comma/space separated hex digests
//   RAMOSLABS_DENYLIST_FILE     path to a file, one digest per line (`#` comments allowed)
// A committed `denylist.sha256` next to this file is read too (digests only, may be empty).
// Findings never print the matched word, only file, line, column and the digest prefix.
import { createHash } from 'node:crypto';

/** @param {string} term */
export function hashTerm(term) {
  return createHash('sha256').update(term.trim().toLowerCase()).digest('hex');
}

/**
 * @param {string} text
 * @returns {Set<string>}
 */
export function parseHashes(text) {
  const out = new Set();
  for (const line of text.split(/\r?\n/)) {
    const body = line.replace(/#.*/, '');
    for (const tok of body.split(/[\s,]+/)) {
      if (/^[0-9a-f]{64}$/i.test(tok)) out.add(tok.toLowerCase());
    }
  }
  return out;
}

const WORD = /[A-Za-z0-9]+/g;
const MAX_TOKEN = 40;
const MAX_PREFIX = 24;

/**
 * Candidates for one word: the whole word, its camelCase segments and its leading prefixes,
 * so both a name (`term`) and a prefix (`termButton`, `term-x`) are found. Words are cut at every
 * non-alphanumeric character, which also handles kebab and snake case.
 * @param {string} word
 * @returns {string[]}
 */
function candidates(word) {
  const lower = word.toLowerCase();
  /** @type {Set<string>} */
  const out = new Set();
  for (let n = 2; n <= Math.min(lower.length, MAX_PREFIX); n++) out.add(lower.slice(0, n));
  out.add(lower);
  for (const seg of word.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
    const s = seg.toLowerCase();
    if (s.length >= 2) {
      for (let n = 2; n <= Math.min(s.length, MAX_PREFIX); n++) out.add(s.slice(0, n));
    }
  }
  return [...out];
}

/**
 * @param {string} text
 * @param {Set<string>} hashes
 * @param {Map<string, string>} [cache] candidate -> digest, shared across files
 * @returns {Array<{ line: number, col: number, digest: string }>}
 */
export function scanText(text, hashes, cache = new Map()) {
  /** @type {Array<{ line: number, col: number, digest: string }>} */
  const out = [];
  if (hashes.size === 0) return out;
  const digestOf = (/** @type {string} */ c) => {
    let d = cache.get(c);
    if (d === undefined) {
      d = hashTerm(c);
      cache.set(c, d);
    }
    return d;
  };
  let line = 1;
  for (let i = 0; i < text.length;) {
    const nl = text.indexOf('\n', i);
    const end = nl === -1 ? text.length : nl;
    const row = text.slice(i, end);
    for (const m of row.matchAll(WORD)) {
      if (m[0].length > MAX_TOKEN) continue;
      for (const c of candidates(m[0])) {
        const d = digestOf(c);
        if (hashes.has(d)) {
          out.push({ line, col: (m.index ?? 0) + 1, digest: d.slice(0, 8) });
          break;
        }
      }
    }
    line++;
    i = end + 1;
  }
  return out;
}

/**
 * @param {{ env?: Record<string, string | undefined>, readFile?: (p: string) => string | null, committedPath?: string }} [options]
 * @returns {Set<string>}
 */
export function loadHashes({ env = {}, readFile = () => null, committedPath } = {}) {
  const all = new Set(parseHashes(env.RAMOSLABS_DENYLIST_SHA256 ?? ''));
  const add = (/** @type {string | null | undefined} */ t) => {
    if (t) for (const h of parseHashes(t)) all.add(h);
  };
  if (env.RAMOSLABS_DENYLIST_FILE) add(readFile(env.RAMOSLABS_DENYLIST_FILE));
  if (committedPath) add(readFile(committedPath));
  return all;
}
