// W1-110: the geometry fallback (core placement) and the independent reference evaluator receive
// identical rectangles and must agree on candidate, offset and visibility (ADR-005 step 2).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluatePlacement, parsePlacement } from '../placement';
import type { PlacementInput } from '../placement';
// @ts-expect-error TS7016: the oracle is plain JS with JSDoc types, outside core's tsconfig.
import { loadFixtures, referenceEvaluate } from '../../../../testing/parity-geometry/index.js';

type Policy = {
  area: string;
  fallbacks?: string;
  order?: string;
  visibility?: string;
  dir?: 'ltr' | 'rtl';
  tries?: Record<string, string>;
};
type Geometry = PlacementInput;
type Outcome = { index: number; x: number; y: number; visible: boolean };
const reference = referenceEvaluate as (p: Policy, g: Geometry) => Outcome;
const fixtures = loadFixtures(1) as {
  version: number;
  fixtures: {
    name: string;
    covers: string[];
    policy: Policy;
    geometry: Geometry;
    expect: Outcome;
  }[];
};

function fallback(p: Policy, g: Geometry): Outcome {
  const parsed = parsePlacement(p, { dir: p.dir, tries: p.tries });
  if (!parsed) throw new Error(`fallback rejected ${p.area}`);
  return evaluatePlacement(parsed, g);
}

describe('fixture set v1', () => {
  it('covers every dimension named by ADR-005 step 2', () => {
    const covered = new Set(
      fixtures.fixtures.flatMap((f) => f.covers.flatMap((c) => c.split(','))),
    );
    for (const need of [
      'flip-block',
      'flip-inline',
      'named @position-try',
      'most-height',
      'anchors-visible',
      'no-overflow',
    ]) {
      expect(covered, need).toContain(need);
    }
  });

  for (const f of fixtures.fixtures) {
    it(`${f.name}: fallback === reference === recorded`, () => {
      expect(reference(f.policy, f.geometry)).toEqual(f.expect);
      expect(fallback(f.policy, f.geometry)).toEqual(f.expect);
    });
  }
});

describe('randomized parity', () => {
  const area = fc.constantFrom(
    'top',
    'bottom',
    'left',
    'right',
    'top left',
    'bottom right',
    'top center',
    'center right',
    'center',
    'block-end inline-start',
  );
  const fallbacks = fc.constantFrom(
    undefined,
    'flip-block',
    'flip-inline',
    'flip-block flip-inline',
    'flip-block, flip-inline',
    '--t, bottom left',
    'top, flip-block flip-inline',
  );
  const rect = (lo: number, hi: number) =>
    fc.record({
      x: fc.integer({ min: -20, max: 300 }),
      y: fc.integer({ min: -20, max: 300 }),
      width: fc.integer({ min: lo, max: hi }),
      height: fc.integer({ min: lo, max: hi }),
    });
  it('agrees on every generated input', () => {
    fc.assert(
      fc.property(
        area,
        fallbacks,
        fc.constantFrom(
          'normal',
          'most-height',
          'most-width',
          'most-block-size',
          'most-inline-size',
        ),
        fc.constantFrom('always', 'anchors-visible', 'no-overflow', 'anchors-visible no-overflow'),
        fc.constantFrom<'ltr' | 'rtl'>('ltr', 'rtl'),
        rect(1, 120), // zero-size anchors are out of scope (no box to anchor to)
        rect(1, 250),
        rect(1, 400),
        (a, fb, order, visibility, dir, anchor, size, clip) => {
          const policy: Policy = {
            area: a,
            fallbacks: fb,
            order,
            visibility,
            dir,
            tries: { '--t': 'top center' },
          };
          const g: Geometry = {
            anchor,
            size: { width: size.width, height: size.height },
            bounds: { x: 0, y: 0, width: 400, height: 300 },
            clip,
          };
          expect(fallback(policy, g)).toEqual(reference(policy, g));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('a seeded divergence is detected by the oracle', () => {
    const f = fixtures.fixtures[3]!;
    const wrong = { ...f.policy, fallbacks: 'flip-inline' };
    expect(fallback(wrong, f.geometry)).not.toEqual(f.expect);
  });
});
