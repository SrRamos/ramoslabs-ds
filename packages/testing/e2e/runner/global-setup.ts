// Warms the three engines against the host page before the first test (W1-314, see ../warmup.ts).
import { warmEngines } from '../warmup';

export default async function globalSetup(): Promise<void> {
  await warmEngines(`http://127.0.0.1:${Number(process.env['E2E_PORT'] ?? 4179)}/host.html`);
}
