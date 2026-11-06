import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, createRef, StrictMode, act, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createFakeScheduler, type FakeScheduler } from '@ramoslabs/core/runtime';
import type { LiveHost, LiveNode, LiveRole } from '@ramoslabs/core/live';
import { SJProvider } from '../runtime/index';
import { SJState, SJStateRoot } from './index';
import * as flat from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class Host implements LiveHost {
  created: LiveRole[] = [];
  ensured = 0;
  said: Array<{ role: LiveRole; text: string }> = [];
  create(role: LiveRole): LiveNode {
    this.created.push(role);
    return { setText: (t) => void (t && this.said.push({ role, text: t })) };
  }
  ensure() {
    this.ensured++;
  }
}

const mounted: ReactTestRenderer[] = [];
function mount(el: unknown) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el as never);
  });
  mounted.push(r);
  return r;
}
beforeAll(() => {
  const orig = console.error;
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    if (String(a[0]).includes('react-test-renderer is deprecated')) return;
    orig(...a);
  });
});
afterEach(() => {
  while (mounted.length) act(() => mounted.pop()!.unmount());
});
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
const root = (r: ReactTestRenderer) => r.root.findByProps({ 'data-part': 'root' });

/** A provider with a recording host and a fake scheduler; `speak()` runs the registry's deferred text. */
function live(children: (s: FakeScheduler) => ReactNode, strict = false) {
  const host = new Host();
  const sched = createFakeScheduler();
  const inner = h(SJProvider, { liveHost: () => host, scheduler: sched }, children(sched));
  const r = mount(strict ? h(StrictMode, null, inner) : inner);
  const speak = () => act(() => (sched.advance(0), sched.flush()));
  return { host, sched, r, speak, inner };
}

const variants = ['first-use', 'no-results', 'cleared', 'loading', 'error'] as const;

describe('naming (ADR-002)', () => {
  it('namespace plus flat exports share the primitive', () => {
    expect(SJState.Root).toBe(SJStateRoot);
    expect(Object.keys(flat).sort()).toEqual(['SJState', 'SJStateRoot']);
  });
});

describe('rendering and variants', () => {
  it('renders the five parts with data-part and the library classes', () => {
    const html = renderToStaticMarkup(
      h(SJState, { heading: 'H', description: 'D', icon: h('i'), actions: h('button') }),
    );
    for (const part of ['root', 'icon', 'title', 'description', 'actions'])
      expect(html).toContain(`data-part="${part}"`);
    for (const c of ['sj-state', 'sj-state__icon', 'sj-state__title', 'sj-state__description'])
      expect(html).toContain(c);
    expect(html).toContain('<p');
    expect(html).toMatch(/aria-hidden="true"[^>]*><i>/);
  });
  it('the three empty kinds and the two other states are distinct, each with visible text', () => {
    const out = variants.map((variant) => {
      const html = renderToStaticMarkup(h(SJState, { variant, heading: `copy ${variant}` }));
      expect(html).toContain(`data-variant="${variant}"`);
      expect(html).toContain(`copy ${variant}`);
      return html;
    });
    expect(new Set(out).size).toBe(5);
  });
  it('default and unknown variants fall back to first-use, never to a done message', () => {
    spyWarn();
    expect(renderToStaticMarkup(h(SJState, { heading: 'x' }))).toContain(
      'data-variant="first-use"',
    );
    expect(renderToStaticMarkup(h(SJState, { variant: 'zzz' as never, heading: 'x' }))).toContain(
      'data-variant="first-use"',
    );
  });
  it('loading sets aria-busy; others do not', () => {
    expect(renderToStaticMarkup(h(SJState, { variant: 'loading', heading: 'x' }))).toContain(
      'aria-busy="true"',
    );
    expect(renderToStaticMarkup(h(SJState, { variant: 'error', heading: 'x' }))).not.toContain(
      'aria-busy',
    );
  });
  it('parts only render when they have content', () => {
    const html = renderToStaticMarkup(h(SJState, { heading: 'x' }));
    for (const part of ['icon', 'description', 'actions']) expect(html).not.toContain(part);
  });
});

describe('prop-or-slot', () => {
  it('heading prop, title slot and description children; a slot wins over its prop', () => {
    expect(renderToStaticMarkup(h(SJState, { heading: 'Prop' }))).toContain('>Prop<');
    const slot = renderToStaticMarkup(
      h(SJState, { heading: 'Prop', title: h('b', null, 'Slot') }, h('em', null, 'Kid')),
    );
    expect(slot).toContain('<b>Slot</b>');
    expect(slot).not.toContain('Prop');
    expect(
      renderToStaticMarkup(h(SJState, { description: 'Dprop' }, h('em', null, 'Kid'))),
    ).toMatch(/<em>Kid<\/em>/);
    expect(renderToStaticMarkup(h(SJState, { description: 'Dprop' }))).toContain('Dprop');
  });
  it('title is a slot, not an HTML attribute', () => {
    expect(renderToStaticMarkup(h(SJState, { title: 'T' }))).not.toContain('title="');
  });
});

describe('classes, native attributes, ref', () => {
  it('classes per part, className and native attributes merge after the library class', () => {
    const html = renderToStaticMarkup(
      h(SJState, {
        heading: 'h',
        description: 'd',
        icon: 'i',
        actions: 'a',
        className: 'own',
        classes: { root: 'r', icon: 'ic', title: 't', description: 'de', actions: 'ac' },
        'data-testid': 'x',
      } as never),
    );
    expect(html).toContain('class="sj-state r own"');
    for (const c of [
      'sj-state__icon ic',
      'sj-state__title t',
      'sj-state__description de',
      'sj-state__actions ac',
    ])
      expect(html).toContain(`class="${c}"`);
    expect(html).toContain('data-testid="x"');
  });
  it('forwardRef reaches the root div, for the primitive and the preset', () => {
    const a = createRef<HTMLDivElement>();
    const b = createRef<HTMLDivElement>();
    const mk = () => ({ createNodeMock: () => ({}) });
    act(() => void mounted.push(create(h(SJState, { heading: 'x', ref: a }) as never, mk())));
    act(() => void mounted.push(create(h(SJStateRoot, { heading: 'x', ref: b }) as never, mk())));
    expect(a.current).not.toBeNull();
    expect(b.current).not.toBeNull();
  });
});

describe('SSR: no live markup (ADR-006)', () => {
  it('no role, aria-live or aria-atomic in any variant, even interrupting, even with a consumer role', () => {
    spyWarn();
    for (const variant of variants)
      for (const render of [renderToStaticMarkup, renderToString]) {
        const html = render(
          h(
            SJProvider,
            null,
            h(SJState, {
              variant,
              heading: 'Boom',
              interrupt: true,
              announce: 'x',
              role: 'alert',
              'aria-live': 'assertive',
              'aria-atomic': 'true',
            } as never),
          ),
        );
        expect(html).not.toMatch(/\brole=|aria-live|aria-atomic/);
      }
  });
  it('the server render is deterministic and id-free', () => {
    const el = () => h(SJState, { variant: 'no-results', heading: 'H', description: 'D' });
    expect(renderToString(el())).toBe(renderToString(el()));
    expect(renderToString(el())).not.toMatch(/\sid=/);
  });
});

describe('announcements (client, after mount)', () => {
  it('requests the eager region at mount (contract liveRegions) and announces nothing for first-use', () => {
    const { host, speak } = live(() => h(SJState, { variant: 'first-use', heading: 'Welcome' }));
    speak();
    expect(host.ensured).toBeGreaterThan(0);
    expect(host.said).toEqual([]);
  });
  it('loading announces its heading politely (status)', () => {
    const { host, speak } = live(() =>
      h(SJState, { variant: 'loading', heading: 'Loading orders' }),
    );
    speak();
    expect(host.said).toEqual([{ role: 'status', text: 'Loading orders' }]);
  });
  it('no-results announces politely; a cleared state is silent unless announce is set', () => {
    const a = live(() => h(SJState, { variant: 'no-results', heading: '0 results' }));
    a.speak();
    expect(a.host.said).toEqual([{ role: 'status', text: '0 results' }]);
    const b = live(() => h(SJState, { variant: 'cleared', heading: 'Cleared' }));
    b.speak();
    expect(b.host.said).toEqual([]);
    const c = live(() =>
      h(SJState, { variant: 'cleared', heading: 'Cleared', announce: 'List emptied' }),
    );
    c.speak();
    expect(c.host.said).toEqual([{ role: 'status', text: 'List emptied' }]);
  });
  it('alert only for an interrupting error; a plain error stays polite', () => {
    const a = live(() => h(SJState, { variant: 'error', heading: 'Failed', interrupt: true }));
    a.speak();
    expect(a.host.said).toEqual([{ role: 'alert', text: 'Failed' }]);
    const b = live(() => h(SJState, { variant: 'error', heading: 'Failed' }));
    b.speak();
    expect(b.host.said).toEqual([{ role: 'status', text: 'Failed' }]);
    const c = live(() => h(SJState, { variant: 'loading', heading: 'x', interrupt: true }));
    c.speak();
    expect(c.host.said).toEqual([{ role: 'status', text: 'x' }]);
  });
  it('a title slot string is announced; an element heading is announced as the text it renders (read after commit)', () => {
    const a = live(() => h(SJState, { variant: 'loading', title: 'Slot text' }));
    a.speak();
    expect(a.host.said[0]?.text).toBe('Slot text');
    // The test renderer has no DOM: the title element's text comes from the node mock (what the browser would hold).
    const host = new Host();
    const sched = createFakeScheduler();
    let rendered!: ReactTestRenderer;
    act(() => {
      rendered = create(
        h(
          SJProvider,
          { liveHost: () => host, scheduler: sched },
          h(SJState, { variant: 'no-results', title: h('b', null, '3 results') }),
        ) as never,
        { createNodeMock: () => ({ textContent: '3 results' }) },
      );
    });
    mounted.push(rendered);
    act(() => (sched.advance(0), sched.flush()));
    expect(host.said).toEqual([{ role: 'status', text: '3 results' }]);
    // A re-render with the same element heading says nothing more.
    act(() =>
      rendered.update(
        h(
          SJProvider,
          { liveHost: () => host, scheduler: sched },
          h(SJState, { variant: 'no-results', title: h('b', null, '3 results') }),
        ) as never,
      ),
    );
    act(() => (sched.advance(0), sched.flush()));
    expect(host.said).toHaveLength(1);
  });
  it('one announcement per change: StrictMode and re-renders do not repeat it', () => {
    const { host, sched, r, inner, speak } = live(
      () => h(SJState, { variant: 'loading', heading: 'Loading' }),
      true,
    );
    speak();
    act(() => r.update(h(StrictMode, null, inner) as never));
    speak();
    act(() => sched.advance(5000));
    expect(host.said).toEqual([{ role: 'status', text: 'Loading' }]);
  });
  it('a changed count is announced again', () => {
    const host = new Host();
    const sched = createFakeScheduler();
    const el = (n: number) =>
      h(
        SJProvider,
        { liveHost: () => host, scheduler: sched },
        h(SJState, { variant: 'no-results', heading: `${n} results` }),
      );
    const r = mount(el(0));
    act(() => (sched.advance(0), sched.flush()));
    act(() => r.update(el(3) as never));
    act(() => (sched.advance(0), sched.flush()));
    expect(host.said.map((s) => s.text)).toEqual(['0 results', '3 results']);
  });
  it('outside a provider it renders and announces nothing', () => {
    spyWarn();
    const r = mount(h(SJState, { variant: 'loading', heading: 'x' }));
    expect(root(r).props['data-variant']).toBe('loading');
  });
  it('the root never carries live attributes on the client either', () => {
    spyWarn();
    const r = mount(
      h(SJState, { variant: 'error', heading: 'x', interrupt: true, role: 'alert' } as never),
    );
    for (const k of ['role', 'aria-live', 'aria-atomic']) expect(k in root(r).props).toBe(false);
  });
});

describe('source rules', () => {
  it('passes the generated stateLive and never a live literal', async () => {
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const fs = (await mod('node:fs')) as { readFileSync(u: URL, e: string): string };
    const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const code = src.replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/\bstateLive\b/);
    expect(code).not.toMatch(/live:\s*['"]/);
    expect(code).not.toMatch(/innerHTML|\bdocument\b|\bnavigator\b/);
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
          h(
            StrictMode,
            null,
            h(
              SJProvider,
              { liveHost: () => new Host(), scheduler: createFakeScheduler() },
              h(SJState, { variant: 'loading', heading: 'x', ref: () => payload.i } as never),
            ),
          ),
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
