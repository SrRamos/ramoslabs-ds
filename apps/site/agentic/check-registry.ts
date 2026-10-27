// Registry drift check (W1-305, ADR-010): the built registry.json must equal a fresh generation
// from the sources (tokens dist, pages, contracts). Run after the site build:
//   bun apps/site/agentic/check-registry.ts
// Exits 1 on drift, naming the top-level keys that differ. W1-314 wires this into CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRegistry } from './integration';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const site = process.env.SITE_URL ?? 'https://design.ramoslabs.com';
const fresh = JSON.parse(generateRegistry(site)) as Record<string, unknown>;

let failed = false;
for (const rel of ['apps/site/dist/registry.json', 'registry.json']) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`registry drift: ${rel} is missing; build the site first`);
    failed = true;
    continue;
  }
  const built = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const keys = new Set([...Object.keys(built), ...Object.keys(fresh)]);
  const differing = [...keys].filter((k) => JSON.stringify(built[k]) !== JSON.stringify(fresh[k]));
  if (differing.length) {
    console.error(`registry drift: ${rel} differs from the contracts in: ${differing.join(', ')}`);
    failed = true;
  } else {
    console.log(`registry: ${rel} matches a fresh generation`);
  }
}
process.exit(failed ? 1 : 0);
