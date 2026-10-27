import { HIDDEN_STYLE } from '@ramoslabs/core/live';
import { createRuntime, createFakeScheduler, type FakeScheduler } from '@ramoslabs/core/runtime';
import { describe, expect, it, vi } from 'vitest';
import {
  createHost,
  setText,
  type ComponentSpec,
  type Effect,
  type EffectInput,
  type LiveHost,
} from './index';

interface S {
  open: boolean;
  count: number;
}
type E = { type: 'toggle' } | { type: 'set'; open: boolean } | { type: 'inc' };
type X = EffectInput & { type: 'focus' | 'announce' | 'open'; text?: string };

/** EventTarget that records every listener with its signal, so tests can count live ones. */
class Target extends EventTarget {
  readonly added: { signal?: AbortSignal }[] = [];
  ownerDocument = undefined as unknown as Document;
  override addEventListener(
    type: string,
    cb: EventListenerOrEventListenerObject | null,
    o?: boolean | AddEventListenerOptions,
  ): void {
    this.added.push({ signal: typeof o === 'object' ? o.signal : undefined });
    // eslint-disable-next-line sj-boundaries/listener-signal -- test double forwards the caller options verbatim
    super.addEventListener(type, cb, o);
  }
  get live(): number {
    return this.added.filter((a) => !a.signal?.aborted).length;
  }
}

const noopLive: LiveHost = { create: () => ({ setText: () => undefined }) };

function setup(over: Partial<ComponentSpec<S, E, Record<string, unknown>, X>> = {}) {
  const sched: FakeScheduler = createFakeScheduler();
  let n = 0;
  const runtime = createRuntime({ scheduler: sched, idFactory: () => `id${n++}` });
  const host = createHost(runtime, { liveHost: noopLive });
  const log: string[] = [];
  const spec: ComponentSpec<S, E, Record<string, unknown>, X> = {
    initial: () => ({ open: false, count: 0 }),
    reduce: (s, e) =>
      e.type === 'inc'
        ? {
            state: { ...s, count: s.count + 1 },
            effects: [{ type: 'announce', text: `n${s.count + 1}` }],
          }
        : e.type === 'toggle'
          ? {
              state: { ...s, open: !s.open },
              effects: [
                { type: 'open', target: 'p' },
                { type: 'focus', target: 'p' },
              ],
            }
          : { state: { ...s, open: e.open } },
    fields: {
      open: {
        prop: 'open',
        onChange: 'onOpen',
        toEvent: (o: boolean) => ({ type: 'set', open: o }),
        native: 'open',
        target: 'p',
      },
    },
    patch: (v, ctx) => {
      log.push(`patch:${v.open}:${v.count}`);
      setText(ctx.el, `${ctx.id}|${v.count}`);
    },
    attach: (ctx) => {
      ctx.listen(ctx.el, 'click', () => ctx.dispatch({ type: 'toggle' }));
      ctx.listen(ctx.el, 'input', () => ctx.dispatch({ type: 'inc' }));
    },
    run: (e, ctx) => {
      log.push(`run:${e.type}`);
      if (e.type === 'announce') ctx.live.announce((e as Effect<X>).text ?? '');
    },
    ...over,
  };
  return { sched, host, spec, log, runtime };
}

const el = () => new Target() as unknown as Element & Target;

describe('vanilla runtime (W1-122, ADR-003 bridge)', () => {
  it('patches first, locks ownership, then attaches listeners', () => {
    const t = setup();
    const e = el();
    const order: string[] = [];
    const inst = t.host.mount(
      e,
      {
        ...t.spec,
        patch: (v, c) => (order.push('patch'), t.spec.patch(v, c)),
        attach: (c) => (order.push('attach'), t.spec.attach!(c)),
      },
      {},
    );
    expect(order).toEqual(['patch', 'attach']);
    expect(e.textContent).toBe('id0|0');
    expect(inst.destroyed).toBe(false);
  });

  it('uses the injected idFactory, explicit id wins, prefix applies; missing source throws', () => {
    const sched = createFakeScheduler();
    const rt = createRuntime({ scheduler: sched, idPrefix: 'p-' });
    const h = createHost(rt, { liveHost: noopLive, idFactory: () => 'gen' });
    const t = setup();
    const a = el();
    h.mount(a, t.spec, {});
    expect(a.textContent).toBe('p-gen|0');
    const b = el();
    h.mount(b, t.spec, { id: 'mine' });
    expect(b.textContent).toBe('mine|0');
    const bare = createHost(rt, { liveHost: noopLive });
    expect(() => bare.mount(el(), t.spec, {})).toThrow(/idFactory/);
  });

  it('drains effects in a microtask after the patch, in order, never synchronously', () => {
    const t = setup();
    const e = el();
    t.host.mount(e, t.spec, {});
    t.log.length = 0;
    e.dispatchEvent(new Event('click'));
    expect(t.log).toEqual(['patch:true:0']);
    t.sched.flush();
    expect(t.log).toEqual(['patch:true:0', 'run:open', 'run:focus']);
  });

  it('drops superseded effects and missing targets', () => {
    const t = setup({ exists: (target) => target !== 'p' });
    const e = el();
    t.host.mount(e, t.spec, {});
    e.dispatchEvent(new Event('click'));
    e.dispatchEvent(new Event('input'));
    e.dispatchEvent(new Event('input'));
    t.sched.flush();
    expect(t.log.filter((l) => l.startsWith('run'))).toEqual(['run:announce']);
  });

  it('forbids synchronous re-dispatch from an effect in development', () => {
    let err: unknown;
    const t = setup({
      run: (_e, ctx) => {
        try {
          ctx.dispatch({ type: 'inc' });
        } catch (x) {
          err = x;
        }
      },
    });
    const e = el();
    t.host.mount(e, t.spec, {});
    e.dispatchEvent(new Event('click'));
    t.sched.flush();
    expect(String(err)).toMatch(/re-dispatch/);
  });

  it('controlled: reducer untouched, onChange called, corrective native effect after the patch', () => {
    const onOpen = vi.fn();
    const t = setup();
    const e = el();
    let corrective: unknown;
    t.host.mount(
      e,
      { ...t.spec, run: (eff) => void (corrective = (eff as unknown as { value: unknown }).value) },
      { open: true, onOpen },
    );
    t.sched.flush();
    const inst = t.host.mount(el(), t.spec, { open: true, onOpen });
    expect(inst.destroyed).toBe(false);
    // native close while controlled open stays true
    let ctxRef!: Parameters<NonNullable<typeof t.spec.attach>>[0];
    const e2 = el();
    t.host.mount(
      e2,
      {
        ...t.spec,
        attach: (c) => (ctxRef = c),
        run: (eff) => void (corrective = (eff as unknown as { value: unknown }).value),
      },
      { open: true, onOpen },
    );
    ctxRef.native('open', false);
    expect(onOpen).toHaveBeenCalledWith(false);
    expect(ctxRef.view().open).toBe(true);
    t.sched.flush();
    expect(corrective).toBe(true);
  });

  it('update re-patches synchronously and surfaces an ownership switch', () => {
    const t = setup();
    const e = el();
    const inst = t.host.mount(e, t.spec, { open: true });
    t.log.length = 0;
    inst.update({ open: false });
    expect(t.log).toEqual(['patch:false:0']);
    expect(() => inst.update({})).toThrow(/switched/);
  });

  it('announces through the single live registry per runtime', () => {
    const created: string[] = [];
    const written: string[] = [];
    const lh: LiveHost = {
      create: (role) => (created.push(role), { setText: (x) => void (x && written.push(x)) }),
    };
    const sched = createFakeScheduler();
    const rt = createRuntime({ scheduler: sched, idFactory: () => 'x' });
    const host = createHost(rt, { liveHost: lh });
    const t = setup();
    const a = el();
    const b = el();
    host.mount(a, t.spec, {});
    host.mount(b, t.spec, {});
    expect(created).toEqual(['status']);
    a.dispatchEvent(new Event('input'));
    sched.flush();
    sched.flush();
    expect(written).toEqual(['n1']);
  });

  it('default live host builds hidden light-DOM nodes with text only, removed on host destroy', () => {
    const children: Record<string, unknown>[] = [];
    const doc = {
      body: { appendChild: (n: Record<string, unknown>) => children.push(n) },
      createElement: () => {
        const attrs: Record<string, string> = {};
        return {
          attrs,
          className: '',
          textContent: '',
          setAttribute: (k: string, v: string) => (attrs[k] = v),
          remove: vi.fn(),
        };
      },
    };
    const sched = createFakeScheduler();
    const host = createHost(createRuntime({ scheduler: sched, idFactory: () => 'x' }));
    const t = setup();
    const e = el();
    (e as unknown as { ownerDocument: unknown }).ownerDocument = doc;
    host.mount(e, t.spec, {});
    expect(children).toHaveLength(1);
    expect((children[0] as { attrs: Record<string, string> }).attrs).toMatchObject({
      role: 'status',
      'aria-live': 'polite',
      style: HIDDEN_STYLE,
    });
    host.destroy();
    expect((children[0] as { remove: ReturnType<typeof vi.fn> }).remove).toHaveBeenCalled();
    expect(() => host.mount(e, t.spec, {})).toThrow(/destroyed host/);
  });

  it('text only: markup in state is never parsed', () => {
    const e = el();
    setText(e, '<img src=x onerror=alert(1)>');
    expect(e.textContent).toBe('<img src=x onerror=alert(1)>');
    expect((e as unknown as Record<string, unknown>).innerHTML).toBeUndefined();
  });

  it('destroy aborts every listener, is idempotent, and silences later events and microtasks', () => {
    const t = setup();
    const e = el();
    const cleaned: number[] = [];
    const inst = t.host.mount(
      e,
      {
        ...t.spec,
        attach: (c) => (
          t.spec.attach!(c),
          c.onCleanup(() => cleaned.push(1)),
          c.onCleanup(() => cleaned.push(2))
        ),
      },
      {},
    );
    e.dispatchEvent(new Event('click'));
    expect(e.live).toBe(2);
    inst.destroy();
    inst.destroy();
    expect(e.live).toBe(0);
    expect(cleaned).toEqual([2, 1]);
    t.log.length = 0;
    e.dispatchEvent(new Event('click'));
    t.sched.flush();
    inst.update({ open: true });
    expect(t.log).toEqual([]);
  });

  it('1,000 mount/destroy cycles retain nothing', async () => {
    const t = setup();
    const e = el();
    for (let i = 0; i < 1000; i++) {
      const inst = t.host.mount(e, t.spec, {});
      e.dispatchEvent(new Event('click'));
      inst.destroy();
    }
    t.sched.flush();
    expect(e.added).toHaveLength(2000);
    expect(e.live).toBe(0);
    expect(t.sched.pending).toBe(0);

    // Heap check where the engine exposes gc.
    const weak: WeakRef<object>[] = [];
    const trackSpec = {
      ...t.spec,
      initial: () => {
        const s = { open: false, count: 0 };
        weak.push(new WeakRef(s));
        return s;
      },
    };
    for (let i = 0; i < 50; i++) t.host.mount(el(), trackSpec, {}).destroy();
    t.sched.flush();
    const v8 = (await import('node:v8' as string)) as { setFlagsFromString(f: string): void };
    const vm = (await import('node:vm' as string)) as { runInNewContext(c: string): () => void };
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');
    await new Promise((r) => setTimeout(r, 0));
    gc();
    expect(weak.filter((w) => w.deref()).length).toBe(0);
  });

  it('host destroy tears down every instance', () => {
    const t = setup();
    const a = el();
    const b = el();
    t.host.mount(a, t.spec, {});
    t.host.mount(b, t.spec, {});
    t.host.destroy();
    expect(a.live + b.live).toBe(0);
  });
});
