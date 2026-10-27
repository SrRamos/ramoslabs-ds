// @ts-check
// `node packages/testing/lint/contract/cli.js [--require-denylist]`
// Runs the contract-data lint over packages/contracts/contracts and the hashed deny-list scan.
// Exits 1 on any finding. The scan reports "not configured" (exit 0) when no digests are
// supplied; pass --require-denylist (CI, once the digests are provisioned) to make that fail.
import { lintContracts, scanTree } from './index.js';

const require = process.argv.includes('--require-denylist');
let failed = false;

const contractFindings = lintContracts();
for (const f of contractFindings) console.error(`${f.file}: ${f.rule}: ${f.message}`);
if (contractFindings.length) failed = true;
else console.log('contract lint: ok');

const scan = scanTree();
if (!scan.configured) {
  console.log(
    `denylist: not configured (0 digests); set RAMOSLABS_DENYLIST_SHA256 or RAMOSLABS_DENYLIST_FILE${require ? '' : ' (skipped)'}`,
  );
  if (require) failed = true;
} else if (scan.findings.length) {
  for (const f of scan.findings) {
    console.error(`${f.file}:${f.line}:${f.col}: denylist match (digest ${f.digest}...)`);
  }
  failed = true;
} else {
  console.log(`denylist: ok (${scan.terms} digests)`);
}
process.exit(failed ? 1 : 0);
