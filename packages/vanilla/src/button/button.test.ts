import { createRuntime } from '@ramoslabs/core/runtime';
import { describe, expect, it, vi } from 'vitest';
import { createHost } from '../runtime/index';
import { defineSJButton, mountButton, type ButtonMountProps } from './index';

// Node has no DOM (ADR-002: jsdom-free). A tiny double covers what the adapter touches; real
// browser behaviour (native activation, focus, forms) is the .f conformance suite's job. The
// double emulates the one native rule these tests need: activating a submit button without a
// cancelled click fires `submit` on its form owner.
class FText {
  constructor(public data: string) {}
  parent: FEl | null = null;
  get textContent() {
    return this.data;
  }
  remove() {
    this.parent?.removeChild(this);
  }
}
class FEl extends EventTarget {
  attrs = new Map<string, string>();
  kids: (FEl | FText)[] = [];
  parent: FEl | null = null;
  added: { signal?: AbortSignal; type: string }[] = [];
  form: FEl | null = null;
  constructor(
    public localName: string,
    public ownerDocument: FDoc,
  ) {
    super();
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  get firstChild() {
    return this.kids[0] ?? null;
  }
  appendChild(n: FEl | FText) {
    n.parent?.removeChild(n);
    n.parent = this;
    this.kids.push(n);
    return n;
  }
  insertBefore(n: FEl | FText, ref: FEl | FText | null) {
    n.parent?.removeChild(n);
    n.parent = this;
    const i = ref ? this.kids.indexOf(ref) : this.kids.length;
    this.kids.splice(i, 0, n);
    return n;
  }
  removeChild(n: FEl | FText) {
    this.kids = this.kids.filter((k) => k !== n);
    n.parent = null;
  }
  replaceChildren(...n: (FEl | FText)[]) {
    for (const k of this.kids) k.parent = null;
    this.kids = [];
    for (const x of n) this.appendChild(x);
  }
  remove() {
    this.parent?.removeChild(this);
  }
  contains(n: unknown): boolean {
    return n === this || this.kids.some((k) => k instanceof FEl && k.contains(n));
  }
  set textContent(t: string) {
    this.replaceChildren(new FText(t));
  }
  get textContent(): string {
    return this.kids.map((k) => k.textContent).join('');
  }
  override addEventListener(type: string, cb: never, o?: AddEventListenerOptions) {
    this.added.push({ type, signal: o?.signal });
    // eslint-disable-next-line sj-boundaries/listener-signal -- test double forwards the caller options verbatim
    super.addEventListener(type, cb, o);
  }
  get live() {
    return this.added.filter((a) => !a.signal?.aborted).length;
  }
  /** Native click: dispatch, then run default activation unless cancelled and not disabled. */
  click() {
    if (this.attrs.has('disabled') && this.localName === 'button') return;
    const ev = new Event('click', { bubbles: true, cancelable: true });
    this.fire(ev);
    if (!ev.defaultPrevented && this.localName === 'button' && this.attrs.get('type') === 'submit')
      this.form?.dispatchEvent(new Event('submit'));
  }
  /** Dispatch `ev` on this node, then bubble a copy to each ancestor (the double has no native bubbling). */
  fire(ev: Event) {
    const path: FEl[] = [this];
    for (let p = this.parent; p; p = p.parent) path.push(p);
    for (const n of path) {
      const copy = new Event(ev.type, { cancelable: true });
      Object.defineProperty(copy, 'target', { value: this });
      n.dispatchEvent(copy);
      if (copy.defaultPrevented) ev.preventDefault();
    }
    return ev;
  }
}
class FDoc {
  createElement(n: string) {
    return new FEl(n, this);
  }
  createTextNode(t: string) {
    return new FText(t);
  }
}
const setup = () => {
  const doc = new FDoc();
  const container = doc.createElement('div');
  const runtime = createRuntime({ target: 'client', idFactory: () => 'id1' });
  const host = createHost(runtime, { liveHost: { create: () => ({ setText: () => undefined }) } });
  return { doc, container, host };
};
const ctl = (c: FEl) => c.kids[0] as FEl;

describe('SJButton vanilla: rendering', () => {
  it('renders a <button> with part, axes and a text node', () => {
    const { container, host } = setup();
    mountButton(host, container as never, { text: 'Save', tone: 'success' });
    const b = ctl(container);
    expect(b.localName).toBe('button');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('data-part')).toBe('root');
    expect(b.getAttribute('data-variant')).toBe('solid');
    expect(b.getAttribute('data-tone')).toBe('success');
    expect(b.kids[0]).toBeInstanceOf(FText);
    expect(b.textContent).toBe('Save');
  });

  it('renders markup-looking text as text, never as elements (no innerHTML)', () => {
    const { container, host } = setup();
    const evil = '<img src=x onerror=alert(1)>';
    mountButton(host, container as never, { text: evil, icon: '<b>', label: evil });
    const b = ctl(container);
    expect(b.kids.filter((k) => k instanceof FEl)).toHaveLength(1); // only the icon span
    expect(b.textContent).toBe(`<b>${evil}`);
    expect(b.getAttribute('aria-label')).toBe(evil);
  });

  it('renders a link as <a> with href, and no type/disabled', () => {
    const { container, host } = setup();
    mountButton(host, container as never, { text: 'Docs', href: '/docs', target: '_blank' });
    const a = ctl(container);
    expect(a.localName).toBe('a');
    expect(a.getAttribute('href')).toBe('/docs');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.hasAttribute('type')).toBe(false);
    expect(a.getAttribute('data-part')).toBe('link');
  });

  it('disabled link drops href, states role and aria-disabled, and cancels click', () => {
    const { container, host } = setup();
    const onPress = vi.fn();
    mountButton(host, container as never, { text: 'Docs', href: '/d', disabled: true, onPress });
    const a = ctl(container);
    expect(a.hasAttribute('href')).toBe(false);
    expect(a.getAttribute('role')).toBe('link');
    expect(a.getAttribute('aria-disabled')).toBe('true');
    const ev = a.fire(new Event('click', { cancelable: true }));
    expect(ev.defaultPrevented).toBe(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('icon-only carries aria-label and a hidden icon part, with no text node', () => {
    const { container, host } = setup();
    mountButton(host, container as never, { iconOnly: true, label: 'Close', icon: 'x' });
    const b = ctl(container);
    expect(b.getAttribute('aria-label')).toBe('Close');
    expect(b.getAttribute('data-icon-only')).toBe('true');
    const icon = b.kids[0] as FEl;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('data-part')).toBe('icon');
  });

  it('update patches attributes, removes stale ones and swaps button <-> a', () => {
    const { container, host } = setup();
    const m = mountButton(host, container as never, { text: 'A', disabled: true, label: 'L' });
    expect(ctl(container).hasAttribute('disabled')).toBe(true);
    m.update({ text: 'B', tone: 'error' });
    const b = ctl(container);
    expect(b.hasAttribute('disabled')).toBe(false);
    expect(b.hasAttribute('data-disabled')).toBe(false);
    expect(b.hasAttribute('aria-label')).toBe(false);
    expect(b.textContent).toBe('B');
    m.update({ text: 'B', href: '/x' });
    expect(ctl(container).localName).toBe('a');
    expect(container.kids).toHaveLength(1);
    m.update({ text: 'B' });
    expect(ctl(container).localName).toBe('button');
  });
});

describe('SJButton vanilla: onPress', () => {
  it('fires onPress and a bubbling press CustomEvent once per click with the original event', () => {
    const { container, host } = setup();
    const onPress = vi.fn();
    const seen = vi.fn();
    mountButton(host, container as never, { text: 'Go', onPress });
    // eslint-disable-next-line sj-boundaries/listener-signal -- test observer on the double
    ctl(container).addEventListener('press', seen as never); // the double does not bubble CustomEvents
    ctl(container).click();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0]![0].originalEvent.type).toBe('click');
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('reads the newest onPress after update', () => {
    const { container, host } = setup();
    const a = vi.fn();
    const b = vi.fn();
    const m = mountButton(host, container as never, { text: 'Go', onPress: a });
    m.update({ text: 'Go', onPress: b });
    ctl(container).click();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('a consumer onClick that cancels suppresses the press', () => {
    const { container, host } = setup();
    const onPress = vi.fn();
    mountButton(host, container as never, {
      text: 'Go',
      onPress,
      attrs: { onClick: (e: Event) => e.preventDefault() },
    });
    ctl(container).click();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled never presses', () => {
    const { container, host } = setup();
    const onPress = vi.fn();
    mountButton(host, container as never, { text: 'Go', onPress, disabled: true });
    ctl(container).click(); // native disabled: no event at all
    ctl(container).fire(new Event('click', { cancelable: true })); // forced event still cancelled
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('SJButton vanilla: form participation (ADR-014: native, no FACE)', () => {
  it('a submit button submits its form owner; type=button and a cancelled click do not', () => {
    const { doc, container, host } = setup();
    const form = doc.createElement('form');
    const submit = vi.fn();
    // eslint-disable-next-line sj-boundaries/listener-signal -- test observer on the double
    form.addEventListener('submit', submit as never);
    container.form = form; // the control inherits the form owner through the tree
    const m = mountButton(host, container as never, { text: 'Send', type: 'submit' });
    ctl(container).form = form;
    ctl(container).click();
    expect(submit).toHaveBeenCalledTimes(1);
    m.update({ text: 'Send', type: 'button' });
    ctl(container).form = form;
    ctl(container).click();
    expect(submit).toHaveBeenCalledTimes(1);
    m.update({
      text: 'Send',
      type: 'submit',
      attrs: { onClick: (e: Event) => e.preventDefault() },
    });
    ctl(container).form = form;
    ctl(container).click();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('SJButton vanilla: lifecycle', () => {
  it('destroy aborts every listener, removes the control and is idempotent', () => {
    const { container, host } = setup();
    const onPress = vi.fn();
    const m = mountButton(host, container as never, { text: 'Go', onPress });
    const b = ctl(container);
    expect(container.added.length).toBeGreaterThan(0);
    expect(container.live).toBe(container.added.length);
    expect(b.added).toHaveLength(0); // delegation: the control owns no listeners
    m.destroy();
    m.destroy();
    expect(container.live).toBe(0);
    expect(container.kids).toHaveLength(0);
    b.fire(new Event('click', { cancelable: true }));
    expect(onPress).not.toHaveBeenCalled();
    m.update({ text: 'late' }); // no-op after destroy
    expect(container.kids).toHaveLength(0);
  });

  it('1,000 mount/update/destroy cycles retain no listeners, children or instances', () => {
    const { container, host } = setup();
    for (let i = 0; i < 1000; i++) {
      const m = mountButton(host, container as never, { text: `n${i}`, onPress: () => undefined });
      m.update({ text: 'x', href: '/h', icon: 'i' });
      m.update({ text: 'y' });
      m.destroy();
    }
    expect(container.live).toBe(0);
    expect(container.kids).toHaveLength(0);
    host.destroy();
  });

  it('source never uses innerHTML/outerHTML/insertAdjacentHTML/attachShadow', async () => {
    // @ts-expect-error node types are not loaded in this package (types: [])
    const { readFileSync } = (await import('node:fs')) as {
      readFileSync(u: URL, e: string): string;
    };
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8').replace(
      /\/\/.*$/gm,
      '',
    );
    expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|attachShadow|attachInternals/);
  });
});

describe('sj-button element', () => {
  const fakeRegistry = () => {
    const map = new Map<string, unknown>();
    return {
      map,
      get: (n: string) => map.get(n),
      define: (n: string, c: unknown) => void map.set(n, c),
    };
  };

  it('importing the module registers nothing and reads no browser globals', () => {
    // The module is already imported at the top of this file under node (no HTMLElement/customElements).
    expect((globalThis as { customElements?: unknown }).customElements).toBeUndefined();
  });

  it('define() is idempotent per name and registers once', () => {
    (globalThis as { HTMLElement?: unknown }).HTMLElement = class {};
    try {
      const reg = fakeRegistry();
      expect(defineSJButton({ registry: reg })).toBe(true);
      expect(defineSJButton({ registry: reg })).toBe(false);
      expect(reg.map.size).toBe(1);
      expect(reg.map.has('sj-button')).toBe(true);
      expect(defineSJButton({ registry: reg, name: 'x-btn' })).toBe(true);
    } finally {
      delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
    }
  });

  it('element lifecycle: connect mounts a real button, attribute change updates, disconnect destroys', () => {
    const { doc, host } = setup();
    class Base extends FEl {
      constructor() {
        super('sj-button', doc);
      }
    }
    (globalThis as { HTMLElement?: unknown }).HTMLElement = Base;
    try {
      const reg = fakeRegistry();
      defineSJButton({ registry: reg, host });
      const Ctor = reg.map.get('sj-button') as new () => FEl & {
        connectedCallback(): void;
        disconnectedCallback(): void;
        attributeChangedCallback(): void;
      };
      const el = new Ctor();
      el.setAttribute('tone', 'info');
      el.textContent = ' Hello ';
      (el as FEl & { getAttribute(k: string): string | null }).getAttribute('tone');
      el.connectedCallback();
      expect(ctl(el).getAttribute('data-tone')).toBe('info');
      expect(ctl(el).textContent).toBe('Hello');
      el.setAttribute('href', '/z');
      el.attributeChangedCallback();
      expect(ctl(el).localName).toBe('a');
      el.disconnectedCallback();
      expect(el.kids).toHaveLength(0);
      expect(el.live).toBe(0);
    } finally {
      delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
    }
  });
});

export type { ButtonMountProps };
