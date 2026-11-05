// SJField vanilla adapter (W1-C02.e, ADR-002 light DOM + text nodes only, ADR-014).
// `mountField` builds root <div> > label, optional hint, the control (SJInput, placed by the consumer) and, while
// an error shows, an error part holding an aria-hidden SJIcon and the visible text. The core getters derive the ids
// (`-label/-hint/-error`), `aria-describedby` and `aria-invalid`; the control reads them through `field.parts`.
// The error is announced once through the host live registry after each commit (ADR-006), never at mount.
//
// FACE is not used (ADR-014): the control is a real <input>/<textarea> in the light DOM and submits natively.
// `define()` registers the optional `sj-field` element; nothing runs at import.
import { createField, type FieldParts } from '@ramoslabs/core/field';
import type { IconData } from '@ramoslabs/core/icon';
import type { FormInstance } from '../form/index';
import { applyProps, createListeners, type Applied } from '../form/apply';
import { fieldLive, type SJFieldOptions } from '../generated/field/index';
import { mountIcon, type IconInstance } from '../icon/index';
import { setText, type Bag, type Instance, type VanillaHost } from '../runtime/index';

type Plain<T> = { [K in keyof T]: T[K] };
/** Vanilla options: the contract props and slots, plus the error icon data (ADR-016: the consumer passes it). */
export type FieldOptions = Plain<Omit<SJFieldOptions, 'default'>> & {
  /** `alert-circle` icon data for the error part (size sm, aria-hidden). Absent: the error is text only. */
  readonly errorIcon?: IconData;
};

export interface FieldInstance extends Instance<FieldOptions> {
  /** The core field parts: SJInput passes them as its `field` context. */
  readonly parts: FieldParts;
  /** Insert the control (an SJInput root) after the label and hint, before the error. */
  place(node: Node): void;
  /** Calls `fn` when the form's Enter position or retained values may have changed. */
  subscribe(fn: () => void): () => void;
  readonly element: Element | undefined;
}

export interface FieldMountOptions {
  /** The SJForm context; absent for a field outside a form. */
  readonly form?: FormInstance;
  /** Initial control: a Node (SJInput root) or text, same as the `default` slot. */
  readonly control?: string | Node;
}

const hasHint = (p: FieldOptions) => p.hasHint === true || (p.hint !== undefined && p.hint !== '');
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && 'nodeType' in v;

function fill(el: Element, v: string | Node | undefined): void {
  if (isNode(v)) el.replaceChildren(v);
  else setText(el, v ?? '');
}

/** Mount an SJField onto `el` (use a `<div>`; the element becomes the root part). */
export function mountField(
  host: VanillaHost,
  el: Element,
  props: FieldOptions = {},
  options: FieldMountOptions = {},
): FieldInstance {
  const doc = el.ownerDocument;
  const { form } = options;
  let parts: FieldParts | undefined;
  let label: HTMLElement | undefined;
  let hint: HTMLElement | undefined;
  let error: HTMLElement | undefined;
  let icon: HTMLElement | undefined;
  let iconInst: IconInstance | undefined;
  let text: HTMLElement | undefined;
  const fresh = {}; // sentinel: a new hint element has not been filled yet
  const drawn: { label?: unknown; hint?: unknown } = {};
  let off: (() => void) | undefined;
  let key: string | undefined;
  const seen = {
    root: new Set<string>() as Applied,
    label: new Set<string>() as Applied,
    hint: new Set<string>() as Applied,
    error: new Set<string>() as Applied,
    icon: new Set<string>() as Applied,
  };
  const placed: Node[] = [];
  const listeners = createListeners();

  const reconnect = (ctxId: string, p: FieldOptions) => {
    const k = p.name ?? ctxId;
    if (k === key) return;
    key = k;
    off?.(); // `connect()` registers with the key at call time (core note)
    off = parts!.connect();
  };

  const instance = host.mount(
    el,
    {
      live: fieldLive,
      initial: () => ({ state: 'idle' as const }),
      reduce: (s: { state: 'idle' }) => ({ state: s }),
      patch(_view, ctx) {
        const p = ctx.props() as FieldOptions;
        if (!parts) {
          label = doc.createElement('label');
          el.append(label);
          parts = createField(
            () => ({
              ...(ctx.props() as FieldOptions),
              hasHint: hasHint(ctx.props() as FieldOptions),
            }),
            {
              id: ctx.id,
              ...(form && { form: form.owner }),
              live: ctx.live,
            },
          );
          ctx.onCleanup(() => {
            iconInst?.destroy();
            for (const n of [label, hint, error, ...placed]) n?.parentNode?.removeChild(n);
            label = hint = error = icon = text = parts = iconInst = undefined;
            placed.length = 0;
          });
        }
        const f = parts;
        applyProps(el, f.getRootProps(), seen.root);
        applyProps(label!, f.getLabelProps(), seen.label);
        if (drawn.label !== p.label || !label!.hasChildNodes()) fill(label!, p.label);
        drawn.label = p.label;

        // The hint exists while one is declared; the control references it only then (`hasHint`).
        if (hasHint(p) && !hint) {
          hint = doc.createElement('div');
          label!.after(hint);
          drawn.hint = fresh;
        } else if (!hasHint(p) && hint) {
          hint.remove();
          hint = undefined;
          drawn.hint = undefined;
          seen.hint.clear();
        }
        if (hint) {
          applyProps(hint, f.getHintProps(), seen.hint);
          if (drawn.hint !== p.hint) fill(hint, p.hint);
          drawn.hint = p.hint;
        }

        // The error part exists only while an error shows: icon (aria-hidden) + visible text.
        const message = (p.error ?? '').trim();
        if (message && !error) {
          error = doc.createElement('div');
          icon = doc.createElement('span');
          text = doc.createElement('span');
          error.append(icon, text);
          el.append(error);
          if (p.errorIcon) {
            iconInst = mountIcon(host, icon, { icon: p.errorIcon, size: 'sm' });
          }
        } else if (!message && error) {
          iconInst?.destroy();
          error.remove();
          error = icon = text = iconInst = undefined;
          seen.error.clear();
          seen.icon.clear();
        }
        if (error) {
          applyProps(error, f.getErrorProps(), seen.error);
          applyProps(
            icon!,
            { class: 'sj-field__icon', 'data-part': 'icon', 'aria-hidden': 'true' },
            seen.icon,
          );
          setText(text!, message);
        }
        if (off) reconnect(ctx.id, p);
        // After the commit: a NEW error text goes to the live registry once; a standing one stays silent.
        f.announce();
      },
      attach(ctx) {
        key = undefined;
        reconnect(ctx.id, ctx.props() as FieldOptions);
        ctx.onCleanup(() => {
          off?.();
          off = undefined;
        });
        if (options.control !== undefined) place(options.control);
      },
    },
    props as Bag,
  );

  function place(node: string | Node): void {
    const n = typeof node === 'string' ? doc.createTextNode(node) : node;
    placed.push(n);
    el.insertBefore(n, error ?? null);
  }

  const update = instance.update.bind(instance);
  instance.update = (next) => {
    update(next);
    listeners.notify();
  };
  return Object.defineProperties(instance, {
    parts: { get: () => parts! },
    place: { value: place },
    subscribe: {
      // The control re-renders on the form's Enter position AND on this field's own props (error, name, ...).
      value: (fn: () => void) => {
        const offOwn = listeners.add(fn);
        const offForm = form?.subscribe(fn);
        return () => {
          offOwn();
          offForm?.();
        };
      },
    },
    element: { get: () => (instance.destroyed ? undefined : el) },
  }) as FieldInstance;
}

const ATTRS = [
  'id',
  'name',
  'label',
  'hint',
  'required',
  'disabled',
  'error',
  'error-message',
] as const;

function optionsFromAttributes(el: Element): FieldOptions {
  const get = (n: string) => el.getAttribute(n) ?? undefined;
  const id = get('id');
  const name = get('name');
  const hint = get('hint');
  const error = get('error');
  const label = get('label');
  return {
    ...(id !== undefined && { id }),
    ...(name !== undefined && { name }),
    ...(label !== undefined && { label }),
    ...(hint !== undefined && { hint, hasHint: true }),
    ...(error !== undefined && { error }),
    required: el.hasAttribute('required'),
    disabled: el.hasAttribute('disabled'),
    errorMessage: el.hasAttribute('error-message'),
  };
}

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-field>` (light DOM, no shadow root, no FACE): existing children (an `<sj-input>`) become the
 * control. Explicit and idempotent. Define `sj-form`, then `sj-field`, then `sj-input` so each finds its parent.
 */
export function define(
  host: VanillaHost,
  name = 'sj-field',
  registry: Registry = globalThis.customElements,
  errorIcon?: IconData,
): void {
  if (registry.get(name)) return;
  class SJFieldElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #root: HTMLElement | undefined;
    #instance: FieldInstance | undefined;
    /** The mounted field, for descendant `sj-input` elements. */
    get field(): FieldInstance | undefined {
      return this.#instance;
    }
    connectedCallback(): void {
      if (this.#instance) return;
      const root = this.ownerDocument.createElement('div');
      this.#root = root;
      const kids = Array.from(this.childNodes);
      this.append(root);
      const form = (this.closest('sj-form') as { form?: FormInstance } | null)?.form;
      this.#instance = mountField(
        host,
        root,
        { ...optionsFromAttributes(this), ...(errorIcon && { errorIcon }) },
        { ...(form && { form }) },
      );
      for (const k of kids) this.#instance.place(k);
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#root?.remove();
      this.#instance = this.#root = undefined;
    }
    attributeChangedCallback(): void {
      this.#instance?.update({ ...optionsFromAttributes(this), ...(errorIcon && { errorIcon }) });
    }
  }
  registry.define(name, SJFieldElement);
}
