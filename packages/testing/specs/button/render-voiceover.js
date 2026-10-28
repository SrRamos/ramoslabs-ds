// @ts-check
// `bun run voiceover:button`: prints the generated VoiceOver protocol for SJButton (W1-505 hook).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderVoiceOverScript } from './voiceover.js';

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', 'contracts', 'contracts', 'button.contract.json'),
    'utf8',
  ),
);
process.stdout.write(renderVoiceOverScript(contract).markdown);
