import { createRuntime } from '@ramoslabs/core/runtime';
import { describe, expect, it, vi } from 'vitest';
import { createHost } from '../runtime/index';
import { defineSJIcon, mountIcon } from './index';

// Node has no DOM (ADR-002: jsdom-free). The double covers what the adapter touches.
class FEl extends EventTarget {
  attrs = new Map<string, string>();
  kids: FEl[] = [];
  parent: FEl | null = null;
  constructor(
    public localName: string,
    public ownerDocument: FDoc,
    public ns: string | null = null,
  ) {
    super();
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  get firstChild() {
    return this.kids[0] ?? null;
  }
  appendChild(n: FEl) {
    n.parent?.removeChild(n);
    n.parent = this;
    this.kids.push(n);
    return n;
  }
  removeChild(n: FEl) {
    this.kids = this.kids.filter((k) => k !== n);
    n.parent = null;
  }
  replaceChildren(...n: FEl[]) {
    for (const k of this.kids) k.parent = null;
    this.kids = [];
    for (const x of n) this.appendChild(x);
  }
  remove() {
    this.parent?.removeChild(this);
  }
}
class FDoc {
  created: FEl[] = [];
  createElementNS(ns: string, n: string) {
    const e = new FEl(n, this, ns);
    this.created.push(e);
    return e;
  }
}
const setup = (dir: 'ltr' | 'rtl' = 'ltr') => {
  const doc = new FDoc();
  const container = new FEl('div', doc);
  const host = createHost(createRuntime({ target: 'client', dir, idFactory: () => 'id1' }));
  return { doc, container, host };
};
const svgOf = (c: FEl) => c.kids[0]!;
const search = {
  name: 'search',
  nodes: [
    ['circle', { cx: 11, cy: 11, r: 8 }],
    ['path', { d: 'm21 21-4.3-4.3' }],
  ],
} as const;
const arrow = { name: 'arrow-right', mirror: true, nodes: [['path', { d: 'M5 12h14' }]] } as const;
const nodesOf = (s: FEl) => s.kids.map((k) => [k.localName, Object.fromEntries(k.attrs)]);

describe('SJIcon vanilla: rendering', () => {
  it('is decorative without a label: svg in the SVG namespace, aria-hidden, no role', () => {
    const { container, host } = setup();
    mountIcon(host, container as never, { icon: search });
    const s = svgOf(container);
    expect(s.localName).toBe('svg');
    expect(s.ns).toBe('http://www.w3.org/2000/svg');
    expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(s.hasAttribute('role')).toBe(false);
    expect(s.hasAttribute('aria-label')).toBe(false);
    expect(s.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(s.getAttribute('stroke')).toBe('currentColor');
    expect(s.hasAttribute('id')).toBe(false);
    expect(s.kids.every((k) => k.ns === 'http://www.w3.org/2000/svg')).toBe(true);
    expect(nodesOf(s)).toEqual([
      ['circle', { cx: '11', cy: '11', r: '8' }],
      ['path', { d: 'm21 21-4.3-4.3' }],
    ]);
  });

  it('is labelled with role=img and aria-label, without aria-hidden', () => {
    const { container, host } = setup();
    const m = mountIcon(host, container as never, { icon: search, label: 'Search' });
    const s = svgOf(container);
    expect(s.getAttribute('role')).toBe('img');
    expect(s.getAttribute('aria-label')).toBe('Search');
    expect(s.hasAttribute('aria-hidden')).toBe(false);
    m.update({ icon: search });
    expect(s.hasAttribute('role')).toBe(false);
    expect(s.getAttribute('aria-hidden')).toBe('true');
  });

  it('maps sizes to data-size and falls back to md', () => {
    const { container, host } = setup();
    const m = mountIcon(host, container as never, { icon: search, size: 'sm' });
    const s = svgOf(container);
    for (const [size, want] of [
      ['sm', 'sm'],
      ['lg', 'lg'],
      ['fit', 'fit'],
      [undefined, 'md'],
      ['xl', 'md'],
    ] as const) {
      m.update({ icon: search, size: size as never });
      expect(s.getAttribute('data-size')).toBe(want);
    }
  });

  it('mirrors a directional icon only in rtl: explicit dir, else the runtime dir', () => {
    const rtl = setup('rtl');
    mountIcon(rtl.host, rtl.container as never, { icon: arrow });
    expect(svgOf(rtl.container).getAttribute('data-mirror')).toBe('true');
    const ltr = setup('rtl');
    mountIcon(ltr.host, ltr.container as never, { icon: arrow, dir: 'ltr' });
    expect(svgOf(ltr.container).hasAttribute('data-mirror')).toBe(false);
    const plain = setup('rtl');
    mountIcon(plain.host, plain.container as never, { icon: search });
    expect(svgOf(plain.container).hasAttribute('data-mirror')).toBe(false);
    const ltrHost = setup('ltr');
    mountIcon(ltrHost.host, ltrHost.container as never, { icon: arrow });
    expect(svgOf(ltrHost.container).hasAttribute('data-mirror')).toBe(false);
  });

  it('respects the allowlist: forbidden tags and attributes are never created', () => {
    const { doc, container, host } = setup();
    const evil = {
      nodes: [
        ['script', { d: 'x' }],
        ['foreignObject', {}],
        [
          'path',
          { d: 'M0 0', onload: 'alert(1)', id: 'a', style: 'x', href: 'javascript:1', class: 'c' },
        ],
      ],
    } as never;
    mountIcon(host, container as never, { icon: evil });
    const s = svgOf(container);
    expect(nodesOf(s)).toEqual([['path', { d: 'M0 0' }]]);
    expect(doc.created.map((e) => e.localName).sort()).toEqual(['path', 'svg']);
  });

  it('a consumer attrs bag merges class but cannot override protected attributes', () => {
    const { container, host } = setup();
    mountIcon(host, container as never, {
      icon: search,
      attrs: {
        class: 'mine',
        role: 'button',
        tabindex: '0',
        'aria-hidden': 'false',
        'data-x': '1',
      },
    });
    const s = svgOf(container);
    expect(s.getAttribute('class')).toContain('sj-icon');
    expect(s.getAttribute('class')).toContain('mine');
    expect(s.hasAttribute('role')).toBe(false);
    expect(s.hasAttribute('tabindex')).toBe(false);
    expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(s.getAttribute('data-x')).toBe('1');
  });

  it('renders an empty svg for a missing icon', () => {
    const { container, host } = setup();
    mountIcon(host, container as never, {});
    expect(svgOf(container).kids).toHaveLength(0);
  });
});

describe('SJIcon vanilla: update and destroy', () => {
  it('replaces children only when the icon changes, and keeps the same svg', () => {
    const { doc, container, host } = setup();
    const m = mountIcon(host, container as never, { icon: search });
    const s = svgOf(container);
    const kids = [...s.kids];
    const made = doc.created.length;
    m.update({ icon: search, label: 'Find', size: 'lg' });
    expect(svgOf(container)).toBe(s);
    expect(s.kids).toEqual(kids);
    expect(s.kids.every((k, i) => k === kids[i])).toBe(true);
    expect(doc.created.length).toBe(made);
    m.update({ icon: arrow });
    expect(nodesOf(s)).toEqual([['path', { d: 'M5 12h14' }]]);
    expect(m.element()).toBe(s);
  });

  it('destroy removes the svg, is idempotent, and later updates are no-ops', () => {
    const { container, host } = setup();
    const m = mountIcon(host, container as never, { icon: search });
    m.destroy();
    m.destroy();
    expect(container.kids).toHaveLength(0);
    expect(m.element()).toBeNull();
    m.update({ icon: arrow });
    expect(container.kids).toHaveLength(0);
  });

  it('1,000 mount/update/destroy cycles retain nothing', () => {
    const { container, host } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 1000; i++) {
      const m = mountIcon(host, container as never, { icon: i % 2 ? arrow : search });
      m.update({ icon: arrow, label: 'x' });
      m.destroy();
    }
    expect(container.kids).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    host.destroy();
  });

  it('source never uses innerHTML/outerHTML/insertAdjacentHTML/attachShadow/attachInternals', async () => {
    // @ts-expect-error node types are not loaded in this package (types: [])
    const { readFileSync } = (await import('node:fs')) as {
      readFileSync(u: URL, e: string): string;
    };
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8').replace(
      /\/\/.*$/gm,
      '',
    );
    expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|attachShadow|attachInternals/);
    expect(src).not.toMatch(/@ramoslabs\/icons/);
  });
});

describe('sj-icon element', () => {
  const fakeRegistry = () => {
    const map = new Map<string, unknown>();
    return {
      map,
      get: (n: string) => map.get(n),
      define: (n: string, c: unknown) => void map.set(n, c),
    };
  };
  type El = FEl & {
    icon: unknown;
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(a: string): void;
  };
  const withBase = <T>(doc: FDoc, fn: () => T): T => {
    class Base extends FEl {
      constructor() {
        super('sj-icon', doc);
      }
    }
    (globalThis as { HTMLElement?: unknown }).HTMLElement = Base;
    try {
      return fn();
    } finally {
      delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
    }
  };

  it('importing registers nothing; define is idempotent and returns false when taken', () => {
    expect((globalThis as { customElements?: unknown }).customElements).toBeUndefined();
    const { doc } = setup();
    withBase(doc, () => {
      const reg = fakeRegistry();
      expect(defineSJIcon({ registry: reg })).toBe(true);
      expect(defineSJIcon({ registry: reg })).toBe(false);
      expect(reg.map.has('sj-icon')).toBe(true);
      expect(defineSJIcon({ registry: reg, name: 'x-icon' })).toBe(true);
    });
  });

  it('resolves the icon attribute by name from the closure map; the property takes data', () => {
    const { doc, host } = setup();
    withBase(doc, () => {
      const reg = fakeRegistry();
      defineSJIcon({ registry: reg, host, icons: { search, find: search, 'arrow-right': arrow } });
      const Ctor = reg.map.get('sj-icon') as new () => El;
      const el = new Ctor();
      el.setAttribute('icon', 'find');
      el.setAttribute('label', 'Find');
      el.setAttribute('size', 'lg');
      el.connectedCallback();
      const s = svgOf(el);
      expect(s.getAttribute('role')).toBe('img');
      expect(s.getAttribute('data-size')).toBe('lg');
      expect(s.kids).toHaveLength(2);

      el.icon = arrow;
      expect(el.icon).toBe(arrow);
      expect(svgOf(el)).toBe(s);
      expect(s.kids).toHaveLength(1);

      el.setAttribute('icon', 'search'); // an attribute change drops the property override
      el.attributeChangedCallback('icon');
      expect(s.kids).toHaveLength(2);
      el.setAttribute('dir', 'rtl');
      el.setAttribute('icon', 'arrow-right');
      el.attributeChangedCallback('icon');
      expect(s.getAttribute('data-mirror')).toBe('true');
      el.disconnectedCallback();
      expect(el.kids).toHaveLength(0);
    });
  });

  it('accepts a list of named icon data, and an unknown name renders an empty svg', () => {
    const { doc, host } = setup();
    withBase(doc, () => {
      const reg = fakeRegistry();
      defineSJIcon({ registry: reg, host, icons: [search, arrow] });
      const Ctor = reg.map.get('sj-icon') as new () => El;
      const el = new Ctor();
      el.setAttribute('icon', 'arrow-right');
      el.connectedCallback();
      expect(svgOf(el).kids).toHaveLength(1);
      el.setAttribute('icon', 'nope');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      el.attributeChangedCallback('icon');
      warn.mockRestore();
      expect(svgOf(el).kids).toHaveLength(0);
      el.disconnectedCallback();
    });
  });

  it('keeps no name state at module scope: two closures resolve independently', () => {
    const { doc, host } = setup();
    withBase(doc, () => {
      const a = fakeRegistry();
      const b = fakeRegistry();
      defineSJIcon({ registry: a, host, icons: { x: search } });
      defineSJIcon({ registry: b, host, icons: { x: arrow } });
      const A = new (a.map.get('sj-icon') as new () => El)();
      const B = new (b.map.get('sj-icon') as new () => El)();
      A.setAttribute('icon', 'x');
      B.setAttribute('icon', 'x');
      expect(A.icon).toBe(search);
      expect(B.icon).toBe(arrow);
    });
  });
});
