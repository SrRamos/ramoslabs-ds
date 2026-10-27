// @ts-check
// Auto-discovery: every packages/core/src/<slug>/reducer.ts is paired with
// packages/contracts/contracts/<slug>.contract.json and run through the harness, so M4 reducers
// are covered with no registration (convention from G-CODE-NOTES: export `reducerEvents`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
export const repoRoot = resolve(here, '..', '..', '..', '..');

/**
 * @param {string} [root] repo root override (tests point it at a temp tree)
 * @returns {{ slug: string, reducerFile: string, contractFile: string | null }[]}
 */
export function discoverReducers(root = repoRoot) {
  const src = join(root, 'packages', 'core', 'src');
  if (!existsSync(src)) return [];
  return readdirSync(src, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(src, d.name, 'reducer.ts')))
    .map((d) => {
      const contractFile = join(
        root,
        'packages',
        'contracts',
        'contracts',
        `${d.name}.contract.json`,
      );
      return {
        slug: d.name,
        reducerFile: join(src, d.name, 'reducer.ts'),
        contractFile: existsSync(contractFile) ? contractFile : null,
      };
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

/** @param {string} file */
export const loadContract = (file) => JSON.parse(readFileSync(file, 'utf8'));
