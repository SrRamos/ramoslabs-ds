import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, useState, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createFakeScheduler } from '@ramoslabs/core/runtime';
import { SJProvider } from '../runtime/index';
import { SJSwitch, SJSwitchControl, SJSwitchRoot, SJSwitchThumb } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeInput {
  checked: boolean;
  /** The owning form; `form.reset()` is a `reset` event followed by the default restore. */
  form: EventTarget;
}
let nodes: FakeInput[] = [];
let renderers: ReactTestRenderer[] = [];

beforeAll(() => {
  // react-test-renderer is deprecated in React 19; the warning is noise here.
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
          const n = { checked: false, form: new EventTarget() };
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

const full = (p: Record<string, unknown> = {}, label: ReactNode = 'Wi-Fi') =>
  h(SJSwitch.Root, p, h(SJSwitch.Control), h(SJSwitch.Thumb), label);
const input = (r: ReactTestRenderer) => r.root.findByType('input');
const toggle = (r: ReactTestRenderer, checked: boolean) =>
  act(() => (input(r).props.onChange as (e: object) => void)({ target: { checked } }));

describe('naming (ADR-002)', () => {
  it('namespace and flat exports are the same components', () => {
    expect(SJSwitch.Root).toBe(SJSwitchRoot);
    expect(SJSwitch.Control).toBe(SJSwitchControl);
    expect(SJSwitch.Thumb).toBe(SJSwitchThumb);
  });
  it('a part outside Root throws a clear error', () => {
    expect(() => renderToString(h(SJSwitch.Control))).toThrow(/inside SJSwitch.Root/);
  });
});

describe('structure', () => {
  it('label > input[role=switch] + thumb with library attributes', () => {
    const r = mount(full({ name: 'wifi', value: 'yes' }));
    const root = r.root.findByType('label');
    expect(root.props['data-part']).toBe('root');
    const i = input(r);
    expect(i.props).toMatchObject({
      type: 'checkbox',
      role: 'switch',
      name: 'wifi',
      value: 'yes',
      checked: false,
      'data-state': 'off',
    });
    expect(i.props.id).toBeTruthy();
    expect(i.props['aria-checked']).toBeUndefined();
    expect(r.root.findByType('span').props['data-part']).toBe('thumb');
  });
  it('prop-or-slot: label prop renders control, thumb and the text', () => {
    const r = mount(h(SJSwitch.Root, { label: 'Dark mode', defaultChecked: true }));
    expect(input(r).props.checked).toBe(true);
    expect(r.root.findByType('span').props['data-state']).toBe('on');
    expect(JSON.stringify(r.toJSON())).toContain('Dark mode');
  });
  it('classes per part concatenate after the library class; consumer className too', () => {
    const r = mount(
      h(
        SJSwitch.Root,
        { classes: { root: 'r', control: 'c', thumb: 't' }, className: 'mine' },
        h(SJSwitch.Control),
        h(SJSwitch.Thumb),
      ),
    );
    expect(r.root.findByType('label').props.className).toBe('sj-switch__root mine r');
    expect(input(r).props.className).toBe('sj-switch__control c');
    expect(r.root.findByType('span').props.className).toBe('sj-switch__thumb t');
  });
  it('library-owned attributes cannot be overridden by a spread', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = mount(
      h(SJSwitch.Root, null, h(SJSwitch.Control, { role: 'button', 'data-state': 'x' } as never)),
    );
    expect(input(r).props.role).toBe('switch');
    expect(input(r).props['data-state']).toBe('off');
    warn.mockRestore();
  });
  it('refs forward to the real elements', () => {
    const ref = { current: null as HTMLInputElement | null };
    mount(h(SJSwitch.Root, null, h(SJSwitch.Control, { ref })));
    expect(ref.current).toBe(nodes[nodes.length - 1]);
  });
});

describe('uncontrolled', () => {
  it('toggles and reports through onCheckedChange', () => {
    const spy = vi.fn();
    const r = mount(full({ onCheckedChange: spy }));
    toggle(r, true);
    expect(input(r).props.checked).toBe(true);
    expect(r.root.findByType('label').props['data-state']).toBe('on');
    toggle(r, false);
    expect(input(r).props.checked).toBe(false);
    expect(spy.mock.calls).toEqual([[{ checked: true }], [{ checked: false }]]);
  });
  it('defaultChecked seeds the state', () => {
    expect(input(mount(full({ defaultChecked: true }))).props.checked).toBe(true);
  });
});

describe('form.reset()', () => {
  // The browser fires `reset` (no `change`), then restores each input to its default. A bare input has no
  // model; the switch's model must follow the DOM, or the next toggle goes the wrong way.
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
        toggle(r, !initial);
        expect(r.root.findByType('label').props['data-state']).toBe(initial ? 'off' : 'on');
        node.checked = initial; // the browser's default action
        node.form.dispatchEvent(new Event('reset'));
        await act(async () => void (await vi.runAllTimersAsync()));
        expect(r.root.findByType('label').props['data-state']).toBe(initial ? 'on' : 'off');
        expect(seen).toEqual([!initial, initial]);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('removes its reset listener on unmount', async () => {
    vi.useFakeTimers();
    try {
      const r = mount(full());
      const node = nodes[0]!;
      act(() => r.unmount());
      renderers = [];
      node.checked = true;
      node.form.dispatchEvent(new Event('reset'));
      await vi.runAllTimersAsync(); // nothing to assert beyond "does not throw"
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('controlled', () => {
  it('follows the prop and corrects the native input when the owner rejects', () => {
    const spy = vi.fn();
    const r = mount(full({ checked: false, onCheckedChange: spy }));
    nodes[0]!.checked = true; // the native input flipped itself
    toggle(r, true);
    expect(spy).toHaveBeenCalledWith({ checked: true });
    expect(input(r).props.checked).toBe(false);
    expect(nodes[0]!.checked).toBe(false); // corrective effect restored it
  });
  it('accepting owner: parent state drives the view', () => {
    function Parent() {
      const [on, setOn] = useState(false);
      return full({ checked: on, onCheckedChange: (p: { checked: boolean }) => setOn(p.checked) });
    }
    const r = mount(h(Parent));
    toggle(r, true);
    expect(input(r).props.checked).toBe(true);
    expect(r.root.findByType('label').props['data-state']).toBe('on');
  });
  it('a prop change from outside is reflected without a callback', () => {
    const spy = vi.fn();
    const r = mount(full({ checked: false, onCheckedChange: spy }));
    act(() =>
      r.update(
        h(
          SJProvider,
          { liveHost: () => ({ create: () => ({ setText() {} }) }) },
          full({ checked: true, onCheckedChange: spy }),
        ),
      ),
    );
    expect(input(r).props.checked).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('disabled', () => {
  it('sets the native disabled and data-disabled; no aria-disabled', () => {
    const r = mount(full({ disabled: true }));
    expect(input(r).props.disabled).toBe(true);
    expect(input(r).props['data-disabled']).toBe('true');
    expect(r.root.findByType('label').props['data-disabled']).toBe('true');
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
  ];
  it.each(cases)('%j', (p) => {
    const sw = renderToStaticMarkup(full(p));
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
    expect(pick(sw)).toEqual(pick(bare));
  });
});

describe('SSR and hydration', () => {
  const tree = () => h(SJProvider, null, full({ name: 'n', defaultChecked: true, id: undefined }));
  it('renders markup on the server without document', () => {
    expect(typeof document).toBe('undefined');
    const html = renderToString(tree());
    expect(html).toContain('role="switch"');
    expect(html).toContain('checked=""');
    expect(html).toContain('data-state="on"');
  });
  it('ids are stable between two server renders', () => {
    const id = (s: string) => /id="([^"]+)"/.exec(s)![1];
    expect(id(renderToString(tree()))).toBe(id(renderToString(tree())));
    expect(id(renderToString(tree()))).toBeTruthy();
  });
  it('explicit id wins', () => {
    expect(renderToString(full({ id: 'mine' }))).toContain('id="mine"');
  });
});

describe('StrictMode', () => {
  it('double invoke yields one state, one callback per change', () => {
    const spy = vi.fn();
    const r = mount(h(StrictMode, null, full({ onCheckedChange: spy })));
    toggle(r, true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(input(r).props.checked).toBe(true);
    toggle(r, false);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(input(r).props.checked).toBe(false);
  });
  it('StrictMode controlled rejection still corrects', () => {
    const r = mount(h(StrictMode, null, full({ checked: true, onCheckedChange() {} })));
    nodes[nodes.length - 1]!.checked = false;
    toggle(r, false);
    expect(nodes[nodes.length - 1]!.checked).toBe(true);
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
                onCheckedChange: () => {},
              }),
            ),
          ),
          {
            createNodeMock: () => {
              const n = { checked: false, form: new EventTarget() };
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
