import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createFakeScheduler, type FakeScheduler } from '@ramoslabs/core/runtime';
import type { LiveHost, LiveNode, LiveRole } from '@ramoslabs/core/live';
import { SJProvider } from '../runtime/index';
import { SJState } from '../state/index';
import { SJSkeleton } from './index';
import * as flat from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class Host implements LiveHost {
  created: LiveRole[] = [];
  said: Array<{ role: LiveRole; text: string }> = [];
  create(role: LiveRole): LiveNode {
    this.created.push(role);
    return { setText: (t) => void (t && this.said.push({ role, text: t })) };
  }
  ensure() {}
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
const root = (r: ReactTestRenderer) => r.root.findByProps({ 'data-part': 'root' });

function live(children: (s: FakeScheduler) => ReactNode, strict = false) {
  const host = new Host();
  const sched = createFakeScheduler();
  const inner = h(SJProvider, { liveHost: () => host, scheduler: sched }, children(sched));
  const r = mount(strict ? h(StrictMode, null, inner) : inner);
  const advance = (ms: number) => act(() => (sched.advance(ms), sched.flush()));
  return { host, sched, r, advance };
}
const grp = (props: Record<string, unknown> = {}, loaded = true) =>
  h(
    SJSkeleton,
    {
      shape: 'group',
      announce: 'Loading activity',
      delay: 300,
      minDuration: 500,
      skeleton: h('div', { id: 'sk' }),
      ...props,
    },
    loaded ? h('div', { id: 'content' }) : null,
  );
const has = (r: ReactTestRenderer, id: string) => r.root.findAllByProps({ id }).length > 0;

describe('naming', () => {
  it('exports SJSkeleton only (no part components)', () => {
    expect(Object.keys(flat).sort()).toEqual(['SJSkeleton']);
  });
});

describe('shapes', () => {
  it('render hidden, non-busy shapes with the data hooks and lines', () => {
    const t = live(() => h(SJSkeleton, { shape: 'text', lines: 4 }));
    expect(root(t.r).props['aria-hidden']).toBe('true');
    expect(root(t.r).props['aria-busy']).toBeUndefined();
    expect(root(t.r).props['data-lines']).toBe(4);
    expect(t.r.root.findAllByProps({ 'data-part': 'line' })).toHaveLength(4);
    const c = live(() => h(SJSkeleton, { shape: 'circle', size: 'xl' }));
    expect(root(c.r).props['data-size']).toBe('xl');
    const w = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const b = live(() => h(SJSkeleton, { shape: 'nope' as never }));
    expect(root(b.r).props['data-shape']).toBe('block');
    w.mockRestore();
  });
  it('merges className and per-part classes; role and aria-live are never rendered', () => {
    const w = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = live(() =>
      h(SJSkeleton, {
        shape: 'text',
        className: 'a',
        role: 'status',
        'aria-live': 'polite',
        classes: { root: 'r', line: 'l' },
      }),
    );
    expect(root(t.r).props.className).toBe('sj-skeleton r a');
    expect(root(t.r).props.role).toBeUndefined();
    expect(root(t.r).props['aria-live']).toBeUndefined();
    expect(t.r.root.findAllByProps({ 'data-part': 'line' })[0]!.props.className).toBe(
      'sj-skeleton__line l',
    );
    w.mockRestore();
  });
});

describe('group timing', () => {
  it('starts pending: busy, placeholder rendered, content absent, nothing announced', () => {
    const t = live(() => grp());
    expect(root(t.r).props['data-state']).toBe('pending');
    expect(root(t.r).props['aria-busy']).toBe('true');
    expect(has(t.r, 'sk')).toBe(true);
    expect(has(t.r, 'content')).toBe(false);
    expect(t.host.said).toEqual([]);
  });
  it('a load that ends inside the delay never becomes visible and announces nothing', () => {
    const t = live(() => grp());
    t.advance(299);
    act(() =>
      t.r.update(
        h(SJProvider, { liveHost: () => t.host, scheduler: t.sched }, grp({ loading: false })),
      ),
    );
    expect(root(t.r).props['data-state']).toBe('idle');
    expect(root(t.r).props['aria-busy']).toBeUndefined();
    expect(has(t.r, 'content')).toBe(true);
    t.advance(5000);
    expect(t.host.said).toEqual([]);
  });
  it('shows after the delay, announces once politely, keeps the minimum, then swaps', () => {
    const t = live(() => grp());
    t.advance(300);
    expect(root(t.r).props['data-state']).toBe('visible');
    t.advance(0);
    expect(t.host.said).toEqual([{ role: 'status', text: 'Loading activity' }]);
    t.advance(100);
    act(() =>
      t.r.update(
        h(SJProvider, { liveHost: () => t.host, scheduler: t.sched }, grp({ loading: false })),
      ),
    );
    expect(root(t.r).props['data-state']).toBe('holding');
    expect(has(t.r, 'content')).toBe(false);
    t.advance(399);
    expect(root(t.r).props['data-state']).toBe('holding');
    t.advance(1);
    expect(root(t.r).props['data-state']).toBe('idle');
    expect(has(t.r, 'content')).toBe(true);
    expect(t.host.said).toHaveLength(1);
  });
  it('loading false from the start shows the content with no announcement', () => {
    const t = live(() => grp({ loading: false }));
    t.advance(5000);
    expect(root(t.r).props['data-state']).toBe('idle');
    expect(has(t.r, 'content')).toBe(true);
    expect(t.host.said).toEqual([]);
  });
  it('StrictMode: exactly one announcement', () => {
    const t = live(() => grp(), true);
    t.advance(300);
    t.advance(0);
    t.advance(100);
    expect(t.host.said).toHaveLength(1);
  });
  it('cancels its timers on unmount', () => {
    const t = live(() => grp());
    act(() => t.r.unmount());
    t.advance(5000);
    expect(t.host.said).toEqual([]);
    expect(t.sched.pending).toBe(0);
  });
});

describe('inside SJState', () => {
  it('state loading renders the aria-hidden skeleton part and speaks its heading once', () => {
    const t = live(() =>
      h(SJState, {
        variant: 'loading',
        heading: 'Loading activity',
        skeleton: h(SJSkeleton, { shape: 'text' }),
      }),
    );
    t.advance(0);
    t.advance(0);
    const part = t.r.root.findByProps({ 'data-part': 'skeleton' });
    expect(part.props['aria-hidden']).toBe('true');
    expect(t.host.said).toEqual([{ role: 'status', text: 'Loading activity' }]);
  });
  it('the skeleton slot is ignored outside the loading variant', () => {
    const t = live(() => h(SJState, { variant: 'error', heading: 'x', skeleton: h('i') }));
    expect(t.r.root.findAllByProps({ 'data-part': 'skeleton' })).toHaveLength(0);
  });
});

describe('SSR and source', () => {
  it('server markup of a loading group is pending, busy, without live markup', () => {
    const el = h(SJProvider, { target: 'server' }, grp({ skeleton: h('b', null, 'sk') }, true));
    for (const html of [renderToString(el), renderToStaticMarkup(el)]) {
      expect(html).toContain('data-state="pending"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('<b>sk</b>');
      expect(html).not.toContain('id="content"');
      expect(html).not.toMatch(/role=|aria-live|aria-atomic/);
    }
  });
  it('uses the generated live constant', async () => {
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const fs = (await mod('node:fs')) as { readFileSync(u: URL, e: string): string };
    const code = fs
      .readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/\bskeletonLive\b/);
    expect(code).not.toMatch(/innerHTML|live:\s*['"]/);
  });
});
