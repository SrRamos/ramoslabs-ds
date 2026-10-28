// RT follow-ups at runtime level: a rejected controlled change is resynced by `useSJStore` itself,
// and the default live host is lazy.
import { describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, h, nextTick, ref, type Component } from 'vue';
import { createLiveRegistry } from '@ramoslabs/core/live';
import { createFakeScheduler } from '@ramoslabs/core/runtime';
import type { Reducer } from '@ramoslabs/core/store';
import { createDomLiveHost } from './dom';
import { SJProvider, useSJStore, type SJStore } from './index';

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
  checked: boolean;
}
const reduce: Reducer<S, boolean, { type: 'checked'; target: string }> = (_s, e) => ({
  state: { checked: e },
});
const fields = {
  checked: {
    prop: 'checked',
    onChange: 'onChange',
    toEvent: (v: boolean) => v,
    native: 'checked',
    target: 'input',
  },
};

function harness(accept: boolean) {
  const out = {
    corrections: [] as unknown[],
    renders: 0,
    api: undefined as unknown as SJStore<S, boolean>,
  };
  const owned = ref(false);
  const Child = defineComponent({
    props: { checked: Boolean },
    setup(p) {
      out.api = useSJStore({
        initial: { checked: false },
        reduce,
        host: { run: (e) => void out.corrections.push((e as { value?: unknown }).value) },
        props: () => ({
          checked: p.checked,
          onChange: (v: boolean) => accept && (owned.value = v),
        }),
        fields,
      });
      return () => (out.renders++, h('i'));
    },
  });
  const Owner: Component = defineComponent({ render: () => h(Child, { checked: owned.value }) });
  const app = createApp({
    render: () => h(SJProvider, { liveHost: { create: () => ({ setText() {} }) } }, () => h(Owner)),
  });
  app.mount(mk('root'));
  return { out, app };
}

describe('controlled resync (Vue)', () => {
  it('a rejected native change is put back to the controlled value', async () => {
    const { out, app } = harness(false);
    await nextTick();
    expect(out.api.native('checked', true)).toBe(false);
    await nextTick();
    expect(out.corrections).toEqual([false]);
    out.api.native('checked', true);
    await nextTick();
    expect(out.corrections).toEqual([false, false]);
    app.unmount();
  });

  it('an accepting owner re-renders once and gets no corrective effect', async () => {
    const { out, app } = harness(true);
    await nextTick();
    const before = out.renders;
    out.api.native('checked', true);
    await nextTick();
    expect(out.corrections).toEqual([]);
    expect(out.renders - before).toBeLessThanOrEqual(1);
    expect(out.api.view().checked).toBe(true);
    app.unmount();
  });

  it('a resync pending at unmount does nothing', async () => {
    const { out, app } = harness(false);
    await nextTick();
    out.api.native('checked', true);
    app.unmount();
    await nextTick();
    expect(out.corrections).toEqual([]);
  });
});

describe('lazy live region (Vue)', () => {
  it('attach creates nothing; first announce creates one region; dispose removes it', () => {
    const body: { remove(): void }[] = [];
    const doc = {
      body: { appendChild: (n: { remove(): void }) => body.push(n) },
      createElement: () => {
        const el = {
          setAttribute() {},
          textContent: '',
          remove: vi.fn(() => void body.splice(body.indexOf(el), 1)),
        };
        return el;
      },
    } as unknown as Document;
    const host = createDomLiveHost(doc);
    const live = createLiveRegistry(createFakeScheduler());
    live.attach(host);
    expect(body).toHaveLength(0);
    live.announce('Saved');
    live.announce('Saved again');
    expect(body).toHaveLength(1);
    host.dispose();
    expect(body).toHaveLength(0);
  });
});

describe('eager live region (Vue)', () => {
  const fakeDoc = () => {
    const body: unknown[] = [];
    const doc = {
      body: { appendChild: (n: unknown) => body.push(n) },
      createElement: () => ({ setAttribute() {}, textContent: '', remove() {} }),
    } as unknown as Document;
    return { body, doc };
  };

  it('ensure() inserts the status region before any text, and later regions on creation', () => {
    const { body, doc } = fakeDoc();
    const host = createDomLiveHost(doc);
    const live = createLiveRegistry(createFakeScheduler());
    live.attach(host);
    expect(body).toHaveLength(0);
    host.ensure();
    expect(body).toHaveLength(1); // present, no announce yet
    host.ensure();
    expect(body).toHaveLength(1); // idempotent
    live.announce('Saved');
    expect(body).toHaveLength(1);
    live.announce('Oops', { urgent: true }); // alert node is created eagerly too
    expect(body).toHaveLength(2);
  });

  const wire = (live: 'eager' | 'lazy') => {
    const ensure = vi.fn();
    const Child = defineComponent({
      setup() {
        useSJStore({ initial: { checked: false }, reduce, host: { run() {} }, live });
        return () => h('i');
      },
    });
    const app = createApp({
      render: () =>
        h(SJProvider, { liveHost: { create: () => ({ setText() {} }), ensure } as never }, () =>
          h(Child),
        ),
    });
    app.mount(mk('root'));
    return { ensure, app };
  };

  it('a component with live: eager makes the provider host ensure at mount (child mounts first)', async () => {
    const { ensure, app } = wire('eager');
    await nextTick();
    expect(ensure).toHaveBeenCalledTimes(1);
    app.unmount();
  });

  it('a component with live: lazy (liveRegions: []) never calls ensure', async () => {
    const { ensure, app } = wire('lazy');
    await nextTick();
    expect(ensure).not.toHaveBeenCalled();
    app.unmount();
  });
});
