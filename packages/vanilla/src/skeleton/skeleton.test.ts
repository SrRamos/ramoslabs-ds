import { createRuntime, createFakeScheduler } from '@ramoslabs/core/runtime';
import { describe, expect, it, vi } from 'vitest';
import { createHost } from '../runtime/index';
import { define, mountSkeleton } from './index';
import { mountState } from '../state/index';

/** Minimal DOM double (no jsdom in the repo). innerHTML-style sinks throw: text nodes only (ADR-002). */
class FakeEl extends EventTarget {
  parent: FakeEl | undefined;
  children: FakeEl[] = [];
  attrs = new Map<string, string>();
  text = '';
  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDoc,
  ) {
    super();
  }
  append(...kids: FakeEl[]): void {
    for (const k of kids) {
      k.remove();
      k.parent = this;
      this.children.push(k);
    }
  }
  replaceChildren(...kids: FakeEl[]): void {
    for (const c of this.children) c.parent = undefined;
    this.children = [];
    this.append(...kids);
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = undefined;
  }
  setAttribute(n: string, v: string): void {
    this.attrs.set(n, v);
  }
  getAttribute(n: string): string | null {
    return this.attrs.get(n) ?? null;
  }
  removeAttribute(n: string): void {
    this.attrs.delete(n);
  }
  hasAttribute(n: string): boolean {
    return this.attrs.has(n);
  }
  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    this.text = v;
  }
  set innerHTML(_: string) {
    throw new Error('innerHTML is forbidden');
  }
  insertAdjacentHTML(): never {
    throw new Error('insertAdjacentHTML is forbidden');
  }
}
class FakeDoc extends EventTarget {
  created = 0;
  createElement(tag: string): FakeEl {
    this.created++;
    return new FakeEl(tag, this);
  }
}

const mk = (doc = new FakeDoc()) => doc.createElement('div');
const asEl = (e: FakeEl) => e as unknown as Element;
const asNode = (e: FakeEl) => e as unknown as Node;

function setup() {
  const said: { role: string; text: string }[] = [];
  const created: string[] = [];
  const sched = createFakeScheduler();
  const host = createHost(
    createRuntime({ target: 'client', scheduler: sched, idFactory: () => 'sk' }),
    {
      allowFakeScheduler: true,
      liveHost: Object.assign(
        {
          create: (role: 'status' | 'alert') => {
            created.push(role);
            return { setText: (text: string) => void (text && said.push({ role, text })) };
          },
        },
        { ensure: vi.fn() },
      ),
    },
  );
  const advance = (ms: number) => {
    sched.advance(ms);
    sched.flush();
    sched.advance(0);
    sched.flush();
  };
  return { host, said, created, sched, advance };
}
const partsOf = (root: FakeEl) => root.children.map((c) => c.getAttribute('data-part'));

describe('SJSkeleton vanilla: shapes', () => {
  it('draw hidden, non-busy shapes with the data hooks and lines', () => {
    const { host } = setup();
    const t = mk();
    mountSkeleton(host, asEl(t), { shape: 'text', lines: 4, classes: { line: 'l' } });
    expect(t.getAttribute('class')).toBe('sj-skeleton');
    expect(t.getAttribute('aria-hidden')).toBe('true');
    expect(t.hasAttribute('aria-busy')).toBe(false);
    expect(t.getAttribute('data-lines')).toBe('4');
    expect(partsOf(t)).toEqual(['line', 'line', 'line', 'line']);
    expect(t.children[0]!.getAttribute('class')).toBe('sj-skeleton__line l');
    const r = mk();
    mountSkeleton(host, asEl(r), { shape: 'rect', ratio: '4/3' });
    expect(r.getAttribute('data-ratio')).toBe('4/3');
    expect(r.children).toHaveLength(0);
  });
  it('update changes the line count and destroy is idempotent', () => {
    const { host } = setup();
    const t = mk();
    const inst = mountSkeleton(host, asEl(t), { shape: 'text', lines: 2 });
    inst.update({ shape: 'text', lines: 5 });
    expect(t.children).toHaveLength(5);
    inst.destroy();
    inst.destroy();
    expect(inst.destroyed).toBe(true);
    expect(t.children).toHaveLength(0);
  });
});

describe('SJSkeleton vanilla: group timing', () => {
  const nodes = (doc: FakeDoc) => ({
    skeleton: asNode(doc.createElement('b')),
    default: asNode(doc.createElement('i')),
  });
  it('pending: busy, placeholder drawn, content absent, nothing announced', () => {
    const { host, said } = setup();
    const root = mk();
    const n = nodes(root.ownerDocument);
    mountSkeleton(host, asEl(root), { shape: 'group', announce: 'Loading', ...n });
    expect(root.getAttribute('data-state')).toBe('pending');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.children).toEqual([n.skeleton]);
    expect(said).toEqual([]);
  });
  it('a load that ends inside the delay never shows and announces nothing', () => {
    const { host, said, advance } = setup();
    const root = mk();
    const n = nodes(root.ownerDocument);
    const p = { shape: 'group' as const, announce: 'Loading', delay: 300, minDuration: 500, ...n };
    const inst = mountSkeleton(host, asEl(root), p);
    advance(299);
    inst.update({ ...p, loading: false });
    expect(root.getAttribute('data-state')).toBe('idle');
    expect(root.hasAttribute('aria-busy')).toBe(false);
    expect(root.children).toEqual([n.default]);
    advance(5000);
    expect(said).toEqual([]);
  });
  it('shows after the delay, announces once, holds the minimum, then swaps', () => {
    const { host, said, created, advance } = setup();
    const root = mk();
    const n = nodes(root.ownerDocument);
    const p = { shape: 'group' as const, announce: 'Loading', delay: 300, minDuration: 500, ...n };
    const inst = mountSkeleton(host, asEl(root), p);
    advance(300);
    expect(root.getAttribute('data-state')).toBe('visible');
    expect(created[0]).toBe('status');
    expect(said).toEqual([{ role: 'status', text: 'Loading' }]);
    advance(100);
    inst.update({ ...p, loading: false });
    expect(root.getAttribute('data-state')).toBe('holding');
    expect(root.children).toEqual([n.skeleton]);
    advance(399);
    expect(root.getAttribute('data-state')).toBe('holding');
    advance(1);
    expect(root.getAttribute('data-state')).toBe('idle');
    expect(root.children).toEqual([n.default]);
    expect(said).toHaveLength(1);
  });
  it('destroy cancels the timers', () => {
    const { host, said, sched, advance } = setup();
    const root = mk();
    const inst = mountSkeleton(host, asEl(root), { shape: 'group', announce: 'x', skeleton: 'sk' });
    inst.destroy();
    advance(5000);
    expect(said).toEqual([]);
    expect(sched.pending).toBe(0);
  });
});

describe('SJSkeleton vanilla: inside SJState and define', () => {
  it('state loading draws the aria-hidden skeleton part, only for the loading variant', () => {
    const { host, said, advance } = setup();
    const root = mk();
    const sk = asNode(root.ownerDocument.createElement('b'));
    const inst = mountState(host, asEl(root), {
      variant: 'loading',
      heading: 'Loading',
      skeleton: sk,
    });
    expect(partsOf(root)).toEqual(['title', 'skeleton']);
    expect(root.children[1]!.getAttribute('aria-hidden')).toBe('true');
    expect(root.children[1]!.children).toEqual([sk]);
    advance(0);
    expect(said).toEqual([{ role: 'status', text: 'Loading' }]);
    inst.update({ variant: 'error', heading: 'Failed', skeleton: sk });
    expect(partsOf(root)).toEqual(['title']);
  });
  it('define registers explicitly and idempotently, never at import', () => {
    const { host } = setup();
    const defined = new Map<string, unknown>();
    const registry = {
      get: (n: string) => defined.get(n),
      define: (n: string, c: unknown) => void defined.set(n, c),
    };
    (globalThis as { HTMLElement?: unknown }).HTMLElement ??= class {};
    define(host, 'sj-skeleton', registry as never);
    define(host, 'sj-skeleton', registry as never);
    expect(defined.size).toBe(1);
  });
});
