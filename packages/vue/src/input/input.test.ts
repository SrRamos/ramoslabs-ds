// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, inject, nextTick } from 'vue';
import { createRuntime } from '@ramoslabs/core/runtime';
import { KINDS, type Kind } from '@ramoslabs/core/kinds';
import { SJProvider } from '../runtime/index';
import { SJForm } from '../form/index';
import { SJ_FORM, type SJFormContext } from '../form/context';
import { SJField } from '../field/index';
import { SJInput } from './index';

const mounts: Array<() => void> = [];
afterEach(() => {
  while (mounts.length) mounts.pop()!();
  document.body.innerHTML = '';
});

function mount(render: () => ReturnType<typeof h>, userInvalid?: boolean) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const runtime = createRuntime({
    target: 'client',
    ...(userInvalid !== undefined && { supports: { userInvalid } }),
  });
  const app = createApp({
    render: () => h(SJProvider, { runtime }, { default: render }),
  });
  app.mount(host);
  mounts.push(() => app.unmount());
  return { host };
}

// `choice` belongs to SJSelect (C10.a1); the contract's kinds are the rest.
const kinds = (Object.keys(KINDS) as Kind[]).filter((k) => k !== 'choice');

describe('SJInput kind rows (ADR-007)', () => {
  it.each(kinds)(
    '%s: no maxlength, type=number only for quantity, textarea only for address',
    (kind) => {
      const { host } = mount(() => h(SJInput, { kind }));
      const el = host.querySelector('[data-part=control]')!;
      expect(el.hasAttribute('maxlength')).toBe(false);
      expect(el.tagName).toBe(kind === 'address' ? 'TEXTAREA' : 'INPUT');
      if (kind === 'address') expect(el.hasAttribute('type')).toBe(false);
      else expect((el as HTMLInputElement).type === 'number').toBe(kind === 'quantity');
      expect(host.querySelector('.sj-input__root')!.getAttribute('data-kind')).toBe(kind);
    },
  );

  it('resolves the native attributes of an email and a tax-id (identifiers are never type=number)', () => {
    const { host } = mount(
      () => [h(SJInput, { kind: 'email' }), h(SJInput, { kind: 'tax-id' })] as never,
    );
    const [email, tax] = [...host.querySelectorAll('input')];
    expect(email!.type).toBe('email');
    expect(email!.getAttribute('autocomplete')).toBe('email');
    expect(email!.getAttribute('spellcheck')).toBe('false');
    expect(tax!.type).toBe('text');
  });

  it('defaults to text; standalone takes id, name, required and disabled itself', () => {
    const { host } = mount(() =>
      h(SJInput, { id: 'i', name: 'n', required: true, disabled: true, placeholder: 'p' }),
    );
    const el = host.querySelector('input')!;
    expect(el.type).toBe('text');
    expect([el.id, el.name, el.required, el.disabled, el.placeholder]).toEqual([
      'i',
      'n',
      true,
      true,
      'p',
    ]);
    expect(el.hasAttribute('aria-describedby')).toBe(false);
  });

  it('class and style go to the root, other attrs to the control; classes append', () => {
    const { host } = mount(() =>
      h(SJInput, {
        class: 'mine',
        style: 'color: red',
        'aria-label': 'x',
        classes: { root: 'r', control: 'c' },
      }),
    );
    const root = host.querySelector('.sj-input__root') as HTMLElement;
    expect(root.className).toBe('sj-input__root mine r');
    expect(root.style.color).toBe('red');
    const el = host.querySelector('input')!;
    expect(el.className).toBe('sj-input__control c');
    expect(el.getAttribute('aria-label')).toBe('x');
  });

  it('a consumer handler and the library handler both run', async () => {
    const seen: string[] = [];
    const { host } = mount(() => h(SJInput, { onChange: () => seen.push('mine') }));
    const el = host.querySelector('input')!;
    el.value = 'a';
    el.dispatchEvent(new Event('change'));
    expect(seen).toEqual(['mine']);
    await nextTick();
    expect(el.getAttribute('data-touched')).toBe('true');
  });
});

describe('SJInput inside SJField and SJForm', () => {
  it('reports its kind to the field and reads the Enter hint from the form (textarea excluded)', async () => {
    const { host } = mount(() =>
      h(SJForm, null, {
        default: () => [
          h(SJField, { id: 'a', name: 'a' }, { default: () => h(SJInput, { kind: 'email' }) }),
          h(SJField, { id: 'b', name: 'b' }, { default: () => h(SJInput, { kind: 'phone' }) }),
          h(SJField, { id: 'c', name: 'c' }, { default: () => h(SJInput, { kind: 'address' }) }),
        ],
      }),
    );
    await nextTick();
    const hint = (id: string) => host.querySelector(`#${id}`)!.getAttribute('enterkeyhint');
    expect([hint('a'), hint('b'), hint('c')]).toEqual(['next', 'go', 'enter']);
  });

  it('a kind change re-reports to the form', async () => {
    const { host } = mount(() =>
      h(
        SJForm,
        { fields: undefined },
        {
          default: () => [
            h(SJField, { id: 'a', name: 'a' }, { default: () => h(SJInput, { kind: 'text' }) }),
            h(SJField, { id: 'b', name: 'b' }, { default: () => h(SJInput, { kind: 'address' }) }),
          ],
        },
      ),
    );
    await nextTick();
    // textarea is excluded from the position computation: the text input is the last editable one.
    expect(host.querySelector('#a')!.getAttribute('enterkeyhint')).toBe('go');
    expect(host.querySelector('#b')!.getAttribute('enterkeyhint')).toBe('enter');
  });

  it('hands entered values to the form owner (3.3.7); secrets are never retained', async () => {
    let ctx: SJFormContext | undefined;
    const Probe = defineComponent({
      setup() {
        ctx = inject(SJ_FORM);
        return () => h('i');
      },
    });
    const { host } = mount(() =>
      h(
        SJForm,
        {
          fields: [
            { key: 'e', kind: 'email' },
            { key: 'p', kind: 'password' },
          ],
        },
        {
          default: () => [
            h(SJField, { id: 'e', name: 'e' }, { default: () => h(SJInput, { kind: 'email' }) }),
            h(SJField, { id: 'p', name: 'p' }, { default: () => h(SJInput, { kind: 'password' }) }),
            h(SJField, { id: 'x', name: 'x' }, { default: () => h(SJInput) }),
            h(Probe),
          ],
        },
      ),
    );
    const type = (id: string, v: string) => {
      const el = host.querySelector<HTMLInputElement>(`#${id}`)!;
      el.value = v;
      el.dispatchEvent(new Event('change'));
    };
    type('e', 'a@b.co');
    type('p', 'hunter2');
    expect(ctx!.owner.prior('e')).toBe('a@b.co');
    expect(ctx!.owner.prior('p')).toBeUndefined();
    expect(ctx!.owner.offers('x')).toEqual(['a@b.co']);
    type('e', '');
    expect(ctx!.owner.prior('e')).toBeUndefined();
  });
});

describe(':user-invalid fallback (touched)', () => {
  it('change and invalid touch the control; blur alone does not; the form reset clears it', async () => {
    const { host } = mount(() => h('form', null, h(SJInput, { required: true })), false);
    const el = host.querySelector('input')!;
    const form = host.querySelector('form')!;
    el.dispatchEvent(new Event('blur'));
    await nextTick();
    expect(el.hasAttribute('data-touched')).toBe(false);
    el.dispatchEvent(new Event('change'));
    await nextTick();
    expect(el.getAttribute('data-touched')).toBe('true');
    form.dispatchEvent(new Event('reset'));
    await nextTick();
    expect(el.hasAttribute('data-touched')).toBe(false);
    el.dispatchEvent(new Event('invalid'));
    await nextTick();
    expect(el.getAttribute('data-touched')).toBe('true');
  });

  it('is inert with native :user-invalid support', async () => {
    const { host } = mount(() => h(SJInput), true);
    const el = host.querySelector('input')!;
    el.dispatchEvent(new Event('change'));
    el.dispatchEvent(new Event('invalid'));
    await nextTick();
    expect(el.hasAttribute('data-touched')).toBe(false);
  });

  it('a consumer cannot fake data-touched', () => {
    const { host } = mount(() => h(SJInput, { 'data-touched': 'true' }));
    expect(host.querySelector('input')!.hasAttribute('data-touched')).toBe(false);
  });
});
