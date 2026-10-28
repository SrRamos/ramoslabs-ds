// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- seeded-defect doubles are deliberately loose

import { readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveSpec } from '../derive/index.js';
import {
  assertReducerHarness,
  defaultKernel,
  l2Plan,
  replaySequences,
  runReducerHarness,
} from './index.js';
import { discoverReducers, loadContract } from './discover.js';
import * as good from './fixtures/toggle.reducer.js';
import * as bare from './fixtures/state.reducer.js';

const contract = JSON.parse(
  readFileSync(new URL('./fixtures/toggle.contract.json', import.meta.url), 'utf8'),
);
const spec = deriveSpec(contract);

/** @param {Partial<typeof good>} over */
const variant = (over) => ({ ...good, ...over });

describe('reducer harness on the fixture reducer (W1-308b)', () => {
  it('passes the correct reducer across many seeded runs', () => {
    for (const seed of [1, 2, 3, 0x5eed]) {
      const r = runReducerHarness(spec, good, { seed, numRuns: 200 });
      expect(r.problems).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });

  it('one spec feeds L1 and L2: the replayed sequences are the very arrays L2 gets', () => {
    expect(l2Plan(spec).sequences).toBe(spec.sequences);
    expect(spec.sequences.length).toBeGreaterThan(0);
    expect(replaySequences(spec, good)).toEqual([]);
    expect(l2Plan(spec).scenarios.map((s) => s.fixture)).toContain('disabled');
  });

  it('is deterministic for a seed', () => {
    const bad = variant({
      reduce: (s, e) => (e.type === 'reset' ? { state: { open: true } } : good.reduce(s, e)),
    });
    const a = runReducerHarness(spec, bad, { seed: 7 });
    const b = runReducerHarness(spec, bad, { seed: 7 });
    expect(a.ok).toBe(false);
    expect(b.counterexample).toEqual(a.counterexample);
  });
});

describe('a reducer that returns the bare state name (the codegen convention)', () => {
  it('runs through the real store and passes', () => {
    const r = runReducerHarness(spec, bare, { seed: 1, numRuns: 100 });
    expect(r.problems).toEqual([]);
    expect(replaySequences(spec, bare)).toEqual([]);
  });
  it('a seeded wrong target is still caught', () => {
    const bad = { ...bare, reduce: (s, e) => (e.type === 'reset' ? 'on' : bare.reduce(s, e)) };
    expect(runReducerHarness(spec, bad, { seed: 1 }).ok).toBe(false);
  });
});

describe('seeded reducer defects are caught', () => {
  const seeded = {
    'wrong target state': variant({
      reduce: (s, e) => (e.type === 'reset' ? { state: { open: true } } : good.reduce(s, e)),
    }),
    'state change on an unlisted pair (reset while off)': variant({
      reduce: (s, e) =>
        e.type === 'reset' && !s.open ? { state: { open: true } } : good.reduce(s, e),
    }),
    'unknown event changes state': variant({
      reduce: (s, e) =>
        e.type === '__sj_unknown_event__' ? { state: { open: !s.open } } : good.reduce(s, e),
    }),
    'unknown event emits effects': variant({
      reduce: (s, e) =>
        e.type === '__sj_unknown_event__'
          ? { state: s, effects: [{ type: 'focus', target: 'root' }] }
          : good.reduce(s, e),
    }),
    'no-op returns a fresh object': variant({
      reduce: (s, e) => (e.type === 'reset' && !s.open ? { state: { ...s } } : good.reduce(s, e)),
    }),
    'mutates its input': variant({
      reduce: (s, e) => {
        if (e.type === 'toggle') {
          s.open = !s.open;
          return { state: s };
        }
        return good.reduce(s, e);
      },
    }),
    'non-deterministic': (() => {
      let n = 0;
      return variant({
        reduce: (s, e) =>
          e.type === 'toggle' && ++n % 2 ? { state: { open: !s.open } } : good.reduce(s, e),
      });
    })(),
    'reducer event missing from reducerEvents': variant({ reducerEvents: ['toggle'] }),
    'extra reducer event': variant({ reducerEvents: ['toggle', 'reset', 'extra'] }),
    'no reducerEvents export': variant({ reducerEvents: undefined }),
  };
  for (const [name, mod] of Object.entries(seeded))
    it(name, () => {
      const r = runReducerHarness(spec, mod, { seed: 11 });
      expect(r.ok, name).toBe(false);
      expect(r.problems.length).toBeGreaterThan(0);
    });

  it('assertReducerHarness throws with a counterexample', () => {
    const bad = variant({
      reduce: (s, e) => (e.type === 'toggle' ? { state: s } : good.reduce(s, e)),
    });
    expect(() => assertReducerHarness(spec, bad, { seed: 3 })).toThrow(/counterexample|spec says/);
  });
});

describe('seeded kernel defects are caught (disabled/removed items, duplicates, stale effects, rejection)', () => {
  const run = (/** @type {any} */ over) =>
    runReducerHarness(spec, good, { seed: 5, numRuns: 300, kernel: { ...defaultKernel, ...over } });

  it('successor ignores disabled items', () => {
    const r = run({ successor: (_p, _n, removed) => removed });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/successor/);
  });

  it('collection: a stale unregister removes the newer duplicate registration', () => {
    const r = run({
      createCollection: (base, init) => {
        const c = defaultKernel.createCollection(base, init);
        const els = new Map();
        return {
          ...c,
          get items() {
            return c.items;
          },
          register: (key, el) => {
            const off = c.register(key, el);
            els.set(key, el);
            return () => {
              off();
              /** @type {any} */ (c).register(key, undefined); // clobbers whatever is there
            };
          },
        };
      },
    });
    expect(r.ok).toBe(false);
  });

  it('effect queue never drops stale effects', () => {
    const r = run({
      createEffectQueue: () => {
        let q = /** @type {any[]} */ ([]);
        return {
          enqueue: (fx, version) => void q.push(...fx.map((e) => ({ ...e, version }))),
          drain: (host, phase = 'layout') => {
            const mine = q.filter((e) => (e.type === 'announce') === (phase === 'passive'));
            q = q.filter((e) => !mine.includes(e));
            mine.forEach((e) => host.run(e));
            return mine.length;
          },
          clear: () => void (q = []),
          size: 0,
          draining: false,
        };
      },
    });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/drain/);
  });

  it('controlled request dispatches although the owner controls the value', () => {
    const r = run({
      createControlled: (config) => {
        const c = defaultKernel.createControlled(config);
        return {
          ...c,
          view: () => c.view(),
          request: (field, next) => {
            const props = config.getProps();
            /** @type {any} */ (config.store).dispatch(
              /** @type {any} */ (config.fields)[field].toEvent(next),
            );
            const cb = props.onOpenChange;
            if (typeof cb === 'function') cb(next);
            return true;
          },
        };
      },
    });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/controlled/);
  });
});

describe('auto-discovery of packages/core/src/<slug>/reducer.ts', () => {
  it('finds a reducer and pairs it with its contract', () => {
    const root = mkdtempSync(join(tmpdir(), 'sj-red-'));
    mkdirSync(join(root, 'packages/core/src/button'), { recursive: true });
    mkdirSync(join(root, 'packages/core/src/switch'), { recursive: true });
    mkdirSync(join(root, 'packages/contracts/contracts'), { recursive: true });
    writeFileSync(join(root, 'packages/core/src/button/reducer.ts'), 'export {}');
    writeFileSync(join(root, 'packages/core/src/switch/index.ts'), 'export {}');
    writeFileSync(join(root, 'packages/contracts/contracts/button.contract.json'), '{}');
    const found = discoverReducers(root);
    expect(found.map((f) => f.slug)).toEqual(['button']);
    expect(found[0].contractFile).toMatch(/button\.contract\.json$/);
  });
});

// Real component reducers: runs for every packages/core/src/<slug>/reducer.ts that exists (none in
// M3; M4 adds them). Absent -> one skipped test so the gap is visible.
describe('real component reducers', () => {
  const found = discoverReducers();
  if (!found.length)
    // #48 owner: SrRamos. No component reducer exists yet; the skip is the visible placeholder.
    it.skip('no component reducer yet (packages/core/src/<slug>/reducer.ts)', () => {});
  for (const f of found)
    it(`${f.slug}: reducer satisfies its derived spec`, async () => {
      expect(f.contractFile, `missing contract for ${f.slug}`).not.toBeNull();
      const mod = await import(/* @vite-ignore */ f.reducerFile);
      assertReducerHarness(deriveSpec(loadContract(/** @type {string} */ (f.contractFile))), mod);
    });
});
