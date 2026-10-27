import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../store';
import { createControlled, type CorrectiveEffect } from './index';

interface S {
  open: boolean;
  count: number;
}
type E = { t: 'open'; v: boolean } | { t: 'count'; v: number };
type P = { open?: boolean; onOpenChange?: (v: boolean) => void; count?: number };

function setup(initial: P = {}) {
  let props: P = initial;
  const store = createStore<S, E>({ open: false, count: 0 }, (s, e) => ({
    state: e.t === 'open' ? { ...s, open: e.v } : { ...s, count: e.v },
  }));
  const c = createControlled<S, E, P>({
    store,
    getProps: () => props,
    fields: {
      open: {
        prop: 'open',
        onChange: 'onOpenChange',
        toEvent: (v: boolean) => ({ t: 'open', v }),
        native: 'open',
        target: 'p',
      },
      count: { prop: 'count', toEvent: (v: number) => ({ t: 'count', v }) },
    },
  });
  return { c, store, set: (p: P) => (props = p) };
}

describe('controlled pipeline (W1-115, ADR-003)', () => {
  it('overlays controlled props on the view and never copies them into reducer state', () => {
    const t = setup({ open: true });
    expect(t.c.view().open).toBe(true);
    expect(t.store.getSnapshot().open).toBe(false);
    t.c.request('open', false);
    expect(t.store.getSnapshot().open).toBe(false);
    t.set({ open: true, count: 5 });
    expect(t.c.view()).toEqual({ open: true, count: 5 });
    expect(t.store.getSnapshot()).toEqual({ open: false, count: 0 });
  });

  it('reads getProps at derive and transition time (latest props win, onChange is current)', () => {
    const a = vi.fn();
    const b = vi.fn();
    const t = setup({ open: false, onOpenChange: a });
    t.set({ open: false, onOpenChange: b });
    t.c.request('open', true);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(true);
  });

  it('uncontrolled: dispatches and notifies; view is the store state', () => {
    const cb = vi.fn();
    const t = setup({ onOpenChange: cb });
    expect(t.c.request('open', true)).toBe(true);
    expect(t.c.view().open).toBe(true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('view is referentially stable until an input changes', () => {
    const t = setup({ open: true });
    const v = t.c.view();
    expect(t.c.view()).toBe(v);
    t.set({ open: false });
    expect(t.c.view()).not.toBe(v);
  });

  it('native Escape while controlled open stays true: one corrective effect, no re-dispatch', () => {
    const cb = vi.fn();
    const t = setup({ open: true, onOpenChange: cb });
    const spy = vi.spyOn(t.store, 'dispatch');
    expect(t.c.native('open', false)).toBe(false);
    expect(cb).toHaveBeenCalledWith(false);
    const fx = t.c.reconcile();
    expect(fx).toEqual<CorrectiveEffect[]>([{ type: 'open', target: 'p', value: true }]);
    expect(spy).not.toHaveBeenCalled();
    expect(t.c.reconcile()).toEqual([]);
  });

  it('reconcile works destructured (uses the closure, not this)', () => {
    const t = setup({ open: true });
    const { native, reconcile } = t.c;
    native('open', false);
    expect(reconcile()).toEqual([{ type: 'open', target: 'p', value: true }]);
  });

  it('native close accepted by the owner needs no correction', () => {
    const t = setup({ open: true });
    t.c.native('open', false);
    t.set({ open: false });
    expect(t.c.reconcile()).toEqual([]);
  });

  it('throws in development when ownership switches after mount, not before', () => {
    const t = setup({});
    t.set({ open: true });
    expect(() => t.c.view()).not.toThrow();
    t.set({});
    t.c.mount();
    t.set({ open: true });
    expect(() => t.c.view()).toThrow(/controlled and uncontrolled/);
    expect(() => t.c.request('open', false)).toThrow();
    t.set({});
    expect(() => t.c.view()).not.toThrow();
  });

  it('is deterministic and keeps controlled values out of state (property)', () => {
    const run = (ops: [boolean, boolean | undefined][]) => {
      const t = setup();
      const out: unknown[] = [];
      for (const [req, ctl] of ops) {
        t.set(ctl === undefined ? {} : { open: ctl });
        t.c.request('open', req);
        out.push(t.c.view(), t.store.getSnapshot());
      }
      return out;
    };
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.option(fc.boolean(), { nil: undefined }))),
        (ops) => {
          expect(run(ops)).toEqual(run(ops));
          const t = setup({ open: true });
          for (const [req] of ops) t.c.request('open', req);
          expect(t.store.getSnapshot().open).toBe(false);
        },
      ),
    );
  });
});
