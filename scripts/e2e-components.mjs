// Which component conformance jobs a pull request needs (G3A R2-NICE-1). Used by the `changes` job
// of .github/workflows/e2e.yml. A changed file narrows the run to one component only when it lives
// in that component's own locations; every other changed file that feeds the browser suites runs
// every component. Matching by path segment or basename is deliberately NOT done: slugs such as
// `state`, `form` or `field` are common file names in shared code.
// Usage: git diff --name-only ... | node scripts/e2e-components.mjs <slug>...   (prints JSON)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BROWSER_RELEVANT =
  /^(packages\/|apps\/storybook\/|\.github\/|package\.json|bun\.lock|turbo\.json|tsconfig)/;

/** @param {string} s */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The slug a file is owned by, or null for any shared file.
 * @param {string} file
 * @param {string[]} slugs
 * @returns {string | null}
 */
export function ownerOf(file, slugs) {
  for (const slug of slugs) {
    const s = escape(slug);
    const owned = [
      new RegExp(`^packages/[^/]+/src/${s}/`),
      new RegExp(`^packages/[^/]+/src/generated/${s}/`),
      new RegExp(`^packages/css/src/${s}\\.css$`),
      new RegExp(`^packages/contracts/contracts/${s}\\.contract\\.json$`),
      new RegExp(`^packages/testing/specs/${s}/`),
    ];
    if (owned.some((re) => re.test(file))) return slug;
  }
  return null;
}

/**
 * @param {string[]} files
 * @param {string[]} slugs
 * @returns {{ browser: boolean, components: string[] }}
 */
export function affected(files, slugs) {
  const relevant = files.filter((f) => BROWSER_RELEVANT.test(f));
  if (relevant.length === 0) return { browser: false, components: [] };
  const owners = relevant.map((f) => ownerOf(f, slugs));
  if (owners.includes(null)) return { browser: true, components: [...slugs] };
  return { browser: true, components: slugs.filter((s) => owners.includes(s)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = readFileSync(0, 'utf8').split('\n').filter(Boolean);
  console.log(JSON.stringify(affected(files, process.argv.slice(2))));
}
