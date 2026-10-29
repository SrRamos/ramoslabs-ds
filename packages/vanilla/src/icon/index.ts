// SJIcon vanilla adapter (W1-C12.e, ADR-016).
//   mountIcon(host, container, props)  -> { update, destroy, element }
//   defineSJIcon({ icons, ... })       -> registers the optional `sj-icon` light-DOM element
// Nothing runs at import time and there is no module-scope state: the element class and the name
// map live inside `defineSJIcon`. The SVG is built with `createElementNS` and `setAttribute` only
// (ADR-002 text-safety: no markup parsing). The adapter never imports `@ramoslabs/icons`: the
// consumer passes icon data, or a name map to `defineSJIcon` (ADR-016 boundary).
import { createIcon, type IconData, type IconProps } from '@ramoslabs/core/icon';
import type { Props } from '@ramoslabs/core/merge';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost, type Bag, type VanillaHost } from '../runtime/index';

export type { IconData, IconProps, VanillaHost };

export interface IconMountProps extends IconProps {
  /** Extra attributes for the `<svg>` (`class` merges; library attributes are protected). */
  readonly attrs?: Props;
}

export interface IconInstance {
  /** Replace the props; patches the DOM synchronously. Children change only with the icon. */
  update(props: IconMountProps): void;
  /** Idempotent. Removes the `<svg>` and drops every reference. */
  destroy(): void;
  /** The `<svg>`, or null after destroy. */
  element(): Element | null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** One state (`idle`), no events (ADR-010 G-ICON); the host mount only supplies lifecycle. */
const spec = {
  initial: () => ({ state: 'idle' as const }),
  reduce: (s: { state: 'idle' }) => ({ state: s }),
  patch: () => undefined,
};

/** Mounts an icon into `container` (light DOM). Mirrored icons without `dir` read `host.runtime.dir`. */
export function mountIcon(
  host: VanillaHost,
  container: Element,
  initial: IconMountProps,
): IconInstance {
  const doc = container.ownerDocument;
  let current = initial;
  let svg: Element | null = null;
  let applied = new Set<string>();
  let drawn: IconData | undefined | null = null;
  const icon = createIcon(() => ({
    ...current,
    dir: current.dir ?? (current.icon?.mirror ? host.runtime.dir : undefined),
  }));

  const instance = host.mount(
    container,
    {
      ...spec,
      attach(ctx) {
        ctx.onCleanup(() => {
          svg?.remove();
          svg = null;
          drawn = null;
          applied = new Set();
        });
      },
    },
    initial as unknown as Bag,
  );

  const render = () => {
    if (!svg) {
      svg = doc.createElementNS(SVG_NS, 'svg');
      container.appendChild(svg);
    }
    const next = new Set<string>();
    for (const [key, value] of Object.entries(icon.getRootProps(current.attrs))) {
      if (typeof value === 'function' || value === undefined || value === null || value === false)
        continue;
      svg.setAttribute(key, String(value));
      next.add(key);
    }
    for (const key of applied) if (!next.has(key)) svg.removeAttribute(key);
    applied = next;

    if (drawn !== current.icon || !svg.firstChild) {
      drawn = current.icon;
      const kids = icon.getNodes().map(([tag, attrs]) => {
        const el = doc.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
        return el;
      });
      svg.replaceChildren(...kids);
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
    element: () => svg,
  };
}

export interface DefineOptions {
  /**
   * The icons the element can resolve by name: a record (`{ search: Search }`, aliases allowed as
   * extra keys) or a list of icon data carrying `name`. The map is built in a closure.
   */
  icons?: Readonly<Record<string, IconData>> | readonly IconData[];
  /** Custom element name; default `sj-icon`. */
  name?: string;
  /** Registry; default `globalThis.customElements`. */
  registry?: { get(name: string): unknown; define(name: string, ctor: never): void };
  /** Host shared by every element; default one client-target host created on first connect. */
  host?: VanillaHost;
}

const ATTRS = ['icon', 'label', 'size', 'dir'];

/**
 * Explicitly registers `<sj-icon>` (idempotent: an existing definition of the name is a no-op and
 * returns false). The `icon` attribute is a name looked up in `options.icons`; the `.icon`
 * property takes icon data directly and wins until the attribute changes.
 */
export function defineSJIcon(options: DefineOptions = {}): boolean {
  const name = options.name ?? 'sj-icon';
  const registry =
    options.registry ??
    (globalThis as unknown as { customElements: DefineOptions['registry'] }).customElements!;
  if (registry.get(name) !== undefined) return false;
  const found = options.icons ?? {};
  const map = new Map<string, IconData>();
  if (Array.isArray(found)) {
    for (const d of found as readonly IconData[]) if (d.name) map.set(d.name, d);
  } else for (const [k, v] of Object.entries(found)) map.set(k, v as IconData);
  let shared = options.host;
  let n = 0;
  const getHost = (): VanillaHost =>
    (shared ??= createHost(createRuntime({ target: 'client', idFactory: () => `sj-icon-${++n}` })));

  const Base = (globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement;
  class SJIconElement extends Base {
    static observedAttributes = ATTRS;
    #inst: IconInstance | null = null;
    #data: IconData | undefined;

    get icon(): IconData | undefined {
      return this.#data ?? map.get(this.getAttribute('icon') ?? '');
    }
    set icon(value: IconData | undefined) {
      this.#data = value;
      this.#inst?.update(this.#props());
    }
    #props(): IconMountProps {
      const a = (k: string) => this.getAttribute(k) ?? undefined;
      return {
        icon: this.icon,
        label: a('label'),
        size: a('size') as IconProps['size'],
        dir: a('dir') as IconProps['dir'],
      };
    }
    connectedCallback(): void {
      if (this.#inst) return;
      this.#inst = mountIcon(getHost(), this, this.#props());
    }
    disconnectedCallback(): void {
      this.#inst?.destroy();
      this.#inst = null;
    }
    attributeChangedCallback(attr: string): void {
      if (attr === 'icon') this.#data = undefined;
      this.#inst?.update(this.#props());
    }
  }
  registry.define(name, SJIconElement as never);
  return true;
}
