// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, createSSRApp, h, nextTick, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { SJProvider } from '../runtime/index';
import { SJDisclosure } from './index';

const lifecycle = vi.hoisted(() => ({ created: 0, destroyed: 0, listeners: 0 }));
vi.mock('@ramoslabs/core/store', async (orig) => {
  const mod = await orig<typeof import('@ramoslabs/core/store')>();
  return {
    ...mod,
    createStore: ((...args: Parameters<typeof mod.createStore>) => {
      const s = mod.createStore(...args);
      lifecycle.created++;
      return {
        ...s,
        subscribe: (fn: Parameters<typeof s.subscribe>[0]) => {
          lifecycle.listeners++;
          const off = s.subscribe(fn);
          return () => {
            lifecycle.listeners--;
            off();
          };
        },
        destroy: () => {
          lifecycle.destroyed++;
          s.destroy();
        },
      };
    }) as typeof mod.createStore,
  };
});

const mounts: Array<() => void> = [];
afterEach(() => {
  while (mounts.length) mounts.pop()!();
  document.body.innerHTML = '';
});

function mount(
  render: () => ReturnType<typeof h> | ReturnType<typeof h>[],
  config?: { supports?: { detailsName?: boolean } },
  host: HTMLElement = document.createElement('div'),
) {
  document.body.appendChild(host);
  const app = createApp({
    render: () => h(SJProvider, { config }, { default: render as () => never }),
  });
  app.mount(host);
  mounts.push(() => app.unmount());
  return { host, unmount: () => app.unmount() };
}
const details = (host: HTMLElement) => [...host.querySelectorAll('details')];
const settle = async () => {
  for (let i = 0; i < 4; i++) await nextTick();
};
/** jsdom does not fire `toggle` on its own. */
const toggle = (el: HTMLDetailsElement, open: boolean) => {
  el.open = open;
  el.dispatchEvent(new Event('toggle'));
};

describe('SJDisclosure markup', () => {
  it('renders details > summary + div with no aria-expanded or role', () => {
    const { host } = mount(() => h(SJDisclosure, { summary: 'More' }, { default: () => 'body' }));
    const root = details(host)[0]!;
    const sum = root.querySelector('summary')!;
    expect(root.className).toBe('sj-disclosure__root');
    expect(sum.textContent).toBe('More');
    expect(sum.hasAttribute('aria-expanded')).toBe(false);
    expect(sum.hasAttribute('role')).toBe(false);
    expect(root.querySelector('.sj-disclosure__content')!.textContent).toBe('body');
    expect(root.dataset.state).toBe('closed');
  });

  it('prop or slot for the summary (slot wins) and classes per part', () => {
    const { host } = mount(() =>
      h(
        SJDisclosure,
        { summary: 'prop', classes: { root: 'r', trigger: 't', content: 'c' }, class: 'mine' },
        { summary: () => 'slot', default: () => 'x' },
      ),
    );
    const root = details(host)[0]!;
    expect(root.className).toBe('sj-disclosure__root r mine');
    expect(root.querySelector('summary')!.className).toBe('sj-disclosure__trigger t');
    expect(root.querySelector('summary')!.textContent).toBe('slot');
    expect(root.querySelector('[data-part=content]')!.className).toBe('sj-disclosure__content c');
  });
});

describe('SJDisclosure uncontrolled', () => {
  it('honours defaultOpen and reports a native toggle with both events', async () => {
    const updates: boolean[] = [];
    const changes: unknown[] = [];
    const { host } = mount(() =>
      h(SJDisclosure, {
        defaultOpen: true,
        summary: 's',
        'onUpdate:open': (v: boolean) => updates.push(v),
        onOpenChange: (p: unknown) => changes.push(p),
      }),
    );
    const el = details(host)[0]!;
    expect(el.open).toBe(true);
    toggle(el, false);
    await settle();
    expect(el.dataset.state).toBe('closed');
    expect(updates).toEqual([false]);
    expect(changes).toEqual([{ open: false }]);
  });
});

describe('SJDisclosure controlled', () => {
  it('follows the parent value', async () => {
    const on = ref(false);
    const { host } = mount(() =>
      h(SJDisclosure, { open: on.value, 'onUpdate:open': (v: boolean) => (on.value = v) }),
    );
    const el = details(host)[0]!;
    toggle(el, true);
    await settle();
    expect(on.value).toBe(true);
    expect(el.open).toBe(true);
    on.value = false;
    await settle();
    expect(el.open).toBe(false);
    expect(el.dataset.state).toBe('closed');
  });

  it('corrects the element when the owner rejects the change', async () => {
    const seen: boolean[] = [];
    const { host } = mount(() =>
      h(SJDisclosure, { open: false, 'onUpdate:open': (v: boolean) => seen.push(v) }),
    );
    const el = details(host)[0]!;
    toggle(el, true);
    await settle();
    expect(seen).toEqual([true]);
    expect(el.open).toBe(false);
    expect(el.dataset.state).toBe('closed');
  });
});

describe('SJDisclosure disabled', () => {
  it('prevents the summary click and marks aria-disabled without emitting', async () => {
    const updates: boolean[] = [];
    const { host } = mount(() =>
      h(SJDisclosure, { disabled: true, 'onUpdate:open': (v: boolean) => updates.push(v) }),
    );
    const sum = host.querySelector('summary')!;
    expect(sum.getAttribute('aria-disabled')).toBe('true');
    expect(details(host)[0]!.dataset.disabled).toBe('true');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    sum.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await settle();
    expect(updates).toEqual([]);
  });
});

describe('SJDisclosure pre-hydration state', () => {
  it('reports a native open that differs from the view at mount', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const tree = (extra: Record<string, unknown> = {}) =>
      h(SJProvider, null, { default: () => h(SJDisclosure, { id: 'd', summary: 's', ...extra }) });
    // Real server markup, then the user opens it before any script runs.
    host.innerHTML = await renderToString(createSSRApp({ render: () => tree() }));
    host.querySelector('details')!.open = true;
    const seen: boolean[] = [];
    const app = createSSRApp({
      render: () => tree({ 'onUpdate:open': (v: boolean) => seen.push(v) }),
    });
    app.mount(host);
    mounts.push(() => app.unmount());
    await settle();
    expect(seen).toEqual([true]);
    expect(details(host)[0]!.dataset.state).toBe('open');
  });
});

describe('SJDisclosure exclusive group fallback (supports.detailsName forced false)', () => {
  const group = (props: Array<Record<string, unknown>>) => () =>
    props.map((p, i) => h(SJDisclosure, { name: 'g', summary: `s${i}`, key: i, ...p }));
  const off = { supports: { detailsName: false } };

  it('closes the open peer when another opens (uncontrolled)', async () => {
    const closes: boolean[] = [];
    const { host } = mount(
      group([
        {
          defaultOpen: true,
          onOpenChange: (p: unknown) => closes.push((p as { open: boolean }).open),
        },
        {},
        {},
      ]),
      off,
    );
    const [a, b, c] = details(host) as [HTMLDetailsElement, HTMLDetailsElement, HTMLDetailsElement];
    toggle(b, true);
    await settle();
    expect(a.open).toBe(false);
    expect(b.open).toBe(true);
    expect(c.open).toBe(false);
    // The closed peer reports through its own toggle, as native does.
    a.dispatchEvent(new Event('toggle'));
    await settle();
    expect(a.dataset.state).toBe('closed');
    expect(closes).toEqual([false]);
  });

  it('works for a controlled member opened programmatically', async () => {
    const open = ref(false);
    const { host } = mount(
      () => [
        h(SJDisclosure, { name: 'g', open: open.value, key: 1 }),
        h(SJDisclosure, { name: 'g', defaultOpen: true, key: 2 }),
      ],
      off,
    );
    const [a, b] = details(host) as [HTMLDetailsElement, HTMLDetailsElement];
    open.value = true;
    await settle();
    expect(a.open).toBe(true);
    a.dispatchEvent(new Event('toggle')); // the browser fires toggle for the programmatic open
    await settle();
    expect(b.open).toBe(false);
  });

  it('closes peers even when the owner rejects the open', async () => {
    const { host } = mount(
      () => [
        h(SJDisclosure, { name: 'g', open: false, key: 1 }),
        h(SJDisclosure, { name: 'g', defaultOpen: true, key: 2 }),
      ],
      off,
    );
    const [a, b] = details(host) as [HTMLDetailsElement, HTMLDetailsElement];
    toggle(a, true);
    await settle();
    expect(b.open).toBe(false); // peer closed although the controlled member snaps back
    expect(a.open).toBe(false);
  });

  it('leaves other names and unnamed members alone, and does nothing when native', async () => {
    const { host } = mount(
      () => [
        h(SJDisclosure, { name: 'g', key: 1 }),
        h(SJDisclosure, { name: 'other', defaultOpen: true, key: 2 }),
        h(SJDisclosure, { defaultOpen: true, key: 3 }),
      ],
      off,
    );
    const [a, b, c] = details(host) as [HTMLDetailsElement, HTMLDetailsElement, HTMLDetailsElement];
    toggle(a, true);
    await settle();
    expect([a.open, b.open, c.open]).toEqual([true, true, true]);

    const native = mount(group([{ defaultOpen: true }, {}]), { supports: { detailsName: true } });
    const [x, y] = details(native.host) as [HTMLDetailsElement, HTMLDetailsElement];
    toggle(y, true);
    await settle();
    expect([x.open, y.open]).toEqual([true, true]); // the browser owns it; jsdom has no native name
  });
});

describe('SJDisclosure retains nothing', () => {
  it('1,000 mount/destroy cycles leave no store, listener or DOM', async () => {
    const before = { ...lifecycle };
    const host = document.createElement('div');
    document.body.appendChild(host);
    for (let i = 0; i < 1000; i++) {
      const app = createApp({
        render: () =>
          h(SJProvider, null, {
            default: () => h(SJDisclosure, { summary: 'x', name: 'g', open: i % 2 === 0 }),
          }),
      });
      app.mount(host);
      toggle(details(host)[0]!, i % 2 !== 0);
      app.unmount();
    }
    await nextTick();
    expect(lifecycle.created - before.created).toBe(1000);
    expect(lifecycle.destroyed - before.destroyed).toBe(1000);
    expect(lifecycle.listeners).toBe(before.listeners);
    expect(host.childNodes.length).toBe(0);
  }, 60_000);
});
