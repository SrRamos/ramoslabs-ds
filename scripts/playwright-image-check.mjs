// Fails when a workflow's Playwright container tag differs from the exact @playwright/test pin in
// packages/testing/package.json (#99). The image ships browsers matched to one Playwright version;
// a mismatch makes Playwright look for browser builds that are not there.
// Usage: node scripts/playwright-image-check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'packages/testing/package.json'), 'utf8'));
const pinned = pkg.devDependencies?.['@playwright/test'] ?? pkg.dependencies?.['@playwright/test'];
const errors = [];
if (!/^\d+\.\d+\.\d+$/.test(pinned ?? ''))
  errors.push(`@playwright/test must be an exact version, got ${pinned}`);

const dir = join(root, '.github/workflows');
let found = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.yml'))) {
  const text = readFileSync(join(dir, f), 'utf8');
  for (const m of text.matchAll(/mcr\.microsoft\.com\/playwright:v([\w.-]+?)-noble/g)) {
    found++;
    if (m[1] !== pinned) errors.push(`${f}: image v${m[1]} != @playwright/test ${pinned}`);
  }
  if (text.includes('.github/actions/browsers') && !text.includes('mcr.microsoft.com/playwright:'))
    errors.push(`${f}: uses the browsers action without the Playwright container`);
}
if (found === 0) errors.push('no Playwright container image found in any workflow');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`playwright-image-check: ${found} image reference(s) match @playwright/test ${pinned}`);
