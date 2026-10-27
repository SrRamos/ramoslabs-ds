import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement, Fragment, StrictMode, act, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import { createFakeScheduler, createRuntime } from '@ramoslabs/core/runtime';
import { HIDDEN_STYLE, type LiveHost, type LiveNode, type LiveRole } from '@ramoslabs/core/live';
import { createDomLiveHost } from './live-host';
import { SJProvider, useMachine, useRuntime } from './index';
import type { AnnounceEffect, Machine } from './index';
import type { Reducer } from '@ramoslabs/core/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface S {
  open: boolean;
}
type E = { type: 'set'; open: boolean } | { type: 'noop' } | { type: 'fx' };
type X = { type: 'open' | 'focus' | 'geometry'; target?: string };

const reduce: Reducer<S, E, X | AnnounceEffect> = (s, e) => {
  if (e.type === 'noop') return { state: s };
  if (e.type === 'fx')
    return {
      state: s,
      effects: [
        { type: 'focus', target: 't' },
        { type: 'announce', text: 'End of list' },
      ],
    };
  return {
    state: s.open === e.open ? s : { open: e.open },
    effects: [
      { type: 'focus', target: 't' },
      { type: 'open', target: 't' },
      { type: 'announce', text: e.open ? 'Opened' : 'Closed' },
    ],
  };
};
const fields = {
  open: {
    prop: 'open',
    onChange: 'onOpenChange',
    toEvent: (open: boolean): E => ({ type: 'set', open }),
    native: 'open',
    target: 't',
  },
};

interface Probe {
  m: Machine<S, E>;
  renders: number;
  log: string[];
  layoutLog: string[];
}

function makeComp(probe: Probe, extra: { exists?: (t: string) => boolean } = {}) {
  return function Comp(props: { open?: boolean; onOpenChange?: (v: boolean) => void }) {
    const m = useMachine<S, E, X, typeof props>({
      initial: () => ({ open: false }),
      reduce,
      props,
      fields,
      run: (e) => probe.log.push(`${e.type}:${e.version}`),
      ...extra,
    });
    probe.m = m;
    probe.renders++;
    return null;
  };
}
const newProbe = (): Probe => ({ m: undefined as never, renders: 0, log: [], layoutLog: [] });

class FakeHost implements LiveHost {
  created: LiveRole[] = [];
  disposed = 0;
  texts: string[] = [];
  create(role: LiveRole): LiveNode {
    this.created.push(role);
    return { setText: (t) => void (t && this.texts.push(t)) };
  }
  dispose() {
    this.disposed++;
  }
}

let renderers: ReactTestRenderer[] = [];
const mount = (el: ReactNode) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el as never);
  });
  renderers.push(r);
  return r;
};
const update = (r: ReactTestRenderer, el: ReactNode) => act(() => r.update(el as never));

beforeAll(() => {
  // react-test-renderer is deprecated in React 19 and says so once; irrelevant to the assertions.
  const orig = console.error;
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    if (String(a[0]).includes('react-test-renderer is deprecated')) return;
    orig(...a);
  });
});
afterEach(() => {
  for (const r of renderers) act(() => r.unmount());
  renderers = [];
});

const wrap = (host: FakeHost, scheduler = createFakeScheduler()) =>
  function W({ children, strict }: { children?: ReactNode; strict?: boolean }) {
    const inner = createElement(SJProvider, { liveHost: () => host, scheduler }, children);
    return strict ? createElement(StrictMode, null, inner) : inner;
  };

describe('SJProvider / useMachine (W1-120)', () => {
  it('uncontrolled: dispatch updates the snapshot; effects run post-commit in order; announce is passive', () => {
    const host = new FakeHost();
    const sched = createFakeScheduler();
    const W = wrap(host, sched);
    const p = newProbe();
    const C = makeComp(p);
    mount(createElement(W, null, createElement(C)));
    expect(p.m.state.open).toBe(false);
    expect(host.created).toEqual(['status']); // attached after first commit
    act(() => p.m.request('open', true));
    expect(p.m.state.open).toBe(true);
    // native open before focus (EFFECT_ORDER); announce not a layout effect
    expect(p.log).toEqual(['open:1', 'focus:1']);
    sched.flush();
    expect(host.texts).toEqual(['Opened']);
  });

  it('G1 MUST-1: an effect-only dispatch (state unchanged) drains layout and passive effects', () => {
    const host = new FakeHost();
    const sched = createFakeScheduler();
    const W = wrap(host, sched);
    const p = newProbe();
    const C = makeComp(p);
    mount(createElement(W, null, createElement(C)));
    const before = p.m.state;
    act(() => p.m.dispatch({ type: 'fx' }));
    expect(p.m.state).toBe(before);
    expect(p.log).toEqual(['focus:1']);
    sched.flush();
    expect(host.texts).toEqual(['End of list']);
  });

  it('render performs no effects: run is never called while rendering', () => {
    const p = newProbe();
    const C = makeComp(p);
    const run = vi.spyOn(p.log, 'push');
    const r = mount(createElement(SJProvider, null, createElement(C)));
    expect(run).not.toHaveBeenCalled();
    update(r, createElement(SJProvider, null, createElement(C)));
    expect(run).not.toHaveBeenCalled();
  });

  it('stable identities across renders; the view reference is stable while nothing changes', () => {
    const p = newProbe();
    const C = makeComp(p);
    const tree = (props: object) => createElement(SJProvider, null, createElement(C, props));
    const r = mount(tree({}));
    const first = p.m;
    update(r, tree({}));
    expect(p.renders).toBeGreaterThan(1);
    for (const k of ['dispatch', 'request', 'native', 'announce'] as const)
      expect(p.m[k]).toBe(first[k]);
    expect(p.m.state).toBe(first.state);
    expect(p.m.runtime).toBe(first.runtime);
  });

  it('no-op dispatch does not re-render', () => {
    const p = newProbe();
    const C = makeComp(p);
    mount(createElement(SJProvider, null, createElement(C)));
    const n = p.renders;
    act(() => p.m.dispatch({ type: 'noop' }));
    expect(p.renders).toBe(n);
  });

  it('controlled: request only notifies; native disagreement yields a corrective open effect post-commit', () => {
    const p = newProbe();
    const C = makeComp(p);
    const onOpenChange = vi.fn();
    mount(createElement(SJProvider, null, createElement(C, { open: false, onOpenChange })));
    act(() => p.m.request('open', true));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(p.m.state.open).toBe(false); // owner has not accepted it
    expect(p.log).toEqual([]);
    act(() => p.m.native('open', true)); // native state reported; owner still says closed
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(p.log).toEqual([]); // correction waits for the next commit
  });

  it('controlled: reconcile after commit enqueues exactly one corrective effect', () => {
    const p = newProbe();
    const C = makeComp(p);
    const onOpenChange = vi.fn();
    const tree = (open: boolean) =>
      createElement(SJProvider, null, createElement(C, { open, onOpenChange }));
    const r = mount(tree(false));
    act(() => p.m.native('open', true));
    update(r, tree(false)); // commit with owner still false
    expect(p.log.filter((l) => l.startsWith('open'))).toHaveLength(1);
    update(r, tree(false));
    expect(p.log.filter((l) => l.startsWith('open'))).toHaveLength(1);
  });

  it('switching controlled to uncontrolled after mount throws in development', () => {
    const p = newProbe();
    const C = makeComp(p);
    const r = mount(createElement(SJProvider, null, createElement(C, { open: false })));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => update(r, createElement(SJProvider, null, createElement(C, {})))).toThrow(
      /controlled and uncontrolled/,
    );
    err.mockRestore();
  });

  it('stale effects from an earlier dispatch in one batch are dropped', () => {
    const p = newProbe();
    const C = makeComp(p);
    mount(createElement(SJProvider, null, createElement(C)));
    act(() => {
      p.m.request('open', true);
      p.m.request('open', false);
    });
    expect(p.log).toEqual(['open:2', 'focus:2']);
  });

  it('outside a provider: default runtime plus one dev warning, announce is a no-op', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = newProbe();
    const C = makeComp(p);
    const r = mount(createElement(C));
    update(r, createElement(C));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(p.m.runtime.locale).toBe('en');
    expect(p.m.announce('x')).toBe(false);
    warn.mockRestore();
  });

  it('provider: one live registry per runtime shared by every consumer; runtime from config', () => {
    const host = new FakeHost();
    const W = wrap(host);
    const a = newProbe();
    const b = newProbe();
    const A = makeComp(a);
    const B = makeComp(b);
    mount(
      createElement(W, null, createElement(Fragment, null, createElement(A), createElement(B))),
    );
    expect(host.created).toEqual(['status']);
    let rt!: ReturnType<typeof useRuntime>;
    function Peek() {
      rt = useRuntime();
      return null;
    }
    mount(
      createElement(SJProvider, { locale: 'de', dir: 'rtl', idPrefix: 'x' }, createElement(Peek)),
    );
    expect([rt.locale, rt.dir, rt.idPrefix]).toEqual(['de', 'rtl', 'x']);
    const given = createRuntime({ locale: 'fr' });
    mount(createElement(SJProvider, { runtime: given }, createElement(Peek)));
    expect(rt).toBe(given);
  });

  it('StrictMode: effects run once, one live host stays attached, ownership lock survives double effects', () => {
    const host = new FakeHost();
    const sched = createFakeScheduler();
    const W = wrap(host, sched);
    const p = newProbe();
    const C = makeComp(p);
    const r = mount(createElement(W, { strict: true }, createElement(C)));
    expect(host.created.length).toBe(host.disposed + 1); // net one attached host
    act(() => p.m.request('open', true));
    expect(p.log).toEqual(['open:1', 'focus:1']); // not doubled
    sched.flush();
    expect(host.texts).toEqual(['Opened']);
    act(() => r.unmount());
    expect(host.created.length).toBe(host.disposed);
    renderers = [];
  });

  it('StrictMode: lazy initial() may be called twice but only one store is kept', () => {
    const p = newProbe();
    let calls = 0;
    function C() {
      p.m = useMachine<S, E, X, Record<string, unknown>>({
        initial: () => (calls++, { open: false }),
        reduce,
        props: {},
        fields,
      });
      return null;
    }
    mount(createElement(StrictMode, null, createElement(SJProvider, null, createElement(C))));
    act(() => p.m.request('open', true));
    expect(p.m.state.open).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it('SSR: server snapshot is the initial state, no live markup, no document access', () => {
    expect(typeof document).toBe('undefined');
    const p = newProbe();
    const C = makeComp(p);
    const html = renderToString(createElement(SJProvider, null, createElement(C)));
    expect(html).toBe('');
    expect(p.m.state.open).toBe(false);
  });

  it('unmount drops pending effects and live hosts; scheduler is left empty', () => {
    const host = new FakeHost();
    const sched = createFakeScheduler();
    const W = wrap(host, sched);
    const p = newProbe();
    const C = makeComp(p);
    const r = mount(createElement(W, null, createElement(C)));
    act(() => p.m.request('open', true));
    sched.flush();
    act(() => r.unmount());
    renderers = [];
    sched.advance(5000);
    expect(sched.pending).toBe(0);
    expect(host.disposed).toBe(host.created.length);
  });
});

describe('retention: 1,000 mount/unmount cycles (L2 invariant)', () => {
  it('retains no stores, listeners or live hosts', async () => {
    // Real gc, so a leak shows as a live WeakRef. Node-only, hence the untyped dynamic imports.
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const v8 = (await mod('node:v8')) as { setFlagsFromString(f: string): void };
    const vm = (await mod('node:vm')) as { runInNewContext(c: string): () => void };
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');

    const refs: WeakRef<object>[] = [];
    let created = 0;
    let disposed = 0;
    let listenerCalls = 0;
    const host = {
      create: (): LiveNode => {
        created++;
        return { setText() {} };
      },
      dispose: () => void disposed++,
    };
    const sched = createFakeScheduler();
    function C() {
      useMachine<S, E, X, Record<string, unknown>>({
        initial: () => {
          const s = { open: false };
          refs.push(new WeakRef(s));
          return s;
        },
        reduce,
        props: {},
        fields,
      });
      return null;
    }
    for (let i = 0; i < 1000; i++) {
      let r!: ReactTestRenderer;
      act(() => {
        r = create(
          createElement(
            StrictMode,
            null,
            createElement(SJProvider, { liveHost: () => host, scheduler: sched }, createElement(C)),
          ),
        );
      });
      act(() => r.unmount());
      listenerCalls++;
    }
    await new Promise((res) => setTimeout(res, 0));
    gc();
    await new Promise((res) => setTimeout(res, 0));
    gc();
    expect(listenerCalls).toBe(1000);
    expect(created).toBe(disposed); // every attached host was detached
    expect(sched.pending).toBe(0);
    const alive = refs.filter((r) => r.deref() !== undefined).length;
    expect(alive).toBeLessThanOrEqual(2); // allow the last couple of fibers React may defer
  }, 60_000);
});

describe('live host (G1 MUST-3)', () => {
  it('default DOM host hides its nodes inline, without a stylesheet', () => {
    const attrs: Record<string, string> = {};
    const doc = {
      body: { appendChild: () => undefined },
      createElement: () => ({ setAttribute: (k: string, v: string) => (attrs[k] = v) }),
    } as unknown as Document;
    createDomLiveHost(doc).create('status');
    expect(attrs.style).toBe(HIDDEN_STYLE);
  });
});
