// @ts-check
// evidence:check (W1-317). Pure functions; cli.js is the gate entry.
//
// Enforced: (1) every registry file validates against at-support.schema.json plus the ADR-015
// rules of evidence (W1-315, contracts/scripts/at-validate.mjs); (2) every evidence ref resolves,
// is fresh and matches its contract row; (3) decision-conflict: structured `constraints` (never the
// prose `decision`) vs the contract's focus.strategy, overlay.listboxMount and nativeFallback;
// (4) pattern coverage: each pattern a contract uses has a registry file with an entry for every
// primary pair, and the contract lists every primary pair (ADR-013 4b). Nothing is pending.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRIMARY_PAIRS,
  registryFiles,
  validateAtFile,
} from '../../contracts/scripts/at-validate.mjs';

/** @type {string[]} Checks listed as not enforced; empty since W1-317 completed. */
export const PENDING = [];

/**
 * @typedef {{ at: string, platform: string, browser: string, evidence: string[] }} AtSupport
 * @typedef {{ id: string, at: string, platform: string, browser: string, next_review: string }} RegistryEntry
 */

const REF = /^at-support\/([a-z0-9-]+\.json)#([a-z0-9-]+)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {{ focusStrategy?: string, listboxMount?: { fine?: string, coarse?: string }, nativeOnTouch?: boolean, domAdjacent?: boolean, mustNot?: string[] }} Constraints
 */

/**
 * Decision-conflict: structured constraints vs the contract. A constraint key that is present must
 * agree with the contract; an absent key says nothing. `domAdjacent` and `mustNot` have no
 * contract field (listboxMount values are DOM-adjacent by definition, ADR-005 step 8), so they are
 * not compared here.
 * @param {string} file @param {any} contract @param {string} source @param {Constraints | undefined} c
 * @param {string[]} errors
 */
function conflicts(file, contract, source, c, errors) {
  if (!c) return;
  const where = `${file}: decision conflict with registry ${source}`;
  if (c.focusStrategy !== undefined && c.focusStrategy !== contract?.focus?.strategy)
    errors.push(
      `${where}: constraints.focusStrategy "${c.focusStrategy}" but contract focus.strategy is "${contract?.focus?.strategy}"`,
    );
  if (c.listboxMount) {
    const mount = contract?.overlay?.listboxMount;
    if (!mount) {
      errors.push(
        `${where}: constraints.listboxMount is set but the contract has no overlay.listboxMount`,
      );
    } else {
      for (const [cls, want] of Object.entries(c.listboxMount)) {
        const got = mount.byAnyPointer?.[cls] ?? mount.default;
        if (got !== want)
          errors.push(
            `${where}: constraints.listboxMount.${cls} "${want}" but the contract resolves it to "${got}"`,
          );
      }
    }
  }
  if (c.nativeOnTouch === true && !contract?.nativeFallback)
    errors.push(
      `${where}: constraints.nativeOnTouch is true but the contract declares no nativeFallback`,
    );
}

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
  /** @type {Map<string, { constraints?: Constraints } | null>} */
  const registryRecommended = new Map();
  const load = (/** @type {string} */ file) => {
    if (!registry.has(file)) {
      const path = join(registryDir, file);
      if (!existsSync(path)) registry.set(file, null);
      else {
        const json = JSON.parse(readFileSync(path, 'utf8'));
        registryRecommended.set(file, json.recommended ?? null);
        registry.set(
          file,
          new Map((json.entries ?? []).map((/** @type {RegistryEntry} */ e) => [e.id, e])),
        );
      }
    }
    return registry.get(file) ?? null;
  };

  for (const path of registryFiles(registryDir)) {
    for (const e of validateAtFile(path))
      errors.push(`registry ${path.split(/[\\/]/).pop()}: ${e.path}: ${e.message}`);
  }

  const files = contractFiles(contractsDir);
  let checkedRefs = 0;
  for (const file of files) {
    const contract = JSON.parse(readFileSync(join(contractsDir, file), 'utf8'));
    /** @type {Set<string>} entry ids already conflict-checked for this contract */
    const conflictChecked = new Set();
    const patternFile = contract?.pattern?.evidence ?? contract?.pattern?.apg;
    if (patternFile) {
      const entries = load(`${patternFile}.json`);
      if (!entries) {
        errors.push(
          `${file}: pattern coverage: no registry file at-support/${patternFile}.json; unmapped pattern, return to the research peer (blocks this component's .a)`,
        );
      } else {
        for (const [key, pair] of Object.entries(PRIMARY_PAIRS)) {
          const has = [...entries.values()].some(
            (e) =>
              String(e.at).toLowerCase() === pair.at &&
              String(e.platform).toLowerCase() === pair.platform,
          );
          if (!has)
            errors.push(
              `${file}: pattern coverage: at-support/${patternFile}.json has no entry for ${key} (${pair.at}/${pair.platform})`,
            );
          const rows = (contract?.a11y?.atSupport ?? []).filter(
            (/** @type {AtSupport} */ r) => r.at === pair.at && r.platform === pair.platform,
          );
          if (!rows.some((/** @type {AtSupport} */ r) => (r.evidence ?? []).length > 0))
            errors.push(
              `${file}: pattern coverage: /a11y/atSupport has no row with evidence for ${key} (${pair.at}/${pair.platform})`,
            );
        }
        const recommended = registryRecommended.get(`${patternFile}.json`);
        if (recommended) conflicts(file, contract, 'recommended', recommended.constraints, errors);
      }
    }
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
        if (entry && !conflictChecked.has(`${m[1]}#${m[2]}`)) {
          conflictChecked.add(`${m[1]}#${m[2]}`);
          conflicts(
            file,
            contract,
            `${m[1]}#${m[2]}`,
            /** @type {any} */ (entry).constraints,
            errors,
          );
        }
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
