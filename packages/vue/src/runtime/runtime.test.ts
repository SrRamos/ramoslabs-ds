import { describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, h, nextTick, type Component } from 'vue';
import fc from 'fast-check';
import { createStore, type Reducer } from '@ramoslabs/core/store';
import type { DrainHost, Effect, EffectInput } from '@ramoslabs/core/effects';
import { HIDDEN_STYLE, type LiveHost } from '@ramoslabs/core/live';
import { createDomLiveHost } from './dom';
import { createRuntime } from '@ramoslabs/core/runtime';
import { SJProvider, useSJContext, useSJRuntime, useSJStore, type SJStore } from './index';

// A DOM-free renderer: components mount into plain objects, so the suite runs under `node`.
interface N {
  type: string;
  children: N[];
  parent?: N;
  text?: string;
}
const mk = (type: string): N => ({ type, children: [] });
const { createApp } = createRenderer<N, N>({
  patchProp() {},
  insert(el, parent, anchor) {
    el.parent = parent;
    const i = anchor ? parent.children.indexOf(anchor) : -1;
    if (i < 0) parent.children.push(el);
    else parent.children.splice(i, 0, el);
  },
  remove(el) {
    const p = el.parent;
    if (p) p.children = p.children.filter((c) => c !== el);
  },
  createElement: mk,
  createText: (text) => ({ ...mk('#text'), text }),
  createComment: (text) => ({ ...mk('#comment'), text }),
  setText(n, text) {
    n.text = text;
  },
  setElementText(n, text) {
    n.text = text;
  },
  parentNode: (n) => n.parent ?? null,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
});

interface S {
  open: boolean;
  n: number;
}
type Ev = 'open' | 'close' | 'inc' | 'noop' | 'fx';
type X = EffectInput & { value?: unknown };
const reduce: Reducer<S, Ev, X> = (s, e) => {
  switch (e) {
    case 'open':
      return { state: { ...s, open: true }, effects: [{ type: 'open', target: 't' }] };
    case 'close':
      return { state: { ...s, open: false } };
    case 'inc':
      return { state: { ...s, n: s.n + 1 } };
    case 'fx':
      return { state: s, effects: [{ type: 'focus', target: 't' }] };
    default:
      return { state: s };
  }
};

const fakeLive = () => {
  const created: string[] = [];
  const host: LiveHost = {
    create(role) {
      created.push(role);
      return { setText() {} };
    },
  };
  return { host, created };
};

interface Harness {
  ran: Effect<X>[];
  api: SJStore<S, Ev>;
  log: string[];
}
function setup(extra: Partial<Parameters<typeof useSJStore<S, Ev, X>>[0]> = {}) {
  const out = {} as Harness;
  out.ran = [];
  out.log = [];
  const host: DrainHost<X> = {
    run: (e) => {
      out.ran.push(e);
      out.log.push(`run:${e.type}`);
    },
  };
  const Comp = defineComponent({
    setup() {
      out.api = useSJStore<S, Ev, X>({
        initial: { open: false, n: 0 },
        reduce,
        host,
        ...extra,
      });
      return () => {
        out.log.push('render');
        return h('div', String(out.api.snapshot.value.n));
      };
    },
  });
  return { out, Comp };
}

const mount = (Comp: Component, props: Record<string, unknown> = {}) => {
  const app = createApp({
    render: () => h(SJProvider, { liveHost: fakeLive().host, ...props }, () => h(Comp)),
  });
  const root = mk('root');
  app.mount(root);
  return app;
};

describe('SJProvider and context', () => {
  it('provides one runtime and one live registry to descendants', () => {
    const runtime = createRuntime({ locale: 'es' });
    const seen: unknown[] = [];
    const Child = defineComponent({
      setup() {
        seen.push(useSJRuntime(), useSJContext().live);
        return () => h('i');
      },
    });
    const { host } = fakeLive();
    const app = mount(defineComponent({ render: () => [h(Child), h(Child)] }), {
      runtime,
      liveHost: host,
    });
    expect(seen[0]).toBe(runtime);
    expect(seen[2]).toBe(runtime);
    expect(seen[1]).toBe(seen[3]);
    app.unmount();
  });

  it('attaches the live host only after mount and detaches on unmount', () => {
    const { host, created } = fakeLive();
    const seenAtSetup: number[] = [];
    let ctx!: ReturnType<typeof useSJContext>;
    const Child = defineComponent({
      setup() {
        ctx = useSJContext();
        seenAtSetup.push(created.length);
        expect(ctx.live.announce('hi')).toBe(false); // server-like: no region yet
        return () => h('i');
      },
    });
    const app = mount(Child, { liveHost: host });
    expect(seenAtSetup).toEqual([0]);
    expect(created).toEqual(['status']);
    expect(ctx.live.announce('hi')).toBe(true);
    app.unmount();
    expect(ctx.live.announce('again')).toBe(false); // detached
  });

  it('falls back to defaults with a dev warning outside a provider, once per app', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seen: unknown[] = [];
    const Child = defineComponent({
      setup() {
        seen.push(useSJContext());
        return () => h('i');
      },
    });
    const app = createApp({ render: () => [h(Child), h(Child)] });
    app.mount(mk('root'));
    expect(seen[0]).toBe(seen[1]);
    expect((seen[0] as ReturnType<typeof useSJContext>).runtime.locale).toBe('en');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/outside <SJProvider>/);
    app.unmount();
    warn.mockRestore();
  });
});

describe('useSJStore bridge', () => {
  it('replaces the snapshot only when a dispatch changed the state', async () => {
    const { out, Comp } = setup();
    const app = mount(Comp);
    const first = out.api.snapshot.value;
    out.api.dispatch('noop');
    out.api.dispatch('fx'); // effects only: state is the same object
    await nextTick();
    expect(out.api.snapshot.value).toBe(first);
    out.api.dispatch('inc');
    expect(out.api.snapshot.value).not.toBe(first);
    expect(out.api.snapshot.value.n).toBe(1);
    app.unmount();
  });

  it('drains effects post-flush, after the render that follows the dispatch', async () => {
    const { out, Comp } = setup();
    const app = mount(Comp);
    out.log.length = 0;
    out.api.dispatch('inc');
    out.api.dispatch('open');
    expect(out.log).toEqual([]); // nothing synchronous
    await nextTick();
    expect(out.log).toEqual(['render', 'run:open']);
    out.api.dispatch('fx'); // effect without a state change still drains
    await nextTick();
    expect(out.ran.map((e) => e.type)).toEqual(['open', 'focus']);
    app.unmount();
  });

  it('runs no native effect before mount, then drains the queued ones once mounted', () => {
    const early: number[] = [];
    const { out, Comp } = setup();
    const Wrapper = defineComponent({
      setup() {
        const inner = Comp.setup as unknown as () => () => unknown;
        const render = inner();
        out.api.dispatch('open');
        early.push(out.ran.length);
        return render as () => unknown;
      },
    });
    const app = mount(Wrapper as unknown as Component);
    expect(early).toEqual([0]);
    expect(out.ran.map((e) => e.type)).toEqual(['open']);
    app.unmount();
  });

  it('enqueues the corrective effect from createControlled().reconcile() post-commit', async () => {
    let props: { open?: boolean } = { open: true };
    const { out, Comp } = setup({
      props: () => props,
      fields: {
        open: {
          prop: 'open',
          toEvent: (v: boolean) => (v ? 'open' : 'close'),
          native: 'open',
          target: 't',
        },
      },
    });
    const app = mount(Comp);
    out.ran.length = 0;
    expect(out.api.native('open', false)).toBe(false); // controlled: only notifies
    expect(out.api.view().open).toBe(true);
    out.api.commit();
    expect(out.ran).toHaveLength(1);
    expect(out.ran[0]).toMatchObject({ type: 'open', target: 't', value: true });
    out.api.commit();
    expect(out.ran).toHaveLength(1); // not repeated
    props = { open: undefined };
    app.unmount();
  });

  it('disposes the effect scope, subscription, store and queue on unmount', async () => {
    let listeners = 0;
    let destroyed = 0;
    const makeStore: typeof createStore = (i, r, o) => {
      const s = createStore(i, r, o);
      return {
        ...s,
        subscribe(l) {
          listeners++;
          const un = s.subscribe(l);
          return () => {
            listeners--;
            un();
          };
        },
        destroy() {
          destroyed++;
          s.destroy();
        },
      };
    };
    const { out, Comp } = setup({ makeStore });
    const app = mount(Comp);
    expect(out.api.scope.active).toBe(true);
    expect(listeners).toBe(1);
    out.api.dispatch('open');
    app.unmount();
    expect(out.api.scope.active).toBe(false);
    expect(listeners).toBe(0);
    expect(destroyed).toBe(1);
    expect(out.api.queue.size).toBe(0);
    // later dispatches are inert and run nothing
    const before = out.ran.length;
    out.api.dispatch('open');
    await nextTick();
    expect(out.ran.length).toBe(before);
  });

  it('retains no stores, listeners or effects across 1,000 mount/unmount cycles', async () => {
    let listeners = 0;
    let live = 0;
    const makeStore: typeof createStore = (i, r, o) => {
      const s = createStore(i, r, o);
      live++;
      return {
        ...s,
        subscribe(l) {
          listeners++;
          const un = s.subscribe(l);
          return () => {
            listeners--;
            un();
          };
        },
        destroy() {
          live--;
          s.destroy();
        },
      };
    };
    const { host } = fakeLive();
    const { out, Comp } = setup({ makeStore });
    for (let i = 0; i < 1000; i++) {
      const a = createApp({ render: () => h(SJProvider, { liveHost: host }, () => h(Comp)) });
      a.mount(mk('root'));
      out.api.dispatch(i % 2 ? 'open' : 'inc');
      a.unmount();
    }
    await nextTick();
    expect(listeners).toBe(0);
    expect(live).toBe(0);
    expect(out.api.scope.active).toBe(false);
  });

  it('property: arbitrary dispatch sequences leave nothing subscribed after unmount', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom<Ev>('open', 'close', 'inc', 'noop', 'fx')), (evs) => {
        let listeners = 0;
        const makeStore: typeof createStore = (i, r, o) => {
          const s = createStore(i, r, o);
          return {
            ...s,
            subscribe(l) {
              listeners++;
              const un = s.subscribe(l);
              return () => {
                listeners--;
                un();
              };
            },
          };
        };
        const { out, Comp } = setup({ makeStore });
        const a = mount(Comp);
        for (const e of evs) out.api.dispatch(e);
        a.unmount();
        return listeners === 0 && out.api.queue.size === 0;
      }),
    );
  });
});

describe('client scheduler default (G1 SHOULD-1)', () => {
  it('SJProvider config without target and the outside-provider fallback use platform timers', () => {
    const seen: object[] = [];
    const Child = defineComponent({
      setup() {
        seen.push(useSJRuntime().scheduler);
        return () => h('i');
      },
    });
    mount(Child, { config: { locale: 'es' } }).unmount();
    const bare = createApp({ render: () => h(Child) });
    bare.mount(mk('root'));
    bare.unmount();
    expect(seen).toHaveLength(2);
    for (const sc of seen) expect('advance' in sc).toBe(false);
  });
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
