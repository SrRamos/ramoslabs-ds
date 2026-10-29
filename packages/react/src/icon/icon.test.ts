import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, createRef, StrictMode, act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { SJProvider } from '../runtime/index';
import { SJIcon, SJIconRoot } from './index';
import * as flat from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const star = { name: 'star', nodes: [['path', { d: 'M1 1' }]] } as const;
const arrow = {
  name: 'arrow-right',
  mirror: true,
  nodes: [
    ['path', { d: 'M2 2' }],
    ['circle', { cx: 1, cy: 2, r: 3 }],
  ],
} as const;

const mounted: ReactTestRenderer[] = [];
function mount(el: unknown) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el as never, { createNodeMock: () => ({}) });
  });
  mounted.push(r);
  return r;
}
afterEach(() => {
  while (mounted.length) {
    const r = mounted.pop()!;
    act(() => r.unmount());
  }
  vi.restoreAllMocks();
});
const svg = (r: ReactTestRenderer) => r.root.findByType('svg' as never);
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('naming (ADR-002)', () => {
  it('namespace plus flat exports share the same primitive', () => {
    expect(SJIcon.Root).toBe(SJIconRoot);
    expect(Object.keys(flat).sort()).toEqual(['SJIcon', 'SJIconRoot']);
  });
});

describe('rendering', () => {
  it('decorative by default: aria-hidden, no role, no label, React prop names', () => {
    const p = svg(mount(h(SJIcon, { icon: star }))).props;
    expect(p).toMatchObject({
      className: 'sj-icon',
      'data-part': 'root',
      'data-size': 'md',
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    });
    for (const k of ['role', 'aria-label', 'tabIndex', 'stroke-linecap', 'class'])
      expect(k in p).toBe(false);
  });
  it('labelled: role=img and aria-label, no aria-hidden', () => {
    const p = svg(mount(h(SJIcon, { icon: star, label: 'Search' }))).props;
    expect(p.role).toBe('img');
    expect(p['aria-label']).toBe('Search');
    expect('aria-hidden' in p).toBe(false);
  });
  it('sizes: known pass, unknown falls back to md', () => {
    for (const s of ['sm', 'md', 'lg', 'fit'])
      expect(svg(mount(h(SJIcon, { icon: star, size: s as 'sm' }))).props['data-size']).toBe(s);
    expect(svg(mount(h(SJIcon, { icon: star, size: 'xl' as never }))).props['data-size']).toBe(
      'md',
    );
  });
  it('children are created elements from the nodes, without ids', () => {
    const html = renderToStaticMarkup(h(SJIcon, { icon: arrow }));
    expect(html).toContain('<path d="M2 2"></path>');
    expect(html).toContain('<circle cx="1" cy="2" r="3"></circle>');
    expect(html).not.toMatch(/\sid=/);
  });
  it('an attribute with a hyphen becomes its React prop (stroke-width -> strokeWidth)', () => {
    const html = renderToStaticMarkup(
      h(SJIcon, { icon: star, 'stroke-width': 3, strokeDasharray: '1' } as never),
    );
    expect(html).toContain('stroke-width="3"');
    expect(html).toContain('stroke-dasharray="1"');
  });
  it('allowlist: unknown tags and attributes are dropped', () => {
    spyWarn();
    const icon = {
      nodes: [
        ['script', { d: 'x' }],
        ['path', { d: 'M1', onload: 'x()', href: 'javascript:1', style: 'a', id: 'i' }],
      ],
    } as never;
    const html = renderToStaticMarkup(h(SJIcon, { icon }));
    expect(html).toContain('<path d="M1"></path>');
    expect(html).not.toMatch(/script|onload|href|style=|id=/);
  });
  it('className, classes.root and native attributes merge; protected keys win', () => {
    spyWarn();
    const p = svg(
      mount(
        h(SJIcon, {
          icon: star,
          label: 'A',
          className: 'a',
          classes: { root: 'r' },
          'data-testid': 't',
          role: 'button',
          'aria-hidden': true,
          width: 9,
          tabIndex: 0,
        } as never),
      ),
    ).props;
    expect(p.className).toBe('sj-icon r a');
    expect(p['data-testid']).toBe('t');
    expect(p.role).toBe('img');
    expect(p.width).toBe('1em');
    expect('aria-hidden' in p).toBe(false);
    expect(p.tabIndex).toBeUndefined();
  });
  it('forwardRef reaches the svg, for the primitive and the preset', () => {
    const ref = createRef<SVGSVGElement>();
    const root = createRef<SVGSVGElement>();
    mount(h(SJIcon, { icon: star, ref }));
    mount(h(SJIconRoot, { icon: star, ref: root }));
    expect(ref.current).not.toBeNull();
    expect(root.current).not.toBeNull();
  });
  it('missing icon renders an empty svg with a dev warning', () => {
    const warn = spyWarn();
    expect(renderToStaticMarkup(h(SJIcon, {} as never))).toMatch(/<svg[^>]*><\/svg>/);
    expect(warn).toHaveBeenCalled();
  });
  it('source never uses innerHTML and never imports @ramoslabs/icons', async () => {
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const fs = (await mod('node:fs')) as { readFileSync(u: URL, e: string): string };
    const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(src.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(
      /\binnerHTML|outerHTML|insertAdjacentHTML|@ramoslabs\/icons/,
    );
  });
});

describe('RTL mirror and runtime (G-ICON SHOULD-2)', () => {
  it('mirrors only a mirrored icon in rtl: dir prop, or the provider runtime', () => {
    const mirrored = (el: unknown) => 'data-mirror' in svg(mount(el)).props;
    expect(mirrored(h(SJIcon, { icon: arrow, dir: 'rtl' }))).toBe(true);
    expect(mirrored(h(SJIcon, { icon: arrow, dir: 'ltr' }))).toBe(false);
    expect(mirrored(h(SJIcon, { icon: star, dir: 'rtl' }))).toBe(false);
    expect(mirrored(h(SJProvider, { dir: 'rtl' }, h(SJIcon, { icon: arrow })))).toBe(true);
    expect(mirrored(h(SJProvider, { dir: 'rtl' }, h(SJIcon, { icon: star })))).toBe(false);
    expect(mirrored(h(SJProvider, { dir: 'rtl' }, h(SJIcon, { icon: arrow, dir: 'ltr' })))).toBe(
      false,
    );
  });
  it('outside a provider: no warning for a non-mirrored icon, 1,000 renders', () => {
    const warn = spyWarn();
    for (let i = 0; i < 1000; i++) renderToStaticMarkup(h(SJIcon, { icon: star }));
    mount(h(SJIcon, { icon: star }));
    expect(warn).not.toHaveBeenCalled();
  });
  it('outside a provider a mirrored icon renders ltr; with dir it does not warn', () => {
    const warn = spyWarn();
    mount(h(SJIcon, { icon: arrow, dir: 'rtl' }));
    expect(warn).not.toHaveBeenCalled();
    expect('data-mirror' in svg(mount(h(SJIcon, { icon: arrow }))).props).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    mount(h(SJProvider, null, h(SJIcon, { icon: arrow })));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('orphan warning cases', () => {
  it('explicit dir (ltr or rtl) never warns, even outside a provider', () => {
    const warn = spyWarn();
    mount(h(SJIcon, { icon: arrow, dir: 'ltr' }));
    mount(h(SJIcon, { icon: arrow, dir: 'rtl' }));
    expect(warn).not.toHaveBeenCalled();
  });
  it('a mirrored icon without dir outside a provider warns once in dev, never in production', () => {
    const warn = spyWarn();
    const r = mount(h(SJIcon, { icon: arrow }));
    act(() => r.update(h(SJIcon, { icon: arrow, size: 'lg' }) as never));
    expect(warn).toHaveBeenCalledTimes(1);
    vi.stubEnv('NODE_ENV', 'production');
    mount(h(SJIcon, { icon: arrow }));
    vi.unstubAllEnvs();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('SSR and StrictMode', () => {
  it('server markup is deterministic, id-free and stable across roots and providers', () => {
    const el = (prefix?: string) =>
      h(
        SJProvider,
        { dir: 'rtl', ...(prefix && { idPrefix: prefix }) },
        h(SJIcon, { icon: arrow, label: 'Next', size: 'lg' }),
      );
    const a = renderToString(el());
    expect(renderToString(el())).toBe(a);
    expect(renderToString(el('other'))).toBe(a);
    expect(renderToStaticMarkup(el())).toBe(a.replace(/<!-- -->/g, ''));
    expect(a).not.toMatch(/\sid=/);
    expect(a).toContain('data-mirror="true"');
  });
  it('server attributes equal the client props', () => {
    const el = h(SJIcon, { icon: arrow, label: 'Next', dir: 'rtl' });
    const html = renderToStaticMarkup(el);
    const props = svg(mount(el)).props as Record<string, unknown>;
    for (const [k, v] of Object.entries(props)) {
      if (k === 'children' || k === 'ref' || v === undefined || v === null) continue;
      const attr =
        k === 'className'
          ? 'class'
          : k === 'viewBox'
            ? k
            : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(html).toContain(`${attr}="${String(v)}"`);
    }
  });
  it('StrictMode renders one svg and the orphan warning fires once', () => {
    const warn = spyWarn();
    const r = mount(h(StrictMode, null, h(SJIcon, { icon: arrow })));
    expect(r.root.findAllByType('svg' as never)).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('retention (ADR-011)', () => {
  it('1,000 StrictMode mount/unmount cycles retain nothing', async () => {
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const v8 = (await mod('node:v8')) as { setFlagsFromString(f: string): void };
    const vm = (await mod('node:vm')) as { runInNewContext(c: string): () => void };
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 1000; i++) {
      const payload = { i };
      refs.push(new WeakRef(payload));
      let r!: ReactTestRenderer;
      act(() => {
        r = create(
          h(StrictMode, null, h(SJIcon, { icon: star, label: 'x', ref: () => payload.i } as never)),
        );
      });
      act(() => r.unmount());
    }
    await new Promise((res) => setTimeout(res, 0));
    gc();
    await new Promise((res) => setTimeout(res, 0));
    gc();
    expect(refs.filter((w) => w.deref() !== undefined).length).toBeLessThanOrEqual(2);
  }, 60_000);
});
