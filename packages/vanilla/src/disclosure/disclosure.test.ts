import { createRuntime, type SupportsMap } from '@ramoslabs/core/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHost } from '../runtime/index';
import { define, mountDisclosure } from './index';

/** Minimal DOM double (no jsdom in the repo). innerHTML-style sinks throw: text nodes only (ADR-002). */
class FakeEl extends EventTarget {
  parent: FakeEl | undefined;
  children: FakeEl[] = [];
  attrs = new Map<string, string>();
  text = '';
  #open = false;
  readonly signals: (AbortSignal | undefined)[] = [];
  readonly clicks: Event[] = [];
  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDoc,
  ) {
    super();
    if (tagName === 'details') ownerDocument.details.push(this);
  }
  /** Like the browser: any change of `open` (user or script) fires an async `toggle` afterwards. */
  get open(): boolean {
    return this.#open;
  }
  set open(v: boolean) {
    if (v === this.#open) return;
    this.#open = v;
    queueMicrotask(() => this.dispatchEvent(new Event('toggle')));
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
  get childNodes(): FakeEl[] {
    return this.children;
  }
  append(...kids: FakeEl[]): void {
    for (const k of kids) {
      k.remove();
      k.parent = this;
      this.children.push(k);
    }
  }
  prepend(...kids: FakeEl[]): void {
    for (const k of kids) {
      k.remove();
      k.parent = this;
    }
    this.children.unshift(...kids);
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = undefined;
  }
  getRootNode(): FakeDoc {
    return this.ownerDocument;
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
    for (const c of this.children) c.parent = undefined;
    this.children = [];
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
  find(tag: string): FakeEl | null {
    return this.all().find((e) => e !== this && e.tagName === tag) ?? null;
  }
}
class FakeDoc extends EventTarget {
  readonly details: FakeEl[] = [];
  createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
  }
  /** Only `details[name]` is asked for. */
  querySelectorAll(sel: string): FakeEl[] {
    expect(sel).toBe('details[name]');
    return this.details.filter((d) => d.hasAttribute('name'));
  }
}

const asEl = (e: FakeEl) => e as unknown as Element;
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function setup(supports: Partial<SupportsMap> = {}) {
  let n = 0;
  const runtime = createRuntime({ target: 'client', idFactory: () => `d${n++}`, supports });
  const host = createHost(runtime, {
    liveHost: { create: () => ({ setText: () => undefined }) },
  });
  return { host, doc: new FakeDoc() };
}

/** The user clicks the summary: the default action toggles `open` unless the click was prevented. */
function userClick(root: FakeEl): boolean {
  const summary = root.find('summary')!;
  const e = new Event('click', { cancelable: true });
  summary.dispatchEvent(e);
  if (!e.defaultPrevented) root.open = !root.open;
  return !e.defaultPrevented;
}

/** Server-rendered markup: a `<details>` that already has its `<summary>` and panel. */
function slotted(doc: FakeDoc): FakeEl {
  const root = doc.createElement('details');
  root.append(doc.createElement('summary'), doc.createElement('div'));
  return root;
}

afterEach(() => vi.restoreAllMocks());

describe('SJDisclosure vanilla', () => {
  it('builds details > summary + panel with text nodes only and no aria-expanded', () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    mountDisclosure(host, asEl(root), { summary: '<b>Title</b>', content: '<i>Body</i>' });
    const summary = root.find('summary')!;
    const panel = root.find('div')!;
    expect(root.children.map((c) => c.tagName)).toEqual(['summary', 'div']);
    expect(summary.textContent).toBe('<b>Title</b>'); // literal text, never parsed
    expect(panel.textContent).toBe('<i>Body</i>');
    expect(root.all().some((e) => e !== root && e.children.length)).toBe(false);
    expect(root.getAttribute('data-part')).toBe('root');
    expect(summary.getAttribute('data-part')).toBe('trigger');
    expect(panel.getAttribute('data-part')).toBe('content');
    expect(root.getAttribute('id')).toBe('d0');
    expect(summary.getAttribute('id')).toBe('d0-trigger');
    expect(panel.getAttribute('id')).toBe('d0-panel');
    expect(root.getAttribute('data-state')).toBe('closed');
    expect(root.open).toBe(false);
    for (const e of root.all()) {
      expect(e.hasAttribute('aria-expanded')).toBe(false);
      expect(e.hasAttribute('aria-controls')).toBe(false);
      expect(e.hasAttribute('role')).toBe(false);
    }
  });

  it('adopts a slotted summary and panel (SSR markup) and leaves their content alone', () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const summary = doc.createElement('summary');
    const panel = doc.createElement('div');
    const child = doc.createElement('p');
    panel.append(child);
    summary.textContent = 'Slotted';
    root.append(summary, panel);
    const inst = mountDisclosure(host, asEl(root), {});
    expect(root.children).toEqual([summary, panel]);
    expect(summary.textContent).toBe('Slotted');
    expect(panel.children).toEqual([child]);
    expect(summary.getAttribute('data-part')).toBe('trigger');
    expect(inst.trigger).toBe(summary as unknown as Element);
    expect(inst.content).toBe(panel as unknown as Element);
    inst.destroy();
    expect(root.children).toEqual([summary, panel]); // adopted nodes are the consumer's
    expect(inst.trigger).toBeUndefined();
  });

  it('prop-or-slot: summary / content props replace the slot text on update', () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const inst = mountDisclosure(host, asEl(root), { summary: 'A' });
    inst.update({ summary: 'B', content: 'C' });
    expect(root.find('summary')!.textContent).toBe('B');
    expect(root.find('div')!.textContent).toBe('C');
  });

  it('classes append after the library class on each part', () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    mountDisclosure(host, asEl(root), { classes: { root: 'r', trigger: 't', content: 'c' } });
    expect(root.getAttribute('class')).toBe('sj-disclosure__root r');
    expect(root.find('summary')!.getAttribute('class')).toBe('sj-disclosure__trigger t');
    expect(root.find('div')!.getAttribute('class')).toBe('sj-disclosure__content c');
  });

  it('uncontrolled: follows the native toggle; defaultOpen seeds it', async () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const onOpenChange = vi.fn();
    mountDisclosure(host, asEl(root), { defaultOpen: true, onOpenChange });
    expect(root.open).toBe(true);
    expect(root.getAttribute('data-state')).toBe('open');
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled(); // the adapter's own write is not a user change
    userClick(root);
    await tick();
    expect(root.getAttribute('data-state')).toBe('closed');
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    userClick(root);
    await tick();
    expect(root.getAttribute('data-state')).toBe('open');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it('controlled: reports, stays on the prop, corrects a rejected open and follows the owner', async () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const onOpenChange = vi.fn();
    const inst = mountDisclosure(host, asEl(root), { open: false, onOpenChange });
    userClick(root);
    await tick();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(root.getAttribute('data-state')).toBe('closed');
    expect(root.open).toBe(false); // put back
    inst.update({ open: true, onOpenChange });
    expect(root.open).toBe(true);
    expect(root.getAttribute('data-state')).toBe('open');
    await tick();
    expect(onOpenChange).toHaveBeenCalledOnce(); // no feedback loop
  });

  it('disabled: aria-disabled + data-disabled, the click is prevented, focusable (no tabindex change)', async () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const onOpenChange = vi.fn();
    const inst = mountDisclosure(host, asEl(root), { disabled: true, onOpenChange });
    const summary = root.find('summary')!;
    expect(summary.getAttribute('aria-disabled')).toBe('true');
    expect(root.getAttribute('data-disabled')).toBe('true');
    expect(summary.hasAttribute('tabindex')).toBe(false);
    expect(userClick(root)).toBe(false);
    await tick();
    expect(root.open).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    inst.update({ onOpenChange });
    expect(summary.hasAttribute('aria-disabled')).toBe(false);
    expect(root.hasAttribute('data-disabled')).toBe(false);
    expect(userClick(root)).toBe(true);
  });

  it('name is emitted on the root', () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const inst = mountDisclosure(host, asEl(root), { name: 'g' });
    expect(root.getAttribute('name')).toBe('g');
    inst.update({});
    expect(root.hasAttribute('name')).toBe(false);
  });

  it('pre-hydration: a toggle made before the script is reported, not overwritten', async () => {
    const { host, doc } = setup();
    const root = slotted(doc);
    root.open = true; // user opened the SSR-closed element before hydration
    const onOpenChange = vi.fn();
    mountDisclosure(host, asEl(root), { onOpenChange });
    await tick();
    expect(root.open).toBe(true);
    expect(root.getAttribute('data-state')).toBe('open');
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('pre-hydration, controlled owner rejects: the element is put back', async () => {
    const { host, doc } = setup();
    const root = slotted(doc);
    root.open = true;
    const onOpenChange = vi.fn();
    mountDisclosure(host, asEl(root), { open: false, onOpenChange });
    await tick();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(root.open).toBe(false);
    expect(root.getAttribute('data-state')).toBe('closed');
  });

  it('pre-hydration: an element that agrees with the view reports nothing', async () => {
    const { host, doc } = setup();
    const root = slotted(doc);
    root.open = true;
    const onOpenChange = vi.fn();
    mountDisclosure(host, asEl(root), { defaultOpen: true, onOpenChange });
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('every listener carries the instance signal; no pointer or touch listener; none left after destroy', () => {
    const { host, doc } = setup();
    const root = doc.createElement('details');
    const inst = mountDisclosure(host, asEl(root), {});
    const all = root.all();
    expect(all.reduce((n, e) => n + e.signals.length, 0)).toBe(2); // toggle + click
    expect(all.reduce((n, e) => n + e.unsignalled, 0)).toBe(0);
    const summary = root.find('summary')!;
    inst.destroy();
    expect(all.reduce((n, e) => n + e.liveListeners, 0)).toBe(0);
    expect(root.children).toEqual([]); // created parts removed
    expect(summary.liveListeners).toBe(0);
    inst.destroy(); // idempotent
    expect(inst.destroyed).toBe(true);
  });

  it('1,000 mount/destroy cycles retain nothing', () => {
    const { host, doc } = setup();
    const roots: FakeEl[] = [];
    for (let i = 0; i < 1000; i++) {
      const root = doc.createElement('details');
      mountDisclosure(host, asEl(root), {
        summary: `s${i}`,
        onOpenChange: () => undefined,
      }).destroy();
      roots.push(root);
    }
    for (const r of roots) {
      expect(r.children.length).toBe(0);
      expect(r.signals.filter((s) => s && !s.aborted).length).toBe(0);
    }
    host.destroy();
  });
});

describe('exclusive group fallback (supports.detailsName forced false)', () => {
  function group(supports: Partial<SupportsMap>, names: (string | undefined)[], props = {}) {
    const { host, doc } = setup(supports);
    const spies = names.map(() => vi.fn());
    const roots = names.map((name, i) => {
      const r = doc.createElement('details');
      mountDisclosure(host, asEl(r), {
        ...(name !== undefined && { name }),
        onOpenChange: spies[i]!,
        ...props,
      });
      return r;
    });
    return { roots, spies, doc };
  }

  it('opening a member closes the other open members of the same name', async () => {
    const { roots, spies } = group({ detailsName: false }, ['g', 'g', 'g', 'other']);
    const [a, b, c, d] = roots as [FakeEl, FakeEl, FakeEl, FakeEl];
    userClick(a);
    userClick(d);
    await tick();
    expect(a.open && d.open).toBe(true);
    userClick(b);
    await tick();
    expect(b.open).toBe(true);
    expect(a.open).toBe(false);
    expect(c.open).toBe(false);
    expect(d.open).toBe(true); // a different name is left alone
    expect(a.getAttribute('data-state')).toBe('closed');
    expect(spies[0]).toHaveBeenLastCalledWith(false); // the closed peer reports, as native does
    userClick(c);
    await tick();
    expect(roots.filter((r) => r.getAttribute('name') === 'g' && r.open)).toEqual([c]);
  });

  it('a controlled member that is opened programmatically still closes its peers', async () => {
    const { host, doc } = setup({ detailsName: false });
    const a = doc.createElement('details');
    const b = doc.createElement('details');
    mountDisclosure(host, asEl(a), { name: 'g', defaultOpen: true });
    const onOpenChange = vi.fn();
    mountDisclosure(host, asEl(b), { name: 'g', open: false, onOpenChange });
    await tick();
    expect(a.open).toBe(true);
    b.open = true; // script opens a controlled member; the owner will reject it
    await tick();
    expect(a.open).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(b.open).toBe(false); // rejected and corrected, the peer stays closed
  });

  it('a controlled owner that accepts the open closes the peers', async () => {
    const { host, doc } = setup({ detailsName: false });
    const a = doc.createElement('details');
    const b = doc.createElement('details');
    mountDisclosure(host, asEl(a), { name: 'g', defaultOpen: true });
    const inst = mountDisclosure(host, asEl(b), {
      name: 'g',
      open: false,
      onOpenChange: () => undefined,
    });
    inst.update({ name: 'g', open: true, onOpenChange: () => undefined });
    expect(b.open).toBe(true);
    await tick();
    expect(a.open).toBe(false);
  });

  it('native engines (detailsName true) and unnamed members: the adapter closes nothing', async () => {
    for (const [supports, names] of [
      [{ detailsName: true }, ['g', 'g']],
      [{ detailsName: false }, [undefined, undefined]],
    ] as const) {
      const { roots } = group(supports, [...names]);
      userClick(roots[0]!);
      await tick();
      userClick(roots[1]!);
      await tick();
      expect(roots.map((r) => r.open)).toEqual([true, true]);
    }
  });

  it('pre-hydration: a member opened before the script closes its open peer on a fallback engine', async () => {
    const { host, doc } = setup({ detailsName: false });
    const a = doc.createElement('details');
    const b = slotted(doc);
    mountDisclosure(host, asEl(a), { name: 'g', defaultOpen: true });
    b.open = true;
    mountDisclosure(host, asEl(b), { name: 'g' });
    await tick();
    expect(b.open).toBe(true);
    expect(a.open).toBe(false);
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
    expect(reg.define).not.toHaveBeenCalled();
    define(host, 'sj-disclosure', reg);
    define(host, 'sj-disclosure', reg);
    expect(reg.define).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('mounts on connect (children become the panel), updates, and gives the children back on disconnect', async () => {
    const { host, doc } = setup();
    vi.stubGlobal(
      'HTMLElement',
      class extends FakeEl {
        constructor() {
          super('sj-disclosure', doc);
        }
      },
    );
    const { reg, map } = fakeRegistry();
    define(host, 'sj-disclosure', reg);
    const el = new (map.get('sj-disclosure')!)() as unknown as FakeEl & {
      connectedCallback(): void;
      disconnectedCallback(): void;
      attributeChangedCallback(): void;
      attachShadow?: unknown;
      open: boolean;
    };
    const kid = doc.createElement('p');
    el.append(kid);
    el.setAttribute('summary', 'Title');
    el.setAttribute('open', '');
    el.connectedCallback();
    const details = el.find('details')!;
    expect(details.open).toBe(true);
    expect(el.open).toBe(true);
    expect(details.find('summary')!.textContent).toBe('Title');
    expect(details.find('div')!.children).toEqual([kid]);
    el.setAttribute('summary', 'Next');
    el.attributeChangedCallback();
    expect(details.find('summary')!.textContent).toBe('Next');
    el.setAttribute('disabled', '');
    el.attributeChangedCallback();
    expect(details.find('summary')!.getAttribute('aria-disabled')).toBe('true');
    expect(el.attachShadow).toBeUndefined();
    el.disconnectedCallback();
    expect(el.children).toEqual([kid]);
    expect(details.all().reduce((n, e) => n + e.liveListeners, 0)).toBe(0);
    vi.unstubAllGlobals();
  });
});
