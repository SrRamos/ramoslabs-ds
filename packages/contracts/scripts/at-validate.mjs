// AT evidence registry validator (W1-315). Library plus CLI.
// CLI: node scripts/at-validate.mjs [file...]   (default: the registry docs/architecture/evidence/at-support/*.json)
// Schema: schema/at-support.schema.json. Rules JSON Schema cannot express live in `semanticErrors`
// (ADR-015 "Rules of evidence" and "Staleness"). Exit 1 on any error, each printed with its JSON path.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTRY_DIR = join(
  root,
  '..',
  '..',
  'docs',
  'architecture',
  'evidence',
  'at-support',
);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const validateSchema = ajv.compile(readJson(join(root, 'schema', 'at-support.schema.json')));

/** The five primary pairs of ADR-013 4b: atEvidence key -> registry (at, platform). */
export const PRIMARY_PAIRS = {
  nvda: { at: 'nvda', platform: 'windows' },
  jaws: { at: 'jaws', platform: 'windows' },
  'voiceover-macos': { at: 'voiceover', platform: 'macos' },
  'voiceover-ios': { at: 'voiceover', platform: 'ios' },
  talkback: { at: 'talkback', platform: 'android' },
};

function schemaErrors(validate) {
  return (validate.errors ?? []).map((e) => {
    let path = e.instancePath || '/';
    if (e.keyword === 'required') path = `${e.instancePath}/${e.params.missingProperty}`;
    if (e.keyword === 'additionalProperties')
      path = `${e.instancePath}/${e.params.additionalProperty}`;
    return { path, message: `${e.keyword}: ${e.message}` };
  });
}

function realDate(value) {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** `retrieved` plus six calendar months, clamped to the month end (2026-08-31 -> 2027-02-28). */
export function plusSixMonths(date) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + 6, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Registrable-ish host: the last two labels, so docs.a11ysupport.io and a11ysupport.io are one organization. */
function org(url) {
  try {
    return new URL(url).hostname.split('.').slice(-2).join('.');
  } catch {
    return url;
  }
}

function semanticErrors(data, fileName) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const byId = new Map();

  if (fileName && data.pattern && `${data.pattern}.json` !== fileName)
    add('/pattern', `pattern "${data.pattern}" does not match file name ${fileName}`);

  entries.forEach((e, i) => {
    if (e?.id === undefined) return;
    if (byId.has(e.id)) add(`/entries/${i}/id`, `duplicate id "${e.id}"`);
    else byId.set(e.id, e);
  });

  entries.forEach((e, i) => {
    const base = `/entries/${i}`;
    if (!e || typeof e !== 'object') return;
    if (data.pattern && e.pattern !== undefined && e.pattern !== data.pattern)
      add(
        `${base}/pattern`,
        `entry pattern "${e.pattern}" does not match file pattern "${data.pattern}"`,
      );
    for (const key of ['retrieved', 'next_review', 'tested_on']) {
      if (typeof e[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e[key]) && !realDate(e[key]))
        add(`${base}/${key}`, `"${e[key]}" is not a real calendar date`);
    }
    if (
      typeof e.retrieved === 'string' &&
      typeof e.next_review === 'string' &&
      realDate(e.retrieved) &&
      realDate(e.next_review)
    ) {
      if (e.next_review < e.retrieved)
        add(
          `${base}/next_review`,
          `next_review ${e.next_review} is before retrieved ${e.retrieved}`,
        );
      const max = plusSixMonths(e.retrieved);
      if (e.next_review > max)
        add(
          `${base}/next_review`,
          `next_review ${e.next_review} is more than 6 months after retrieved ${e.retrieved} (max ${max})`,
        );
    }
  });

  const rec = data.recommended;
  if (!rec || typeof rec !== 'object') return errors;

  // The unit of the rule is the recommended variant (ADR-015): >= 1 T1, or >= 2 independent T2.
  if (Array.isArray(rec.supportedBy)) {
    const sources = [];
    rec.supportedBy.forEach((id, i) => {
      const e = byId.get(id);
      if (!e) add(`/recommended/supportedBy/${i}`, `no entry "${id}" in this file`);
      else sources.push(e);
    });
    const t1 = sources.filter((e) => e.source_tier === 'T1').length;
    const t2orgs = new Set(
      sources.filter((e) => e.source_tier === 'T2').map((e) => org(e.source_url)),
    );
    if (sources.length === rec.supportedBy.length && t1 < 1 && t2orgs.size < 2)
      add(
        '/recommended/supportedBy',
        'variant needs at least one T1 source or two independent T2 sources (T3 never decides)',
      );
  }

  // Per-AT claims: observation(s) or the explicit no-measured-evidence; T3 alone never decides.
  if (rec.atEvidence && typeof rec.atEvidence === 'object') {
    for (const [key, value] of Object.entries(rec.atEvidence)) {
      const pair = PRIMARY_PAIRS[key];
      if (!pair) continue;
      if (value === 'no-measured-evidence') {
        const stray = data.entries.find(
          (e) =>
            e &&
            e.kind === 'observation' &&
            String(e.at).toLowerCase() === pair.at &&
            String(e.platform).toLowerCase() === pair.platform,
        );
        if (stray)
          add(
            `/recommended/atEvidence/${key}`,
            `declared no-measured-evidence but observation "${stray.id}" exists for ${stray.at}/${stray.platform}; reference it or remove it`,
          );
        continue;
      }
      if (!Array.isArray(value)) continue;
      const found = [];
      value.forEach((id, i) => {
        const e = byId.get(id);
        const p = `/recommended/atEvidence/${key}/${i}`;
        if (!e) return add(p, `no entry "${id}" in this file`);
        found.push(e);
        if (e.kind !== 'observation')
          add(
            p,
            `"${id}" is a ${e.kind} entry; a per-AT claim needs an observation or no-measured-evidence`,
          );
        if (
          String(e.at).toLowerCase() !== pair.at ||
          String(e.platform).toLowerCase() !== pair.platform
        )
          add(p, `"${id}" is ${e.at}/${e.platform}, not ${pair.at}/${pair.platform}`);
      });
      if (found.length > 0 && found.every((e) => e.source_tier === 'T3'))
        add(
          `/recommended/atEvidence/${key}`,
          'T3 evidence alone never decides; add a T1/T2 observation or use no-measured-evidence',
        );
    }
  }
  return errors;
}

/** @returns {{path: string, message: string}[]} */
export function validateAtSupport(data, { fileName } = {}) {
  if (!validateSchema(data)) return schemaErrors(validateSchema);
  return semanticErrors(data, fileName);
}

export function registryFiles(dir = REGISTRY_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

export function validateAtFile(file) {
  let data;
  try {
    data = readJson(file);
  } catch (e) {
    return [{ path: '/', message: `not valid JSON: ${e.message}` }];
  }
  return validateAtSupport(data, { fileName: basename(file) });
}

function main(argv) {
  const files = argv.length > 0 ? argv.map((f) => resolve(f)) : registryFiles();
  let failed = 0;
  for (const file of files) {
    for (const e of validateAtFile(file)) {
      failed += 1;
      console.error(`${relative(process.cwd(), file)}: ${e.path}: ${e.message}`);
    }
  }
  if (failed > 0) {
    console.error(`at-validate: ${failed} problem(s) in ${files.length} file(s).`);
    process.exit(1);
  }
  console.log(`at-validate: ${files.length} registry file(s) valid.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
