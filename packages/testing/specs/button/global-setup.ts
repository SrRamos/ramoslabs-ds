// Warms the engines against the host page and writes the declaration of what the parity matrix must
// contain (W1-313 input), derived from the contract, never from results.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { warmEngines } from '../../e2e/warmup';
import { buttonExpected } from './matrix';

const here = dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  await warmEngines(`http://127.0.0.1:${Number(process.env['E2E_BUTTON_PORT'] ?? 4181)}/host.html`);
  const dir = join(here, '..', '..', 'node_modules', '.cache', 'e2e');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'e2e-button-expected.json'),
    JSON.stringify(buttonExpected(), null, 2) + '\n',
  );
}
