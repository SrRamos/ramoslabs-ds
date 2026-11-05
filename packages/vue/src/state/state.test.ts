// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Comment, Fragment, createApp, createSSRApp, h, nextTick, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createRuntime } from '@ramoslabs/core/runtime';
import type { LiveHost, LiveRole } from '@ramoslabs/core/live';
import { SJProvider } from '../runtime/index';
import { SJState } from './index';
import source from './SJState.ts?raw';

interface Log {
  created: LiveRole[];
  texts: Array<[LiveRole, string]>;
}
const recorder = (): { log: Log; host: LiveHost } => {
  const log: Log = { created: [], texts: [] };
  return {
    log,
    host: {
      create: (role) => {
        log.created.push(role);
        return { setText: (t) => void (t && log.texts.push([role, t])) };
      },
    },
  };
};
const flush = async () => {
  for (let i = 0; i < 4; i++) await nextTick();
  await new Promise((r) => setTimeout(r, 5));
};

function mount(props: Record<string, unknown>, slots?: Record<string, () => unknown>) {
  const rec = recorder();
  const el = document.createElement('div');
  document.body.appendChild(el);
  const p = ref(props);
  const app = createApp({
    render: () =>
      h(
        SJProvider,
        { runtime: createRuntime({ target: 'client' }), liveHost: rec.host },
        { default: () => h(SJState, p.value, slots) },
      ),
  });
  app.mount(el);
  return { ...rec, el, p, app, root: () => el.firstElementChild as HTMLElement };
}

describe('SJState render', () => {
  it('renders the parts with data-variant and no live markup', () => {
    const m = mount(
      { variant: 'no-results', heading: 'No matches', description: 'Try again' },
      { icon: () => h('i'), actions: () => h('button', 'Clear') },
    );
    const r = m.root();
    expect(r.className).toBe('sj-state');
    expect(r.getAttribute('data-variant')).toBe('no-results');
    for (const k of ['role', 'aria-live', 'aria-atomic', 'aria-busy'])
      expect(r.hasAttribute(k)).toBe(false);
    expect(r.querySelector('.sj-state__title')?.textContent).toBe('No matches');
    expect(r.querySelector('.sj-state__description')?.textContent).toBe('Try again');
    expect(r.querySelector('.sj-state__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(r.querySelector('.sj-state__actions button')?.textContent).toBe('Clear');
    for (const part of r.querySelectorAll('[data-part]'))
      expect(part.getAttribute('data-variant')).toBe('no-results');
    m.app.unmount();
  });

  it('keeps the three empty kinds distinct and falls back to first-use', () => {
    const kinds = ['first-use', 'no-results', 'cleared'].map((variant) =>
      mount({ variant, heading: 'h' }).root().getAttribute('data-variant'),
    );
    expect(new Set(kinds).size).toBe(3);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mount({ variant: 'bogus', heading: 'h' }).root().getAttribute('data-variant')).toBe(
      'first-use',
    );
    warn.mockRestore();
  });

  it('loading sets aria-busy; slots win over props; omits empty parts', () => {
    const m = mount(
      { variant: 'loading', heading: 'prop' },
      { title: () => 'slot title', default: () => 'slot body' },
    );
    expect(m.root().getAttribute('aria-busy')).toBe('true');
    expect(m.root().querySelector('.sj-state__title')?.textContent).toBe('slot title');
    expect(m.root().querySelector('.sj-state__description')?.textContent).toBe('slot body');
    expect(m.root().querySelector('.sj-state__icon')).toBeNull();
    expect(m.root().querySelector('.sj-state__actions')).toBeNull();
  });

  it('merges class and per-part classes; protected attributes win', () => {
    const m = mount(
      {
        heading: 'h',
        description: 'd',
        class: 'a',
        role: 'alert',
        classes: { root: 'r', title: 't', description: 'd2' },
      },
      { icon: () => 'x', actions: () => 'y' },
    );
    expect(m.root().className).toBe('sj-state a r');
    expect(m.root().hasAttribute('role')).toBe(false);
    expect(m.root().querySelector('.sj-state__title')?.className).toBe('sj-state__title t');
    expect(m.root().querySelector('.sj-state__description')?.className).toBe(
      'sj-state__description d2',
    );
  });
});

describe('SJState announcements', () => {
  it('creates the status region eagerly, announces loading politely once', async () => {
    const m = mount({ variant: 'loading', heading: 'Loading orders' });
    await flush();
    expect(m.log.created[0]).toBe('status');
    expect(m.log.texts).toEqual([['status', 'Loading orders']]);
    m.app.unmount();
  });

  it('announces a changed count politely and does not repeat an unchanged one', async () => {
    const m = mount({ variant: 'no-results', heading: '0 results' });
    await flush();
    m.p.value = { variant: 'no-results', heading: '0 results', description: 'x' };
    await flush();
    m.p.value = { variant: 'no-results', heading: '0 results for "a"' };
    await flush();
    expect(m.log.texts).toEqual([
      ['status', '0 results'],
      ['status', '0 results for "a"'],
    ]);
  });

  it('first-use and cleared are silent unless announce is set', async () => {
    const a = mount({ variant: 'first-use', heading: 'Welcome' });
    const b = mount({ variant: 'cleared', heading: 'Cleared' });
    const c = mount({ variant: 'cleared', heading: 'Cleared', announce: 'List cleared' });
    await flush();
    expect(a.log.texts).toEqual([]);
    expect(b.log.texts).toEqual([]);
    expect(c.log.texts).toEqual([['status', 'List cleared']]);
  });

  it('alert only for an error that interrupts', async () => {
    const calm = mount({ variant: 'error', heading: 'Could not save' });
    const loud = mount({ variant: 'error', heading: 'Connection lost', interrupt: true });
    const notError = mount({ variant: 'loading', heading: 'Wait', interrupt: true });
    await flush();
    expect(calm.log.texts).toEqual([['status', 'Could not save']]);
    expect(loud.log.texts).toEqual([['alert', 'Connection lost']]);
    expect(notError.log.texts).toEqual([['status', 'Wait']]);
  });

  it('does not announce after unmount', async () => {
    const m = mount({ variant: 'loading', heading: 'Loading' });
    m.app.unmount();
    await flush();
    expect(m.log.texts).toEqual([]);
  });
});

describe('SJState title slot', () => {
  it('a string title slot announces like heading, and updates', async () => {
    const text = ref('Loading orders');
    const rec = recorder();
    const el = document.createElement('div');
    document.body.appendChild(el);
    createApp({
      render: () =>
        h(
          SJProvider,
          { liveHost: rec.host },
          {
            default: () => h(SJState, { variant: 'loading' }, { title: () => text.value }),
          },
        ),
    }).mount(el);
    await flush();
    text.value = 'Loading invoices';
    await flush();
    expect(rec.log.texts).toEqual([
      ['status', 'Loading orders'],
      ['status', 'Loading invoices'],
    ]);
  });

  it('empty slots render no part', () => {
    const m = mount(
      { variant: 'first-use' },
      {
        icon: () => [],
        title: () => [h(Comment)],
        default: () => '',
        actions: () => [h(Fragment, [])],
      },
    );
    expect(m.root().querySelectorAll('[data-part]').length).toBe(0);
  });
});

describe('SJState SSR', () => {
  const ssr = (props: Record<string, unknown>) =>
    renderToString(
      createSSRApp({
        render: () =>
          h(SJProvider, null, {
            default: () => h(SJState, props, { icon: () => h('i'), actions: () => h('a', 'Go') }),
          }),
      }),
    );

  it('renders no live markup, is deterministic, and has no ids', async () => {
    for (const variant of ['first-use', 'no-results', 'cleared', 'loading', 'error']) {
      const html = await ssr({ variant, heading: 'Heading', interrupt: true });
      expect(html).not.toMatch(/\brole=|aria-live|aria-atomic/);
      expect(html).toContain(`data-variant="${variant}"`);
      expect(html).toContain('Heading');
      expect(html).not.toMatch(/\bid=/);
      expect(await ssr({ variant, heading: 'Heading', interrupt: true })).toBe(html);
    }
  });
});

describe('SJState source', () => {
  it('derives live timing from the generated constant and never hand-writes it', () => {
    const code = source.replace(/\/\/[^\n]*/g, '');
    expect(code).toContain('stateLive');
    expect(code).not.toMatch(/\blive\s*:\s*['"]/);
    expect(code).not.toMatch(/innerHTML|v-html/);
    expect(code).not.toMatch(/\btitle\b\s*:\s*\{?\s*type/);
  });
});

describe('SJState retains nothing', () => {
  it('1,000 mount/destroy cycles leave no DOM and detach every registry', async () => {
    const detached = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    let creates = 0;
    for (let i = 0; i < 1000; i++) {
      const app = createApp({
        render: () =>
          h(
            SJProvider,
            { liveHost: { create: () => (creates++, { setText: detached }) } },
            { default: () => h(SJState, { variant: 'loading', heading: `n${i}` }) },
          ),
      });
      app.mount(host);
      app.unmount();
    }
    await nextTick();
    expect(host.childNodes.length).toBe(0);
    expect(creates).toBe(1000);
    expect(detached).not.toHaveBeenCalled();
  }, 60_000);
});
