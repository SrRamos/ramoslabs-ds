// Runtime-level tests for the two RT follow-ups: a controlled owner that rejects a change gets the
// native control resynced by `useMachine` itself, and the live region is created lazily.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement, StrictMode, act, useState, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { createFakeScheduler } from '@ramoslabs/core/runtime';
import type { Reducer } from '@ramoslabs/core/store';
import { SJProvider, useMachine, type Machine } from './index';
import { createDomLiveHost } from './live-host';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface S {
  checked: boolean;
}
type E = { type: 'set'; checked: boolean };
type X = { type: 'checked'; target?: string };
const reduce: Reducer<S, E, X> = (_s, e) => ({ state: { checked: e.checked } });
const fields = {
  checked: {
    prop: 'checked',
    onChange: 'onChange',
    toEvent: (checked: boolean): E => ({ type: 'set', checked }),
    native: 'checked',
    target: 'input',
  },
};

interface Probe {
  m: Machine<S, E>;
  renders: number;
  /** What the "native input" holds; the run callback is the only thing that writes it after the report. */
  input: boolean;
  corrections: number;
}
const newProbe = (): Probe => ({ m: undefined as never, renders: 0, input: false, corrections: 0 });

function makeComp(p: Probe) {
  return function Comp(props: { checked?: boolean; onChange?: (v: boolean) => void }) {
    p.m = useMachine<S, E, X, typeof props>({
      initial: () => ({ checked: false }),
      reduce,
      props,
      fields,
      run: (e) => {
        p.corrections++;
        p.input = (e as unknown as { value: boolean }).value;
      },
    });
    p.renders++;
    return null;
  };
}

let renderers: ReactTestRenderer[] = [];
const mount = async (el: ReactNode) => {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(el as never);
  });
  renderers.push(r);
  return r;
};
beforeAll(() => {
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

const strictness = [false, true];
describe.each(strictness)('controlled resync (strict=%s)', (strict) => {
  const wrap = (el: ReactNode) => (strict ? createElement(StrictMode, null, el) : el);

  it('a rejected native change is resynced to the controlled value without any component help', async () => {
    const p = newProbe();
    const C = makeComp(p);
    const onChange = vi.fn(); // owner never updates `checked`
    await mount(
      wrap(createElement(SJProvider, null, createElement(C, { checked: false, onChange }))),
    );
    p.input = true; // the user just toggled the native input
    await act(async () => void p.m.native('checked', true));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(p.corrections).toBe(1);
    expect(p.input).toBe(false); // put back
    // Rejecting again corrects again, once each.
    p.input = true;
    await act(async () => void p.m.native('checked', true));
    expect(p.corrections).toBe(2);
    expect(p.input).toBe(false);
  });

  it('an accepting owner causes no extra render and no corrective effect', async () => {
    const p = newProbe();
    const C = makeComp(p);
    function Owner() {
      const [checked, set] = useState(false);
      return createElement(C, { checked, onChange: set });
    }
    await mount(wrap(createElement(SJProvider, null, createElement(Owner))));
    const before = p.renders;
    await act(async () => void p.m.native('checked', true));
    // Exactly the owner's render (twice under StrictMode's double render), none forced by the runtime.
    expect(p.renders - before).toBe(strict ? 2 : 1);
    expect(p.m.state.checked).toBe(true);
    expect(p.corrections).toBe(0);
  });

  it('request of a rejected change also resyncs; an uncontrolled field never forces a render', async () => {
    const p = newProbe();
    const C = makeComp(p);
    const onChange = vi.fn();
    const r = await mount(
      wrap(createElement(SJProvider, null, createElement(C, { checked: false, onChange }))),
    );
    const before = p.renders;
    await act(async () => void p.m.request('checked', true));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(p.renders - before).toBeGreaterThan(0); // the forced resync render
    act(() => r.unmount());
    renderers = [];

    const q = newProbe();
    const U = makeComp(q);
    await mount(wrap(createElement(SJProvider, null, createElement(U))));
    const b = q.renders;
    await act(async () => void q.m.native('checked', true));
    expect(q.renders - b).toBe(strict ? 2 : 1); // the store's own state change only
    expect(q.corrections).toBe(0);
  });

  it('a resync scheduled before unmount does nothing after it', async () => {
    const p = newProbe();
    const C = makeComp(p);
    const r = await mount(
      wrap(
        createElement(SJProvider, null, createElement(C, { checked: false, onChange: vi.fn() })),
      ),
    );
    p.m.native('checked', true);
    act(() => r.unmount());
    renderers = [];
    const renders = p.renders;
    await Promise.resolve();
    expect(p.renders).toBe(renders);
  });
});

describe('lazy live region', () => {
  const fakeDoc = () => {
    const body: unknown[] = [];
    const doc = {
      body: { appendChild: (n: unknown) => body.push(n) },
      createElement: () => ({
        setAttribute() {},
        textContent: '',
        remove() {
          const i = body.indexOf(this);
          if (i >= 0) body.splice(i, 1);
        },
      }),
    } as unknown as Document;
    return { body, doc };
  };

  it('attach and silence create nothing; the first announce creates one region; dispose removes it', () => {
    const { body, doc } = fakeDoc();
    const host = createDomLiveHost(doc);
    const sched = createFakeScheduler();
    return import('@ramoslabs/core/live').then(({ createLiveRegistry }) => {
      const live = createLiveRegistry(sched);
      live.attach(host);
      expect(body).toHaveLength(0);
      live.announce('Saved');
      expect(body).toHaveLength(1);
      live.announce('Saved again');
      expect(body).toHaveLength(1);
      host.dispose();
      expect(body).toHaveLength(0);
      live.detach();
    });
  });
});

describe('eager live region', () => {
  it('ensure() inserts the status region before any text, and later regions on creation', async () => {
    const body: unknown[] = [];
    const doc = {
      body: { appendChild: (n: unknown) => body.push(n) },
      createElement: () => ({ setAttribute() {}, textContent: '', remove() {} }),
    } as unknown as Document;
    const { createLiveRegistry } = await import('@ramoslabs/core/live');
    const host = createDomLiveHost(doc);
    const live = createLiveRegistry(createFakeScheduler());
    live.attach(host);
    expect(body).toHaveLength(0);
    host.ensure();
    expect(body).toHaveLength(1);
    host.ensure();
    expect(body).toHaveLength(1);
    live.announce('Saved');
    expect(body).toHaveLength(1);
    live.announce('Oops', { urgent: true });
    expect(body).toHaveLength(2);
  });

  const wire = async (live: 'eager' | 'lazy') => {
    const ensure = vi.fn();
    const host = Object.assign(createDomLiveHost({ body: { appendChild() {} } } as never), {
      ensure,
    });
    function Child() {
      useMachine<S, E, X, Record<string, never>>({
        initial: () => ({ checked: false }),
        reduce,
        props: {},
        fields,
        live,
      });
      return null;
    }
    await mount(createElement(SJProvider, { liveHost: () => host }, createElement(Child)));
    return ensure;
  };

  it('a machine with live: eager makes the provider host ensure at mount (child commits first)', async () => {
    expect(await wire('eager')).toHaveBeenCalledTimes(1);
  });

  it('a machine with live: lazy (liveRegions: []) never calls ensure', async () => {
    expect(await wire('lazy')).not.toHaveBeenCalled();
  });
});
