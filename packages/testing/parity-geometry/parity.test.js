// @ts-check
import { describe, expect, it } from 'vitest';
import { fixtureCss, loadFixtures, referenceEvaluate } from './index.js';

describe('parity fixture set v1', () => {
  const set = loadFixtures(1);

  it('is versioned and every recorded outcome matches the reference evaluator', () => {
    expect(set.version).toBe(1);
    expect(set.fixtures.length).toBeGreaterThan(20);
    for (const f of set.fixtures)
      expect(referenceEvaluate(f.policy, f.geometry), f.name).toEqual(f.expect);
  });

  it('a seeded wrong expectation fails', () => {
    const f = set.fixtures[0];
    if (!f) throw new Error('empty fixture set');
    expect(referenceEvaluate(f.policy, f.geometry)).not.toEqual({ ...f.expect, x: f.expect.x + 1 });
  });

  it('rejects policies outside the compiled subset instead of inferring', () => {
    const g = /** @type {any} */ (set.fixtures[0]).geometry;
    expect(() => referenceEvaluate({ area: 'span-all' }, g)).toThrow();
    expect(() => referenceEvaluate({ area: 'top', fallbacks: 'flip-start' }, g)).toThrow();
  });

  it('emits the native CSS for the L6 lane', () => {
    const f = set.fixtures.find((x) => x.policy.tries);
    if (!f) throw new Error('no named-try fixture');
    expect(fixtureCss(f)).toContain('@position-try --above { position-area: top; }');
  });
});
