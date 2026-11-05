// SJInput vanilla adapter (W1-C02.e, ADR-002 light DOM + text nodes only, ADR-007, ADR-014).
// `mountInput` builds root <span> > a native <input> (or <textarea> for the `address` kind) and writes the ADR-007
// attributes resolved by the core getters. Inside an SJField (`{ field }`) the field supplies id, name, required,
// disabled, `aria-describedby` and `aria-invalid` and the Enter position; the input reports its kind to the field.
//
// FACE is deliberately NOT used (ADR-014 "only where a custom control needs native form participation"): the
// control IS a native input in the light DOM, so it submits, validates, autofills and resets like a bare one.
// `:user-invalid` uses the native pseudo-class where `runtime.supports.userInvalid`; otherwise the touched
// fallback sets `data-touched` (a user `change` or an `invalid` event; the owning form's `reset` clears it).
import { createInput, type InputParts, type InputProps } from '@ramoslabs/core/input';
import type { FieldInstance } from '../field/index';
import { applyProps, type Applied } from '../form/apply';
import type { SJInputOptions } from '../generated/input/index';
import type { Bag, Instance, InstanceContext, VanillaHost } from '../runtime/index';

type Plain<T> = { [K in keyof T]: T[K] };
export type InputOptions = Plain<SJInputOptions>;
type Control = HTMLInputElement | HTMLTextAreaElement;

export interface InputInstance extends Instance<InputOptions> {
  /** The native control; `undefined` after destroy. It is replaced when `kind` switches between input and textarea. */
  readonly control: Control | undefined;
}

export interface InputMountOptions {
  /** The enclosing SJField instance (its parts supply ids, ARIA and the Enter position). */
  readonly field?: FieldInstance;
}

/** Mount an SJInput onto `el` (use a `<span>`; the element becomes the root part). */
export function mountInput(
  host: VanillaHost,
  el: Element,
  props: InputOptions = {},
  options: InputMountOptions = {},
): InputInstance {
  const doc = el.ownerDocument;
  const { field } = options;
  let parts: InputParts | undefined;
  let control: Control | undefined;
  let ctl: AbortController | undefined;
  let reported: { kind: InputOptions['kind'] } | undefined;
  const seen = { root: new Set<string>() as Applied, control: new Set<string>() as Applied };

  type Ctx = InstanceContext<{ state: 'idle' }, never, Bag>;

  const bind = (c: Control) => {
    ctl = new AbortController();
    const { signal } = ctl;
    // Activation and typing are native; these only report a committed change / failed submission.
    c.addEventListener(
      'change',
      (e) => (parts!.getControlProps().onChange as (e: Event) => void)(e),
      { signal },
    );
    c.addEventListener(
      'invalid',
      (e) => (parts!.getControlProps().onInvalid as (e: Event) => void)(e),
      { signal },
    );
  };

  function render(ctx: Ctx): void {
    if (!parts) {
      parts = createInput(() => ctx.props() as InputProps, {
        ...(field && { field: field.parts }),
        userInvalid: host.runtime.supports.userInvalid,
      });
      ctx.onCleanup(() => {
        ctl?.abort();
        control?.remove();
        control = ctl = parts = undefined;
      });
    }
    const tag = parts.tag();
    if (!control || control.tagName.toLowerCase() !== tag) {
      const next = doc.createElement(tag) as Control;
      if (control) {
        next.value = control.value;
        ctl?.abort();
        control.remove();
        seen.control.clear();
      }
      control = next;
      el.append(next);
      bind(next);
    }
    applyProps(el, parts.getRootProps(), seen.root);
    applyProps(control, parts.getControlProps(), seen.control);
    // `kind` may change after mount: report it to the field again (re-registers for the Enter order).
    const kind = (ctx.props() as InputOptions).kind;
    const changed = reported !== undefined && kind !== reported.kind;
    reported = { kind }; // before connect(): its notifications re-enter this render
    if (changed) parts.connect();
  }

  const instance = host.mount(
    el,
    {
      initial: () => ({ state: 'idle' as const }),
      reduce: (s: { state: 'idle' }) => ({ state: s }),
      patch: (_view, ctx: Ctx) => render(ctx),
      attach(ctx) {
        const rerender = () => void (!ctx.signal.aborted && parts && render(ctx));
        // Report the kind first: the notifications this causes must not reach this half-mounted instance.
        const offKind = parts!.connect();
        reported ??= { kind: (ctx.props() as InputOptions).kind };
        // The field's Enter position and the touched fallback change what the control must show.
        const offStore = parts!.store.subscribe(rerender);
        const offField = field?.subscribe(rerender);
        rerender(); // the registration above may have moved the Enter position
        // `reset` bubbles to the document and runs its default action after dispatch; the touched state clears.
        ctx.listen(doc, 'reset', (e) => {
          if (control && e.target === (control as HTMLInputElement).form) parts!.reset();
        });
        ctx.onCleanup(() => {
          offStore();
          offField?.();
          offKind();
        });
      },
    },
    props as Bag,
  );

  return Object.defineProperties(instance, {
    control: { get: () => (instance.destroyed ? undefined : control) },
  }) as InputInstance;
}

const ATTRS = [
  'kind',
  'variant',
  'autocomplete',
  'section',
  'meaningful',
  'digits',
  'uppercase',
  'auto-submit',
  'id',
  'name',
  'required',
  'disabled',
] as const;

function optionsFromAttributes(el: Element): InputOptions {
  const get = (n: string) => el.getAttribute(n) ?? undefined;
  const kind = get('kind') as InputOptions['kind'];
  const id = get('id');
  const name = get('name');
  const autocomplete = get('autocomplete');
  const section = get('section');
  const digits = get('digits');
  return {
    ...(kind !== undefined && { kind }),
    ...(el.getAttribute('variant') === 'text' && { variant: 'text' as const }),
    ...(autocomplete !== undefined && { autocomplete }),
    ...(section !== undefined && { section }),
    ...(digits !== undefined && { digits: digits !== 'false' }),
    meaningful: el.hasAttribute('meaningful'),
    uppercase: el.hasAttribute('uppercase'),
    autoSubmit: el.hasAttribute('auto-submit'),
    ...(id !== undefined && { id }),
    ...(name !== undefined && { name }),
    required: el.hasAttribute('required'),
    disabled: el.hasAttribute('disabled'),
  };
}

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-input>` (light DOM, no shadow root, no FACE). Explicit and idempotent. Inside an `<sj-field>` it
 * uses that field's context; define `sj-field` first so the ancestor is upgraded before the input connects.
 */
export function define(
  host: VanillaHost,
  name = 'sj-input',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJInputElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #root: HTMLElement | undefined;
    #instance: InputInstance | undefined;
    connectedCallback(): void {
      if (this.#instance) return;
      const root = this.ownerDocument.createElement('span');
      this.#root = root;
      this.append(root);
      const field = (this.closest('sj-field') as { field?: FieldInstance } | null)?.field;
      this.#instance = mountInput(host, root, optionsFromAttributes(this), {
        ...(field && { field }),
      });
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#root?.remove();
      this.#instance = this.#root = undefined;
    }
    attributeChangedCallback(): void {
      this.#instance?.update(optionsFromAttributes(this));
    }
    /** The native control, for reading `value`. */
    get control(): Control | undefined {
      return this.#instance?.control;
    }
  }
  registry.define(name, SJInputElement);
}
