// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { SJProvider } from '../runtime/index';
import { SJSwitch } from './index';

// Count store lifecycles through the runtime's own createStore import.
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
  render: () => ReturnType<typeof h>,
  host: HTMLElement = document.createElement('div'),
) {
  document.body.appendChild(host);
  const app = createApp({ render: () => h(SJProvider, null, { default: render }) });
  app.mount(host);
  const unmount = () => app.unmount();
  mounts.push(unmount);
  return { host, unmount };
}
const input = (host: HTMLElement) => host.querySelector('input') as HTMLInputElement;

describe('SJSwitch markup', () => {
  it('renders a real checkbox input with role=switch inside a wrapping label', () => {
    const { host } = mount(() => h(SJSwitch, { label: 'Wifi', name: 'wifi' }));
    const el = input(host);
    expect(el.type).toBe('checkbox');
    expect(el.getAttribute('role')).toBe('switch');
    expect(el.closest('label')?.className).toContain('sj-switch__root');
    expect(host.textContent).toBe('Wifi');
    expect(el.hasAttribute('aria-checked')).toBe(false);
    expect(host.querySelectorAll('input').length).toBe(1);
  });

  it('prop or slot for the label (slot wins) and classes per part', () => {
    const { host } = mount(() =>
      h(
        SJSwitch,
        { label: 'prop', classes: { root: 'r', control: 'c', thumb: 't', label: 'l' } },
        { default: () => 'slot' },
      ),
    );
    expect(host.textContent).toBe('slot');
    expect(host.querySelector('label')!.className).toBe('sj-switch__root r');
    expect(input(host).className).toBe('sj-switch__control c');
    expect(host.querySelector('[data-part=thumb]')!.className).toBe('sj-switch__thumb t');
    expect(host.querySelector('.sj-switch__label')!.className).toBe('sj-switch__label l');
  });

  it('forwards attrs to the input and class to the root; library-owned attrs win', () => {
    const { host } = mount(() =>
      h(SJSwitch, { 'aria-label': 'x', class: 'mine', role: 'checkbox', type: 'text' }),
    );
    expect(input(host).getAttribute('aria-label')).toBe('x');
    expect(host.querySelector('label')!.className).toContain('mine');
    expect(input(host).type).toBe('checkbox');
    expect(input(host).getAttribute('role')).toBe('switch');
  });
});

describe('SJSwitch uncontrolled', () => {
  it('honours defaultChecked and toggles on click, emitting both events', async () => {
    const updates: boolean[] = [];
    const changes: unknown[] = [];
    const { host } = mount(() =>
      h(SJSwitch, {
        defaultChecked: true,
        'onUpdate:checked': (v: boolean) => updates.push(v),
        onCheckedChange: (p: unknown) => changes.push(p),
      }),
    );
    const el = input(host);
    expect(el.checked).toBe(true);
    expect(el.dataset.state).toBe('on');
    el.click();
    await nextTick();
    expect(el.checked).toBe(false);
    expect(el.dataset.state).toBe('off');
    expect(host.querySelector('label')!.dataset.state).toBe('off');
    expect(updates).toEqual([false]);
    expect(changes).toEqual([{ checked: false }]);
  });
});

describe('SJSwitch controlled (v-model:checked)', () => {
  it('follows the parent value', async () => {
    const on = ref(false);
    const { host } = mount(() =>
      h(SJSwitch, { checked: on.value, 'onUpdate:checked': (v: boolean) => (on.value = v) }),
    );
    const el = input(host);
    el.click();
    await nextTick();
    await nextTick();
    expect(on.value).toBe(true);
    expect(el.checked).toBe(true);
    on.value = false;
    await nextTick();
    expect(el.checked).toBe(false);
    expect(el.dataset.state).toBe('off');
  });

  it('corrects the input when the owner rejects the change', async () => {
    const seen: boolean[] = [];
    const { host } = mount(() =>
      h(SJSwitch, { checked: false, 'onUpdate:checked': (v: boolean) => seen.push(v) }),
    );
    const el = input(host);
    el.click(); // the native input flips to true
    await nextTick();
    await nextTick();
    expect(seen).toEqual([true]);
    expect(el.checked).toBe(false); // corrective `checked` effect restored it
    expect(el.dataset.state).toBe('off');
  });

  it('keeps correcting repeated rejections', async () => {
    const { host } = mount(() => h(SJSwitch, { checked: true }));
    const el = input(host);
    for (let i = 0; i < 3; i++) {
      el.click();
      await nextTick();
      await nextTick();
      expect(el.checked).toBe(true);
    }
  });
});

describe('SJSwitch disabled', () => {
  it('uses native disabled and does not toggle or emit', async () => {
    const updates: boolean[] = [];
    const { host } = mount(() =>
      h(SJSwitch, { disabled: true, 'onUpdate:checked': (v: boolean) => updates.push(v) }),
    );
    const el = input(host);
    expect(el.disabled).toBe(true);
    expect(el.hasAttribute('aria-disabled')).toBe(false);
    expect(host.querySelector('label')!.dataset.disabled).toBe('true');
    el.click();
    await nextTick();
    expect(el.checked).toBe(false);
    expect(updates).toEqual([]);
  });
});

describe('SJSwitch form state equals a bare checkbox', () => {
  const bare = (attrs: Record<string, string | boolean>) => {
    const f = document.createElement('form');
    const i = document.createElement('input');
    i.type = 'checkbox';
    for (const [k, v] of Object.entries(attrs)) {
      if (v === true) i.setAttribute(k, '');
      else if (v !== false) i.setAttribute(k, v);
    }
    f.appendChild(i);
    return f;
  };
  const entries = (f: HTMLFormElement) => [...new FormData(f).entries()];
  const sj = (props: Record<string, unknown>) => {
    const form = document.createElement('form');
    mount(() => h(SJSwitch, props), form);
    return form;
  };

  it.each([
    ['off', { name: 'n' }, { name: 'n' }],
    ['on', { name: 'n', defaultChecked: true }, { name: 'n', checked: true }],
    [
      'custom value',
      { name: 'n', value: 'yes', defaultChecked: true },
      { name: 'n', value: 'yes', checked: true },
    ],
    [
      'disabled on',
      { name: 'n', disabled: true, defaultChecked: true },
      { name: 'n', disabled: true, checked: true },
    ],
    ['no name', { defaultChecked: true }, { checked: true }],
    [
      'long label',
      { name: 'n', label: 'x'.repeat(5000), defaultChecked: true },
      { name: 'n', checked: true },
    ],
  ])('%s', (_label, props, attrs) => {
    expect(entries(sj(props))).toEqual(entries(bare(attrs)));
  });

  it('matches after a user toggle', async () => {
    const form = sj({ name: 'n', value: 'v' });
    const b = bare({ name: 'n', value: 'v' });
    input(form).click();
    (b.querySelector('input') as HTMLInputElement).click();
    await nextTick();
    expect(entries(form)).toEqual(entries(b));
    expect(entries(form)).toEqual([['n', 'v']]);
  });

  it('reset restores the default like a bare input', async () => {
    const form = sj({ name: 'n' });
    input(form).click();
    await nextTick();
    form.reset();
    await new Promise((r) => setTimeout(r, 5));
    expect(entries(form)).toEqual([]);
    expect(input(form).dataset.state).toBe('off');
    input(form).click(); // the model re-synced: this click turns it on, not a stale no-op
    await nextTick();
    expect(entries(form)).toEqual([['n', 'on']]);
  });
});

describe('SJSwitch retains nothing', () => {
  it('1,000 mount/destroy cycles leave no store, listener or DOM', async () => {
    const before = { ...lifecycle };
    const host = document.createElement('div');
    document.body.appendChild(host);
    for (let i = 0; i < 1000; i++) {
      const app = createApp({
        render: () =>
          h(SJProvider, null, { default: () => h(SJSwitch, { label: 'x', checked: i % 2 === 0 }) }),
      });
      app.mount(host);
      input(host).click();
      app.unmount();
    }
    await nextTick();
    expect(lifecycle.created - before.created).toBe(1000);
    expect(lifecycle.destroyed - before.destroyed).toBe(1000);
    expect(lifecycle.listeners).toBe(before.listeners);
    expect(host.childNodes.length).toBe(0);
  });
});
