import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const files = ['contracts', 'schema'].flatMap((d) => walk(join(root, d)));

for (const file of files) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${relative(root, file)}: ${err.message}`);
    process.exit(1);
  }
}

console.log(`contracts: ${files.length} json files ok`);
