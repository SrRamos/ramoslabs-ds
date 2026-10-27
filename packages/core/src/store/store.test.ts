import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { createStore, type Reduction } from './index';

type Ev = { t: 'inc'; by: number } | { t: 'noop' } | { t: 'fx' };
const reduce = (s: { n: number }, e: Ev): Reduction<{ n: number }, string> => {
  if (e.t === 'inc') return { state: e.by === 0 ? s : { n: s.n + e.by } };
  if (e.t === 'fx') return { state: s, effects: ['x'] };
  return { state: s };
};
const make = () => createStore({ n: 0 }, reduce);

describe('snapshot store (W1-101, ADR-003)', () => {
  it('getSnapshot is stable until a dispatch changes state', () => {
    const s = make();
    const a = s.getSnapshot();
    expect(s.getSnapshot()).toBe(a);
    expect(s.dispatch({ t: 'noop' })).toBe(a);
    expect(s.dispatch({ t: 'inc', by: 0 })).toBe(a);
    const b = s.dispatch({ t: 'inc', by: 1 });
    expect(b).not.toBe(a);
    expect(s.getSnapshot()).toBe(b);
  });

  it('no-op dispatch never notifies; changing dispatch notifies once', () => {
    const s = make();
    const l = vi.fn();
    s.subscribe(l);
    s.dispatch({ t: 'noop' });
    expect(l).not.toHaveBeenCalled();
    s.dispatch({ t: 'inc', by: 2 });
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('dedupes subscribe and unsubscribe is idempotent', () => {
    const s = make();
    const l = vi.fn();
    const off = s.subscribe(l);
    s.subscribe(l);
    s.dispatch({ t: 'inc', by: 1 });
    expect(l).toHaveBeenCalledTimes(1);
    off();
    off();
    s.dispatch({ t: 'inc', by: 1 });
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('destroy is idempotent, drops listeners and freezes the store', () => {
    const s = make();
    const l = vi.fn();
    s.subscribe(l);
    s.destroy();
    s.destroy();
    const snap = s.getSnapshot();
    expect(s.dispatch({ t: 'inc', by: 1 })).toBe(snap);
    s.subscribe(l)();
    expect(l).not.toHaveBeenCalled();
  });

  it('server snapshot is the initial state, stable after dispatches', () => {
    const s = make();
    const first = s.getServerSnapshot();
    s.dispatch({ t: 'inc', by: 5 });
    expect(s.getServerSnapshot()).toBe(first);
    expect(first).toEqual({ n: 0 });
  });

  it('listeners removed during a notification are not called', () => {
    const s = make();
    const calls: string[] = [];
    let offB = () => {};
    s.subscribe(() => {
      calls.push('a');
      offB();
    });
    offB = s.subscribe(() => calls.push('b'));
    s.dispatch({ t: 'inc', by: 1 });
    expect(calls).toEqual(['a']);
  });

  it('reports effects with a growing version, including when state is unchanged', () => {
    const seen: [readonly string[], number][] = [];
    const s = createStore({ n: 0 }, reduce, (fx, v) => seen.push([fx, v]));
    const l = vi.fn();
    s.subscribe(l);
    s.dispatch({ t: 'fx' });
    s.dispatch({ t: 'noop' });
    s.dispatch({ t: 'fx' });
    expect(seen).toEqual([
      [['x'], 1],
      [['x'], 2],
    ]);
    expect(l).not.toHaveBeenCalled();
  });

  it('has no module-scope store: instances are isolated (SSR)', () => {
    const a = make();
    const b = make();
    a.dispatch({ t: 'inc', by: 3 });
    expect(b.getSnapshot()).toEqual({ n: 0 });
  });

  it('StrictMode double invocation: create/subscribe/unsubscribe/resubscribe is safe', () => {
    const s = make();
    const l = vi.fn();
    s.subscribe(l)();
    s.subscribe(l);
    s.dispatch({ t: 'inc', by: 1 });
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('1,000 create/destroy cycles retain no listeners', () => {
    const live = new Set<() => void>();
    for (let i = 0; i < 1000; i++) {
      const s = make();
      const l = () => {};
      live.add(l);
      s.subscribe(l);
      s.destroy();
      s.dispatch({ t: 'inc', by: 1 });
      live.delete(l);
    }
    expect(live.size).toBe(0);
  });

  it('property: snapshot equals a plain fold of the events; identity changes only on change', () => {
    const ev = fc.oneof(
      fc.record({ t: fc.constant('inc' as const), by: fc.integer({ min: -3, max: 3 }) }),
      fc.constant({ t: 'noop' as const }),
    );
    fc.assert(
      fc.property(fc.array(ev), (events) => {
        const s = make();
        let n = 0;
        for (const e of events) {
          const before = s.getSnapshot();
          const after = s.dispatch(e);
          if (e.t === 'inc') n += e.by;
          expect(after.n).toBe(n);
          if (e.t === 'noop' || (e.t === 'inc' && e.by === 0)) expect(after).toBe(before);
        }
      }),
    );
  });
});
