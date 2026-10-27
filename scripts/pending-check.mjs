// Placeholder for a gate that a later task implements. Loud, and never silently green:
// if the files the future check will verify already exist, it exits 1.
// Usage: node scripts/pending-check.mjs <name> <task> <dir> <suffix>
import { existsSync, readdirSync } from 'node:fs';

const [, , name = 'check', task = 'a later task', dir, suffix = ''] = process.argv;
const inputs =
  dir && existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(suffix)) : [];

if (inputs.length > 0) {
  console.error(
    `${name}: input exists (${dir}: ${inputs.join(', ')}) but the check is not implemented (${task}).`,
  );
  process.exit(1);
}
console.log(`${name}: not implemented yet (owned by ${task}); no inputs under ${dir ?? 'n/a'}.`);
