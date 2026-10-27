// @ts-check
// Contract lint (W1-307): contract-driven source rules, contract-aware CSS rule, deny-list scan.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildIndex, lintContractData } from './source.js';
import { loadHashes, scanText } from './denylist.js';

export { buildIndex, lintContractData, lintSource } from './source.js';
export { lintCssContract, selectorsOf } from './css-contract.js';
export { hashTerm, loadHashes, parseHashes, scanText } from './denylist.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const contractsDir = path.join(repoRoot, 'packages', 'contracts', 'contracts');

/** Read every component contract plus the kinds contract. */
export function loadContracts(dir = contractsDir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.contract.json'));
  /** @type {Array<{ file: string, json: any }>} */
  const all = files.map((f) => ({
    file: f,
    json: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
  }));
  const kinds = all.find((c) => c.file === 'kinds.contract.json')?.json?.kinds ?? [];
  const contracts = all.filter((c) => c.file !== 'kinds.contract.json');
  return { kinds, contracts };
}

/** Contract-data findings for every component contract (unknown kind). */
export function lintContracts(dir = contractsDir) {
  const { kinds, contracts } = loadContracts(dir);
  const index = buildIndex({ contracts: contracts.map((c) => c.json), kinds });
  return contracts.flatMap((c) => lintContractData(c.json, index, c.file));
}

const SKIP = /(^|\/)(bun\.lock|node_modules|dist|\.git)(\/|$)/;
const MAX_BYTES = 2 * 1024 * 1024;

/** Tracked and untracked-not-ignored files; falls back to a plain walk outside git. */
export function listRepoFiles(root = repoRoot) {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
      },
    ).toString();
    return out.split('\0').filter((f) => f && !SKIP.test(f));
  } catch {
    /** @type {string[]} */
    const acc = [];
    const walk = (/** @type {string} */ d) => {
      for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
        const rel = path.posix.join(d, e.name);
        if (SKIP.test(rel)) continue;
        if (e.isDirectory()) walk(rel);
        else acc.push(rel);
      }
    };
    walk('');
    return acc;
  }
}

/**
 * Scan the tree against the hashed deny-list.
 * @param {{ env?: Record<string, string | undefined>, root?: string, files?: string[] }} [options]
 */
export function scanTree({ env = process.env, root = repoRoot, files } = {}) {
  const hashes = loadHashes({
    env,
    readFile: (p) => {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {
        return null;
      }
    },
    committedPath: path.join(here, 'denylist.sha256'),
  });
  /** @type {Array<{ file: string, line: number, col: number, digest: string }>} */
  const findings = [];
  if (hashes.size === 0) return { configured: false, terms: 0, findings };
  const cache = new Map();
  for (const rel of files ?? listRepoFiles(root)) {
    const abs = path.join(root, rel);
    let buf;
    try {
      const st = fs.statSync(abs);
      if (!st.isFile() || st.size > MAX_BYTES) continue;
      buf = fs.readFileSync(abs);
    } catch {
      continue;
    }
    if (buf.subarray(0, 8192).includes(0)) continue; // binary
    // The path itself is scanned too: a prior-brand file or folder name is a defect.
    for (const f of scanText(rel, hashes, cache)) findings.push({ file: rel, ...f, line: 0 });
    for (const f of scanText(buf.toString('utf8'), hashes, cache))
      findings.push({ file: rel, ...f });
  }
  return { configured: true, terms: hashes.size, findings };
}
