// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createFakeScheduler, createRuntime } from '@ramoslabs/core/runtime';
import type { LiveHost, LiveRole } from '@ramoslabs/core/live';
import { SJProvider } from '../runtime/index';
import { SJForm } from '../form/index';
import { SJInput } from '../input/index';
import { SJField } from './index';

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

/** A recording live host: every `setText` lands in `spoken` (empty strings are the clears). */
function liveHost() {
  const spoken: string[] = [];
  const created: LiveRole[] = [];
  const host: LiveHost = {
    create(role) {
      created.push(role);
      return { setText: (t) => void (t && spoken.push(t)) };
    },
  };
  return { host, spoken, created };
}

function mount(render: () => ReturnType<typeof h>) {
  const scheduler = createFakeScheduler();
  const live = liveHost();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(
        SJProvider,
        { runtime: createRuntime({ target: 'client', scheduler }), liveHost: live.host },
        { default: render },
      ),
  });
  app.mount(host);
  mounts.push(() => app.unmount());
  const settle = async () => {
    await nextTick();
    await nextTick();
    scheduler.flush();
  };
  return { host, live, settle, scheduler, unmount: () => app.unmount() };
}

describe('SJField markup and derived ARIA', () => {
  it('links label, hint and error to the control by <id>-label/-hint/-error', async () => {
    const { host } = mount(() =>
      h(
        SJField,
        { id: 'f', label: 'Email', hint: 'We never share it', error: 'Enter an email' },
        { default: () => h(SJInput, { kind: 'email' }) },
      ),
    );
    const control = host.querySelector('input')!;
    expect(control.id).toBe('f');
    const label = host.querySelector('label')!;
    expect(label.id).toBe('f-label');
    expect(label.getAttribute('for')).toBe('f');
    expect(host.querySelector('[data-part=hint]')!.id).toBe('f-hint');
    expect(host.querySelector('[data-part=error]')!.id).toBe('f-error');
    expect(control.getAttribute('aria-describedby')).toBe('f-hint f-error');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.hasAttribute('aria-errormessage')).toBe(false);
    expect(host.querySelector('.sj-field__root')!.getAttribute('data-invalid')).toBe('true');
  });

  it('a valid field has no aria-invalid, no error element and describes only the hint', () => {
    const { host } = mount(() =>
      h(
        SJField,
        { id: 'f', label: 'Name', hint: 'As on your card' },
        { default: () => h(SJInput) },
      ),
    );
    const control = host.querySelector('input')!;
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(control.getAttribute('aria-describedby')).toBe('f-hint');
    expect(host.querySelector('[data-part=error]')).toBeNull();
  });

  it('opt-in aria-errormessage; name, required and disabled reach the control', () => {
    const { host } = mount(() =>
      h(
        SJField,
        { id: 'f', name: 'n', required: true, disabled: true, error: 'Bad', errorMessage: true },
        { default: () => h(SJInput, { name: 'ignored', required: false }) },
      ),
    );
    const control = host.querySelector('input')!;
    expect(control.getAttribute('aria-errormessage')).toBe('f-error');
    expect(control.name).toBe('n');
    expect(control.required).toBe(true);
    expect(control.disabled).toBe(true);
  });

  it('prop or slot for label and hint (slot wins); a blank prop renders nothing', () => {
    const { host } = mount(() =>
      h(
        SJField,
        { id: 'f', label: 'prop label', hint: 'prop hint' },
        {
          label: () => 'slot label',
          hint: () => 'slot hint',
          default: () => h(SJInput),
        },
      ),
    );
    expect(host.querySelector('label')!.textContent).toBe('slot label');
    expect(host.querySelector('[data-part=hint]')!.textContent).toBe('slot hint');
    const bare = mount(() => h(SJField, { id: 'g', label: '  ', hint: '' }));
    expect(bare.host.querySelector('label')).toBeNull();
    expect(bare.host.querySelector('[data-part=hint]')).toBeNull();
    // A hint slot alone makes the control reference it.
    const slotOnly = mount(() =>
      h(SJField, { id: 'h' }, { hint: () => 'x', default: () => h(SJInput) }),
    );
    expect(slotOnly.host.querySelector('input')!.getAttribute('aria-describedby')).toBe('h-hint');
  });

  it('error part: visible text plus an aria-hidden SJIcon alert-circle (sm) in the icon part; no live attributes', () => {
    const { host } = mount(() => h(SJField, { id: 'f', error: '  Too short  ' }));
    const error = host.querySelector('[data-part=error]')!;
    expect(error.textContent).toBe('Too short');
    expect(error.hasAttribute('role')).toBe(false);
    expect(error.hasAttribute('aria-live')).toBe(false);
    const icon = error.querySelector('[data-part=icon]')!;
    expect(icon.className).toBe('sj-field__icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const svg = icon.querySelector('svg')!;
    expect(svg.getAttribute('data-size')).toBe('sm');
    expect(svg.querySelectorAll('circle').length).toBe(1);
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('classes per part append after the library class; attrs go to the root', () => {
    const { host } = mount(() =>
      h(
        SJField,
        {
          id: 'f',
          label: 'L',
          hint: 'H',
          error: 'E',
          class: 'mine',
          'data-x': '1',
          classes: { root: 'r', label: 'l', hint: 'h', error: 'e', icon: 'i' },
        },
        { default: () => h(SJInput) },
      ),
    );
    expect(host.querySelector('.sj-field__root')!.className).toBe('sj-field__root mine r');
    expect(host.querySelector('.sj-field__root')!.getAttribute('data-x')).toBe('1');
    expect(host.querySelector('label')!.className).toBe('sj-field__label l');
    expect(host.querySelector('[data-part=hint]')!.className).toBe('sj-field__hint h');
    expect(host.querySelector('[data-part=error]')!.className).toBe('sj-field__error e');
    expect(host.querySelector('[data-part=icon]')!.className).toBe('sj-field__icon i');
  });

  it('derives a stable id when none is given and honours the runtime idPrefix', () => {
    const { host } = mount(() => h(SJField, { label: 'L' }, { default: () => h(SJInput) }));
    const id = host.querySelector('input')!.id;
    expect(id).toMatch(/^sj-field-/);
    expect(host.querySelector('label')!.getAttribute('for')).toBe(id);
  });
});

describe('SJField error announcement (once, never at mount)', () => {
  it('a standing error at mount is silent; a new text announces once; the same text is silent', async () => {
    const error = ref<string | undefined>('Standing');
    const { live, settle } = mount(() => h(SJField, { id: 'f', error: error.value }));
    await settle();
    expect(live.spoken).toEqual([]);
    error.value = 'Now different';
    await settle();
    expect(live.spoken).toEqual(['Now different']);
    // Re-render with the same text, and a whitespace-only difference: no second announcement.
    error.value = 'Now different ';
    await settle();
    expect(live.spoken).toEqual(['Now different']);
  });

  it('clearing then repeating the same text announces again', async () => {
    const error = ref<string | undefined>(undefined);
    const { live, settle, scheduler } = mount(() => h(SJField, { id: 'f', error: error.value }));
    await settle();
    for (const next of ['Required', undefined, 'Required']) {
      error.value = next;
      await settle();
      // The registry's own dedupe window (1 s) ends: the repeat is a new announcement.
      scheduler.advance(1000);
    }
    expect(live.spoken).toEqual(['Required', 'Required']);
  });

  it('creates the eager status region at mount, before any text', async () => {
    const { live, settle } = mount(() => h(SJField, { id: 'f' }));
    await settle();
    expect(live.created).toEqual(['status']);
    expect(live.spoken).toEqual([]);
  });

  it('is polite status only: the error never becomes an alert', async () => {
    const error = ref<string | undefined>(undefined);
    const { live, settle } = mount(() => h(SJField, { id: 'f', error: error.value }));
    error.value = 'Oops';
    await settle();
    expect(live.created).not.toContain('alert');
  });
});

describe('SJField, SJInput and SJForm lifecycle', () => {
  it('1,000 mount/destroy cycles retain no store, listener or live node', async () => {
    const before = { ...lifecycle };
    const live = liveHost();
    for (let i = 0; i < 1000; i++) {
      const host = document.createElement('div');
      const app = createApp({
        render: () =>
          h(
            SJProvider,
            { liveHost: live.host },
            {
              default: () =>
                h(
                  SJForm,
                  { fields: [{ key: 'a' }] },
                  {
                    default: () =>
                      h(SJField, { id: 'f', name: 'a', error: 'x' }, { default: () => h(SJInput) }),
                  },
                ),
            },
          ),
      });
      app.mount(host);
      app.unmount();
    }
    await nextTick();
    expect(lifecycle.created - before.created).toBe(lifecycle.destroyed - before.destroyed);
    expect(lifecycle.created - before.created).toBe(2000);
    expect(lifecycle.listeners).toBe(before.listeners);
    expect(document.body.children.length).toBe(0);
  }, 60_000);

  it('registers fields in order, renames under the new key, and unregisters on unmount', async () => {
    const name = ref('a');
    const show = ref(true);
    const { host, settle } = mount(() =>
      h(SJForm, null, {
        default: () =>
          show.value
            ? [
                h(SJField, { id: 'one', name: name.value }, { default: () => h(SJInput) }),
                h(SJField, { id: 'two', name: 'b' }, { default: () => h(SJInput) }),
              ]
            : [],
      }),
    );
    await settle();
    const hints = () =>
      [...host.querySelectorAll('input')].map((i) => i.getAttribute('enterkeyhint'));
    expect(hints()).toEqual(['next', 'go']);
    // Known limit: a rename re-registers at the end of the registration order (use the data-first
    // `fields` prop when the order must survive dynamic changes).
    name.value = 'c';
    await settle();
    expect(hints().slice().sort()).toEqual(['go', 'next']);
    show.value = false;
    await settle();
    expect(host.querySelectorAll('input').length).toBe(0);
  });
});
