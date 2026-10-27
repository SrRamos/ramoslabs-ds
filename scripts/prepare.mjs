// Installs git hooks (lefthook) for local development only. Skipped in CI, when there is no
// git checkout, or when lefthook is not installed (for example a production install).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (process.env.CI || !existsSync('.git')) process.exit(0);
const result = spawnSync('lefthook', ['install'], { stdio: 'inherit', shell: false });
if (result.error) console.log('prepare: lefthook not available, hooks not installed.');
