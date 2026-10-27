// @ts-check
// evidence:check (W1-317, partial). Pure functions; cli.js is the gate entry.
//
// Implemented now (inputs exist): ref resolution and staleness for every registry entry a
// contract uses. Pending until the inputs/owners exist: decision-conflict against
// focus.strategy / overlay.listboxMount, and the pattern coverage report (see PENDING).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PENDING = [
  'decision-conflict: registry entry `constraints` vs contract focus.strategy / overlay.listboxMount (W1-317, pending)',
  'pattern coverage: every pattern a component uses has a registry entry for every AT in the support matrix (W1-317, pending)',
];

/**
 * @typedef {{ at: string, platform: string, browser: string, evidence: string[] }} AtSupport
 * @typedef {{ id: string, at: string, platform: string, browser: string, next_review: string }} RegistryEntry
 */

const REF = /^at-support\/([a-z0-9-]+\.json)#([a-z0-9-]+)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {string} dir */
export function contractFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.contract.json') && f !== 'kinds.contract.json')
    .sort();
}

/**
 * @param {{ contractsDir: string, registryDir: string, today?: string }} opts
 * `registryDir` is the directory that holds the registry JSON files (the `at-support/` folder).
 * @returns {{ errors: string[], checkedRefs: number, contracts: number }}
 */
export function checkEvidence({
  contractsDir,
  registryDir,
  today = new Date().toISOString().slice(0, 10),
}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, Map<string, RegistryEntry> | null>} */
  const registry = new Map();
  const load = (/** @type {string} */ file) => {
    if (!registry.has(file)) {
      const path = join(registryDir, file);
      if (!existsSync(path)) registry.set(file, null);
      else {
        const json = JSON.parse(readFileSync(path, 'utf8'));
        registry.set(
          file,
          new Map((json.entries ?? []).map((/** @type {RegistryEntry} */ e) => [e.id, e])),
        );
      }
    }
    return registry.get(file) ?? null;
  };

  const files = contractFiles(contractsDir);
  let checkedRefs = 0;
  for (const file of files) {
    const contract = JSON.parse(readFileSync(join(contractsDir, file), 'utf8'));
    /** @type {AtSupport[]} */
    const rows = contract?.a11y?.atSupport ?? [];
    rows.forEach((row, i) => {
      for (const ref of row.evidence ?? []) {
        checkedRefs += 1;
        const where = `${file}: /a11y/atSupport/${i}/evidence "${ref}"`;
        const m = REF.exec(ref);
        if (!m) {
          errors.push(`${where}: malformed ref (expected at-support/<file>.json#<id>)`);
          continue;
        }
        const entries = load(m[1]);
        const declared = contract?.pattern?.evidence;
        if (declared && m[1] !== `${declared}.json`)
          errors.push(`${where}: ref is outside the declared pattern.evidence "${declared}"`);
        if (!entries) {
          errors.push(`${where}: registry file ${m[1]} does not exist`);
          continue;
        }
        const entry = entries.get(m[2]);
        if (!entry) {
          errors.push(`${where}: no entry "${m[2]}" in ${m[1]}`);
          continue;
        }
        if (!DATE.test(entry.next_review ?? ''))
          errors.push(`${where}: entry has no valid next_review`);
        else if (entry.next_review < today)
          errors.push(`${where}: stale, next_review ${entry.next_review} is before ${today}`);
        for (const key of /** @type {const} */ (['at', 'platform', 'browser'])) {
          if (String(entry[key]).toLowerCase() !== row[key])
            errors.push(
              `${where}: entry ${key} "${entry[key]}" does not match contract "${row[key]}"`,
            );
        }
      }
    });
  }
  return { errors, checkedRefs, contracts: files.length };
}
