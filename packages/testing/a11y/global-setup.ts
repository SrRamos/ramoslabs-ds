// Warms the three engines against the host page before the first test (W1-314, see e2e/warmup.ts).
import { warmEngines } from '../e2e/warmup';

export default async function globalSetup(): Promise<void> {
  await warmEngines(`http://127.0.0.1:${Number(process.env['A11Y_PORT'] ?? 4180)}/a11y-host.html`);
}
