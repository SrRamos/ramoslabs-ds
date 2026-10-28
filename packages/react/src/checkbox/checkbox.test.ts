import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, useState, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createFakeScheduler } from '@ramoslabs/core/runtime';
import { SJProvider } from '../runtime/index';
import { SJCheckbox, SJCheckboxControl, SJCheckboxRoot } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeInput {
  checked: boolean;
  indeterminate: boolean;
  form: EventTarget;
}
let nodes: FakeInput[] = [];
let renderers: ReactTestRenderer[] = [];

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const r of renderers) act(() => r.unmount());
  renderers = [];
  nodes = [];
});

function mount(node: ReactNode): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(h(SJProvider, { liveHost: () => ({ create: () => ({ setText() {} }) }) }, node), {
      createNodeMock: (el) => {
        if (el.type === 'input') {
          const n = { checked: false, indeterminate: false, form: new EventTarget() };
          nodes.push(n);
          return n;
        }
        return null;
      },
    });
  });
  renderers.push(r);
  return r;
}
const provider = (node: ReactNode) =>
  h(SJProvider, { liveHost: () => ({ create: () => ({ setText() {} }) }) }, node);

const full = (p: Record<string, unknown> = {}, label: ReactNode = 'Accept') =>
  h(SJCheckbox.Root, p, h(SJCheckbox.Control), h(SJCheckbox.Indicator), label);
const input = (r: ReactTestRenderer) => r.root.findByType('input');
const root = (r: ReactTestRenderer) => r.root.findByType('label');
/** What the browser does on a click: flip `checked` and clear `indeterminate`, then fire `change`. */
const click = (r: ReactTestRenderer, node = nodes[0]!) =>
  act(() => {
    node.checked = !node.checked;
    node.indeterminate = false;
    (input(r).props.onChange as (e: object) => void)({ target: node });
  });

describe('naming (ADR-002)', () => {
  it('namespace and flat exports are the same components', () => {
    expect(SJCheckbox.Root).toBe(SJCheckboxRoot);
    expect(SJCheckbox.Control).toBe(SJCheckboxControl);
  });
  it('a part outside Root throws a clear error', () => {
    expect(() => renderToString(h(SJCheckbox.Control))).toThrow(/inside SJCheckbox.Root/);
  });
});

describe('structure', () => {
  it('label > input[type=checkbox] + indicator, no role, no aria-checked, no indeterminate attribute', () => {
    const r = mount(full({ name: 'terms', value: 'yes' }));
    expect(root(r).props['data-part']).toBe('root');
    const i = input(r);
    expect(i.props).toMatchObject({
      type: 'checkbox',
      name: 'terms',
      value: 'yes',
      checked: false,
      'data-state': 'unchecked',
    });
    expect(i.props.role).toBeUndefined();
    expect(i.props['aria-checked']).toBeUndefined();
    expect('indeterminate' in i.props).toBe(false);
    expect(i.props.id).toBeTruthy();
    expect(r.root.findByType('span').props['data-part']).toBe('indicator');
  });
  it('prop-or-slot: label prop renders control, indicator and the label part', () => {
    const r = mount(h(SJCheckbox.Root, { label: 'Newsletter', defaultChecked: true }));
    expect(input(r).props.checked).toBe(true);
    const label = r.root.findByProps({ 'data-part': 'label' });
    expect(label.type).toBe('span');
    expect(label.props.className).toBe('sj-checkbox__label');
    expect(label.props['data-state']).toBe('checked');
    expect(JSON.stringify(label.children)).toContain('Newsletter');
  });
  it('classes per part concatenate after the library class; consumer className too', () => {
    const r = mount(
      h(
        SJCheckbox.Root,
        { classes: { root: 'r', control: 'c', indicator: 'i' }, className: 'mine' },
        h(SJCheckbox.Control),
        h(SJCheckbox.Indicator),
      ),
    );
    expect(root(r).props.className).toBe('sj-checkbox__root mine r');
    expect(input(r).props.className).toBe('sj-checkbox__control c');
    expect(r.root.findByType('span').props.className).toBe('sj-checkbox__indicator i');
  });
  it('library-owned attributes cannot be overridden by a spread', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = mount(
      h(
        SJCheckbox.Root,
        null,
        h(SJCheckbox.Control, { type: 'radio', 'data-state': 'x' } as never),
      ),
    );
    expect(input(r).props.type).toBe('checkbox');
    expect(input(r).props['data-state']).toBe('unchecked');
    warn.mockRestore();
  });
  it('refs forward to the real elements', () => {
    const ref = { current: null as HTMLInputElement | null };
    mount(h(SJCheckbox.Root, null, h(SJCheckbox.Control, { ref })));
    expect(ref.current).toBe(nodes[nodes.length - 1]);
  });
});

describe('uncontrolled', () => {
  it('toggles and reports through onCheckedChange', () => {
    const spy = vi.fn();
    const r = mount(full({ onCheckedChange: spy }));
    click(r);
    expect(input(r).props.checked).toBe(true);
    expect(root(r).props['data-state']).toBe('checked');
    click(r);
    expect(input(r).props.checked).toBe(false);
    expect(spy.mock.calls).toEqual([[{ checked: true }], [{ checked: false }]]);
  });
  it('defaults seed checked and indeterminate; the property is set on the node after mount', () => {
    const r = mount(full({ defaultChecked: true, defaultIndeterminate: true }));
    expect(input(r).props.checked).toBe(true);
    expect(nodes[0]!.indeterminate).toBe(true);
    expect(root(r).props['data-state']).toBe('indeterminate');
  });
  it('a click clears indeterminate, flips checked and reports both', () => {
    const c = vi.fn();
    const i = vi.fn();
    const r = mount(
      full({ defaultIndeterminate: true, onCheckedChange: c, onIndeterminateChange: i }),
    );
    click(r);
    expect(nodes[0]!.indeterminate).toBe(false);
    expect(root(r).props['data-state']).toBe('checked');
    expect(c).toHaveBeenCalledWith({ checked: true });
    expect(i).toHaveBeenCalledWith({ indeterminate: false });
  });
  it('a plain click does not report indeterminate', () => {
    const i = vi.fn();
    const r = mount(full({ onIndeterminateChange: i }));
    click(r);
    expect(i).not.toHaveBeenCalled();
  });
});

describe('controlled indeterminate', () => {
  it('follows the prop on every change, through the property', () => {
    const r = mount(full({ indeterminate: false }));
    expect(nodes[0]!.indeterminate).toBe(false);
    act(() => r.update(provider(full({ indeterminate: true }))));
    expect(nodes[0]!.indeterminate).toBe(true);
    expect('indeterminate' in input(r).props).toBe(false);
    act(() => r.update(provider(full({ indeterminate: false }))));
    expect(nodes[0]!.indeterminate).toBe(false);
  });
  it('an owner that keeps indeterminate=true is corrected after a click', async () => {
    const i = vi.fn();
    const r = mount(full({ indeterminate: true, onIndeterminateChange: i }));
    click(r); // the browser cleared it
    await act(async () => {});
    expect(i).toHaveBeenCalledWith({ indeterminate: false });
    expect(nodes[0]!.indeterminate).toBe(true);
    expect(root(r).props['data-state']).toBe('indeterminate');
  });
  it('an accepting owner releases it (select-all parent)', () => {
    function Parent() {
      const [mixed, setMixed] = useState(true);
      return full({
        indeterminate: mixed,
        onIndeterminateChange: (p: { indeterminate: boolean }) => setMixed(p.indeterminate),
      });
    }
    const r = mount(h(Parent));
    click(r);
    expect(nodes[0]!.indeterminate).toBe(false);
    expect(root(r).props['data-state']).toBe('checked');
  });
});

describe('form.reset()', () => {
  it.each([false, true])(
    'the model follows the restored default (defaultChecked %s)',
    async (initial) => {
      vi.useFakeTimers();
      try {
        const seen: boolean[] = [];
        const r = mount(
          full({
            defaultChecked: initial,
            onCheckedChange: ({ checked }: { checked: boolean }) => seen.push(checked),
          }),
        );
        const node = nodes[0]!;
        node.checked = initial;
        click(r);
        expect(root(r).props['data-state']).toBe(initial ? 'unchecked' : 'checked');
        node.checked = initial; // the browser's default action
        node.form.dispatchEvent(new Event('reset'));
        await act(async () => void (await vi.runAllTimersAsync()));
        expect(root(r).props['data-state']).toBe(initial ? 'checked' : 'unchecked');
        expect(seen).toEqual([!initial, initial]);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it('reset leaves indeterminate alone (native behavior)', async () => {
    vi.useFakeTimers();
    try {
      const r = mount(full({ defaultIndeterminate: true }));
      const node = nodes[0]!;
      node.form.dispatchEvent(new Event('reset'));
      await act(async () => void (await vi.runAllTimersAsync()));
      expect(node.indeterminate).toBe(true);
      expect(root(r).props['data-state']).toBe('indeterminate');
    } finally {
      vi.useRealTimers();
    }
  });
  it('removes its reset listener on unmount', async () => {
    vi.useFakeTimers();
    try {
      const r = mount(full());
      const node = nodes[0]!;
      act(() => r.unmount());
      renderers = [];
      node.checked = true;
      node.form.dispatchEvent(new Event('reset'));
      await vi.runAllTimersAsync();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('controlled checked', () => {
  it('follows the prop and corrects the native input when the owner rejects', async () => {
    const spy = vi.fn();
    const r = mount(full({ checked: false, onCheckedChange: spy }));
    nodes[0]!.checked = true;
    (input(r).props.onChange as (e: object) => void)({});
    await act(async () => {});
    expect(spy).toHaveBeenCalledWith({ checked: true });
    expect(input(r).props.checked).toBe(false);
    expect(nodes[0]!.checked).toBe(false);
  });
  it('accepting owner: parent state drives the view', () => {
    function Parent() {
      const [on, setOn] = useState(false);
      return full({ checked: on, onCheckedChange: (p: { checked: boolean }) => setOn(p.checked) });
    }
    const r = mount(h(Parent));
    click(r);
    expect(input(r).props.checked).toBe(true);
    expect(root(r).props['data-state']).toBe('checked');
  });
  it('a prop change from outside is reflected without a callback', () => {
    const spy = vi.fn();
    const r = mount(full({ checked: false, onCheckedChange: spy }));
    act(() => r.update(provider(full({ checked: true, onCheckedChange: spy }))));
    expect(input(r).props.checked).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('disabled', () => {
  it('sets the native disabled and data-disabled; no aria-disabled', () => {
    const r = mount(full({ disabled: true }));
    expect(input(r).props.disabled).toBe(true);
    expect(input(r).props['data-disabled']).toBe('true');
    expect(root(r).props['data-disabled']).toBe('true');
    expect(input(r).props['aria-disabled']).toBeUndefined();
  });
  it('omits disabled when not disabled', () => {
    expect(input(mount(full())).props.disabled).toBeUndefined();
  });
});

describe('form state equals a bare checkbox', () => {
  const pick = (html: string) => {
    const tag = /<input[^>]*>/.exec(html)![0];
    const get = (a: string) => new RegExp(`\\s${a}(?:="([^"]*)")?(?=[\\s/>])`).exec(tag);
    return ['name', 'value', 'checked', 'disabled', 'type'].map((a) => {
      const m = get(a);
      return m ? [a, m[1] ?? ''] : [a, null];
    });
  };
  const cases: Record<string, unknown>[] = [
    {},
    { name: 'n' },
    { name: 'n', value: 'v' },
    { name: 'n', defaultChecked: true },
    { name: 'n', defaultChecked: true, value: 'v', disabled: true },
    { name: 'n', checked: true, onCheckedChange() {} },
    { name: 'n', disabled: true },
    { name: 'n', defaultChecked: true, defaultIndeterminate: true },
    { name: 'n', indeterminate: true },
  ];
  it.each(cases)('%j', (p) => {
    const cb = renderToStaticMarkup(full(p));
    const bare = renderToStaticMarkup(
      h('input', {
        type: 'checkbox',
        ...(p.name !== undefined && { name: p.name }),
        ...(p.value !== undefined && { value: p.value }),
        checked: p.checked === true || p.defaultChecked === true,
        ...(p.disabled === true ? { disabled: true } : {}),
        readOnly: true,
      }),
    );
    expect(pick(cb)).toEqual(pick(bare));
  });
});

describe('SSR and hydration', () => {
  const tree = () =>
    h(SJProvider, null, full({ name: 'n', defaultChecked: true, defaultIndeterminate: true }));
  it('renders markup on the server without document; indeterminate is state only, never an attribute', () => {
    expect(typeof document).toBe('undefined');
    const html = renderToString(tree());
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain('data-state="indeterminate"');
    expect(html).not.toMatch(/\sindeterminate/);
    expect(html).not.toContain('role=');
  });
  it('server markup equals the client props', () => {
    const r = mount(full({ id: 'x', name: 'n', defaultChecked: true, defaultIndeterminate: true }));
    const html = renderToStaticMarkup(
      full({ id: 'x', name: 'n', defaultChecked: true, defaultIndeterminate: true }),
    );
    const p = input(r).props;
    expect(html).toContain(`data-state="${p['data-state']}"`);
    expect(html).toContain(`id="${p.id}"`);
    expect(html).toContain(`name="${p.name}"`);
    expect(html).toContain(`class="${p.className}"`);
    expect(p.checked).toBe(true);
  });
  it('ids are stable between two server renders; explicit id wins', () => {
    const id = (s: string) => /id="([^"]+)"/.exec(s)![1];
    expect(id(renderToString(tree()))).toBe(id(renderToString(tree())));
    expect(renderToString(full({ id: 'mine' }))).toContain('id="mine"');
  });
});

describe('StrictMode', () => {
  it('double invoke yields one state, one callback per change', () => {
    const spy = vi.fn();
    const r = mount(h(StrictMode, null, full({ onCheckedChange: spy })));
    const node = nodes[nodes.length - 1]!;
    click(r, node);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(input(r).props.checked).toBe(true);
    click(r, node);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(input(r).props.checked).toBe(false);
  });
  it('StrictMode keeps the indeterminate property and corrects a rejection', async () => {
    const r = mount(h(StrictMode, null, full({ indeterminate: true, onIndeterminateChange() {} })));
    const node = nodes[nodes.length - 1]!;
    expect(node.indeterminate).toBe(true);
    click(r, node);
    await act(async () => {});
    expect(node.indeterminate).toBe(true);
  });
});

describe('retention: 1,000 mount/unmount cycles', () => {
  it('retains no stores, listeners or nodes', async () => {
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const v8 = (await mod('node:v8')) as { setFlagsFromString(f: string): void };
    const vm = (await mod('node:vm')) as { runInNewContext(c: string): () => void };
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');
    const refs: WeakRef<object>[] = [];
    const sched = createFakeScheduler();
    let disposed = 0;
    let created = 0;
    const host = {
      create: () => {
        created++;
        return { setText() {} };
      },
      dispose: () => void disposed++,
    };
    for (let i = 0; i < 1000; i++) {
      let r!: ReactTestRenderer;
      act(() => {
        r = create(
          h(
            StrictMode,
            null,
            h(
              SJProvider,
              { liveHost: () => host, scheduler: sched },
              full({
                checked: false,
                indeterminate: true,
                onCheckedChange: () => {},
                onIndeterminateChange: () => {},
              }),
            ),
          ),
          {
            createNodeMock: () => {
              const n = { checked: false, indeterminate: false, form: new EventTarget() };
              refs.push(new WeakRef(n));
              return n;
            },
          },
        );
      });
      act(() => (r.root.findByType('input').props.onChange as (e: object) => void)({}));
      act(() => r.unmount());
    }
    await new Promise((res) => setTimeout(res, 0));
    gc();
    await new Promise((res) => setTimeout(res, 0));
    gc();
    expect(created).toBe(disposed);
    expect(sched.pending).toBe(0);
    expect(refs.filter((r) => r.deref() !== undefined).length).toBeLessThanOrEqual(2);
  }, 60_000);
});
