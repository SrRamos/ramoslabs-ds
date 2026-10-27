// @ts-check
// L3 a11y gates (W1-310). The browser runs live in a11y.e2e.ts (`bun run --filter @ramoslabs/testing
// test:a11y`); this barrel exposes the pure verdicts and the collectors for other harness code.
export * from './verdicts.js';
export * as collectors from './collectors.js';
