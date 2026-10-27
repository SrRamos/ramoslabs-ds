// Component CSS generator (W1-205).
//
//   bun run new -- select --parts root,trigger,content,item
//   bun run new -- select                  (parts read from the contract's anatomy[].part)
//
// Writes src/<name>.css from component.css.tpl. Names follow ADR-009: class `sj-<name>__<part>`,
// hook `data-part`, state `data-state|data-active|data-disabled|data-invalid`.
//
// Contract name check (ADR-002, ADR-009): packages/contracts/contracts/<name>.contract.json must exist and
// the parts must equal its anatomy[].part. A missing contract is an error. `checkStylesheets` runs the
// same check over every src/*.css and is part of the test suite, so drift fails CI.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** `SJSelect` / `SJDatePicker` / `select` -> `select` / `date-picker`. */
export function toSlug(input) {
  const bare = input.replace(/^SJ(?=[A-Z])/, '');
  return bare.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Renders the template. */
export function render(template, { name, parts }) {
  const rootPart = parts.includes('root') ? 'root' : parts[0];
  const loop = /\{\{#parts\}\}\n?([\s\S]*?)\{\{\/parts\}\}\n?/g;
  const body = template.replace(loop, (_, block) =>
    parts.map((part) => block.replaceAll('{{part}}', part)).join(''),
  );
  return body.replaceAll('{{name}}', name).replaceAll('{{rootPart}}', rootPart);
}

/** Reads the part names a contract declares, or null when no contract exists. */
export function contractParts(name, contractsDir) {
  const file = join(contractsDir, `${name}.contract.json`);
  if (!existsSync(file)) return null;
  const contract = JSON.parse(readFileSync(file, 'utf8'));
  return (contract.anatomy ?? []).map((a) => a.part);
}

/** Compares CSS part names with the contract. Returns a list of problems (empty when they match). */
export function checkAnatomy(parts, contract) {
  const problems = [];
  for (const p of parts)
    if (!contract.includes(p)) problems.push(`part "${p}" is not in the contract anatomy`);
  for (const p of contract)
    if (!parts.includes(p)) problems.push(`contract part "${p}" has no CSS rule`);
  return problems;
}

/** Part names (the `<part>` of `.sj-<name>__<part>`) a stylesheet uses. */
export function cssParts(name, css) {
  const re = new RegExp(`\\.sj-${name}__([a-z0-9]+(?:-[a-z0-9]+)*)`, 'g');
  return [...new Set([...css.matchAll(re)].map((m) => m[1]))];
}

/** Checks every component stylesheet in `srcDir` against its contract. Returns problems (empty when clean). */
export function checkStylesheets(srcDir, contractsDir) {
  const problems = [];
  for (const f of readdirSync(srcDir)) {
    if (!f.endsWith('.css') || f.startsWith('_')) continue;
    const name = f.slice(0, -4);
    const contract = contractParts(name, contractsDir);
    if (!contract) {
      problems.push(`${f}: no contract ${name}.contract.json`);
      continue;
    }
    for (const p of checkAnatomy(cssParts(name, readFileSync(join(srcDir, f), 'utf8')), contract)) {
      problems.push(`${f}: ${p}`);
    }
  }
  return problems;
}

/**
 * @returns {{ file: string, content: string, warnings: string[] }}
 */
export function generate({ component, parts, srcDir, contractsDir, force = false }) {
  const name = toSlug(component);
  if (!NAME.test(name))
    throw new Error(`Invalid component name "${component}" (use kebab-case, e.g. date-picker).`);
  const fromContract = contractParts(name, contractsDir);
  const warnings = [];
  if (!fromContract) {
    throw new Error(
      `No contract at ${contractsDir}/${name}.contract.json. Create the contract (anatomy[].part) first.`,
    );
  }
  const list = parts?.length ? parts : fromContract;
  for (const p of list)
    if (!NAME.test(p)) throw new Error(`Invalid part name "${p}" (use kebab-case).`);
  if (new Set(list).size !== list.length) throw new Error('Duplicate part names.');
  const problems = checkAnatomy(list, fromContract);
  if (problems.length)
    throw new Error(`Parts do not match the ${name} contract:\n  - ${problems.join('\n  - ')}`);
  const file = join(srcDir, `${name}.css`);
  if (existsSync(file) && !force) throw new Error(`${file} exists. Pass --force to overwrite.`);
  const content = render(readFileSync(join(here, 'component.css.tpl'), 'utf8'), {
    name,
    parts: list,
  });
  writeFileSync(file, content);
  return { file, content, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const flag = (n) => {
    const i = args.indexOf(n);
    return i === -1 ? undefined : args[i + 1];
  };
  const component = args.find(
    (a, i) =>
      !a.startsWith('--') &&
      (i === 0 || !args[i - 1].startsWith('--') || args[i - 1] === '--force'),
  );
  if (!component) {
    console.error('Usage: bun run new -- <component> [--parts a,b,c] [--force]');
    process.exit(2);
  }
  try {
    const root = join(here, '..', '..');
    const { file, warnings } = generate({
      component,
      parts: flag('--parts')
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      srcDir: join(root, 'src'),
      contractsDir: join(root, '..', 'contracts', 'contracts'),
      force: args.includes('--force'),
    });
    for (const w of warnings) console.warn(`warning: ${w}`);
    console.log(`wrote ${file}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
