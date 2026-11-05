// SJForm vanilla adapter (W1-C02.e, ADR-014). `mountForm` makes a native <form> the root part and owns the
// SJForm context (Enter position from field order, retained values for WCAG 3.3.7). It adds no validation
// and no submission handling: the form is a plain <form> (no handlers, no `novalidate`).
//
// FACE is not used (ADR-014 "only where a custom control needs native form participation"): the real
// <input>/<textarea> lives in the light DOM, so the form's own element collects it natively.
// `define()` registers the optional `sj-form` element; nothing runs at import.
import { createForm, type FormOwner, type FormProps } from '@ramoslabs/core/form';
import type { SJFormOptions } from '../generated/form/index';
import type { Bag, Instance, VanillaHost } from '../runtime/index';
import { applyProps, createListeners, type Applied } from './apply';

export type { SJFormOptions };
type Plain<T> = { [K in keyof T]: T[K] };
export type FormOptions = Plain<Omit<SJFormOptions, 'default'>>;

export interface FormInstance extends Instance<FormOptions> {
  /** The owner context SJField mounts into (`mountField(host, el, props, { form })`). */
  readonly owner: FormOwner;
  /** The form element; `undefined` after destroy. */
  readonly element: Element | undefined;
  /** Calls `fn` when the owner store or the form props change (Enter position, retained values). */
  subscribe(fn: () => void): () => void;
}

/** Mount an SJForm onto `el` (use a `<form>`; the element becomes the root part). */
export function mountForm(host: VanillaHost, el: Element, props: FormOptions = {}): FormInstance {
  let latest = props;
  const owner = createForm(() => latest as FormProps);
  const listeners = createListeners();
  const seen: Applied = new Set();
  let unsub: (() => void) | undefined;
  const instance = host.mount(
    el,
    {
      initial: () => ({ state: 'idle' as const }),
      reduce: (s: { state: 'idle' }) => ({ state: s }),
      patch: () => applyProps(el, owner.getRootProps(), seen),
      attach(ctx) {
        // Bridges the owner store to adapters; the runtime hands the subscription back on destroy.
        unsub = owner.store.subscribe(listeners.notify);
        ctx.onCleanup(() => {
          unsub?.();
          unsub = undefined;
          owner.store.destroy();
        });
      },
    },
    props as Bag,
  );
  const update = instance.update.bind(instance);
  instance.update = (next) => {
    latest = next;
    update(next);
    listeners.notify();
  };
  return Object.defineProperties(instance, {
    owner: { value: owner },
    subscribe: { value: listeners.add },
    element: { get: () => (instance.destroyed ? undefined : el) },
  }) as FormInstance;
}

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

const ATTRS = ['action', 'submits', 'auto-submit'] as const;

function optionsFromAttributes(el: Element): FormOptions {
  const action = el.getAttribute('action');
  return {
    ...((action === 'go' || action === 'send' || action === 'search') && { action }),
    ...(el.getAttribute('submits') === 'false' && { submits: false }),
    ...(el.hasAttribute('auto-submit') && { autoSubmit: true }),
  };
}

/**
 * Register `<sj-form>` (light DOM, no shadow root, no FACE): its children move into one native `<form>`.
 * Explicit and idempotent. Define `sj-form` before `sj-field` and `sj-input` so descendants find it.
 */
export function define(
  host: VanillaHost,
  name = 'sj-form',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJFormElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #form: Element | undefined;
    #instance: FormInstance | undefined;
    /** The mounted form context, for descendant `sj-field` elements. */
    get form(): FormInstance | undefined {
      return this.#instance;
    }
    connectedCallback(): void {
      if (this.#instance) return;
      const form = this.ownerDocument.createElement('form');
      this.#form = form;
      form.append(...Array.from(this.childNodes));
      this.append(form);
      this.#instance = mountForm(host, form, optionsFromAttributes(this));
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#form?.remove();
      this.#instance = this.#form = undefined;
    }
    attributeChangedCallback(): void {
      this.#instance?.update(optionsFromAttributes(this));
    }
  }
  registry.define(name, SJFormElement);
}
