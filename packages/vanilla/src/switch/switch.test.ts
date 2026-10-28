import { createRuntime } from '@ramoslabs/core/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHost } from '../runtime/index';
import { define, mountSwitch } from './index';

/** Minimal DOM double (no jsdom in the repo). innerHTML-style sinks throw: text nodes only (ADR-002). */
class FakeEl extends EventTarget {
  parent: FakeEl | undefined;
  children: FakeEl[] = [];
  attrs = new Map<string, string>();
  checked = false;
  disabled = false;
  text = '';
  readonly signals: (AbortSignal | undefined)[] = [];
  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDoc,
  ) {
    super();
  }
  override addEventListener(
    type: string,
    cb: EventListenerOrEventListenerObject | null,
    o?: boolean | AddEventListenerOptions,
  ): void {
    this.signals.push(typeof o === 'object' ? o.signal : undefined);
    // eslint-disable-next-line sj-boundaries/listener-signal -- test double forwards the caller options verbatim
    super.addEventListener(type, cb, o);
  }
  get liveListeners(): number {
    return this.signals.filter((s) => s && !s.aborted).length;
  }
  get unsignalled(): number {
    return this.signals.filter((s) => !s).length;
  }
  append(...kids: FakeEl[]): void {
    for (const k of kids) {
      k.parent = this;
      this.children.push(k);
    }
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = undefined;
  }
  setAttribute(n: string, v: string): void {
    this.attrs.set(n, v);
  }
  getAttribute(n: string): string | null {
    return this.attrs.get(n) ?? null;
  }
  removeAttribute(n: string): void {
    this.attrs.delete(n);
  }
  hasAttribute(n: string): boolean {
    return this.attrs.has(n);
  }
  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    this.text = v;
  }
  set innerHTML(_: string) {
    throw new Error('innerHTML is forbidden');
  }
  insertAdjacentHTML(): never {
    throw new Error('insertAdjacentHTML is forbidden');
  }
  all(): FakeEl[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
  querySelector(sel: string): FakeEl | null {
    return this.all().find((e) => e !== this && e.tagName === sel) ?? null;
  }
}
class FakeDoc {
  createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
  }
}

const mk = (tag = 'label') => new FakeDoc().createElement(tag);
const asEl = (e: FakeEl) => e as unknown as Element;
const tick = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

function setup() {
  let n = 0;
  const runtime = createRuntime({ target: 'client', idFactory: () => `sw${n++}` });
  const host = createHost(runtime, {
    liveHost: { create: () => ({ setText: () => undefined }) },
  });
  return { host };
}

/** The "user" flips the native input and the browser fires `change`. */
function userToggle(input: FakeEl): void {
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change'));
}

/** HTML form-data entry for a checkbox: submitted only when named, enabled and checked. */
function formEntry(input: FakeEl): [string, string] | null {
  const name = input.getAttribute('name');
  if (!name || input.disabled || !input.checked) return null;
  return [name, input.getAttribute('value') ?? 'on'];
}
function bare(name: string | undefined, value: string | undefined, checked: boolean, dis: boolean) {
  const i = mk('input');
  if (name !== undefined) i.setAttribute('name', name);
  if (value !== undefined) i.setAttribute('value', value);
  i.checked = checked;
  i.disabled = dis;
  return i;
}

afterEach(() => vi.restoreAllMocks());

describe('SJSwitch vanilla', () => {
  it('builds the anatomy with text nodes only and a real role=switch checkbox', () => {
    const { host } = setup();
    const root = mk();
    const inst = mountSwitch(host, asEl(root), { label: '<b>Wi-Fi</b>' });
    const input = root.querySelector('input')!;
    expect(input.getAttribute('type')).toBe('checkbox');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.getAttribute('id')).toBe('sw0');
    expect(root.getAttribute('data-part')).toBe('root');
    expect(root.textContent).toBe('<b>Wi-Fi</b>'); // literal text, never parsed
    expect(root.children.map((c) => c.tagName)).toEqual(['input', 'span', 'span']);
    expect(root.children.some((c) => c.children.length)).toBe(false);
    expect(inst.control).toBe(input as unknown as HTMLInputElement);
  });

  it('uncontrolled: toggles through native change; defaultChecked seeds it', () => {
    const { host } = setup();
    const root = mk();
    mountSwitch(host, asEl(root), { defaultChecked: true });
    const input = root.querySelector('input')!;
    expect(input.checked).toBe(true);
    expect(input.getAttribute('data-state')).toBe('on');
    userToggle(input);
    expect(input.checked).toBe(false);
    expect(input.getAttribute('data-state')).toBe('off');
    expect(root.getAttribute('data-state')).toBe('off');
    userToggle(input);
    expect(root.getAttribute('data-state')).toBe('on');
  });

  it('controlled: reports the request, stays on the prop, and corrects a rejected change', async () => {
    const { host } = setup();
    const root = mk();
    const onCheckedChange = vi.fn();
    const inst = mountSwitch(host, asEl(root), { checked: true, onCheckedChange });
    const input = root.querySelector('input')!;
    userToggle(input); // native flips to false
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(root.getAttribute('data-state')).toBe('on'); // prop still true
    await tick();
    expect(input.checked).toBe(true); // reconciled back
    inst.update({ checked: false, onCheckedChange });
    expect(input.checked).toBe(false);
    expect(root.getAttribute('data-state')).toBe('off');
    userToggle(input);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
  });

  it('disabled: native disabled + data-disabled, cleared on update', () => {
    const { host } = setup();
    const root = mk();
    const inst = mountSwitch(host, asEl(root), { disabled: true });
    const input = root.querySelector('input')!;
    expect(input.disabled).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(root.getAttribute('data-disabled')).toBe('true');
    expect(input.hasAttribute('aria-disabled')).toBe(false);
    inst.update({});
    expect(input.disabled).toBe(false);
    expect(input.hasAttribute('disabled')).toBe(false);
    expect(root.hasAttribute('data-disabled')).toBe(false);
  });

  it.each([
    ['named off', 'n', undefined, false, false],
    ['named on', 'n', undefined, true, false],
    ['named on value', 'n', 'yes', true, false],
    ['named on disabled', 'n', undefined, true, true],
    ['unnamed on', undefined, undefined, true, false],
  ])('form submit equals a bare checkbox: %s', (_l, name, value, checked, disabled) => {
    const { host } = setup();
    const root = mk();
    const props = {
      ...(name !== undefined && { name }),
      ...(value !== undefined && { value }),
      defaultChecked: checked,
      disabled,
    };
    mountSwitch(host, asEl(root), props);
    const input = root.querySelector('input')!;
    expect(formEntry(input)).toEqual(formEntry(bare(name, value, checked, disabled)));
    // and after the user toggles, it still matches a bare checkbox flipped the same way
    const b = bare(name, value, checked, disabled);
    if (!disabled) {
      userToggle(input);
      b.checked = !b.checked;
      expect(formEntry(input)).toEqual(formEntry(b));
    }
  });

  it('destroy aborts every listener and later events do nothing', () => {
    const { host } = setup();
    const root = mk();
    const onCheckedChange = vi.fn();
    const inst = mountSwitch(host, asEl(root), { checked: false, onCheckedChange });
    const input = root.querySelector('input')!;
    expect(input.liveListeners).toBe(1);
    expect(input.unsignalled).toBe(0);
    inst.destroy();
    expect(input.liveListeners).toBe(0);
    input.dispatchEvent(new Event('change'));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(root.children).toEqual([]);
    inst.destroy(); // idempotent
    expect(inst.destroyed).toBe(true);
  });

  it('registers no pointer or touch listener (activation is native)', () => {
    const { host } = setup();
    const root = mk();
    mountSwitch(host, asEl(root), {});
    const total = root.all().reduce((n, e) => n + e.signals.length, 0);
    expect(total).toBe(1); // the single change listener
  });

  it('1,000 mount/destroy cycles retain nothing', () => {
    const { host } = setup();
    const roots: FakeEl[] = [];
    for (let i = 0; i < 1000; i++) {
      const root = mk();
      mountSwitch(host, asEl(root), { label: `s${i}`, onCheckedChange: () => undefined }).destroy();
      roots.push(root);
    }
    for (const r of roots) {
      expect(r.children.length).toBe(0);
      expect(r.all().reduce((n, e) => n + e.liveListeners, 0)).toBe(0);
    }
    host.destroy();
  });
});

describe('define()', () => {
  function fakeRegistry() {
    const map = new Map<string, CustomElementConstructor>();
    const reg = {
      get: (n: string) => map.get(n),
      define: vi.fn((n: string, c: CustomElementConstructor) => void map.set(n, c)),
    };
    return { reg, map };
  }

  it('is never run at import and is idempotent', () => {
    vi.stubGlobal('HTMLElement', class {});
    const { host } = setup();
    const { reg } = fakeRegistry();
    // importing the module above registered nothing and touched no global registry
    expect(reg.define).not.toHaveBeenCalled();
    define(host, 'sj-switch', reg);
    define(host, 'sj-switch', reg);
    expect(reg.define).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('element mounts on connect, updates on attributes, destroys on disconnect (light DOM, no shadow)', () => {
    const { host } = setup();
    const doc = new FakeDoc();
    vi.stubGlobal(
      'HTMLElement',
      class extends FakeEl {
        constructor() {
          super('sj-switch', doc);
          // a real HTMLElement has no own `checked` field: let the element's accessor show through
          delete (this as { checked?: boolean }).checked;
        }
      },
    );
    const { reg, map } = fakeRegistry();
    define(host, 'sj-switch', reg);
    const el = new (map.get('sj-switch')!)() as unknown as FakeEl & {
      connectedCallback(): void;
      disconnectedCallback(): void;
      attributeChangedCallback(): void;
      attachShadow?: unknown;
      checked: boolean;
    };
    el.setAttribute('name', 'wifi');
    el.setAttribute('checked', '');
    el.connectedCallback();
    const input = el.querySelector('input')!;
    expect(input.checked).toBe(true);
    expect(el.checked).toBe(true);
    expect(formEntry(input)).toEqual(['wifi', 'on']);
    el.setAttribute('disabled', '');
    el.attributeChangedCallback();
    expect(input.disabled).toBe(true);
    expect(el.attachShadow).toBeUndefined();
    el.disconnectedCallback();
    expect(input.liveListeners).toBe(0);
    expect(el.children).toEqual([]);
    vi.unstubAllGlobals();
  });
});
