import { describe, expect, it, vi } from 'vitest';
import { createRenderer, createSSRApp, h, nextTick, reactive, type App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import fc from 'fast-check';
import { SJButton } from './index';

// DOM-free renderer (as in runtime.test.ts): elements keep the props Vue patched, including
// handlers, so a click is `props.onClick(event)` and the suite runs under `node`.
interface N {
  type: string;
  props: Record<string, unknown>;
  children: N[];
  parent?: N;
  text?: string;
}
const mk = (type: string): N => ({ type, props: {}, children: [] });
const { createApp } = createRenderer<N, N>({
  patchProp(el, key, _prev, next) {
    if (next === null || next === undefined || next === false) delete el.props[key];
    else el.props[key] = next;
  },
  insert(el, parent, anchor) {
    el.parent = parent;
    const i = anchor ? parent.children.indexOf(anchor) : -1;
    if (i < 0) parent.children.push(el);
    else parent.children.splice(i, 0, el);
  },
  remove(el) {
    const p = el.parent;
    if (p) p.children = p.children.filter((c) => c !== el);
  },
  createElement: mk,
  createText: (text) => ({ ...mk('#text'), text }),
  createComment: (text) => ({ ...mk('#comment'), text }),
  setText(n, text) {
    n.text = text;
  },
  setElementText(n, text) {
    n.children = [{ ...mk('#text'), text }];
  },
  parentNode: (n) => n.parent ?? null,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
});

type Render = Parameters<typeof h>;
function mount(props: Record<string, unknown>, slots?: Record<string, () => unknown>) {
  const root = mk('root');
  const state = reactive({ ...props });
  const app = createApp({ render: () => h(SJButton, state, slots as never) });
  app.mount(root);
  const el = () => root.children[0]!;
  return { app, root, el, state };
}
const click = (el: N, event: { preventDefault: () => void } = { preventDefault() {} }) =>
  (el.props.onClick as (e: unknown) => void)(event);
const text = (n: N): string =>
  n.type === '#text' ? (n.text ?? '') : n.children.map(text).join('');
void (null as unknown as Render);

describe('SJButton element and attributes', () => {
  it('renders a native <button type=button> with the axis data attributes', () => {
    const { el } = mount({}, { default: () => 'Save' });
    expect(el().type).toBe('button');
    expect(el().props).toMatchObject({
      type: 'button',
      class: 'sj-button__root',
      'data-part': 'root',
      'data-variant': 'solid',
      'data-tone': 'primary',
      'data-size': 'md',
    });
    expect(el().props).not.toHaveProperty('disabled');
    expect(text(el())).toBe('Save');
  });

  it('renders <a> for a non-empty href and keeps button-only keys off it', () => {
    const { el } = mount({ href: '/x', target: '_blank' }, { default: () => 'Go' });
    expect(el().type).toBe('a');
    expect(el().props).toMatchObject({
      href: '/x',
      'data-part': 'link',
      class: 'sj-button__link',
      rel: 'noopener noreferrer',
    });
    expect(el().props).not.toHaveProperty('type');
    expect(el().props).not.toHaveProperty('disabled');
    expect(mount({ href: '' }).el().type).toBe('button');
  });

  it('a disabled link drops href and states role and aria-disabled (per the getters)', () => {
    const { el } = mount({ href: '/x', target: '_blank', disabled: true });
    expect(el().type).toBe('a');
    expect(el().props).toMatchObject({
      role: 'link',
      'aria-disabled': 'true',
      'data-disabled': 'true',
    });
    for (const k of ['href', 'target', 'rel']) expect(el().props).not.toHaveProperty(k);
    const ev = { preventDefault: vi.fn() };
    const onPress = vi.fn();
    const m = mount({ href: '/x', disabled: true, onPress });
    click(m.el(), ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a disabled button is natively disabled and never presses', () => {
    const onPress = vi.fn();
    const { el } = mount({ disabled: true, onPress });
    expect(el().props).toMatchObject({ disabled: true, 'data-disabled': 'true' });
    click(el());
    expect(onPress).not.toHaveBeenCalled();
  });

  it('icon-only carries aria-label, a decorative icon and no visible text', () => {
    const { el } = mount({ iconOnly: true, label: 'Close' }, { icon: () => 'x' });
    expect(el().props).toMatchObject({ 'aria-label': 'Close', 'data-icon-only': 'true' });
    const icon = el().children[0]!;
    expect(icon.props).toMatchObject({
      class: 'sj-button__icon',
      'aria-hidden': 'true',
      'data-part': 'icon',
    });
  });

  it('warns in dev when icon-only has no accessible name, and accepts a consumer aria-label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount({ iconOnly: true }, { icon: () => 'x' });
    expect(warn).toHaveBeenCalled();
    warn.mockClear();
    const m = mount({ iconOnly: true, 'aria-label': 'Open' }, { icon: () => 'x' });
    expect(warn).not.toHaveBeenCalled();
    expect(m.el().props['aria-label']).toBe('Open');
    warn.mockRestore();
  });

  it('unknown axis values fall back to the defaults', () => {
    const { el } = mount({ variant: 'nope', tone: 'x', size: 'huge' });
    expect(el().props).toMatchObject({
      'data-variant': 'solid',
      'data-tone': 'primary',
      'data-size': 'md',
    });
  });

  it('updates reactively when props change', async () => {
    const m = mount({ variant: 'solid' });
    m.state.variant = 'ghost';
    m.state.href = '/y';
    await nextTick();
    expect(m.el().type).toBe('a');
    expect(m.el().props['data-variant']).toBe('ghost');
  });
});

describe('SJButton classes, attrs and slots', () => {
  it('appends consumer class then classes.<part>, per part', () => {
    const b = mount(
      { class: 'mine', classes: { root: 'r', link: 'l', icon: 'i' } },
      { icon: () => 'x' },
    );
    expect(b.el().props.class).toBe('sj-button__root mine r');
    expect(b.el().children[0]!.props.class).toBe('sj-button__icon i');
    const a = mount({ href: '/x', classes: { root: 'r', link: 'l' } });
    expect(a.el().props.class).toBe('sj-button__link l');
  });

  it('passes non-prop attributes through and keeps library-owned ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el } = mount({ 'data-testid': 't', 'aria-describedby': 'h', 'data-variant': 'hack' });
    expect(el().props['data-testid']).toBe('t');
    expect(el().props['aria-describedby']).toBe('h');
    expect(el().props['data-variant']).toBe('solid');
    warn.mockRestore();
  });

  it('slot content wins; the label prop is the visible text only when there is no slot', () => {
    expect(text(mount({ label: 'Prop' }).el())).toBe('Prop');
    expect(text(mount({ label: 'Prop' }, { default: () => 'Slot' }).el())).toBe('Slot');
    expect(text(mount({ iconOnly: true, label: 'Close' }).el())).toBe('');
  });

  it('the icon slot renders before the label inside the icon part', () => {
    const { el } = mount({}, { icon: () => 'i', default: () => 'L' });
    expect(el().children.map((c) => c.props['data-part'] ?? c.type)).toEqual(['icon', '#text']);
  });

  it('id prop becomes the element id', () => {
    expect(mount({ id: 'b1' }).el().props.id).toBe('b1');
  });
});

describe('SJButton onPress and keyboard semantics', () => {
  it('a click (the native result of pointer, Enter or Space on a button) emits press once', () => {
    const onPress = vi.fn();
    const { el } = mount({ onPress });
    const ev = { preventDefault() {} };
    click(el(), ev);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith({ originalEvent: ev });
  });

  it('keyboard is native: no key handlers exist on either element, so Space never activates a link', () => {
    for (const props of [{}, { href: '/x' }]) {
      const keys = Object.keys(mount(props).el().props).filter((k) => /^on/.test(k));
      expect(keys).toEqual(['onClick']);
    }
  });

  it('consumer onClick runs first and preventDefault cancels press', () => {
    const order: string[] = [];
    const onPress = vi.fn(() => order.push('press'));
    const onClick = (e: { preventDefault: () => void }) => {
      order.push('consumer');
      e.preventDefault();
    };
    const m = mount({ onClick, onPress });
    let prevented = false;
    // Library handler checks defaultPrevented via mergeProps' wrapper.
    click(m.el(), {
      get defaultPrevented() {
        return prevented;
      },
      preventDefault() {
        prevented = true;
      },
    } as never);
    expect(order).toEqual(['consumer']);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('the click reads the newest props at fire time', async () => {
    const m = mount({});
    const stale = m.el().props.onClick as (e: unknown) => void;
    m.state.disabled = true;
    await nextTick();
    const onPress = vi.fn();
    m.state.onPress = onPress;
    m.state.disabled = false;
    await nextTick();
    stale({ preventDefault() {} });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SJButton SSR', () => {
  const ssr = (props: Record<string, unknown>, slots?: Record<string, () => unknown>) =>
    renderToString(createSSRApp({ render: () => h(SJButton, props, slots as never) }));

  it('renders a button with attributes and no handler or runtime markup', async () => {
    const html = await ssr({ tone: 'error', classes: { root: 'x' } }, { default: () => 'Delete' });
    expect(html).toBe(
      '<button class="sj-button__root x" data-part="root" data-variant="solid" data-tone="error" data-size="md" type="button">Delete</button>',
    );
  });

  it('renders the link, the disabled link and the icon-only button', async () => {
    expect(await ssr({ href: '/a' }, { default: () => 'A' })).toContain('<a ');
    expect(await ssr({ href: '/a' }, { default: () => 'A' })).toContain('href="/a"');
    const off = await ssr({ href: '/a', disabled: true }, { default: () => 'A' });
    expect(off).not.toContain('href');
    expect(off).toContain('aria-disabled="true"');
    const icon = await ssr({ iconOnly: true, label: 'Close' }, { icon: () => 'x' });
    expect(icon).toContain('aria-label="Close"');
    expect(icon).toContain(
      '<span class="sj-button__icon" aria-hidden="true" data-part="icon">x</span>',
    );
  });

  it('is deterministic across renders (no ids, no random, no warnings)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = await ssr({ variant: 'outline' }, { default: () => 'Z' });
    expect(await ssr({ variant: 'outline' }, { default: () => 'Z' })).toBe(a);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('SJButton lifecycle', () => {
  it('1,000 mount/unmount cycles retain nothing and never need a provider or a store', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = mk('root');
    for (let i = 0; i < 1000; i++) {
      const app: App<N> = createApp({
        render: () => h(SJButton, { href: i % 2 ? '/x' : undefined }, { default: () => 'b' }),
      });
      app.mount(root);
      const instance = (app as unknown as { _instance: { scope: { active: boolean } } })._instance;
      const scope = instance.scope;
      expect(root.children).toHaveLength(1);
      app.unmount();
      expect(scope.active).toBe(false);
      expect(root.children).toHaveLength(0);
    }
    // No SJProvider fallback warning: the button never touches the runtime context.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('property: any axis combination renders matching, defaulted data attributes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('solid', 'soft', 'outline', 'ghost', 'bad'),
        fc.constantFrom('primary', 'neutral', 'success', 'warning', 'error', 'info', 'bad'),
        fc.constantFrom('sm', 'md', 'lg', 'bad'),
        fc.boolean(),
        (variant, tone, size, link) => {
          const { el } = mount({ variant, tone, size, href: link ? '/x' : undefined });
          const ok = (v: string, set: string[], d: string) => (set.includes(v) ? v : d);
          expect(el().type).toBe(link ? 'a' : 'button');
          expect(el().props['data-variant']).toBe(
            ok(variant, ['solid', 'soft', 'outline', 'ghost'], 'solid'),
          );
          expect(el().props['data-tone']).toBe(
            ok(tone, ['primary', 'neutral', 'success', 'warning', 'error', 'info'], 'primary'),
          );
          expect(el().props['data-size']).toBe(ok(size, ['sm', 'md', 'lg'], 'md'));
        },
      ),
      { numRuns: 60 },
    );
  });
});
