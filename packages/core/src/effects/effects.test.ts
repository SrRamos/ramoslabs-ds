import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createStore } from '../store';
import { EFFECT_ORDER, createEffectQueue, type Effect, type EffectInput } from './index';

const types = ['open', 'close', 'focus', 'geometry', 'announce', 'other'] as const;
const targets = ['a', 'b', 'c', undefined] as const;
const arbBatch = fc.array(
  fc.record({ type: fc.constantFrom(...types), target: fc.constantFrom(...targets) }),
  { maxLength: 25 },
);

/** Enqueue each descriptor as its own dispatch (version 1..n), as the store would. */
function load(batch: EffectInput[]) {
  const q = createEffectQueue();
  batch.forEach((e, i) => q.enqueue([e], i + 1));
  return q;
}

describe('effects (W1-104, ADR-003, ADR-013 L1)', () => {
  it('property: no stale effect runs; only the newest per type+target survives', () => {
    fc.assert(
      fc.property(arbBatch, (batch) => {
        const q = load(batch);
        const ran: Effect[] = [];
        q.drain({ run: (e) => ran.push(e) }, 'layout');
        q.drain({ run: (e) => ran.push(e) }, 'passive');
        const seen = new Set<string>();
        for (const e of ran) {
          const k = `${e.type}|${e.target}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
          const newest = batch.reduce(
            (v, b, i) => (b.type === e.type && b.target === e.target ? i + 1 : v),
            0,
          );
          expect(e.version).toBe(newest);
        }
        expect(seen.size).toBe(new Set(batch.map((b) => `${b.type}|${b.target}`)).size);
      }),
    );
  });

  it('property: effects for removed targets are dropped, targetless ones kept', () => {
    fc.assert(
      fc.property(arbBatch, fc.subarray(['a', 'b', 'c']), (batch, present) => {
        const q = load(batch);
        const ran: Effect[] = [];
        q.drain({ exists: (t) => present.includes(t), run: (e) => ran.push(e) });
        q.drain({ exists: (t) => present.includes(t), run: (e) => ran.push(e) }, 'passive');
        for (const e of ran)
          expect(e.target === undefined || present.includes(e.target)).toBe(true);
        const expected = new Set(
          batch
            .filter((b) => b.target === undefined || present.includes(b.target))
            .map((b) => `${b.type}|${b.target}`),
        );
        expect(new Set(ran.map((e) => `${e.type}|${e.target}`))).toEqual(expected);
      }),
    );
  });

  it('property: native open/close always run before any focus in the same drain', () => {
    fc.assert(
      fc.property(arbBatch, (batch) => {
        const ran: string[] = [];
        load(batch).drain({ run: (e) => ran.push(e.type) });
        const firstFocus = ran.indexOf('focus');
        if (firstFocus >= 0)
          expect(ran.slice(firstFocus).some((t) => t === 'open' || t === 'close')).toBe(false);
        const ranks = ran.map((t) => EFFECT_ORDER.indexOf(t));
        expect(ranks.filter((r) => r >= 0)).toEqual(
          [...ranks.filter((r) => r >= 0)].sort((a, b) => a - b),
        );
      }),
    );
  });

  it('property: every effect runs at most once; a second drain is empty', () => {
    fc.assert(
      fc.property(arbBatch, (batch) => {
        const q = load(batch);
        const n1 = q.drain({ run: () => {} });
        q.drain({ run: () => {} }, 'passive');
        expect(q.size).toBe(0);
        expect(q.drain({ run: () => {} })).toBe(0);
        expect(n1).toBeLessThanOrEqual(batch.length);
      }),
    );
  });

  it('open precedes focus even when focus was emitted first', () => {
    const q = createEffectQueue();
    q.enqueue(
      [
        { type: 'focus', target: 'item' },
        { type: 'open', target: 'panel' },
      ],
      1,
    );
    const ran: string[] = [];
    q.drain({ run: (e) => ran.push(e.type) });
    expect(ran).toEqual(['open', 'focus']);
  });

  it('announcements drain only in the passive phase', () => {
    const q = createEffectQueue();
    q.enqueue([{ type: 'announce' }, { type: 'focus', target: 'a' }], 1);
    const ran: string[] = [];
    q.drain({ run: (e) => ran.push(e.type) }, 'layout');
    expect(ran).toEqual(['focus']);
    expect(q.size).toBe(1);
    q.drain({ run: (e) => ran.push(e.type) }, 'passive');
    expect(ran).toEqual(['focus', 'announce']);
  });

  it('no synchronous re-dispatch: effects enqueued while draining wait for the next drain', () => {
    const q = createEffectQueue();
    q.enqueue([{ type: 'open', target: 'a' }], 1);
    const ran: string[] = [];
    let nested = -1;
    q.drain({
      run(e) {
        ran.push(e.type);
        q.enqueue([{ type: 'focus', target: 'a' }], 2);
        expect(q.draining).toBe(true);
        nested = q.drain({ run: () => ran.push('nested') });
      },
    });
    expect(nested).toBe(0);
    expect(ran).toEqual(['open']);
    expect(q.size).toBe(1);
    q.drain({ run: (e) => ran.push(e.type) });
    expect(ran).toEqual(['open', 'focus']);
  });

  it('a throwing host does not wedge the queue', () => {
    const q = createEffectQueue();
    q.enqueue([{ type: 'open', target: 'a' }], 1);
    expect(() =>
      q.drain({
        run: () => {
          throw new Error('boom');
        },
      }),
    ).toThrow('boom');
    expect(q.draining).toBe(false);
  });

  it('wires to the store: reducer descriptors are stamped with the dispatch version', () => {
    const q = createEffectQueue();
    const store = createStore<number, 'go', EffectInput>(
      0,
      (s) => ({ state: s + 1, effects: [{ type: 'focus', target: 'x' }] }),
      (fx, v) => q.enqueue(fx, v),
    );
    store.dispatch('go');
    store.dispatch('go');
    const ran: Effect[] = [];
    q.drain({ run: (e) => ran.push(e) });
    expect(ran).toEqual([{ type: 'focus', target: 'x', version: 2 }]);
  });

  it('clear drops everything and instances are isolated', () => {
    const a = createEffectQueue();
    const b = createEffectQueue();
    a.enqueue([{ type: 'open' }], 1);
    expect(b.size).toBe(0);
    a.clear();
    expect(a.size).toBe(0);
  });
});
