import { createRuntime } from '@ramoslabs/core/runtime';
import { stateLive } from '../generated/state/index';
import { describe, expect, it, vi } from 'vitest';
import { createHost } from '../runtime/index';
import { define, mountState } from './index';

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
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function setup() {
  const said: { role: string; text: string }[] = [];
  const ensure = vi.fn();
  const created: string[] = [];
  let n = 0;
  const host = createHost(createRuntime({ target: 'client', idFactory: () => `st${n++}` }), {
    liveHost: Object.assign(
      {
        create: (role: 'status' | 'alert') => {
          created.push(role);
          return {
            setText: (text: string) => {
              if (text) said.push({ role, text });
            },
          };
        },
      },
      { ensure },
    ),
  });
  return { host, said, ensure, created };
}
const partsOf = (root: FakeEl) => root.children.map((c) => c.getAttribute('data-part'));
const VARIANTS = ['first-use', 'no-results', 'cleared', 'loading', 'error'] as const;

describe('SJState vanilla: rendering', () => {
  it('builds only the parts that have content, in anatomy order, as text nodes', () => {
    const { host } = setup();
    const root = mk();
    mountState(host, asEl(root), { heading: '<b>No projects</b>', description: 'Create one' });
    expect(root.getAttribute('class')).toBe('sj-state');
    expect(root.getAttribute('data-part')).toBe('root');
    expect(partsOf(root)).toEqual(['title', 'description']);
    expect(root.textContent).toBe('<b>No projects</b>Create one'); // literal text, never parsed
    expect(root.children.some((c) => c.children.length)).toBe(false);
  });

  it('renders each part as the element the contract anatomy names', () => {
    const { host } = setup();
    const root = mk();
    mountState(host, asEl(root), { heading: 'h', description: 'd', icon: 'i', actions: 'a' });
    expect(root.children.map((c) => [c.getAttribute('data-part'), c.tagName])).toEqual([
      ['icon', 'span'],
      ['title', 'p'],
      ['description', 'p'],
      ['actions', 'div'],
    ]);
  });

  it('accepts icon, title, default and actions as slots (string or Node); slots win over props', () => {
    const { host } = setup();
    const root = mk();
    const doc = root.ownerDocument;
    const glyph = doc.createElement('svg');
    const button = doc.createElement('button');
    mountState(host, asEl(root), {
      heading: 'prop heading',
      title: 'Slot heading',
      description: 'prop copy',
      default: 'Slot copy',
      icon: glyph as unknown as Node,
      actions: button as unknown as Node,
    });
    expect(partsOf(root)).toEqual(['icon', 'title', 'description', 'actions']);
    const [icon, title, desc, actions] = root.children as [FakeEl, FakeEl, FakeEl, FakeEl];
    expect(icon.children).toEqual([glyph]);
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(title.textContent).toBe('Slot heading');
    expect(desc.textContent).toBe('Slot copy');
    expect(actions.children).toEqual([button]);
  });

  it('does not read `title` from any attribute and keeps no title attribute on the DOM', () => {
    const { host } = setup();
    const root = mk();
    root.setAttribute('title', 'tooltip text');
    mountState(host, asEl(root), { heading: 'Nothing here' });
    expect(partsOf(root)).toEqual(['title']);
    expect(root.children[0]!.textContent).toBe('Nothing here');
    expect(root.children[0]!.hasAttribute('title')).toBe(false);
  });

  it.each(VARIANTS)('variant %s: every part carries data-variant and the text is rendered', (v) => {
    const { host } = setup();
    const root = mk();
    mountState(host, asEl(root), {
      variant: v,
      heading: `h-${v}`,
      description: 'd',
      icon: 'i',
      actions: 'a',
    });
    expect(root.getAttribute('data-variant')).toBe(v);
    for (const c of root.children) expect(c.getAttribute('data-variant')).toBe(v);
    // no color-only meaning: the kind always renders its copy
    expect(root.children[1]!.textContent).toBe(`h-${v}`);
    expect(root.getAttribute('aria-busy')).toBe(v === 'loading' ? 'true' : null);
  });

  it('the three empty kinds are distinct variants and an unknown value falls back to first-use', () => {
    const { host } = setup();
    const seen = new Set<string | null>();
    for (const v of ['first-use', 'no-results', 'cleared'] as const) {
      const root = mk();
      mountState(host, asEl(root), { variant: v, heading: 'x' });
      seen.add(root.getAttribute('data-variant'));
    }
    expect(seen.size).toBe(3);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bad = mk();
    mountState(host, asEl(bad), { variant: 'bogus' as never, heading: 'x' });
    expect(bad.getAttribute('data-variant')).toBe('first-use');
  });

  it('classes override per part; the library class and data-part are kept', () => {
    const { host } = setup();
    const root = mk();
    mountState(host, asEl(root), {
      heading: 'h',
      icon: 'i',
      classes: { root: 'mine-root', title: 'mine-title', icon: 'mine-icon' },
    });
    expect(root.getAttribute('class')).toBe('sj-state mine-root');
    const [icon, title] = root.children as [FakeEl, FakeEl];
    expect(icon.getAttribute('class')).toContain('mine-icon');
    expect(title.getAttribute('class')).toContain('sj-state__title');
    expect(title.getAttribute('class')).toContain('mine-title');
    expect(title.getAttribute('data-part')).toBe('title');
  });
});

describe('SJState vanilla: no live markup in the rendered output (SSR-safe)', () => {
  it.each(VARIANTS)('variant %s: no role, aria-live or aria-atomic on any part', (v) => {
    const { host } = setup();
    const root = mk();
    mountState(host, asEl(root), {
      variant: v,
      heading: 'h',
      description: 'd',
      icon: 'i',
      actions: 'a',
      announce: 'said',
      interrupt: true,
    });
    for (const el of [root, ...root.children])
      for (const a of ['role', 'aria-live', 'aria-atomic']) expect(el.hasAttribute(a)).toBe(false);
  });
});

describe('SJState vanilla: announcements (ADR-006)', () => {
  it('uses the generated eager constant and asks the host for its region at mount', () => {
    expect(stateLive).toBe('eager');
    const { host, ensure } = setup();
    mountState(host, asEl(mk()), { variant: 'first-use', heading: 'h' });
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it('loading and no-results announce the heading politely; first-use and cleared are silent', async () => {
    const { host, said } = setup();
    for (const v of ['first-use', 'cleared'] as const)
      mountState(host, asEl(mk()), { variant: v, heading: `quiet-${v}` });
    await tick();
    expect(said).toEqual([]);
    mountState(host, asEl(mk()), { variant: 'loading', heading: 'Loading projects' });
    await tick();
    mountState(host, asEl(mk()), { variant: 'no-results', heading: '0 results' });
    await tick();
    expect(said).toEqual([
      { role: 'status', text: 'Loading projects' },
      { role: 'status', text: '0 results' },
    ]);
  });

  it('alert only for an error that interrupts; a plain error stays polite', async () => {
    const { host, said, created } = setup();
    mountState(host, asEl(mk()), { variant: 'error', heading: 'Quiet failure' });
    await tick();
    mountState(host, asEl(mk()), { variant: 'error', heading: 'Save failed', interrupt: true });
    await tick();
    mountState(host, asEl(mk()), { variant: 'loading', heading: 'Loading', interrupt: true });
    await tick();
    expect(said.map((s) => s.role)).toEqual(['status', 'alert', 'status']);
    expect(created).toContain('alert');
  });

  it('announces once per change, not once per update, and follows the title slot', async () => {
    const { host, said } = setup();
    const root = mk();
    const inst = mountState(host, asEl(root), { variant: 'loading', title: 'Loading' });
    await tick();
    inst.update({ variant: 'loading', title: 'Loading', description: 'still' });
    inst.update({ variant: 'loading', title: 'Loading', description: 'again' });
    await tick();
    expect(said).toEqual([{ role: 'status', text: 'Loading' }]);
    inst.update({ variant: 'no-results', title: '3 results' });
    await tick();
    expect(said.at(-1)).toEqual({ role: 'status', text: '3 results' });
    expect(said).toHaveLength(2);
  });

  it('an explicit announce on a static variant is honoured', async () => {
    const { host, said } = setup();
    mountState(host, asEl(mk()), {
      variant: 'cleared',
      heading: 'Cleared',
      announce: 'List cleared',
    });
    await tick();
    expect(said).toEqual([{ role: 'status', text: 'List cleared' }]);
  });
});

describe('SJState vanilla: update and destroy', () => {
  it('update patches in place: same elements, parts added and removed, stale attributes dropped', () => {
    const { host } = setup();
    const root = mk();
    const inst = mountState(host, asEl(root), { variant: 'loading', heading: 'h' });
    const title = root.children[0]!;
    expect(root.getAttribute('aria-busy')).toBe('true');
    inst.update({ variant: 'error', heading: 'h2', actions: 'Retry' });
    expect(root.children[0]).toBe(title);
    expect(partsOf(root)).toEqual(['title', 'actions']);
    expect(title.textContent).toBe('h2');
    expect(title.getAttribute('data-variant')).toBe('error');
    expect(root.hasAttribute('aria-busy')).toBe(false);
    inst.update({ variant: 'error', heading: 'h2' });
    expect(partsOf(root)).toEqual(['title']);
    expect(Object.keys(inst.parts())).toEqual(['title']);
  });

  it('does not recreate elements when nothing structural changes', () => {
    const { host } = setup();
    const root = mk();
    const inst = mountState(host, asEl(root), { heading: 'h', description: 'd' });
    const made = root.ownerDocument.created;
    inst.update({ heading: 'h', description: 'd2' });
    expect(root.ownerDocument.created).toBe(made);
  });

  it('destroy removes the parts, is idempotent, ignores later updates and registers no listener', () => {
    const { host } = setup();
    const root = mk();
    const inst = mountState(host, asEl(root), { heading: 'h', icon: 'i' });
    inst.destroy();
    expect(root.children).toEqual([]);
    expect(inst.destroyed).toBe(true);
    expect(inst.parts()).toEqual({});
    inst.destroy();
    inst.update({ heading: 'again' });
    expect(root.children).toEqual([]);
  });

  it('1,000 mount/destroy cycles leave nothing behind', () => {
    const { host } = setup();
    const root = mk();
    for (let i = 0; i < 1000; i++) {
      const inst = mountState(host, asEl(root), {
        variant: 'loading',
        heading: `h${i}`,
        icon: 'i',
        actions: 'a',
      });
      inst.destroy();
    }
    expect(root.children).toEqual([]);
    expect(root.parent).toBeUndefined();
  });
});

describe('SJState vanilla: define()', () => {
  class FakeRegistry {
    map = new Map<string, unknown>();
    get(n: string) {
      return this.map.get(n);
    }
    define(n: string, c: unknown) {
      this.map.set(n, c);
    }
  }

  it('registers nothing at import and define is explicit and idempotent', () => {
    const { host } = setup();
    vi.stubGlobal('HTMLElement', class extends FakeEl {});
    const reg = new FakeRegistry();
    expect(reg.map.size).toBe(0);
    define(host, 'sj-state', reg as never);
    define(host, 'sj-state', reg as never);
    expect(reg.map.size).toBe(1);
    const ctor = reg.get('sj-state') as { observedAttributes: string[] };
    expect(ctor.observedAttributes).toEqual([
      'variant',
      'heading',
      'description',
      'announce',
      'interrupt',
    ]);
    expect(ctor.observedAttributes).not.toContain('title');
    vi.unstubAllGlobals();
  });

  it('the element mounts on connect, ignores the title attribute, and cleans up on disconnect', () => {
    const { host } = setup();
    vi.stubGlobal('HTMLElement', class extends FakeEl {});
    const reg = new FakeRegistry();
    define(host, 'sj-state', reg as never);
    const Ctor = reg.get('sj-state') as new (
      t: string,
      d: FakeDoc,
    ) => FakeEl & {
      connectedCallback(): void;
      disconnectedCallback(): void;
      attributeChangedCallback(): void;
    };
    const el = new Ctor('sj-state', new FakeDoc());
    el.setAttribute('variant', 'no-results');
    el.setAttribute('heading', 'No matches');
    el.setAttribute('title', 'ignored tooltip');
    el.connectedCallback();
    expect(el.children).toHaveLength(1);
    const inner = el.children[0]!;
    expect(inner.getAttribute('data-variant')).toBe('no-results');
    expect(inner.textContent).toBe('No matches');
    el.setAttribute('heading', 'Still none');
    el.attributeChangedCallback();
    expect(inner.textContent).toBe('Still none');
    el.disconnectedCallback();
    expect(el.children).toEqual([]);
    expect(inner.children).toEqual([]);
    vi.unstubAllGlobals();
  });
});
