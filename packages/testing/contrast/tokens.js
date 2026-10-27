// @ts-check
// Resolves the DTCG token source into the flat map `{ "color-indigo-600": "#4f46e5" }`, the same
// names `tokens.json` uses. Reads the authoritative JSON, so it works before the tokens build runs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultTokenDir = fileURLToPath(new URL('../../tokens/src/tokens/', import.meta.url));

/** @param {string} [dir] @returns {Record<string, string>} */
export function loadTokens(dir = defaultTokenDir) {
  /** @type {Record<string, unknown>} */
  const raw = {};
  /** @param {string} prefix @param {any} node */
  const walk = (prefix, node) => {
    if (node && typeof node === 'object' && '$value' in node) {
      raw[prefix] = node.$value;
      return;
    }
    for (const [k, v] of Object.entries(node ?? {})) {
      if (!k.startsWith('$')) walk(prefix ? `${prefix}-${k}` : k, v);
    }
  };
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()) {
    walk('', JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  /** @type {Record<string, string>} */
  const out = {};
  /** @param {string} name @param {string[]} seen @returns {string} */
  const resolve = (name, seen = []) => {
    const v = raw[name];
    if (typeof v !== 'string') return JSON.stringify(v);
    const m = /^\{(.+)\}$/.exec(v);
    if (!m) return v;
    const ref = m[1].replaceAll('.', '-');
    if (seen.includes(ref)) throw new Error(`Token alias cycle at ${ref}`);
    return resolve(ref, [...seen, name]);
  };
  for (const name of Object.keys(raw)) out[name] = resolve(name);
  return out;
}
