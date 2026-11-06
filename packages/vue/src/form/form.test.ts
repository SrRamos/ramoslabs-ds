// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { SJProvider } from '../runtime/index';
import { SJField } from '../field/index';
import { SJInput } from '../input/index';
import { SJForm } from './index';

const mounts: Array<() => void> = [];
afterEach(() => {
  while (mounts.length) mounts.pop()!();
  document.body.innerHTML = '';
});
function mount(render: () => ReturnType<typeof h>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp({ render: () => h(SJProvider, null, { default: render }) });
  app.mount(host);
  mounts.push(() => app.unmount());
  return { host };
}
const field = (id: string, kind: 'text' | 'email' | 'address' | 'otp' | 'password' = 'text') =>
  h(SJField, { id, name: id }, { default: () => h(SJInput, { kind }) });
const hints = (host: HTMLElement) =>
  [...host.querySelectorAll('input, textarea')].map((e) => e.getAttribute('enterkeyhint'));

describe('SJForm root', () => {
  it('is a native form: class, data-part, no handlers, no novalidate', () => {
    const { host } = mount(() =>
      h(SJForm, {
        class: 'mine',
        classes: { root: 'r' },
        'aria-label': 'Sign in',
        action: '/submit',
      }),
    );
    const form = host.querySelector('form')!;
    expect(form.className).toBe('sj-form__root mine r');
    expect(form.getAttribute('data-part')).toBe('root');
    expect(form.getAttribute('aria-label')).toBe('Sign in');
    expect(form.hasAttribute('novalidate')).toBe(false);
    expect(form.getAttribute('action')).toBe('/submit');
    expect(form.getAttributeNames().sort()).toEqual(['action', 'aria-label', 'class', 'data-part']);
  });
});

describe('SJForm Enter position', () => {
  it('the last editable field gets go, the others next', async () => {
    const { host } = mount(() => h(SJForm, null, () => [field('a'), field('b'), field('c')]));
    await nextTick();
    expect(hints(host)).toEqual(['next', 'next', 'go']);
  });

  it('submits=false gives the last field done; enter wins', async () => {
    const quiet = mount(() => h(SJForm, { submits: false }, () => [field('a'), field('b')]));
    await nextTick();
    expect(hints(quiet.host)).toEqual(['next', 'done']);
    const search = mount(() => h(SJForm, { enter: 'search' }, () => [field('a'), field('b')]));
    await nextTick();
    expect(hints(search.host)).toEqual(['next', 'search']);
  });

  it('a trailing textarea is excluded: the last single-line field is last', async () => {
    const { host } = mount(() =>
      h(SJForm, null, () => [field('a'), field('b'), field('c', 'address')]),
    );
    await nextTick();
    expect(hints(host)).toEqual(['next', 'go', 'enter']);
  });

  it('one-time code submits on Enter with autoSubmit, else done', async () => {
    const off = mount(() => h(SJForm, null, () => [field('a', 'otp')]));
    await nextTick();
    expect(hints(off.host)).toEqual(['done']);
    const on = mount(() => h(SJForm, { autoSubmit: true }, () => [field('a', 'otp')]));
    await nextTick();
    expect(hints(on.host)).toEqual(['go']);
  });

  it('the data-first fields prop sets the hints before any field registers (SSR order)', () => {
    const fields = [{ key: 'a' }, { key: 'b' }];
    const { host } = mount(() => h(SJForm, { fields }, () => [field('a'), field('b')]));
    expect(hints(host)).toEqual(['next', 'go']);
  });

  it('follows prop changes without remounting', async () => {
    const submits = ref(true);
    const { host } = mount(() => h(SJForm, { submits: submits.value }, () => [field('a')]));
    await nextTick();
    expect(hints(host)).toEqual(['go']);
    submits.value = false;
    await nextTick();
    expect(hints(host)).toEqual(['done']);
  });

  it('a field added later registers and the former last field becomes next', async () => {
    const more = ref(false);
    const { host } = mount(() =>
      h(SJForm, null, () => [field('a'), ...(more.value ? [field('b')] : [])]),
    );
    await nextTick();
    expect(hints(host)).toEqual(['go']);
    more.value = true;
    await nextTick();
    await nextTick();
    expect(hints(host)).toEqual(['next', 'go']);
  });
});

describe('SJForm DOM order', () => {
  it('a field inserted before another takes its DOM position; a reorder re-registers', async () => {
    const early = ref(false);
    const { host } = mount(() =>
      h(SJForm, null, () => [...(early.value ? [field('a')] : []), field('b'), field('c')]),
    );
    await nextTick();
    expect(hints(host)).toEqual(['next', 'go']);
    early.value = true;
    await nextTick();
    await nextTick();
    expect(hints(host)).toEqual(['next', 'next', 'go']);
  });
});
