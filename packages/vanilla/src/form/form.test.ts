import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KINDS, enterKeyHints } from '@ramoslabs/core/kinds';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '../runtime/index';
import { define as defineField, mountField } from '../field/index';
import { define as defineInput, mountInput, type InputOptions } from '../input/index';
import { define as defineForm, mountForm } from './index';

/** Minimal DOM double (no jsdom in the repo). innerHTML-style sinks throw: text nodes only (ADR-002). */
class FakeNode extends EventTarget {
  parentNode: FakeEl | undefined;
  constructor(readonly nodeType: number) {
    super();
  }
  remove(): void {
    if (this.parentNode) this.parentNode.kids = this.parentNode.kids.filter((c) => c !== this);
    this.parentNode = undefined;
  }
}
class FakeText extends FakeNode {
  constructor(public data: string) {
    super(3);
  }
  get textContent(): string {
    return this.data;
  }
}
class FakeEl extends FakeNode {
  kids: FakeNode[] = [];
  attrs = new Map<string, string>();
  value = '';
  disabled = false;
  form: FakeEl | null = null;
  readonly signals: (AbortSignal | undefined)[] = [];
  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDoc,
  ) {
    super(1);
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
  get children(): FakeEl[] {
    return this.kids.filter((k): k is FakeEl => k instanceof FakeEl);
  }
  get firstChild(): FakeNode | undefined {
    return this.kids[0];
  }
  hasChildNodes(): boolean {
    return this.kids.length > 0;
  }
  private adopt(k: FakeNode | string): FakeNode {
    const n = typeof k === 'string' ? new FakeText(k) : k;
    n.remove();
    n.parentNode = this;
    return n;
  }
  append(...ks: (FakeNode | string)[]): void {
    for (const k of ks) this.kids.push(this.adopt(k));
  }
  appendChild(k: FakeNode): FakeNode {
    this.append(k);
    return k;
  }
  insertBefore(k: FakeNode, ref: FakeNode | null): void {
    const n = this.adopt(k);
    const at = ref ? this.kids.indexOf(ref) : -1;
    if (at < 0) this.kids.push(n);
    else this.kids.splice(at, 0, n);
  }
  after(k: FakeNode): void {
    const p = this.parentNode!;
    const n = p.adopt(k);
    p.kids.splice(p.kids.indexOf(this) + 1, 0, n);
  }
  replaceChildren(...ks: FakeNode[]): void {
    for (const c of this.kids) c.parentNode = undefined;
    this.kids = [];
    this.append(...ks);
  }
  removeChild(k: FakeNode): void {
    k.remove();
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
    return this.kids.map((c) => (c as FakeEl | FakeText).textContent).join('');
  }
  set textContent(v: string) {
    this.replaceChildren(new FakeText(v));
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
  q(sel: string): FakeEl | null {
    return this.all().find((e) => e !== this && e.attrs.get('data-part') === sel) ?? null;
  }
  tag(t: string): FakeEl | null {
    return this.all().find((e) => e !== this && e.tagName === t) ?? null;
  }
}
class FakeDoc extends EventTarget {
  readonly signals: (AbortSignal | undefined)[] = [];
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
  createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
  }
  createElementNS(_ns: string, tag: string): FakeEl {
    return new FakeEl(tag, this);
  }
  createTextNode(t: string): FakeText {
    return new FakeText(t);
  }
}

const up = (n: FakeEl | undefined, sel: string): FakeEl | null =>
  !n ? null : n.tagName === sel ? n : up(n.parentNode, sel);
let doc = new FakeDoc();
beforeEach(() => void (doc = new FakeDoc()));
const mk = (tag = 'div') => doc.createElement(tag);
const el = (e: FakeEl) => e as unknown as Element;
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function setup(userInvalid = false) {
  let n = 0;
  const spoken: string[] = [];
  const runtime = createRuntime({
    target: 'client',
    idFactory: () => `f${n++}`,
    supports: { userInvalid },
  });
  const host = createHost(runtime, {
    liveHost: { create: () => ({ setText: (t: string) => void (t && spoken.push(t)) }) },
  });
  return { host, spoken };
}

const typed = (c: FakeEl, v: string) => {
  c.value = v;
  c.dispatchEvent(new Event('change'));
};

/** form > field(name, kind) > input; returns the pieces. */
function mountRow(
  host: ReturnType<typeof setup>['host'],
  form: ReturnType<typeof mountForm> | undefined,
  name: string,
  kind: NonNullable<InputOptions['kind']>,
  extra: Record<string, unknown> = {},
) {
  const root = mk();
  const field = mountField(
    host,
    el(root),
    { name, label: name, ...extra },
    { ...(form && { form }) },
  );
  const slot = mk('span');
  field.place(slot as unknown as Node);
  const input = mountInput(host, el(slot), { kind }, { field });
  return {
    root,
    field,
    slot,
    input,
    control: root.tag(kind === 'address' ? 'textarea' : 'input')!,
  };
}

describe('SJForm vanilla', () => {
  it('is a plain native form root: part attributes only, no handlers, no novalidate', () => {
    const { host } = setup();
    const form = mk('form');
    const inst = mountForm(host, el(form), {});
    expect(form.getAttribute('class')).toBe('sj-form__root');
    expect(form.getAttribute('data-part')).toBe('root');
    expect(form.hasAttribute('novalidate')).toBe(false);
    expect(form.signals).toEqual([]); // no listener at all: submission stays native
    expect(inst.element).toBe(form);
    inst.destroy();
    expect(inst.element).toBeUndefined();
  });

  it('computes the Enter position from field order, textarea excluded, and follows later fields', () => {
    const { host } = setup();
    const form = mountForm(host, el(mk('form')), {});
    const a = mountRow(host, form, 'email', 'email');
    expect(a.control.getAttribute('enterkeyhint')).toBe('go'); // alone: last editable field
    const b = mountRow(host, form, 'bio', 'address');
    expect(b.control.tagName).toBe('textarea');
    expect(b.control.getAttribute('enterkeyhint')).toBe('enter');
    expect(a.control.getAttribute('enterkeyhint')).toBe('go'); // textarea kinds are excluded
    const c = mountRow(host, form, 'name', 'name');
    expect(enterKeyHints(['email', 'address', 'name'], { submits: true })).toEqual([
      'next',
      'enter',
      'go',
    ]);
    expect(a.control.getAttribute('enterkeyhint')).toBe('next');
    expect(c.control.getAttribute('enterkeyhint')).toBe('go');
    c.input.destroy();
    c.field.destroy();
    expect(a.control.getAttribute('enterkeyhint')).toBe('go');
  });

  it('submits:false gives the last field done, and a form update re-renders the controls', () => {
    const { host } = setup();
    const form = mountForm(host, el(mk('form')), { submits: false });
    const a = mountRow(host, form, 'email', 'email');
    expect(a.control.getAttribute('enterkeyhint')).toBe('done');
    form.update({ action: 'search' });
    expect(a.control.getAttribute('enterkeyhint')).toBe('search');
  });

  it('3.3.7: retains committed values, offers them elsewhere, never a secret', () => {
    const { host } = setup();
    const form = mountForm(host, el(mk('form')), {});
    const email = mountRow(host, form, 'email', 'email');
    const other = mountRow(host, form, 'confirm', 'email');
    const pw = mountRow(host, form, 'pw', 'password');
    typed(email.control, 'a@b.co');
    typed(pw.control, 'hunter2');
    expect(email.field.parts.prior()).toBe('a@b.co');
    expect(other.field.parts.offers()).toEqual(['a@b.co']);
    expect(pw.field.parts.prior()).toBeUndefined();
    // values survive an unmount (multi-step flows)
    email.input.destroy();
    email.field.destroy();
    expect(other.field.parts.offers()).toEqual(['a@b.co']);
  });

  it('a field outside any form has no Enter position of its own (kind default) and retains nothing', () => {
    const { host } = setup();
    const a = mountRow(host, undefined, 'email', 'email');
    typed(a.control, 'x');
    expect(a.field.parts.prior()).toBeUndefined();
    expect(a.field.parts.enterHint()).toBeUndefined();
  });
});

describe('SJField vanilla', () => {
  it('derives ids, aria-describedby and aria-invalid; the label points at the control', () => {
    const { host } = setup();
    const r = mountRow(host, undefined, 'email', 'email', {
      hint: 'We never share it',
      error: 'Enter an email',
    });
    const id = r.control.getAttribute('id')!;
    expect(id).toBe('f0');
    expect(r.root.tag('label')!.getAttribute('for')).toBe(id);
    expect(r.root.tag('label')!.getAttribute('id')).toBe(`${id}-label`);
    expect(r.root.q('hint')!.getAttribute('id')).toBe(`${id}-hint`);
    expect(r.root.q('error')!.getAttribute('id')).toBe(`${id}-error`);
    expect(r.control.getAttribute('aria-describedby')).toBe(`${id}-hint ${id}-error`);
    expect(r.control.getAttribute('aria-invalid')).toBe('true');
    expect(r.control.hasAttribute('aria-errormessage')).toBe(false);
    r.field.update({
      name: 'email',
      label: 'email',
      hint: 'We never share it',
      errorMessage: true,
      error: 'Enter an email',
    });
    expect(r.control.getAttribute('aria-errormessage')).toBe(`${id}-error`);
    r.field.update({ name: 'email', label: 'email' });
    expect(r.control.hasAttribute('aria-invalid')).toBe(false);
    expect(r.control.hasAttribute('aria-describedby')).toBe(false);
    expect(r.root.q('error')).toBeNull();
    expect(r.root.q('hint')).toBeNull();
  });

  it('orders label, hint, control, error and uses text nodes only', () => {
    const { host } = setup();
    const r = mountRow(host, undefined, 'n', 'text', {
      label: '<b>Name</b>',
      hint: '<i>h</i>',
      error: '<u>e</u>',
    });
    expect(r.root.children.map((c) => c.getAttribute('data-part'))).toEqual([
      'label',
      'hint',
      'root',
      'error',
    ]);
    expect(r.root.tag('label')!.textContent).toBe('<b>Name</b>');
    expect(r.root.q('hint')!.textContent).toBe('<i>h</i>');
    expect(r.root.q('error')!.textContent).toBe('<u>e</u>');
  });

  it('accepts a Node for the label and the hint (prop-or-slot)', () => {
    const { host } = setup();
    const root = mk();
    const label = mk('em');
    const hint = mk('strong');
    mountField(host, el(root), { label: label as unknown as Node, hint: hint as unknown as Node });
    expect(root.tag('label')!.children).toEqual([label]);
    expect(root.q('hint')!.children).toEqual([hint]);
  });

  it('error part: aria-hidden icon part plus visible text, no role or aria-live of its own', () => {
    const { host } = setup();
    const root = mk();
    mountField(host, el(root), {
      label: 'L',
      error: 'Bad',
      errorIcon: { name: 'alert-circle', nodes: [['circle', { cx: 12, cy: 12, r: 10 }]] },
    });
    const err = root.q('error')!;
    const icon = err.q('icon')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('class')).toBe('sj-field__icon');
    expect(
      icon.tag('svg')!.getAttribute('data-size') ?? icon.tag('svg')!.getAttribute('class'),
    ).toBeTruthy();
    expect(err.textContent).toBe('Bad');
    expect(err.hasAttribute('role')).toBe(false);
    expect(err.hasAttribute('aria-live')).toBe(false);
  });

  it('announces a changed error once, stays silent at mount and for the same text', async () => {
    const { host, spoken } = setup();
    const root = mk();
    const f = mountField(host, el(root), { label: 'L', error: 'Standing' });
    await tick();
    expect(spoken).toEqual([]); // a standing error at mount is silent
    f.update({ label: 'L', error: 'Standing' });
    f.update({ label: 'L', error: 'Standing' });
    await tick();
    expect(spoken).toEqual([]);
    f.update({ label: 'L', error: 'Changed' });
    f.update({ label: 'L', error: 'Changed' });
    await tick();
    expect(spoken).toEqual(['Changed']);
    f.update({ label: 'L', error: 'Other' });
    await tick();
    expect(spoken).toEqual(['Changed', 'Other']);
  });

  it('a name change re-registers under the new key', () => {
    const { host } = setup();
    const form = mountForm(host, el(mk('form')), {});
    const r = mountRow(host, form, 'a', 'email');
    typed(r.control, 'v');
    expect(r.field.parts.prior()).toBe('v');
    r.field.update({ name: 'b', label: 'b' });
    expect(form.owner.store.getSnapshot().fields.map((f) => f.key)).toEqual(['b']);
  });
});

describe('SJInput vanilla', () => {
  it('builds root > native input and writes the ADR-007 row', () => {
    const { host } = setup();
    const root = mk('span');
    const inst = mountInput(host, el(root), {
      kind: 'email',
      id: 'e',
      name: 'mail',
      required: true,
    });
    const c = root.tag('input')!;
    expect(root.getAttribute('data-part')).toBe('root');
    expect(root.getAttribute('data-kind')).toBe('email');
    expect(c.getAttribute('type')).toBe('email');
    expect(c.getAttribute('autocomplete')).toBe('email');
    expect(c.getAttribute('inputmode')).toBe('email');
    expect(c.getAttribute('id')).toBe('e');
    expect(c.getAttribute('name')).toBe('mail');
    expect(c.hasAttribute('required')).toBe(true);
    expect(inst.control).toBe(c);
  });

  it('every kind: never maxlength, type=number only for quantity, address is a textarea', () => {
    const { host } = setup();
    for (const kind of Object.keys(KINDS)) {
      const root = mk('span');
      const inst = mountInput(host, el(root), { kind: kind as never });
      const c = root.children[0]!;
      expect(c.hasAttribute('maxlength'), kind).toBe(false);
      if (c.getAttribute('type') === 'number') expect(kind).toBe('quantity');
      if (kind === 'address') expect(c.tagName).toBe('textarea');
      inst.destroy();
    }
  });

  it('switching to a textarea kind replaces the control, keeps the value and moves the listeners', () => {
    const { host } = setup();
    const root = mk('span');
    const inst = mountInput(host, el(root), { kind: 'text' });
    const first = inst.control as unknown as FakeEl;
    first.value = 'typed';
    inst.update({ kind: 'address' });
    const next = inst.control as unknown as FakeEl;
    expect(next.tagName).toBe('textarea');
    expect(next.value).toBe('typed');
    expect(next.hasAttribute('type')).toBe(false);
    expect(first.liveListeners).toBe(0);
    expect(next.liveListeners).toBe(2);
    expect(root.children).toEqual([next]);
  });

  it(':user-invalid fallback: touched on change or invalid, cleared by the form reset, inert when native', () => {
    for (const native of [false, true]) {
      const { host } = setup(native);
      const root = mk('span');
      const form = mk('form');
      mountInput(host, el(root), { kind: 'text' });
      const c = root.tag('input')!;
      c.form = form;
      c.dispatchEvent(new Event('blur'));
      expect(c.hasAttribute('data-touched')).toBe(false); // blur alone never touches
      typed(c, 'x');
      expect(c.getAttribute('data-touched')).toBe(native ? null : 'true');
      const reset = new Event('reset');
      Object.defineProperty(reset, 'target', { value: form });
      doc.dispatchEvent(reset);
      expect(c.hasAttribute('data-touched')).toBe(false);
      c.dispatchEvent(new Event('invalid'));
      expect(c.getAttribute('data-touched')).toBe(native ? null : 'true');
    }
  });

  it('inside a field the field wins for id, name, required and disabled', () => {
    const { host } = setup();
    const root = mk();
    const f = mountField(host, el(root), { name: 'fn', required: true, label: 'L' });
    const slot = mk('span');
    f.place(slot as unknown as Node);
    mountInput(
      host,
      el(slot),
      { kind: 'text', id: 'x', name: 'xn', required: false, disabled: true },
      { field: f },
    );
    const c = root.tag('input')!;
    expect(c.getAttribute('id')).toBe('f0');
    expect(c.getAttribute('name')).toBe('fn');
    expect(c.hasAttribute('required')).toBe(true);
    expect(c.hasAttribute('disabled')).toBe(false);
  });

  it('destroy aborts every listener and removes the control; later events do nothing', () => {
    const { host } = setup();
    const root = mk('span');
    const inst = mountInput(host, el(root), { kind: 'text' });
    const c = root.tag('input')!;
    expect(c.unsignalled).toBe(0);
    expect(c.liveListeners).toBe(2);
    inst.destroy();
    expect(c.liveListeners).toBe(0);
    expect(root.children).toEqual([]);
    expect(doc.liveListeners).toBe(0);
    expect(inst.control).toBeUndefined();
    typed(c, 'x'); // no throw
    inst.destroy();
  });

  it('1,000 mount/destroy cycles of form + field + input retain nothing', () => {
    const { host } = setup();
    const roots: FakeEl[] = [];
    const formEl = mk('form');
    const form = mountForm(host, el(formEl), {});
    for (let i = 0; i < 1000; i++) {
      const r = mountRow(host, form, `n${i}`, 'text', { error: 'e', hint: 'h' });
      r.input.destroy();
      r.field.destroy();
      roots.push(r.root);
    }
    expect(form.owner.store.getSnapshot().fields).toEqual([]);
    for (const r of roots) {
      expect(r.children).toEqual([]);
      expect(r.all().reduce((n, e) => n + e.liveListeners, 0)).toBe(0);
    }
    form.destroy();
    expect(formEl.signals.filter((s) => s && !s.aborted)).toEqual([]);
    expect(doc.liveListeners).toBe(0);
    host.destroy();
  });
});

describe('define()', () => {
  function fakeRegistry() {
    const map = new Map<string, CustomElementConstructor>();
    return {
      reg: {
        get: (n: string) => map.get(n),
        define: vi.fn((n: string, c: CustomElementConstructor) => void map.set(n, c)),
      },
      map,
    };
  }

  it('never registers at import, is explicit and idempotent', () => {
    vi.stubGlobal('HTMLElement', class {});
    const { host } = setup();
    const { reg } = fakeRegistry();
    expect(reg.define).not.toHaveBeenCalled();
    for (const [d, name] of [
      [defineForm, 'sj-form'],
      [defineField, 'sj-field'],
      [defineInput, 'sj-input'],
    ] as const) {
      d(host, name, reg);
      d(host, name, reg);
    }
    expect(reg.define.mock.calls.map((c) => c[0])).toEqual(['sj-form', 'sj-field', 'sj-input']);
    vi.unstubAllGlobals();
  });

  it('elements connect parent-first, share context, and destroy on disconnect (light DOM, no shadow)', () => {
    const { host } = setup();
    class Base extends FakeEl {
      constructor() {
        super('x', doc);
        delete (this as { form?: unknown }).form; // a real HTMLElement has no own `form`
      }
      closest(sel: string): FakeEl | null {
        return up(this, sel);
      }
      get childNodes(): FakeNode[] {
        return this.kids;
      }
    }
    vi.stubGlobal('HTMLElement', Base);
    const { reg, map } = fakeRegistry();
    defineForm(host, 'sj-form', reg);
    defineField(host, 'sj-field', reg);
    defineInput(host, 'sj-input', reg);
    type El = Base & { connectedCallback(): void; disconnectedCallback(): void; control?: FakeEl };
    const make = (n: string, tag: string) => {
      const e = new (map.get(n)!)() as unknown as El;
      (e as { tagName: string }).tagName = tag;
      return e;
    };
    const f = make('sj-form', 'sj-form');
    const fld = make('sj-field', 'sj-field');
    const inp = make('sj-input', 'sj-input');
    fld.setAttribute('name', 'mail');
    fld.setAttribute('label', 'Email');
    inp.setAttribute('kind', 'email');
    fld.append(inp);
    f.append(fld);
    f.connectedCallback(); // moves fld into the native <form>
    const form = f.tag('form')!;
    expect(form.children).toEqual([fld]);
    fld.connectedCallback();
    inp.connectedCallback();
    const control = inp.control!;
    expect(control.getAttribute('type')).toBe('email');
    expect(control.getAttribute('enterkeyhint')).toBe('go'); // saw the form context through the field
    expect(control.getAttribute('name')).toBe('mail');
    expect(f.attrs.has('attachShadow')).toBe(false);
    inp.disconnectedCallback();
    fld.disconnectedCallback();
    f.disconnectedCallback();
    expect((control as unknown as FakeEl).liveListeners).toBe(0);
    vi.unstubAllGlobals();
  });
});
