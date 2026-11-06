import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, createRef, useContext, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import type { FormOwner } from '@ramoslabs/core/form';
import { SJProvider } from '../runtime/index';
import { SJField } from '../field/index';
import { SJInput } from '../input/index';
import { SJForm, SJFormContext, SJFormRoot } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let renderers: ReactTestRenderer[] = [];
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const r of renderers) act(() => r.unmount());
  renderers = [];
});
const provide = (node: ReactNode) =>
  h(SJProvider, { liveHost: () => ({ create: () => ({ setText() {} }) }) }, node);
function mount(node: ReactNode): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(provide(node), { createNodeMock: () => ({ form: new EventTarget() }) });
  });
  renderers.push(r);
  return r;
}
const form = (r: ReactTestRenderer) => r.root.findByType('form');
const f = (name: string, kind: string) =>
  h(SJField.Root, { key: name, name, label: name }, h(SJInput, { kind: kind as never }));
const hints = (r: ReactTestRenderer) =>
  r.root.findAllByProps({ 'data-part': 'control' }).map((c) => c.props.enterKeyHint);

describe('SJForm root', () => {
  it('SJForm and SJForm.Root are the same primitive family', () => {
    expect(SJForm.Root).toBe(SJFormRoot);
  });
  it('is a native <form> with the library class and part; no handlers, no novalidate, no contract props', () => {
    const r = mount(h(SJForm, { enter: 'send', submits: false, autoSubmit: true, fields: [] }));
    const p = form(r).props;
    expect(p).toMatchObject({ className: 'sj-form__root', 'data-part': 'root' });
    for (const k of [
      'onSubmit',
      'onReset',
      'onInvalid',
      'noValidate',
      'novalidate',
      'enter',
      'fields',
      'submits',
      'autoSubmit',
    ])
      expect(k in p).toBe(false);
  });
  it('native attributes, classes and the ref reach the form; the library part cannot be faked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = createRef<HTMLFormElement>();
    const onSubmit = vi.fn();
    const r = mount(
      h(SJForm, {
        ref,
        className: 'mine',
        classes: { root: 'r' },
        id: 'x',
        onSubmit,
        'data-part': 'nope',
      } as never),
    );
    expect(form(r).props).toMatchObject({
      className: 'sj-form__root mine r',
      id: 'x',
      'data-part': 'root',
      onSubmit,
    });
    expect(ref.current).toBeTruthy();
    warn.mockRestore();
  });
  it('the native action passes through to the form; enter is the Enter label', () => {
    const r = mount(h(SJForm, { action: '/submit', method: 'post', enter: 'send' }));
    expect(form(r).props).toMatchObject({ action: '/submit', method: 'post' });
    expect('enter' in form(r).props).toBe(false);
    // @ts-expect-error enter is 'go' | 'send' | 'search'
    void h(SJForm, { enter: '/submit' });
  });
  it('server render: a plain form; the data-first fields give the Enter position, no live markup', () => {
    const fields = [
      { key: 'a', kind: 'name' },
      { key: 'b', kind: 'email' },
    ] as const;
    const html = renderToString(
      h(SJProvider, null, h(SJForm, { fields: [...fields] }, f('a', 'name'), f('b', 'email'))),
    );
    expect(html).toMatch(/<form data-part="root" class="sj-form__root"/);
    expect(html).toMatch(/enterkeyhint="next"/i);
    expect(html).toMatch(/enterkeyhint="go"/i);
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
  });
});

describe('Enter position follows the form props', () => {
  it('changing fields or submits re-renders the fields below', () => {
    const tree = (props: Record<string, unknown>) =>
      provide(h(SJForm, props, f('a', 'name'), f('b', 'email')));
    let r!: ReactTestRenderer;
    act(() => {
      r = create(tree({}), { createNodeMock: () => ({ form: new EventTarget() }) });
    });
    renderers.push(r);
    expect(hints(r)).toEqual(['next', 'go']);
    act(() => r.update(tree({ submits: false })));
    expect(hints(r)).toEqual(['next', 'done']);
    act(() =>
      r.update(
        tree({
          fields: [
            { key: 'b', kind: 'email' },
            { key: 'a', kind: 'name' },
          ],
        }),
      ),
    );
    expect(hints(r)).toEqual(['go', 'next']);
  });
  it('StrictMode gives the same positions', () => {
    const r = mount(
      h(StrictMode, null, h(SJForm, null, f('a', 'name'), f('b', 'email'), f('c', 'username'))),
    );
    expect(hints(r)).toEqual(['next', 'next', 'go']);
  });
});

describe('registration order is the DOM order of form.elements', () => {
  it('a reorder re-registers each field with its new index', () => {
    // DOM order is the order of this array; the mock control of each field looks itself up in it.
    const dom: object[] = [];
    const elements = dom as unknown as ArrayLike<object>;
    const tree = (names: string[]) => provide(h(SJForm, null, ...names.map((n) => f(n, 'name'))));
    let r!: ReactTestRenderer;
    const mockNode = () => {
      const el = { form: { elements, addEventListener() {} } };
      dom.push(el);
      return el;
    };
    act(() => {
      r = create(tree(['a', 'b', 'c']), { createNodeMock: mockNode });
    });
    renderers.push(r);
    expect(hints(r)).toEqual(['next', 'next', 'go']);
    // The browser moved the last control first: DOM order is now c, a, b.
    dom.unshift(dom.pop()!);
    act(() => r.update(tree(['a', 'b', 'c'])));
    // Position follows DOM: the field whose element is last in the DOM (b) gets go.
    const els = r.root.findAllByProps({ 'data-part': 'control' });
    expect(els).toHaveLength(3);
    expect(hints(r).filter((x) => x === 'go')).toHaveLength(1);
    expect(hints(r)[1]).toBe('go');
  });
});

describe('3.3.7 retained values survive a step change', () => {
  function Probe({ out }: { out: { owner?: FormOwner } }) {
    out.owner = useContext(SJFormContext)!.owner;
    return null;
  }
  it('a value typed in step 1 is offered in step 2 after step 1 unmounts', () => {
    const out: { owner?: FormOwner } = {};
    const tree = (step: number) =>
      provide(
        h(
          SJForm,
          null,
          h(Probe, { out }),
          step === 1 ? f('email', 'email') : f('confirm', 'email'),
        ),
      );
    let r!: ReactTestRenderer;
    act(() => {
      r = create(tree(1), { createNodeMock: () => ({ form: new EventTarget() }) });
    });
    renderers.push(r);
    const input = r.root.findByProps({ 'data-part': 'control' });
    act(() => void (input.props.onChange as (e: object) => void)({ target: { value: 'a@b.co' } }));
    act(() => r.update(tree(2)));
    expect(out.owner!.store.getSnapshot().fields.map((x) => x.key)).toEqual(['confirm']);
    expect(out.owner!.offers('confirm')).toEqual(['a@b.co']);
  });
});
