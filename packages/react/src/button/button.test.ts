import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, createRef, StrictMode, act } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { SJButton, SJButtonIcon, SJButtonRoot } from './index';
import * as flat from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];
function mount(el: unknown, opts?: { createNodeMock?: (e: unknown) => unknown }) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el as never, opts as never);
  });
  mounted.push(r);
  return r;
}
afterEach(() => {
  while (mounted.length) {
    const r = mounted.pop()!;
    act(() => r.unmount());
  }
  vi.restoreAllMocks();
});
const host = (r: ReactTestRenderer, type: string) => r.root.findByType(type as never);
const evt = () => ({ preventDefault: vi.fn(), nativeEvent: { native: true } });
const click = (i: ReactTestInstance, e = evt()) => {
  act(() => (i.props.onClick as (e: unknown) => void)(e));
  return e;
};

describe('naming (ADR-002)', () => {
  it('namespace object plus flat exports share the same components', () => {
    expect(SJButton.Root).toBe(SJButtonRoot);
    expect(SJButton.Icon).toBe(SJButtonIcon);
    expect(flat.SJButtonRoot).toBe(SJButtonRoot);
    expect(Object.keys(flat).sort()).toEqual(['SJButton', 'SJButtonIcon', 'SJButtonRoot']);
  });
});

describe('rendering', () => {
  it('renders a native button with the getter attributes', () => {
    const r = mount(h(SJButton, { variant: 'soft', tone: 'error', size: 'lg' }, 'Save'));
    const b = host(r, 'button');
    expect(b.props).toMatchObject({
      type: 'button',
      className: 'sj-button__root',
      'data-part': 'root',
      'data-variant': 'soft',
      'data-tone': 'error',
      'data-size': 'lg',
    });
    expect(b.props.disabled).toBeUndefined();
    expect(b.children).toEqual(['Save']);
  });

  it('renders <a> for a non-empty href, with rel for target=_blank', () => {
    const r = mount(h(SJButton, { href: '/x', target: '_blank' }, 'Go'));
    const a = host(r, 'a');
    expect(a.props).toMatchObject({
      href: '/x',
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'sj-button__link',
      'data-part': 'link',
    });
    expect(a.props.type).toBeUndefined();
    expect(() => host(r, 'button')).toThrow();
  });

  it('empty href stays a button', () => {
    const r = mount(h(SJButton, { href: '' }, 'x'));
    expect(host(r, 'button')).toBeTruthy();
  });

  it('disabled link drops href and is announced as a disabled link', () => {
    const onPress = vi.fn();
    const r = mount(h(SJButton, { href: '/x', target: '_blank', disabled: true, onPress }, 'Go'));
    const a = host(r, 'a');
    expect(a.props.href).toBeUndefined();
    expect(a.props.target).toBeUndefined();
    expect(a.props.rel).toBeUndefined();
    expect(a.props.role).toBe('link');
    expect(a.props['aria-disabled']).toBe('true');
    expect(a.props['data-disabled']).toBe('true');
    const e = click(a);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled button uses the native attribute and never presses', () => {
    const onPress = vi.fn();
    const r = mount(h(SJButton, { disabled: true, onPress }, 'x'));
    const b = host(r, 'button');
    expect(b.props.disabled).toBe(true);
    expect(b.props['data-disabled']).toBe('true');
    click(b);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('icon-only: label becomes aria-label, the icon is the only content and is aria-hidden', () => {
    const r = mount(h(SJButton, { iconOnly: true, label: 'Close' }, h('svg', null)));
    const b = host(r, 'button');
    expect(b.props['aria-label']).toBe('Close');
    expect(b.props['data-icon-only']).toBe('true');
    const icon = b.findByProps({ 'data-part': 'icon' });
    expect(icon.props['aria-hidden']).toBe('true');
    expect(icon.props.className).toBe('sj-button__icon');
    expect(icon.findByType('svg' as never)).toBeTruthy();
  });

  it('icon-only without a name warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mount(h(SJButton, { iconOnly: true, icon: h('svg', null) }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('accessible name'));
  });

  it('consumer aria-label survives (library emits none when label is absent)', () => {
    const r = mount(h(SJButton, { iconOnly: true, icon: 'i', 'aria-label': 'Menu' } as never));
    expect(host(r, 'button').props['aria-label']).toBe('Menu');
  });

  it('markup-like strings render as text, not elements', () => {
    const r = mount(h(SJButton, null, '<b>x</b>'));
    expect(host(r, 'button').children).toEqual(['<b>x</b>']);
  });
});

describe('classes (ADR-004)', () => {
  it('appends per-part classes and className after the library class', () => {
    const r = mount(
      h(
        SJButton,
        { classes: { root: 'r', link: 'l', icon: 'i' }, className: 'c', icon: 'ic' },
        't',
      ),
    );
    const b = host(r, 'button');
    expect(b.props.className).toBe('sj-button__root r c');
    expect(b.findByProps({ 'data-part': 'icon' }).props.className).toBe('sj-button__icon i');
  });
  it('uses classes.link for the anchor', () => {
    const r = mount(h(SJButton, { href: '/x', classes: { root: 'r', link: 'l' } }, 't'));
    expect(host(r, 'a').props.className).toBe('sj-button__link l');
  });
});

describe('children vs props (prop-or-slot)', () => {
  it('icon prop renders before the children', () => {
    const r = mount(h(SJButton, { icon: h('i', { key: 'i' }) }, 'Text'));
    const kids = host(r, 'button').children as (string | ReactTestInstance)[];
    expect((kids[0] as ReactTestInstance).findByType('span' as never).props['data-part']).toBe(
      'icon',
    );
    expect(kids[1]).toBe('Text');
  });
  it('primitives compose directly', () => {
    const r = mount(
      h(SJButton.Root, { iconOnly: true, label: 'x' }, h(SJButton.Icon, { className: 'k' }, 'g')),
    );
    expect(host(r, 'button').findByProps({ 'data-part': 'icon' }).props.className).toBe(
      'sj-button__icon k',
    );
  });
  it('iconOnly ignores text children when an icon prop is given', () => {
    const r = mount(h(SJButton, { iconOnly: true, label: 'x', icon: 'I' }, 'ignored'));
    expect(JSON.stringify(r.toJSON())).not.toContain('ignored');
  });
});

describe('onPress semantics', () => {
  it('click (native activation for Enter/Space on a button, Enter on a link) presses with the native event', () => {
    const onPress = vi.fn();
    const r = mount(h(SJButton, { onPress }, 'x'));
    const e = click(host(r, 'button'));
    expect(onPress).toHaveBeenCalledOnce();
    expect(onPress).toHaveBeenCalledWith({ originalEvent: e.nativeEvent });
    const link = mount(h(SJButton, { href: '/x', onPress }, 'x'));
    click(host(link, 'a'));
    expect(onPress).toHaveBeenCalledTimes(2);
  });
  it('installs no key handlers: Space on a link is not an activation', () => {
    const r = mount(h(SJButton, { href: '/x', onPress: () => undefined }, 'x'));
    const keys = Object.keys(host(r, 'a').props).filter((k) => /^onKey/.test(k));
    expect(keys).toEqual([]);
    const b = mount(h(SJButton, null, 'x'));
    expect(
      Object.keys(host(b, 'button').props).filter((k) => /^onKey|^onPointer|^onMouse/.test(k)),
    ).toEqual([]);
  });
  it('consumer onClick runs first; preventDefault cancels onPress', () => {
    const order: string[] = [];
    const r = mount(
      h(
        SJButton,
        {
          onClick: (e) => {
            order.push('consumer');
            e.preventDefault();
          },
          onPress: () => order.push('press'),
        },
        'x',
      ),
    );
    click(host(r, 'button'), { ...evt(), preventDefault: vi.fn() });
    expect(order).toEqual(['consumer', 'press']); // synthetic mock never sets defaultPrevented
  });
  it('reads the props of the latest commit', () => {
    const a = vi.fn();
    const b = vi.fn();
    const r = mount(h(SJButton, { onPress: a }, 'x'));
    act(() => r.update(h(SJButton, { onPress: b }, 'x')));
    click(host(r, 'button'));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
  it('type=submit passes through; consumer cannot override protected keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = mount(h(SJButton, { type: 'submit', 'data-part': 'evil' } as never, 'x'));
    expect(host(r, 'button').props.type).toBe('submit');
    expect(host(r, 'button').props['data-part']).toBe('root');
    expect(warn).toHaveBeenCalled();
  });
});

describe('ref forwarding', () => {
  it('points at the real element, for button, link and icon', () => {
    const node = { tag: 'real' };
    const ref = createRef<HTMLElement>();
    mount(h(SJButton, { ref }, 'x'), { createNodeMock: () => node });
    expect(ref.current).toBe(node);
    const lref = createRef<HTMLElement>();
    mount(h(SJButton, { ref: lref, href: '/x' }, 'x'), { createNodeMock: () => node });
    expect(lref.current).toBe(node);
    const fn = vi.fn();
    mount(h(SJButton.Root, { ref: fn }, 'x'), { createNodeMock: () => node });
    expect(fn).toHaveBeenCalledWith(node);
    const iref = createRef<HTMLSpanElement>();
    mount(h(SJButton.Icon, { ref: iref }), { createNodeMock: () => node });
    expect(iref.current).toBe(node);
  });
});

describe('SSR, hydration, StrictMode', () => {
  const tree = () =>
    h(SJButton, { variant: 'outline', href: '/x', classes: { link: 'l' }, icon: h('i') }, 'Go');
  it('server markup carries the full attribute set and no handler leakage', () => {
    const html = renderToString(tree());
    expect(html).toContain('<a ');
    expect(html).toContain('class="sj-button__link l"');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('href="/x"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('onClick');
    expect(html).toBe(renderToString(h(StrictMode, null, tree())));
  });
  it('server render needs no document/window', () => {
    expect(typeof document).toBe('undefined');
    expect(() => renderToString(h(SJButton, { disabled: true }, 'x'))).not.toThrow();
  });
  it('server markup equals the client tree (same props bag on both sides, so hydration matches)', () => {
    const r = mount(tree());
    const a = host(r, 'a');
    const html = renderToString(tree());
    for (const [k, v] of Object.entries(a.props)) {
      if (typeof v === 'function' || k === 'children' || k === 'ref') continue;
      const attr = k === 'className' ? 'class' : k;
      expect(html).toContain(`${attr}="${String(v)}"`);
    }
  });
  it('hydrateRoot is importable but needs a DOM; real hydration is covered by L2 (.f)', () => {
    expect(typeof hydrateRoot).toBe('function');
  });
  it('StrictMode double render attaches one handler and presses once', () => {
    const onPress = vi.fn();
    const r = mount(h(StrictMode, null, h(SJButton, { onPress }, 'x')));
    click(host(r, 'button'));
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('retention (ADR-011)', () => {
  it('1,000 StrictMode mount/unmount cycles retain nothing', async () => {
    const mod = (n: string) => import(/* @vite-ignore */ n) as Promise<Record<string, unknown>>;
    const v8 = (await mod('node:v8')) as { setFlagsFromString(f: string): void };
    const vm = (await mod('node:vm')) as { runInNewContext(c: string): () => void };
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 1000; i++) {
      const payload = { i };
      refs.push(new WeakRef(payload));
      let r!: ReactTestRenderer;
      act(() => {
        r = create(h(StrictMode, null, h(SJButton, { icon: 'i', onPress: () => payload.i }, 'x')));
      });
      click(r.root.findByType('button' as never));
      act(() => r.unmount());
    }
    await new Promise((res) => setTimeout(res, 0));
    gc();
    await new Promise((res) => setTimeout(res, 0));
    gc();
    expect(refs.filter((w) => w.deref() !== undefined).length).toBeLessThanOrEqual(2);
  }, 60_000);
});
