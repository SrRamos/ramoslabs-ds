// Contract validator (W1-301). Library plus CLI.
// CLI: node scripts/validate.mjs [file...]   (default: every contracts/*.contract.json)
// `kinds.contract.json` is validated against kinds.schema.json, every other contract against
// contract.schema.json. Exit 1 on any error; each error is printed with its JSON path.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const contractSchema = readJson(join(root, 'schema', 'contract.schema.json'));
const kindsSchemaPath = join(root, 'schema', 'kinds.schema.json');
const validateContractSchema = ajv.compile(contractSchema);
const validateKindsSchema = existsSync(kindsSchemaPath)
  ? ajv.compile(readJson(kindsSchemaPath))
  : null;

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

// Rules JSON Schema cannot express: uniqueness by key, references between sections, real dates.
function semanticErrors(c, today) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  const dupes = (items, key, base, label) => {
    const seen = new Set();
    items.forEach((item, i) => {
      if (seen.has(item[key])) add(`${base}/${i}/${key}`, `duplicate ${label} "${item[key]}"`);
      seen.add(item[key]);
    });
  };
  const parts = new Set(c.anatomy.map((a) => a.part));
  const states = new Set(c.state.machine);
  dupes(c.anatomy, 'part', '/anatomy', 'anatomy part');
  const rows = new Set();
  c.actions.forEach((a, i) => {
    const key = `${a.id}\u0000${a.from}`;
    if (rows.has(key)) add(`/actions/${i}/id`, `duplicate transition "${a.id}" from "${a.from}"`);
    rows.add(key);
  });
  dupes(c.events, 'name', '/events', 'event name');
  dupes(c.props, 'name', '/props', 'prop name');
  dupes(c.slots, 'name', '/slots', 'slot name');
  c.actions.forEach((a, i) => {
    for (const k of ['from', 'to'])
      if (!states.has(a[k])) add(`/actions/${i}/${k}`, `"${a[k]}" is not in state.machine`);
    for (const map of ['aria', 'dom'])
      for (const part of Object.keys(a[map] ?? {}))
        if (!parts.has(part)) add(`/actions/${i}/${map}/${part}`, `unknown anatomy part "${part}"`);
  });
  for (const part of Object.keys(c.keyboard))
    if (!parts.has(part)) add(`/keyboard/${part}`, `unknown anatomy part "${part}"`);
  if (c.focus.owner && !parts.has(c.focus.owner))
    add('/focus/owner', `unknown anatomy part "${c.focus.owner}"`);
  c.a11y.atSupport.forEach((s, i) => {
    const base = `/a11y/atSupport/${i}`;
    const same = c.a11y.atSupport.findIndex(
      (o) => o.at === s.at && o.platform === s.platform && o.browser === s.browser,
    );
    if (same !== i) add(base, `duplicate AT pairing ${s.at}/${s.platform}/${s.browser}`);
    if (s.tested_on !== undefined) {
      if (!realDate(s.tested_on)) add(`${base}/tested_on`, `"${s.tested_on}" is not a real date`);
      else if (s.tested_on > today) add(`${base}/tested_on`, `"${s.tested_on}" is in the future`);
    }
  });
  return errors;
}

export function validateContract(data, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!validateContractSchema(data))
    return { valid: false, errors: schemaErrors(validateContractSchema) };
  const errors = semanticErrors(data, today);
  return { valid: errors.length === 0, errors };
}

export function validateKinds(data) {
  if (!validateKindsSchema)
    return { valid: false, errors: [{ path: '/', message: 'kinds.schema.json missing' }] };
  if (!validateKindsSchema(data))
    return { valid: false, errors: schemaErrors(validateKindsSchema) };
  const errors = [];
  const seen = new Set();
  data.kinds.forEach((k, i) => {
    if (seen.has(k.kind))
      errors.push({ path: `/kinds/${i}/kind`, message: `duplicate kind "${k.kind}"` });
    seen.add(k.kind);
  });
  return { valid: errors.length === 0, errors };
}

export function validateFile(file) {
  let data;
  try {
    data = readJson(file);
  } catch (err) {
    return { valid: false, errors: [{ path: '/', message: `unreadable JSON: ${err.message}` }] };
  }
  return basename(file) === 'kinds.contract.json' ? validateKinds(data) : validateContract(data);
}

export function contractFiles(dir = join(root, 'contracts')) {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.contract.json'))
        .sort()
        .map((f) => join(dir, f))
    : [];
}

function main(argv) {
  const files = argv.length > 0 ? argv.map((f) => resolve(f)) : contractFiles();
  let failed = 0;
  for (const file of files) {
    const { valid, errors } = validateFile(file);
    if (valid) continue;
    failed += 1;
    for (const e of errors)
      console.error(`${relative(process.cwd(), file)}: ${e.path}: ${e.message}`);
  }
  if (failed > 0) {
    console.error(`contracts:check: ${failed} of ${files.length} contract file(s) invalid.`);
    process.exit(1);
  }
  console.log(`contracts:check: ${files.length} contract file(s) valid.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
