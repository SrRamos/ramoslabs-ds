import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, useState, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createFakeScheduler } from '@ramoslabs/core/runtime';
import { SJProvider } from '../runtime/index';
import { SJDisclosure, SJDisclosureContent, SJDisclosureRoot } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A `<details>` stand-in: the properties and methods the adapter touches. */
interface FakeDetails {
  id: string;
  open: boolean;
  attrs: Map<string, string>;
  getAttribute(n: string): string | null;
  getRootNode(): FakeDoc;
}
interface FakeDoc {
  querySelectorAll(sel: string): FakeDetails[];
}
let nodes: FakeDetails[] = [];
let renderers: ReactTestRenderer[] = [];
// One shared fake document: every mounted node is a member of it (the same tree).
const doc: FakeDoc = {
  querySelectorAll: (sel) => {
    expect(sel).toBe('details[name]');
    return nodes.filter((n) => n.attrs.has('name'));
  },
};
const makeNode = (el: { props: unknown }): FakeDetails => {
  const attrs = new Map<string, string>();
  const p = el.props as Record<string, unknown>;
  if (typeof p.name === 'string') attrs.set('name', p.name);
  return {
    id: String(p.id ?? ''),
    open: p.open === true, // the markup's initial `open` attribute
    attrs,
    getAttribute: (n) => attrs.get(n) ?? null,
    getRootNode: () => doc,
  };
};

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const r of renderers) act(() => r.unmount());
  renderers = [];
  nodes = [];
});

const provider = (node: ReactNode, supports?: Record<string, boolean>) =>
  h(
    SJProvider,
    { liveHost: () => ({ create: () => ({ setText() {} }) }), ...(supports && { supports }) },
    node,
  );
function mount(node: ReactNode, supports?: Record<string, boolean>, pre?: boolean) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(provider(node, supports), {
      createNodeMock: (el) => {
        if (el.type !== 'details') return null;
        const n = makeNode(el);
        if (pre !== undefined) n.open = pre;
        nodes.push(n);
        return n;
      },
    });
  });
  renderers.push(r);
  return r;
}

const full = (p: Record<string, unknown> = {}, body: ReactNode = 'Content') =>
  h(
    SJDisclosure.Root,
    p,
    h(SJDisclosure.Trigger, null, 'Title'),
    h(SJDisclosure.Content, null, body),
  );
const detailsOf = (r: ReactTestRenderer) => r.root.findByType('details');
const summaryOf = (r: ReactTestRenderer) => r.root.findByType('summary');
/** What the browser does: the element's `open` changes, then `toggle` fires on it. */
const toggle = (r: ReactTestRenderer, node: FakeDetails, next: boolean, which = 0) =>
  act(() => {
    node.open = next;
    (r.root.findAllByType('details')[which]!.props.onToggle as (e: object) => void)({
      currentTarget: node,
    });
  });

describe('naming (ADR-002)', () => {
  it('namespace and flat exports are the same components', () => {
    expect(SJDisclosure.Root).toBe(SJDisclosureRoot);
    expect(SJDisclosure.Content).toBe(SJDisclosureContent);
  });
  it('a part outside Root throws a clear error', () => {
    expect(() => renderToString(h(SJDisclosure.Trigger))).toThrow(/inside SJDisclosure.Root/);
  });
});

describe('structure', () => {
  it('details > summary + div, no aria-expanded, no role', () => {
    const r = mount(full({ name: 'g', id: 'd1' }));
    expect(detailsOf(r).props).toMatchObject({
      id: 'd1',
      name: 'g',
      'data-part': 'root',
      'data-state': 'closed',
      className: 'sj-disclosure__root',
    });
    const s = summaryOf(r).props;
    expect(s['data-part']).toBe('trigger');
    expect(s['aria-expanded']).toBeUndefined();
    expect(s['aria-controls']).toBeUndefined();
    expect(s.role).toBeUndefined();
    const c = r.root.findByProps({ 'data-part': 'content' });
    expect(c.type).toBe('div');
  });
  it('prop-or-slot: summary prop plus children render trigger and content', () => {
    const r = mount(h(SJDisclosure.Root, { summary: 'More', defaultOpen: true }, 'Body'));
    expect(JSON.stringify(summaryOf(r).children)).toContain('More');
    expect(JSON.stringify(r.root.findByProps({ 'data-part': 'content' }).children)).toContain(
      'Body',
    );
    expect(detailsOf(r).props['data-state']).toBe('open');
  });
  it('summary without children still renders an empty content part', () => {
    const r = mount(h(SJDisclosure.Root, { summary: 'More' }));
    const c = r.root.findByProps({ 'data-part': 'content' });
    expect(c.type).toBe('div');
    expect(c.children).toEqual([]);
  });
  it('classes per part concatenate after the library class; consumer className too', () => {
    const r = mount(
      h(
        SJDisclosure.Root,
        { classes: { root: 'r', trigger: 't', content: 'c' }, className: 'mine' },
        h(SJDisclosure.Trigger, null, 'x'),
        h(SJDisclosure.Content, null, 'y'),
      ),
    );
    expect(detailsOf(r).props.className).toBe('sj-disclosure__root mine r');
    expect(summaryOf(r).props.className).toBe('sj-disclosure__trigger t');
    expect(r.root.findByProps({ 'data-part': 'content' }).props.className).toBe(
      'sj-disclosure__content c',
    );
  });
  it('library-owned attributes cannot be overridden by a spread', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = mount(
      h(
        SJDisclosure.Root,
        null,
        h(SJDisclosure.Trigger, { 'data-state': 'x', 'aria-disabled': 'true', id: 'zz' } as never),
      ),
    );
    expect(summaryOf(r).props['data-state']).toBe('closed');
    expect(summaryOf(r).props['aria-disabled']).toBeUndefined();
    expect(summaryOf(r).props.id).not.toBe('zz');
    warn.mockRestore();
  });
  it('refs forward to the real element', () => {
    const ref = { current: null as HTMLDetailsElement | null };
    mount(h(SJDisclosure.Root, { ref }));
    expect(ref.current).toBe(nodes[nodes.length - 1]);
  });
});

describe('uncontrolled', () => {
  it('follows the native toggle and reports through onOpenChange', () => {
    const spy = vi.fn();
    const r = mount(full({ onOpenChange: spy }));
    toggle(r, nodes[0]!, true);
    expect(detailsOf(r).props['data-state']).toBe('open');
    toggle(r, nodes[0]!, false);
    expect(detailsOf(r).props['data-state']).toBe('closed');
    expect(spy.mock.calls).toEqual([[{ open: true }], [{ open: false }]]);
  });
  it('defaultOpen seeds the view and the markup', () => {
    const r = mount(full({ defaultOpen: true }));
    expect(detailsOf(r).props.open).toBe(true);
    expect(detailsOf(r).props['data-state']).toBe('open');
  });
  it('a toggle equal to the view reports nothing', () => {
    const spy = vi.fn();
    const r = mount(full({ defaultOpen: true, onOpenChange: spy }));
    toggle(r, nodes[0]!, true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('controlled open', () => {
  it('a rejecting owner gets the element put back', async () => {
    const spy = vi.fn();
    const r = mount(full({ open: false, onOpenChange: spy }));
    toggle(r, nodes[0]!, true);
    await act(async () => {});
    expect(spy).toHaveBeenCalledWith({ open: true });
    expect(nodes[0]!.open).toBe(false);
    expect(detailsOf(r).props['data-state']).toBe('closed');
  });
  it('an accepting owner drives the view', () => {
    function Parent() {
      const [o, setO] = useState(false);
      return full({ open: o, onOpenChange: (p: { open: boolean }) => setO(p.open) });
    }
    const r = mount(h(Parent));
    toggle(r, nodes[0]!, true);
    expect(detailsOf(r).props['data-state']).toBe('open');
    expect(nodes[0]!.open).toBe(true);
  });
  it('a prop change from outside moves the element without a callback', () => {
    const spy = vi.fn();
    const r = mount(full({ open: false, onOpenChange: spy }));
    act(() => r.update(provider(full({ open: true, onOpenChange: spy }))));
    expect(nodes[0]!.open).toBe(true);
    expect(detailsOf(r).props['data-state']).toBe('open');
    act(() => r.update(provider(full({ open: false, onOpenChange: spy }))));
    expect(nodes[0]!.open).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('pre-hydration', () => {
  it('a state the user set before hydration (differs from the view) is reported at mount', () => {
    const spy = vi.fn();
    const r = mount(full({ onOpenChange: spy }), undefined, true);
    expect(spy).toHaveBeenCalledWith({ open: true });
    expect(detailsOf(r).props['data-state']).toBe('open');
  });
  it('nothing is reported when the element matches the view', () => {
    const spy = vi.fn();
    mount(full({ defaultOpen: true, onOpenChange: spy }));
    expect(spy).not.toHaveBeenCalled();
  });
  it('a controlled owner that rejects the pre-hydration state gets the element corrected', async () => {
    const r = mount(full({ open: false, onOpenChange() {} }), undefined, true);
    await act(async () => {});
    expect(nodes[0]!.open).toBe(false);
    expect(detailsOf(r).props['data-state']).toBe('closed');
  });
});

describe('disabled', () => {
  it('aria-disabled and data-disabled on the trigger; click is prevented', () => {
    const r = mount(full({ disabled: true }));
    expect(summaryOf(r).props['aria-disabled']).toBe('true');
    expect(summaryOf(r).props['data-disabled']).toBe('true');
    expect(detailsOf(r).props['data-disabled']).toBe('true');
    const prevent = vi.fn();
    (summaryOf(r).props.onClick as (e: object) => void)({ preventDefault: prevent });
    expect(prevent).toHaveBeenCalled();
  });
  it('an enabled trigger is not prevented', () => {
    const r = mount(full());
    const prevent = vi.fn();
    (summaryOf(r).props.onClick as (e: object) => void)({ preventDefault: prevent });
    expect(prevent).not.toHaveBeenCalled();
  });
});

describe('exclusive group fallback (supports.detailsName forced false)', () => {
  const group = (extra: (i: number) => Record<string, unknown> = () => ({})) =>
    h(
      'div',
      null,
      ...[0, 1, 2].map((i) =>
        h(
          SJDisclosure.Root,
          { key: i, id: `d${i}`, name: 'g', ...extra(i) },
          h(SJDisclosure.Trigger, null, `t${i}`),
        ),
      ),
    );
  const off = { detailsName: false };

  it('opening one closes the other open members, and each peer reports', () => {
    const spies = [vi.fn(), vi.fn(), vi.fn()];
    const r = mount(
      group((i) => ({ onOpenChange: spies[i] })),
      off,
    );
    toggle(r, nodes[0]!, true, 0);
    toggle(r, nodes[1]!, true, 1);
    expect(nodes.map((n) => n.open)).toEqual([false, true, false]);
    // the peer's own toggle reports, as native does
    toggle(r, nodes[0]!, false, 0);
    expect(spies[0]!.mock.calls).toEqual([[{ open: true }], [{ open: false }]]);
    const views = r.root.findAllByType('details').map((d) => d.props['data-state']);
    expect(views).toEqual(['closed', 'open', 'closed']);
  });
  it('peers without an id do not collide', () => {
    const r = mount(
      h(
        'div',
        null,
        ...[0, 1, 2].map((i) =>
          h(
            SJDisclosure.Root,
            { key: i, name: 'g', defaultOpen: i > 0 },
            h(SJDisclosure.Trigger, null, 't'),
          ),
        ),
      ),
      off,
    );
    nodes.forEach((n) => (n.id = ''));
    toggle(r, nodes[0]!, true, 0);
    expect(nodes.map((n) => n.open)).toEqual([true, false, false]);
  });
  it('members outside the group and unnamed members are left alone', () => {
    const r = mount(
      h(
        'div',
        null,
        h(SJDisclosure.Root, { id: 'a', name: 'g' }, h(SJDisclosure.Trigger, null, 'a')),
        h(
          SJDisclosure.Root,
          { id: 'b', name: 'other', defaultOpen: true },
          h(SJDisclosure.Trigger, null, 'b'),
        ),
        h(SJDisclosure.Root, { id: 'c', defaultOpen: true }, h(SJDisclosure.Trigger, null, 'c')),
      ),
      off,
    );
    toggle(r, nodes[0]!, true, 0);
    expect(nodes.map((n) => n.open)).toEqual([true, true, true]);
  });
  it('a controlled member still closes its peers', () => {
    const r = mount(
      group((i) => (i === 1 ? { open: false, onOpenChange() {} } : {})),
      off,
    );
    toggle(r, nodes[0]!, true, 0);
    toggle(r, nodes[1]!, true, 1); // the controlled member opens natively (then is rejected)
    expect(nodes[0]!.open).toBe(false);
  });
  it('a rejected open still closed the peers (the owner puts the member back)', async () => {
    const r = mount(
      group((i) => (i === 2 ? { open: false, onOpenChange() {} } : {})),
      off,
    );
    toggle(r, nodes[0]!, true, 0);
    toggle(r, nodes[2]!, true, 2);
    await act(async () => {});
    expect(nodes[0]!.open).toBe(false);
    expect(nodes[2]!.open).toBe(false);
  });
  it('a programmatic open (no user, toggle event only) closes peers', () => {
    const r = mount(group(), off);
    toggle(r, nodes[1]!, true, 1);
    toggle(r, nodes[2]!, true, 2);
    expect(nodes.map((n) => n.open)).toEqual([false, false, true]);
  });
  it('a close does not touch the peers', () => {
    const r = mount(
      group(() => ({ defaultOpen: true })),
      off,
    );
    toggle(r, nodes[0]!, false, 0);
    expect(nodes.map((n) => n.open)).toEqual([false, true, true]);
  });
  it('native engines (detailsName true) do nothing: the browser already closed the peers', () => {
    const r = mount(group(), { detailsName: true });
    toggle(r, nodes[0]!, true, 0);
    toggle(r, nodes[1]!, true, 1);
    expect(nodes.map((n) => n.open)).toEqual([true, true, false]);
  });
});

describe('SSR and hydration', () => {
  const tree = () => h(SJProvider, null, full({ name: 'n', defaultOpen: true }));
  it('renders markup on the server without document', () => {
    expect(typeof document).toBe('undefined');
    const html = renderToString(tree());
    expect(html).toContain('<details');
    expect(html).toContain('open=""');
    expect(html).toContain('data-state="open"');
    expect(html).toContain('<summary');
    expect(html).not.toContain('aria-expanded');
    expect(html).not.toContain('role=');
  });
  it('closed markup has no open attribute', () => {
    expect(renderToStaticMarkup(full())).not.toContain('open');
  });
  it('the root opts out of the dev hydration warning: the user may toggle <details> before hydration', () => {
    const r = mount(full());
    expect(detailsOf(r).props['suppressHydrationWarning']).toBe(true);
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
    const r = mount(h(StrictMode, null, full({ onOpenChange: spy })));
    const node = nodes[nodes.length - 1]!;
    toggle(r, node, true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(detailsOf(r).props['data-state']).toBe('open');
    toggle(r, node, false);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('StrictMode reports a pre-hydration state once', () => {
    const spy = vi.fn();
    mount(h(StrictMode, null, full({ onOpenChange: spy })), undefined, true);
    expect(spy).toHaveBeenCalledTimes(1);
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
              { liveHost: () => host, scheduler: sched, supports: { detailsName: false } },
              full({ name: 'g', open: false, onOpenChange: () => {} }),
            ),
          ),
          {
            createNodeMock: () => {
              const n = { id: '', open: false, getAttribute: () => 'g', getRootNode: () => doc };
              refs.push(new WeakRef(n));
              return n;
            },
          },
        );
      });
      act(() => (r.root.findByType('details').props.onToggle as (e: object) => void)({}));
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
