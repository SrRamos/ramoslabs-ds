// Writes the declaration of what the matrix must contain (W1-313 input), derived from the contract,
// never from results. Runs once before the tests.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeExpected } from './probe-matrix';
import runnerWarmup from '../runner/global-setup';

const here = dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  await runnerWarmup();
  const dir = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'e2e-supports-expected.json'),
    JSON.stringify(probeExpected(), null, 2) + '\n',
  );
}
