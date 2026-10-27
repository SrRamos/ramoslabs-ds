// @ts-check
// @ramoslabs/testing/parity-geometry: placement parity oracle (W1-110, ADR-005 step 2).
// The versioned fixture set is `fixtures/v1.json`; `reference.js` is the independent evaluator.
import { readFileSync } from 'node:fs';
import { referenceEvaluate } from './reference.js';

export { referenceEvaluate };

/**
 * @typedef {import('./reference.js').Policy} Policy
 * @typedef {import('./reference.js').Geometry} Geometry
 * @typedef {import('./reference.js').Outcome} Outcome
 * @typedef {{ name: string, covers: string[], policy: Policy, geometry: Geometry, expect: Outcome }} Fixture
 * @typedef {{ version: number, fixtures: Fixture[] }} FixtureSet
 */

/** Load a fixture set by version. @param {number} [version] */
export function loadFixtures(version = 1) {
  const url = new URL(`./fixtures/v${version}.json`, import.meta.url);
  return /** @type {FixtureSet} */ (JSON.parse(readFileSync(url, 'utf8')));
}

/**
 * CSS for a fixture, for the L6 native lane (Chromium >= 125): the same policy the compiler emits.
 * Evaluate it in a real browser and compare with `expect` to certify reference against native.
 * @param {Fixture} f
 */
export function fixtureCss(f) {
  const p = f.policy;
  const tries = Object.entries(p.tries ?? {})
    .map(([n, a]) => `@position-try ${n} { position-area: ${a}; }`)
    .join('\n');
  return [
    tries,
    `.anchor { anchor-name: --a; }`,
    `.pop { position: fixed; position-anchor: --a; position-area: ${p.area};`,
    `  position-try-fallbacks: ${p.fallbacks ?? 'none'}; position-try-order: ${p.order ?? 'normal'};`,
    `  position-visibility: ${p.visibility ?? 'always'}; }`,
  ].join('\n');
}
