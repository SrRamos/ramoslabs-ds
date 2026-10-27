// @ts-check
// `bun run evidence:check`: exit 1 on a dangling or stale evidence ref. The remaining W1-317
// checks are listed loudly as pending; they are not silently skipped.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEvidence, PENDING } from './index.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { errors, checkedRefs, contracts } = checkEvidence({
  contractsDir: join(repo, 'packages', 'contracts', 'contracts'),
  registryDir: join(repo, 'docs', 'architecture', 'evidence', 'at-support'),
});

for (const p of PENDING) console.warn(`evidence:check: PENDING (not enforced) - ${p}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`evidence:check: ${e}`);
  console.error(`evidence:check: ${errors.length} problem(s).`);
  process.exit(1);
}
console.log(
  `evidence:check: ${checkedRefs} ref(s) in ${contracts} contract(s) resolve and are fresh; ${PENDING.length} W1-317 check(s) still pending.`,
);
