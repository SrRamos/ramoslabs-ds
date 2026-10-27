/* eslint-disable @typescript-eslint/ban-ts-comment -- test drives TypeScript runner modules and untyped JS spec tools */
// @ts-nocheck -- drives TypeScript runner modules and untyped JS spec tools.
// Unit tests for the pure parts of the L2 runner (W1-309a). The browser run is `bun run test:e2e`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveSpec } from '../../spec/derive/index.js';
import { l2Plan } from '../../spec/reducer/index.js';
import { triggerFor, variantsOf } from './executor.ts';
import config, { RESULTS_FILE } from './playwright.config.ts';

const contract = JSON.parse(
  readFileSync(new URL('../../probe/probe.contract.json', import.meta.url), 'utf8'),
);
const spec = deriveSpec(contract);
const plan = l2Plan(spec);

describe('playwright config', () => {
  it('uses retries: 0 and a manifest-safe results file by default', () => {
    expect(config.retries).toBe(0);
    expect(RESULTS_FILE).toBe('e2e-results.json');
  });
  it('runs chromium, firefox and webkit', () => {
    expect(config.projects.map((p) => p.name)).toEqual(['chromium', 'firefox', 'webkit']);
  });
});

describe('plan consumption', () => {
  it('hands the executor exactly the spec sequences (same arrays the L1 harness replays)', () => {
    expect(plan.sequences).toBe(spec.sequences);
  });
  it('variants are pointer plus every declared keyboard key, in stable order', () => {
    expect(variantsOf(plan)).toEqual(['pointer', 'Enter', 'Space']);
  });
  it('triggerFor honours the variant and falls back to the first declared trigger', () => {
    const step = plan.steps[0];
    expect(triggerFor(step, 'pointer')).toBe('pointer');
    expect(triggerFor(step, 'Space')).toMatchObject({ key: 'Space' });
    expect(triggerFor(step, 'F13')).toMatchObject({ kind: 'keyboard' });
  });
});
