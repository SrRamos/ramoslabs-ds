import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, createRef, useContext, type ReactNode } from 'react';
import type { FormOwner } from '@ramoslabs/core/form';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import { KINDS } from '@ramoslabs/core/kinds';
import { SJProvider } from '../runtime/index';
import { SJField } from '../field/index';
import { SJForm, SJFormContext } from '../form/index';
import { SJInput, SJInputRoot } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let renderers: ReactTestRenderer[] = [];
let forms: EventTarget[] = [];
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const r of renderers) act(() => r.unmount());
  renderers = [];
  forms = [];
});

function mount(node: ReactNode, supports?: { userInvalid: boolean }): ReactTestRenderer {
  let r!: ReactTestRenderer;
  const form = new EventTarget();
  forms.push(form);
  act(() => {
    r = create(
      h(
        SJProvider,
        {
          liveHost: () => ({ create: () => ({ setText() {} }) }),
          ...(supports && { supports }),
        },
        node,
      ),
      { createNodeMock: () => ({ form }) },
    );
  });
  renderers.push(r);
  return r;
}
const control = (r: ReactTestRenderer) => r.root.findByProps({ 'data-part': 'control' });
const change = (r: ReactTestRenderer, value: string) =>
  act(() => void (control(r).props.onChange as (e: object) => void)({ target: { value } }));

describe('naming (ADR-002)', () => {
  it('SJInput and SJInput.Root are the same primitive family', () => {
    expect(SJInput.Root).toBe(SJInputRoot);
  });
});

describe('kinds (ADR-007)', () => {
  it('default kind is text: a span root around a bare input[type=text]', () => {
    const r = mount(h(SJInput));
    expect(r.root.findByProps({ 'data-part': 'root' }).type).toBe('span');
    expect(control(r).type).toBe('input');
    expect(control(r).props).toMatchObject({
      type: 'text',
      className: 'sj-input__control',
      'data-part': 'control',
    });
  });
  it('maps the native attributes to React names and never emits maxlength', () => {
    const r = mount(h(SJInput, { kind: 'email' }));
    expect(control(r).props).toMatchObject({
      type: 'email',
      inputMode: 'email',
      autoComplete: 'email',
      autoCapitalize: 'none',
    });
    for (const k of ['inputmode', 'autocomplete', 'enterkeyhint', 'maxlength', 'maxLength'])
      expect(k in control(r).props).toBe(false);
  });
  it('every kind row renders without type=number except quantity; none has maxlength', () => {
    const kinds = Object.keys(KINDS).filter((k) => k !== 'choice');
    expect(kinds.length).toBeGreaterThan(20);
    for (const kind of kinds) {
      const r = mount(h(SJInput, { kind: kind as never }));
      const p = control(r).props;
      if (kind === 'quantity') expect(p.type).toBe('number');
      else expect(p.type).not.toBe('number');
      expect('maxLength' in p || 'maxlength' in p).toBe(false);
    }
  });
  it('address renders a textarea without a type; others render an input', () => {
    const r = mount(h(SJInput, { kind: 'address' }));
    expect(control(r).type).toBe('textarea');
    expect('type' in control(r).props).toBe(false);
    expect(control(r).props.enterKeyHint).toBe('enter');
  });
  it('identifiers use text with a digits keypad, never type=number', () => {
    const r = mount(h(SJInput, { kind: 'postal' }));
    expect(control(r).props.type).toBe('text');
  });
  it('the kind cannot be overridden by a spread of native attributes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = mount(h(SJInput, { kind: 'email', type: 'number', inputMode: 'text' } as never));
    expect(control(r).props.type).toBe('email');
    warn.mockRestore();
  });
  it('type errors: unknown kind, maxLength, native type and autoComplete are rejected', () => {
    // @ts-expect-error unknown kind is a type error
    void h(SJInput, { kind: 'nope' });
    // @ts-expect-error maxLength is never allowed (ADR-007)
    void h(SJInput, { maxLength: 4 });
    // @ts-expect-error the kind owns type
    void h(SJInput, { type: 'text' });
    // @ts-expect-error the contract prop is `autocomplete`
    void h(SJInput, { autoComplete: 'x' });
    expect(true).toBe(true);
  });
  it('standalone: id, name, required, disabled come from the props', () => {
    const r = mount(h(SJInput, { id: 'x', name: 'n', required: true, disabled: true }));
    expect(control(r).props).toMatchObject({ id: 'x', name: 'n', required: true, disabled: true });
  });
  it('classes, className, native props and the ref reach the control', () => {
    const ref = createRef<HTMLInputElement>();
    const r = mount(
      h(SJInput, {
        classes: { root: 'r', control: 'c' },
        className: 'mine',
        placeholder: 'p',
        defaultValue: 'v',
        ref,
      } as never),
    );
    expect(r.root.findByProps({ 'data-part': 'root' }).props.className).toBe('sj-input__root r');
    expect(control(r).props).toMatchObject({
      className: 'sj-input__control mine c',
      placeholder: 'p',
      defaultValue: 'v',
    });
    expect(ref.current).toBeTruthy();
  });
});

describe('inside SJField (ADR-014)', () => {
  const inField = (props: Record<string, unknown> = {}, input: Record<string, unknown> = {}) =>
    h(SJField.Root, { id: 'f', label: 'L', ...props }, h(SJInput, input));
  it('ids, name, required, disabled and aria come from the field; own id/name props are ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = mount(
      inField(
        { name: 'email', required: true, hint: 'h', error: 'bad' },
        { id: 'other', name: 'x' },
      ),
    );
    expect(control(r).props).toMatchObject({
      id: 'f',
      name: 'email',
      required: true,
      'aria-invalid': 'true',
      'aria-describedby': 'f-hint f-error',
    });
    warn.mockRestore();
  });
});

describe('Enter position from the form owner (ADR-007)', () => {
  const hints = (r: ReactTestRenderer) =>
    r.root.findAllByProps({ 'data-part': 'control' }).map((c) => c.props.enterKeyHint);
  const f = (name: string, kind: string) =>
    h(SJField.Root, { key: name, name, label: name }, h(SJInput, { kind: kind as never }));
  it('data-first fields: next, next, go; a textarea is excluded from the position', () => {
    const fields = [
      { key: 'a', kind: 'name' },
      { key: 'b', kind: 'email' },
      { key: 'c', kind: 'address' },
    ] as const;
    const r = mount(
      h(SJForm, { fields: [...fields] }, f('a', 'name'), f('b', 'email'), f('c', 'address')),
    );
    expect(hints(r)).toEqual(['next', 'go', 'enter']);
  });
  it('registration order after mount gives the same result without a fields prop', () => {
    const r = mount(h(SJForm, null, f('a', 'name'), f('b', 'email'), f('c', 'username')));
    expect(hints(r)).toEqual(['next', 'next', 'go']);
  });
  it('submits=false gives the last field done; action wins', () => {
    const r = mount(h(SJForm, { submits: false }, f('a', 'name'), f('b', 'email')));
    expect(hints(r)).toEqual(['next', 'done']);
    const s = mount(h(SJForm, { action: 'search' }, f('q', 'search')));
    expect(hints(s)).toEqual(['search']);
  });
  it('adding a field re-renders the others (order recomputed)', () => {
    const tree = (n: number) => {
      const kids = ['a', 'b', 'c'].slice(0, n).map((k) => f(k, 'name'));
      return h(SJProvider, null, h(SJForm, null, ...kids));
    };
    let r!: ReactTestRenderer;
    act(() => {
      r = create(tree(2), { createNodeMock: () => ({ form: new EventTarget() }) });
    });
    renderers.push(r);
    expect(hints(r)).toEqual(['next', 'go']);
    act(() => r.update(tree(3)));
    expect(hints(r)).toEqual(['next', 'next', 'go']);
  });
  it('a standalone input in no field gets no owner hint', () => {
    const r = mount(h(SJInput, { kind: 'email' }));
    expect(control(r).props.enterKeyHint).toBeUndefined();
  });
});

describe(':user-invalid touched fallback (ADR-014)', () => {
  it('pristine: no data-touched; a user change or an invalid event touches; blur alone does not', () => {
    const r = mount(h(SJInput, { kind: 'email' }));
    expect(control(r).props['data-touched']).toBeUndefined();
    act(() => void (control(r).props.onBlur as undefined | (() => void))?.());
    expect(control(r).props['data-touched']).toBeUndefined();
    change(r, 'a');
    expect(control(r).props['data-touched']).toBe('true');
    const s = mount(h(SJInput));
    act(() => void (control(s).props.onInvalid as () => void)());
    expect(control(s).props['data-touched']).toBe('true');
  });
  it('the owning form reset event clears it', () => {
    const r = mount(h(SJInput, { kind: 'email' }));
    change(r, 'a');
    expect(control(r).props['data-touched']).toBe('true');
    act(() => void forms[0]!.dispatchEvent(new Event('reset')));
    expect(control(r).props['data-touched']).toBeUndefined();
  });
  it('native :user-invalid support makes the handlers inert', () => {
    const r = mount(h(SJInput), { userInvalid: true });
    change(r, 'a');
    act(() => void (control(r).props.onInvalid as () => void)());
    expect(control(r).props['data-touched']).toBeUndefined();
  });
  it('data-touched cannot be faked by the consumer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = mount(h(SJInput, { 'data-touched': 'true' } as never));
    expect(control(r).props['data-touched']).toBeUndefined();
    warn.mockRestore();
  });
  it('the consumer onChange still runs', () => {
    const spy = vi.fn();
    const r = mount(h(SJInput, { onChange: spy }));
    change(r, 'x');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('3.3.7 retained values', () => {
  function Probe({ out }: { out: { owner?: FormOwner } }) {
    out.owner = useContext(SJFormContext)!.owner;
    return null;
  }
  it('values typed in a field are retained by the form under its name; secrets are not', () => {
    const out: { owner?: FormOwner } = {};
    const r = mount(
      h(
        SJForm,
        {
          fields: [
            { key: 'email', kind: 'email' },
            { key: 'pw', kind: 'password' },
          ],
        },
        h(Probe, { out }),
        h(SJField.Root, { name: 'email', label: 'E' }, h(SJInput, { kind: 'email' })),
        h(SJField.Root, { name: 'pw', label: 'P' }, h(SJInput, { kind: 'password' })),
      ),
    );
    const [email, pw] = r.root.findAllByProps({ 'data-part': 'control' });
    act(() => void (email!.props.onChange as (e: object) => void)({ target: { value: 'a@b.co' } }));
    act(() => void (pw!.props.onChange as (e: object) => void)({ target: { value: 'secret' } }));
    expect(out.owner!.prior('email')).toBe('a@b.co');
    expect(out.owner!.prior('pw')).toBeUndefined();
    expect(out.owner!.offers('pw')).toEqual(['a@b.co']);
  });
});

describe('StrictMode and SSR', () => {
  it('StrictMode renders the same control', () => {
    const r = mount(h(StrictMode, null, h(SJInput, { kind: 'email' })));
    expect(control(r).props.type).toBe('email');
  });
  it('server render: attributes in HTML names, no data-touched, no maxlength', () => {
    const html = renderToString(
      h(
        SJProvider,
        null,
        h(SJField.Root, { id: 'f', label: 'L' }, h(SJInput, { kind: 'otp', autoSubmit: true })),
      ),
    );
    expect(html).toMatch(/inputmode="numeric"/i);
    expect(html).toMatch(/autocomplete="one-time-code"/i);
    expect(html).not.toContain('data-touched');
    expect(html).not.toContain('maxlength');
    expect(html).toMatch(/enterkeyhint="go"/i);
  });
});
