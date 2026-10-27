// @ts-check
// `bun run evidence:check`: exit 1 on an invalid registry file, a dangling or stale ref, a
// decision conflict, or a pattern coverage gap (W1-315, W1-317).
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
  `evidence:check: registry valid; ${checkedRefs} ref(s) in ${contracts} contract(s) resolve, are fresh, agree with focus/listboxMount and cover every primary pair.`,
);
