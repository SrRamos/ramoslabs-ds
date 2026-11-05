// SJButton vanilla adapter (W1-C01.e). The golden vanilla layout: later `.e` copy it.
//   mountButton(host, container, props)  -> { update, destroy, element }
//   defineSJButton(options?)             -> registers the optional `sj-button` light-DOM element
// Nothing runs at import time: no `customElements`, `document` or `HTMLElement` read at module scope
// (the element class is built inside `defineSJButton`). Light DOM only (ADR-002), consumer strings
// are rendered as text nodes only, never parsed as markup. No FACE: see C01-NOTES.md ".e".
import {
  createButton,
  type ButtonEventLike,
  type ButtonPressPayload,
  type ButtonProps,
} from '@ramoslabs/core/button';
import { reduce } from '@ramoslabs/core/button';
import type { Props } from '@ramoslabs/core/merge';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost, type Bag, type VanillaHost } from '../runtime/index';

export type { ButtonPressPayload, ButtonProps, VanillaHost };

/** Core props plus the content the adapter renders as text nodes. */
export interface ButtonMountProps extends ButtonProps {
  /** Visible label: a string is rendered as a text node; a Node is appended as given. */
  readonly text?: string | Node;
  /** Contract name for `text`; `text` wins when both are set. */
  readonly default?: string | Node;
  /** Decorative icon inside the `icon` part (`aria-hidden`): a string is text, a Node is appended as given. */
  readonly icon?: string | Node;
  /** Extra attributes for the control (`name`, `value`, `form`, `data-*`, `aria-*`, `class`, `onClick`). */
  readonly attrs?: Props;
}

export interface ButtonInstance {
  /** Replace the props; patches the DOM synchronously. */
  update(props: ButtonMountProps): void;
  /** Idempotent. Aborts the instance signal (every listener) and removes the control. */
  destroy(): void;
  /** The current `<button>` or `<a>` (changes when `href` toggles). */
  element(): Element | null;
}

/** Contract state is constant (`idle`); the reducer is wired for fidelity, never dispatched. */
const spec = {
  initial: () => ({ state: 'idle' as const }),
  reduce: (s: { state: 'idle' }, e: { type: string }) => ({ state: { state: reduce(s.state, e) } }),
  patch: () => undefined,
};

/**
 * Mounts a button into `container` (light DOM). One delegated click listener on the container
 * carries the instance signal; the control itself gets no listeners, so swapping `<button>` and
 * `<a>` never leaks.
 */
export function mountButton(
  host: VanillaHost,
  container: Element,
  initial: ButtonMountProps,
): ButtonInstance {
  const doc = container.ownerDocument;
  let current = initial;
  let control: Element | null = null;
  let applied = new Set<string>();
  let iconEl: Element | null = null;
  let textNode: Node | null = null;
  let iconSrc: string | Node | undefined;
  let textSrc: string | Node | undefined;
  let onClick: ((e: ButtonEventLike) => void) | undefined;
  let iconApplied = new Set<string>();

  // `press` is the contract event: bubble a CustomEvent from the control, then call `onPress`.
  const press = (payload: ButtonPressPayload) => {
    control?.dispatchEvent(new CustomEvent('press', { bubbles: true, detail: payload }));
    current.onPress?.(payload);
  };
  const button = createButton(() => ({ ...current, onPress: press }));

  const setAttrs = (el: Element, bag: Props, prev: Set<string>): Set<string> => {
    const next = new Set<string>();
    for (const [key, value] of Object.entries(bag)) {
      if (typeof value === 'function') continue;
      if (value === undefined || value === null || value === false) continue;
      el.setAttribute(key, value === true && key === 'disabled' ? '' : String(value));
      next.add(key);
    }
    for (const key of prev) if (!next.has(key)) el.removeAttribute(key);
    return next;
  };

  const instance = host.mount(
    container,
    {
      ...spec,
      attach(ctx) {
        ctx.listen(container, 'click', (event) => {
          if (control && control.contains(event.target as Node)) onClick?.(event);
        });
        ctx.onCleanup(() => {
          control?.remove();
          control = iconEl = textNode = onClick = null as never;
          iconSrc = textSrc = undefined;
        });
      },
    },
    initial as unknown as Bag,
  );

  const render = () => {
    const kind = button.element();
    if (!control || control.localName !== kind) {
      control?.remove();
      control = doc.createElement(kind);
      container.replaceChildren(control);
      applied = new Set();
      iconEl = null;
      textNode = null;
      iconSrc = textSrc = undefined;
    }
    const bag =
      kind === 'a' ? button.getLinkProps(current.attrs) : button.getRootProps(current.attrs);
    applied = setAttrs(control, bag, applied);
    onClick = bag.onClick as typeof onClick;

    // A string is text; a Node is appended as given. Content is rebuilt only when the source
    // (string value or Node identity) changes, so an `update()` with the same Node keeps it.
    const icon = current.icon === '' ? undefined : current.icon;
    if (icon !== undefined) {
      if (!iconEl) {
        iconEl = doc.createElement('span');
        control.insertBefore(iconEl, control.firstChild);
        iconApplied = new Set();
        iconSrc = undefined;
      }
      iconApplied = setAttrs(iconEl, button.getIconProps(), iconApplied);
      if (iconSrc !== icon) {
        if (typeof icon === 'string') iconEl.textContent = icon;
        else iconEl.replaceChildren(icon);
        iconSrc = icon;
      }
    } else if (iconEl) {
      iconEl.remove();
      iconEl = null;
      iconSrc = undefined;
    }
    const text =
      (current.text ?? current.default) === '' ? undefined : (current.text ?? current.default);
    if (text !== undefined) {
      if (textSrc !== text) {
        textNode?.parentNode?.removeChild(textNode);
        textNode = typeof text === 'string' ? doc.createTextNode(text) : text;
        control.appendChild(textNode);
        textSrc = text;
      }
    } else if (textNode) {
      textNode.parentNode?.removeChild(textNode);
      textNode = null;
      textSrc = undefined;
    }
  };
  render();

  return {
    update(next) {
      if (instance.destroyed) return;
      current = next;
      instance.update(next as unknown as Bag);
      render();
    },
    destroy: () => instance.destroy(),
    element: () => control,
  };
}

export interface DefineOptions {
  /** Custom element name; default `sj-button`. */
  name?: string;
  /** Registry; default `globalThis.customElements`. */
  registry?: { get(name: string): unknown; define(name: string, ctor: never): void };
  /** Host shared by every element; default one client-target host created on first connect. */
  host?: VanillaHost;
}

const ATTRS = [
  'variant',
  'tone',
  'size',
  'disabled',
  'type',
  'href',
  'target',
  'rel',
  'label',
  'icon-only',
  'icon',
  'text',
];

/**
 * Explicitly registers `<sj-button>` (idempotent: a second call, or an existing definition of the
 * name, is a no-op and returns false). The element mounts the real control inside itself in the
 * light DOM; initial child text becomes the label when no `text` attribute is given.
 */
export function defineSJButton(options: DefineOptions = {}): boolean {
  const name = options.name ?? 'sj-button';
  const registry =
    options.registry ??
    (globalThis as unknown as { customElements: DefineOptions['registry'] }).customElements!;
  if (registry.get(name) !== undefined) return false;
  let shared = options.host;
  let n = 0;
  const getHost = (): VanillaHost =>
    (shared ??= createHost(
      createRuntime({ target: 'client', idFactory: () => `sj-button-${++n}` }),
    ));

  const Base = (globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement;
  class SJButtonElement extends Base {
    static observedAttributes = ATTRS;
    #inst: ButtonInstance | null = null;
    #text: string | undefined;

    #props(): ButtonMountProps {
      const a = (k: string) => this.getAttribute(k) ?? undefined;
      const has = (k: string) => this.hasAttribute(k) && this.getAttribute(k) !== 'false';
      return {
        variant: a('variant') as ButtonProps['variant'],
        tone: a('tone') as ButtonProps['tone'],
        size: a('size') as ButtonProps['size'],
        type: a('type') as ButtonProps['type'],
        href: a('href'),
        target: a('target'),
        rel: a('rel'),
        label: a('label'),
        disabled: has('disabled'),
        iconOnly: has('icon-only'),
        icon: a('icon'),
        text: a('text') ?? this.#text,
      };
    }
    connectedCallback(): void {
      if (this.#inst) return;
      this.#text = this.textContent?.trim() || undefined;
      this.#inst = mountButton(getHost(), this, this.#props());
    }
    disconnectedCallback(): void {
      this.#inst?.destroy();
      this.#inst = null;
    }
    attributeChangedCallback(): void {
      this.#inst?.update(this.#props());
    }
  }
  registry.define(name, SJButtonElement as never);
  return true;
}
