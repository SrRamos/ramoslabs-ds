// Warms the three engines before the first test (W1-314, see e2e/warmup.ts). No page: these tests
// use setContent.
import { warmEngines } from '../e2e/warmup';

export default async function globalSetup(): Promise<void> {
  await warmEngines();
}
