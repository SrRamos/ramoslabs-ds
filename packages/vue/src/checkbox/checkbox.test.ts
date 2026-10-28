// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { SJProvider } from '../runtime/index';
import { SJCheckbox } from './index';

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

// Count commits through the effect queue: every `commit()` drains the layout lane exactly once.
const drains = vi.hoisted(() => ({ layout: 0 }));
vi.mock('@ramoslabs/core/effects', async (orig) => {
  const mod = await orig<typeof import('@ramoslabs/core/effects')>();
  return {
    ...mod,
    createEffectQueue: ((...args: Parameters<typeof mod.createEffectQueue>) => {
      const q = mod.createEffectQueue(...args);
      const drain = q.drain.bind(q);
      return {
        ...q,
        get draining() {
          return q.draining;
        },
        drain: ((host: never, lane?: string) => {
          if (lane === 'layout') drains.layout++;
          return drain(host, lane as never);
        }) as typeof q.drain,
      };
    }) as typeof mod.createEffectQueue,
  };
});

const ACCEPTED_COMMITS = 1; // the post-flush watcher; the owner's re-render adds none
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

describe('SJCheckbox markup', () => {
  it('renders a real checkbox input (no role) inside a wrapping label', () => {
    const { host } = mount(() => h(SJCheckbox, { label: 'Wifi', name: 'wifi' }));
    const el = input(host);
    expect(el.type).toBe('checkbox');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.closest('label')?.className).toContain('sj-checkbox__root');
    expect(host.textContent).toBe('Wifi');
    expect(el.hasAttribute('aria-checked')).toBe(false);
    expect(host.querySelectorAll('input').length).toBe(1);
  });

  it('prop or slot for the label (slot wins) and classes per part', () => {
    const { host } = mount(() =>
      h(
        SJCheckbox,
        { label: 'prop', classes: { root: 'r', control: 'c', indicator: 'i', label: 'l' } },
        { default: () => 'slot' },
      ),
    );
    expect(host.textContent).toBe('slot');
    expect(host.querySelector('label')!.className).toBe('sj-checkbox__root r');
    expect(input(host).className).toBe('sj-checkbox__control c');
    expect(host.querySelector('[data-part=indicator]')!.className).toBe('sj-checkbox__indicator i');
    expect(host.querySelector('.sj-checkbox__label')!.className).toBe('sj-checkbox__label l');
  });

  it('forwards attrs to the input and class to the root; library-owned attrs win', () => {
    const { host } = mount(() =>
      h(SJCheckbox, { 'aria-label': 'x', class: 'mine', role: 'checkbox', type: 'text' }),
    );
    expect(input(host).getAttribute('aria-label')).toBe('x');
    expect(host.querySelector('label')!.className).toContain('mine');
    expect(input(host).type).toBe('checkbox');
    expect(input(host).hasAttribute('role')).toBe(true); // consumer attrs pass through; type stays library-owned
  });
});

describe('SJCheckbox uncontrolled', () => {
  it('honours defaultChecked and toggles on click, emitting both events', async () => {
    const updates: boolean[] = [];
    const changes: unknown[] = [];
    const { host } = mount(() =>
      h(SJCheckbox, {
        defaultChecked: true,
        'onUpdate:checked': (v: boolean) => updates.push(v),
        onCheckedChange: (p: unknown) => changes.push(p),
      }),
    );
    const el = input(host);
    expect(el.checked).toBe(true);
    expect(el.dataset.state).toBe('checked');
    el.click();
    await nextTick();
    expect(el.checked).toBe(false);
    expect(el.dataset.state).toBe('unchecked');
    expect(host.querySelector('label')!.dataset.state).toBe('unchecked');
    expect(updates).toEqual([false]);
    expect(changes).toEqual([{ checked: false }]);
  });
});

describe('SJCheckbox controlled (v-model:checked)', () => {
  it('follows the parent value', async () => {
    const on = ref(false);
    const { host } = mount(() =>
      h(SJCheckbox, { checked: on.value, 'onUpdate:checked': (v: boolean) => (on.value = v) }),
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
    expect(el.dataset.state).toBe('unchecked');
  });

  it('corrects the input when the owner rejects the change', async () => {
    const seen: boolean[] = [];
    const { host } = mount(() =>
      h(SJCheckbox, { checked: false, 'onUpdate:checked': (v: boolean) => seen.push(v) }),
    );
    const el = input(host);
    el.click(); // the native input flips to true
    await nextTick();
    await nextTick();
    expect(seen).toEqual([true]);
    expect(el.checked).toBe(false); // corrective `checked` effect restored it
    expect(el.dataset.state).toBe('unchecked');
  });

  it('commits once per accepted change; a rejected change still resyncs (G3A SHOULD-3)', async () => {
    const on = ref(false);
    const { host } = mount(() =>
      h(SJCheckbox, { checked: on.value, 'onUpdate:checked': (v: boolean) => (on.value = v) }),
    );
    const el = input(host);
    await nextTick();
    const settle = async () => {
      for (let i = 0; i < 4; i++) await nextTick();
    };
    await settle();
    const before = drains.layout;
    el.click();
    await settle();
    const accepted = drains.layout - before;
    expect(el.checked).toBe(true);
    expect(accepted).toBe(ACCEPTED_COMMITS);

    // Rejection: no owner render happens, so exactly one forced commit restores the input.
    const rejected = mount(() => h(SJCheckbox, { checked: false }));
    const rel = input(rejected.host);
    await settle();
    const rb = drains.layout;
    rel.click();
    await settle();
    expect(rel.checked).toBe(false);
    expect(drains.layout - rb).toBe(1);
  });

  it('keeps correcting repeated rejections', async () => {
    const { host } = mount(() => h(SJCheckbox, { checked: true }));
    const el = input(host);
    for (let i = 0; i < 3; i++) {
      el.click();
      await nextTick();
      await nextTick();
      expect(el.checked).toBe(true);
    }
  });
});

describe('SJCheckbox disabled', () => {
  it('uses native disabled and does not toggle or emit', async () => {
    const updates: boolean[] = [];
    const { host } = mount(() =>
      h(SJCheckbox, { disabled: true, 'onUpdate:checked': (v: boolean) => updates.push(v) }),
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

describe('SJCheckbox form state equals a bare checkbox', () => {
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
    mount(() => h(SJCheckbox, props), form);
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
    expect(input(form).dataset.state).toBe('unchecked');
    input(form).click(); // the model re-synced: this click turns it on, not a stale no-op
    await nextTick();
    expect(entries(form)).toEqual([['n', 'on']]);
  });
});

describe('SJCheckbox indeterminate', () => {
  it('applies the property after mount (never an attribute) and on every change', async () => {
    const mixed = ref(true);
    const { host } = mount(() =>
      h(SJCheckbox, {
        indeterminate: mixed.value,
        'onUpdate:indeterminate': (v: boolean) => (mixed.value = v),
      }),
    );
    const el = input(host);
    expect(el.indeterminate).toBe(true);
    expect(el.hasAttribute('indeterminate')).toBe(false);
    expect(el.dataset.state).toBe('indeterminate');
    mixed.value = false;
    await nextTick();
    expect(el.indeterminate).toBe(false);
    mixed.value = true;
    await nextTick();
    expect(el.indeterminate).toBe(true);
  });

  it('uncontrolled default; a click clears it and checks like a bare input', async () => {
    const checks: boolean[] = [];
    const mixes: boolean[] = [];
    const { host } = mount(() =>
      h(SJCheckbox, {
        defaultIndeterminate: true,
        'onUpdate:checked': (v: boolean) => checks.push(v),
        'onUpdate:indeterminate': (v: boolean) => mixes.push(v),
      }),
    );
    const el = input(host);
    const bare = document.createElement('input');
    bare.type = 'checkbox';
    bare.indeterminate = true;
    expect(el.indeterminate).toBe(true);
    el.click();
    bare.click();
    await nextTick();
    expect(el.indeterminate).toBe(bare.indeterminate);
    expect(el.checked).toBe(bare.checked);
    expect(el.indeterminate).toBe(false);
    expect(el.dataset.state).toBe('checked');
    expect(checks).toEqual([true]);
    expect(mixes).toEqual([false]);
  });

  it('a controlled owner that keeps indeterminate is corrected after the click', async () => {
    const { host } = mount(() => h(SJCheckbox, { checked: false, indeterminate: true }));
    const el = input(host);
    el.click();
    await nextTick();
    await nextTick();
    expect(el.indeterminate).toBe(true);
    expect(el.checked).toBe(false);
    expect(el.dataset.state).toBe('indeterminate');
  });

  it('reset leaves indeterminate alone and re-syncs checked', async () => {
    const form = document.createElement('form');
    mount(
      () => h(SJCheckbox, { name: 'n', defaultChecked: true, defaultIndeterminate: true }),
      form,
    );
    const el = input(form);
    el.click(); // unchecked, indeterminate cleared
    await nextTick();
    el.indeterminate = true;
    form.reset();
    await new Promise((r) => setTimeout(r, 5));
    expect(el.checked).toBe(true);
    expect(el.indeterminate).toBe(true);
    expect(el.dataset.state).toBe('indeterminate');
    el.click();
    await nextTick();
    expect(el.checked).toBe(false);
    expect(el.indeterminate).toBe(false);
  });

  it('reset restores a checked default like a bare input', async () => {
    const form = document.createElement('form');
    mount(() => h(SJCheckbox, { name: 'n', defaultChecked: true }), form);
    input(form).click();
    await nextTick();
    form.reset();
    await new Promise((r) => setTimeout(r, 5));
    expect([...new FormData(form).entries()]).toEqual([['n', 'on']]);
    expect(input(form).dataset.state).toBe('checked');
  });
});

describe('SJCheckbox retains nothing', () => {
  it('1,000 mount/destroy cycles leave no store, listener or DOM', async () => {
    const before = { ...lifecycle };
    const host = document.createElement('div');
    document.body.appendChild(host);
    for (let i = 0; i < 1000; i++) {
      const app = createApp({
        render: () =>
          h(SJProvider, null, {
            default: () => h(SJCheckbox, { label: 'x', checked: i % 2 === 0 }),
          }),
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
    // 1,000 jsdom mounts exceed the 5 s default on CI runners; this is a leak check, not a speed check.
  }, 60_000);
});
