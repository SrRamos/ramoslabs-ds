// Warms the engines against the host page, then writes the declaration of what the parity matrix must
// contain (W1-313 input), derived from the contract and never from results.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { warmEngines } from '../../e2e/warmup';
import { switchExpected } from './matrix';

const here = dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  const dir = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'switch-expected.json'),
    JSON.stringify(switchExpected(), null, 2) + '\n',
  );
  await warmEngines(`http://127.0.0.1:${Number(process.env['SWITCH_PORT'] ?? 4193)}/host.html`);
}
