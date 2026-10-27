import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createControlled } from '../../controlled/index';
import { createStore } from '../../store/index';
import {
  anyPointerClass,
  createOverlayStack,
  listboxMount,
  type OverlayEl,
  type OverlayEntry,
  type OverlayKind,
  type OverlayOptions,
} from './index';

class El implements OverlayEl {
  isConnected = true;
  calls: string[] = [];
  children: El[] = [];
  cancelPrevented = false;
  focused = 0;
  constructor(readonly name: string) {}
  setAttribute() {}
  removeAttribute() {}
  focus() {
    this.focused++;
  }
  contains(n: unknown): boolean {
    return n === this || this.children.some((c) => c.contains(n));
  }
  dispatchEvent(e: unknown) {
    this.calls.push('cancel');
    return !(this.cancelPrevented || (e as { prevent?: boolean }).prevent);
  }
  close() {
    this.calls.push('close');
  }
  hidePopover() {
    this.calls.push('hidePopover');
  }
  requestClose() {
    this.calls.push('requestClose');
  }
  showModal() {
    this.calls.push('showModal');
  }
  showPopover() {
    this.calls.push('showPopover');
  }
}

const mk = (o: Partial<OverlayOptions> & { popover?: boolean; rc?: boolean } = {}) => {
  const closed: [OverlayEntry, unknown][] = [];
  const stack = createOverlayStack({
    supports: { popover: o.popover ?? true, dialogRequestClose: o.rc ?? true },
    onClose: (e, r) => closed.push([e, r]),
    cancelEvent: () => ({}),
    ...o,
  });
  return { stack, closed };
};
const open = (s: ReturnType<typeof mk>['stack'], el: El, kind: OverlayKind, opener?: El) =>
  s.sync(el, kind, true, { opener });

describe('ADR-005 step 5 rules as fixture dimensions', () => {
  it('1. an auto popover above a modal closes first on Escape (platform order = stack order)', () => {
    const { stack } = mk();
    const dlg = new El('dlg');
    const pop = new El('pop');
    open(stack, dlg, 'modal');
    open(stack, pop, 'auto');
    expect(stack.top?.el).toBe(pop);
    // the native Escape closes pop; the engine only mirrors the toggle event
    expect(stack.escape()).toBeUndefined();
    stack.sync(pop, 'auto', false);
    expect(stack.top?.el).toBe(dlg);
  });

  it('2. nested auto popovers preserve only ancestor chains', () => {
    const { stack, closed } = mk();
    const a = new El('a');
    const b = new El('b');
    const c = new El('c');
    a.children.push(b);
    b.children.push(c);
    const other = new El('other');
    open(stack, a, 'auto');
    open(stack, b, 'auto', a);
    open(stack, c, 'auto', b);
    expect(stack.entries.map((e) => e.parent?.el)).toEqual([undefined, a, b]);
    stack.sync(b, 'auto', false); // closing b removes its descendant c, never its ancestor a
    expect(stack.entries.map((e) => e.el)).toEqual([a]);
    expect(closed.map(([e]) => e.el)).toEqual([c, b]);
    open(stack, other, 'auto'); // unrelated popover: native closes a (toggle follows)
    stack.sync(a, 'auto', false);
    expect(stack.entries.map((e) => e.el)).toEqual([other]);
  });

  it('3. a modal opened from a popover sits above it; Escape order is modal then popover', () => {
    const { stack } = mk({ popover: false }); // engine owns Escape for popovers here
    const pop = new El('pop');
    const dlg = new El('dlg');
    const trigger = new El('trigger');
    pop.children.push(trigger);
    open(stack, pop, 'auto');
    open(stack, dlg, 'modal', trigger);
    expect(stack.entries.map((e) => e.el)).toEqual([pop, dlg]);
    expect(stack.entries[1]!.parent?.el).toBe(pop);
    expect(stack.escape()).toBeUndefined(); // top is a modal: native cancel/close handles it
    stack.sync(dlg, 'modal', false);
    let prevented = 0;
    expect(stack.escape({ preventDefault: () => prevented++ })?.el).toBe(pop);
    expect(prevented).toBe(1);
    expect(stack.entries).toEqual([]);
  });

  it('4. a hint never closes an auto', () => {
    const { stack } = mk({ popover: false });
    const auto = new El('auto');
    const hint = new El('hint');
    open(stack, auto, 'auto');
    open(stack, hint, 'hint');
    expect(stack.escape()?.el).toBe(hint);
    expect(stack.entries.map((e) => e.el)).toEqual([auto]);
    open(stack, hint, 'hint');
    stack.sync(hint, 'hint', false);
    expect(stack.top?.el).toBe(auto);
  });

  it('5. opener reference and stack are synced from toggle/close; sync is idempotent', () => {
    const { stack, closed } = mk();
    const opener = new El('opener');
    const dlg = new El('dlg');
    open(stack, dlg, 'modal', opener);
    open(stack, dlg, 'modal', new El('x'));
    expect(stack.entries).toHaveLength(1);
    expect(stack.entries[0]!.opener).toBe(opener);
    stack.sync(dlg, 'modal', false);
    stack.sync(dlg, 'modal', false);
    expect(closed).toHaveLength(1);
    expect(closed[0]![1]).toBe(opener); // focus returns to the opener
  });
});

describe('focus return', () => {
  it('uses the fallback when the opener is gone, nothing when advanced', () => {
    const fb = new El('fb');
    const { stack, closed } = mk({ fallback: () => fb });
    const op = new El('op');
    const d = new El('d');
    open(stack, d, 'modal', op);
    op.isConnected = false;
    stack.sync(d, 'modal', false);
    expect(closed[0]![1]).toBe(fb);
    open(stack, d, 'modal', op);
    stack.sync(d, 'modal', false, { advanced: true });
    expect(closed[1]![1]).toBeUndefined();
  });
});

describe('close tiers (step 7)', () => {
  const run = (rc: boolean, prevent = false) => {
    const { stack, closed } = mk({ rc });
    const d = new El('d');
    d.cancelPrevented = prevent;
    d.requestClose = rc ? d.requestClose : (undefined as never);
    open(stack, d, 'modal', new El('o'));
    const ok = stack.close(d);
    return { d, ok, closed, stack };
  };
  it('tier 1 uses requestClose()', () => {
    const t = run(true);
    expect(t.d.calls).toEqual(['requestClose']);
    expect(t.ok).toBe(true);
  });
  it('tier 2 dispatches a cancelable cancel then close()', () => {
    const t = run(false);
    expect(t.d.calls).toEqual(['cancel', 'close']);
  });
  it('both tiers reach the one close operation with identical results', () => {
    const a = run(true);
    const b = run(false);
    expect(a.closed.map(([e, r]) => [e.kind, r !== undefined])).toEqual(
      b.closed.map(([e, r]) => [e.kind, r !== undefined]),
    );
    expect(a.stack.entries).toEqual(b.stack.entries);
  });
  it('a prevented cancel keeps the overlay open (tier 2)', () => {
    const t = run(false, true);
    expect(t.ok).toBe(false);
    expect(t.d.calls).toEqual(['cancel']);
    expect(t.stack.entries).toHaveLength(1);
    expect(t.closed).toHaveLength(0);
  });
  it('falls back to requestClose absence when supports flag lies', () => {
    const { stack } = mk({ rc: true });
    const d = new El('d');
    d.requestClose = undefined as never;
    open(stack, d, 'modal');
    stack.close(d);
    expect(d.calls).toEqual(['cancel', 'close']);
  });
});

describe('dismissal (step 6)', () => {
  const doc = () => {
    const l: {
      fn?: (e: { composedPath(): unknown[] }) => void;
      cap?: { capture: boolean; passive?: boolean };
    } = {};
    return {
      l,
      d: {
        addEventListener: (
          _t: 'pointerdown',
          fn: never,
          cap: { capture: boolean; passive?: boolean },
        ) => ((l.fn = fn), (l.cap = cap)),
        removeEventListener: () => (l.fn = undefined),
      },
    };
  };
  it('installs nothing where native light dismiss exists', () => {
    const { stack } = mk({ popover: true });
    const { l, d } = doc();
    stack.install(d)();
    expect(l.fn).toBeUndefined();
  });
  it('installs capture pointerdown where absent, excludes inside/opener, closes outside', () => {
    const { stack } = mk({ popover: false });
    const { l, d } = doc();
    const off = stack.install(d);
    expect(l.cap).toEqual({ capture: true, passive: true });
    const pop = new El('p');
    const op = new El('o');
    const outside = new El('x');
    open(stack, pop, 'auto', op);
    l.fn!({ composedPath: () => [new El('inner'), pop] });
    expect(stack.entries).toHaveLength(1);
    l.fn!({ composedPath: () => [op] });
    expect(stack.entries).toHaveLength(1);
    l.fn!({ composedPath: () => [outside] });
    expect(stack.entries).toHaveLength(0);
    off();
    expect(l.fn).toBeUndefined();
  });
  it('never dismisses modals or manual overlays by pointer', () => {
    const { stack } = mk({ popover: false });
    open(stack, new El('m'), 'modal');
    expect(stack.dismiss([])).toEqual([]);
    expect(stack.entries).toHaveLength(1);
  });
  it('dismisses a nested chain from the top down until a containing entry', () => {
    const { stack } = mk({ popover: false });
    const a = new El('a');
    const b = new El('b');
    a.children.push(b);
    const btn = new El('btn');
    a.children.push(btn);
    open(stack, a, 'auto');
    open(stack, b, 'auto', btn);
    stack.dismiss([a]);
    expect(stack.entries.map((e) => e.el)).toEqual([a]);
  });
});

describe('controlled integration', () => {
  it('reconcile() corrective open effect is applied to the native element', () => {
    const { stack } = mk();
    const d = new El('d');
    stack.register('dlg', d, 'modal');
    const store = createStore<{ open: boolean }, { type: 'set'; v: boolean }>(
      { open: false },
      (s, e) => ({ state: { ...s, open: e.v } }),
    );
    const props = { open: true as boolean | undefined };
    const c = createControlled({
      store,
      getProps: () => props,
      fields: {
        open: {
          prop: 'open',
          native: 'open',
          target: 'dlg',
          toEvent: (v: boolean) => ({ type: 'set', v }),
        },
      },
    } as never);
    c.native('open' as never, false as never);
    const eff = c.reconcile();
    expect(eff).toHaveLength(1);
    stack.apply(eff[0]!, { opener: new El('o') });
    expect(d.calls).toEqual(['showModal']);
    expect(stack.entries).toHaveLength(1);
    stack.apply({ type: 'open', target: 'dlg', value: false });
    expect(d.calls).toEqual(['showModal', 'requestClose']);
    expect(stack.entries).toHaveLength(0);
    stack.apply({ type: 'open', target: 'unknown', value: true });
    stack.apply({ type: 'other', target: 'dlg', value: true });
    expect(d.calls).toHaveLength(2);
  });
});

describe('listboxMount (step 8)', () => {
  const flag = {
    default: 'top-layer',
    byAnyPointer: { fine: 'top-layer', coarse: 'inline' },
  } as const;
  it('keys on the any-pointer class, never the primary pointer', () => {
    const asked: string[] = [];
    expect(anyPointerClass((q) => (asked.push(q), q === '(any-pointer: coarse)'))).toBe('coarse');
    expect(asked).toEqual(['(any-pointer: coarse)']);
    expect(anyPointerClass(() => false)).toBe('fine');
  });
  it('maps class to a DOM-placement value, falling back to the default', () => {
    expect(listboxMount(flag, 'coarse')).toBe('inline');
    expect(listboxMount(flag, 'fine')).toBe('top-layer');
    expect(listboxMount({ default: 'inline' }, 'coarse')).toBe('inline');
  });
});

describe('stack invariants (property)', () => {
  const model = (ops: [number, boolean][]) => {
    const m: number[] = [];
    for (const [i, o] of ops) {
      const at = m.indexOf(i);
      if (o && at < 0) m.push(i);
      if (!o && at >= 0) m.splice(at, 1);
    }
    return m;
  };
  const ops = fc.array(fc.tuple(fc.integer({ min: 0, max: 4 }), fc.boolean()), { maxLength: 40 });
  it('non-nested stack equals the open-order model; each close fires once', () => {
    fc.assert(
      fc.property(ops, (list) => {
        const { stack, closed } = mk();
        const els = [0, 1, 2, 3, 4].map((i) => new El(String(i)));
        for (const [i, o] of list) stack.sync(els[i]!, 'manual', o);
        expect(stack.entries.map((e) => Number((e.el as El).name))).toEqual(model(list));
        const opens = list.filter(([, o]) => o).length;
        expect(closed.length).toBeLessThanOrEqual(opens);
      }),
    );
  });
  it('a seeded wrong model (LIFO swap) is detected', () => {
    const wrong = (l: [number, boolean][]) => model(l).reverse();
    let differs = false;
    fc.assert(
      fc.property(ops, (list) => {
        const { stack } = mk();
        const els = [0, 1, 2, 3, 4].map((i) => new El(String(i)));
        for (const [i, o] of list) stack.sync(els[i]!, 'manual', o);
        if (stack.entries.map((e) => Number((e.el as El).name)).join() !== wrong(list).join())
          differs = true;
      }),
    );
    expect(differs).toBe(true);
  });
});
