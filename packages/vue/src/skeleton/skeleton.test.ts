// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, createSSRApp, h, nextTick, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createFakeScheduler, createRuntime, type FakeScheduler } from '@ramoslabs/core/runtime';
import type { LiveHost, LiveRole } from '@ramoslabs/core/live';
import { SJProvider } from '../runtime/index';
import { SJSkeleton } from './index';
import { SJState } from '../state/index';
import source from './SJSkeleton.ts?raw';

const apps: Array<{ unmount(): void }> = [];
afterEach(() => {
  while (apps.length) apps.pop()!.unmount();
  vi.restoreAllMocks();
});

const recorder = () => {
  const texts: Array<[LiveRole, string]> = [];
  const created: LiveRole[] = [];
  const host: LiveHost = {
    create: (role) => {
      created.push(role);
      return { setText: (t) => void (t && texts.push([role, t])) };
    },
  };
  return { texts, created, host };
};
const tick = async () => {
  for (let i = 0; i < 4; i++) await nextTick();
};

/** Mount under a provider with a fake scheduler so delay and minimum duration are driven by `advance`. */
function mount(props: Record<string, unknown>, slots?: Record<string, () => unknown>) {
  const rec = recorder();
  const sched: FakeScheduler = createFakeScheduler();
  const el = document.createElement('div');
  document.body.appendChild(el);
  const p = ref(props);
  const app = createApp({
    render: () =>
      h(
        SJProvider,
        { runtime: createRuntime({ target: 'client', scheduler: sched }), liveHost: rec.host },
        { default: () => h(SJSkeleton, p.value, slots) },
      ),
  });
  app.mount(el);
  apps.push(app);
  const root = () => el.firstElementChild as HTMLElement;
  const advance = async (ms: number) => {
    sched.advance(ms);
    sched.flush();
    await tick();
    // The registry defers its text through the scheduler too.
    sched.advance(0);
    sched.flush();
    await tick();
  };
  return { ...rec, p, el, root, advance };
}
const group = (props: Record<string, unknown> = {}) =>
  mount(
    { shape: 'group', announce: 'Loading activity', delay: 300, minDuration: 500, ...props },
    { skeleton: () => h('div', { id: 'sk' }), default: () => h('div', { id: 'content' }) },
  );

describe('SJSkeleton shapes', () => {
  it('renders hidden, non-busy shapes with the data hooks', () => {
    const t = mount({ shape: 'text', lines: 4 }).root();
    expect(t.className).toBe('sj-skeleton');
    expect(t.getAttribute('aria-hidden')).toBe('true');
    expect(t.hasAttribute('aria-busy')).toBe(false);
    expect(t.getAttribute('data-lines')).toBe('4');
    expect(t.querySelectorAll('.sj-skeleton__line')).toHaveLength(4);
    expect(mount({ shape: 'rect', ratio: '4/3' }).root().getAttribute('data-ratio')).toBe('4/3');
    expect(mount({ shape: 'circle', size: 'xl' }).root().getAttribute('data-size')).toBe('xl');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mount({ shape: 'nope' }).root().getAttribute('data-shape')).toBe('block');
    expect(mount({}).root().querySelector('.sj-skeleton__line')).toBeNull();
    warn.mockRestore();
  });
  it('merges class and per-part classes; role and aria-live are never rendered', () => {
    const m = mount({
      shape: 'text',
      class: 'a',
      role: 'status',
      'aria-live': 'polite',
      classes: { root: 'r', line: 'l' },
    });
    expect(m.root().className).toBe('sj-skeleton a r');
    expect(m.root().hasAttribute('role')).toBe(false);
    expect(m.root().hasAttribute('aria-live')).toBe(false);
    expect(m.root().querySelector('.sj-skeleton__line')?.className).toBe('sj-skeleton__line l');
  });
});

describe('SJSkeleton group timing', () => {
  it('starts pending: busy, placeholder laid out, content absent, nothing announced', async () => {
    const m = group();
    await tick();
    expect(m.root().getAttribute('data-state')).toBe('pending');
    expect(m.root().getAttribute('aria-busy')).toBe('true');
    expect(m.el.querySelector('#sk')).not.toBeNull();
    expect(m.el.querySelector('#content')).toBeNull();
    expect(m.texts).toEqual([]);
  });
  it('a load that ends inside the delay never becomes visible and announces nothing', async () => {
    const m = group();
    await m.advance(299);
    m.p.value = { ...m.p.value, loading: false };
    await m.advance(0);
    expect(m.root().getAttribute('data-state')).toBe('idle');
    expect(m.root().hasAttribute('aria-busy')).toBe(false);
    expect(m.el.querySelector('#content')).not.toBeNull();
    await m.advance(5000);
    expect(m.texts).toEqual([]);
  });
  it('shows after the delay, announces once politely, keeps the minimum duration, then swaps', async () => {
    const m = group();
    await m.advance(300);
    expect(m.root().getAttribute('data-state')).toBe('visible');
    expect(m.created[0]).toBe('status');
    expect(m.texts).toEqual([['status', 'Loading activity']]);
    await m.advance(100);
    m.p.value = { ...m.p.value, loading: false };
    await m.advance(0);
    expect(m.root().getAttribute('data-state')).toBe('holding');
    expect(m.root().getAttribute('aria-busy')).toBe('true');
    expect(m.el.querySelector('#content')).toBeNull();
    await m.advance(399);
    expect(m.root().getAttribute('data-state')).toBe('holding');
    await m.advance(1);
    expect(m.root().getAttribute('data-state')).toBe('idle');
    expect(m.el.querySelector('#content')).not.toBeNull();
    expect(m.el.querySelector('#sk')).toBeNull();
    expect(m.texts).toHaveLength(1);
  });
  it('loading false from the start renders the content with no timer and no announcement', async () => {
    const m = group({ loading: false });
    await m.advance(5000);
    expect(m.root().getAttribute('data-state')).toBe('idle');
    expect(m.el.querySelector('#content')).not.toBeNull();
    expect(m.texts).toEqual([]);
  });
  it('reads the tokens when delay and minDuration are not props', async () => {
    const m = mount(
      {
        shape: 'group',
        style: '--motion-skeleton-delay: 40ms; --motion-skeleton-min-duration: 60ms',
      },
      { skeleton: () => h('i') },
    );
    await m.advance(39);
    expect(m.root().getAttribute('data-state')).toBe('pending');
    await m.advance(1);
    expect(m.root().getAttribute('data-state')).toBe('visible');
  });
  it('falls back to 300 and 500 without tokens', async () => {
    const m = mount({ shape: 'group' }, { skeleton: () => h('i') });
    await m.advance(299);
    expect(m.root().getAttribute('data-state')).toBe('pending');
    await m.advance(1);
    expect(m.root().getAttribute('data-state')).toBe('visible');
  });
  it('cancels its timers on unmount', async () => {
    const rec = recorder();
    const sched = createFakeScheduler();
    const el = document.createElement('div');
    const app = createApp({
      render: () =>
        h(
          SJProvider,
          { runtime: createRuntime({ target: 'client', scheduler: sched }), liveHost: rec.host },
          {
            default: () =>
              h(SJSkeleton, { shape: 'group', announce: 'x' }, { skeleton: () => 'sk' }),
          },
        ),
    });
    app.mount(el);
    await tick();
    expect(sched.pending).toBeGreaterThan(0);
    app.unmount();
    sched.advance(5000);
    sched.flush();
    expect(rec.texts).toEqual([]);
  });
});

describe('SJSkeleton inside SJState', () => {
  it('state loading renders the aria-hidden skeleton part and speaks its heading once', async () => {
    const rec = recorder();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(
          SJProvider,
          { runtime: createRuntime({ target: 'client' }), liveHost: rec.host },
          {
            default: () =>
              h(
                SJState,
                { variant: 'loading', heading: 'Loading activity' },
                { skeleton: () => h(SJSkeleton, { shape: 'text' }) },
              ),
          },
        ),
    });
    app.mount(el);
    apps.push(app);
    await tick();
    await new Promise((r) => setTimeout(r, 5));
    const part = el.querySelector('.sj-state__skeleton')!;
    expect(part.getAttribute('aria-hidden')).toBe('true');
    expect(el.firstElementChild!.getAttribute('aria-busy')).toBe('true');
    expect(rec.texts).toEqual([['status', 'Loading activity']]);
  });
  it('the skeleton slot is ignored outside the loading variant', () => {
    const el = document.createElement('div');
    const app = createApp({
      render: () => h(SJState, { variant: 'error', heading: 'x' }, { skeleton: () => 'sk' }),
    });
    app.mount(el);
    expect(el.querySelector('.sj-state__skeleton')).toBeNull();
    app.unmount();
  });
});

describe('SJSkeleton SSR and source', () => {
  it('server markup of a loading group is pending, busy, without live markup, and starts no timer', async () => {
    const sched = createFakeScheduler();
    const app = createSSRApp({
      render: () =>
        h(
          SJProvider,
          { runtime: createRuntime({ target: 'server', scheduler: sched }) },
          {
            default: () =>
              h(
                SJSkeleton,
                { shape: 'group', announce: 'Loading' },
                { skeleton: () => h('b', 'sk'), default: () => h('i', 'content') },
              ),
          },
        ),
    });
    const html = await renderToString(app);
    expect(html).toContain('data-state="pending"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<b>sk</b>');
    expect(html).not.toContain('content');
    expect(html).not.toMatch(/role=|aria-live|aria-atomic/);
    expect(sched.pending).toBe(0);
  });
  it('uses the generated live constant and never innerHTML', () => {
    expect(source).toMatch(/skeletonLive/);
    expect(source).not.toMatch(/innerHTML|live:\s*'(eager|lazy)'/);
  });
});
