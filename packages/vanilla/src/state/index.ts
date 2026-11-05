// SJState vanilla adapter (W1-C11.e, ADR-002 light DOM + text nodes only, ADR-006 live regions).
//   mountState(host, el, props) -> { update, destroy, destroyed, parts }
//   define(host, name?, registry?) registers the optional `sj-state` element (explicit; never at import)
// Parts are created only for content that exists (icon, title, description, actions). String content is
// a text node (never parsed as markup); a `Node` is moved in and left to the caller on destroy. The root
// never carries live markup: the announcement goes to the host live registry after mount (client only),
// so a server render has none. `title` is a global tooltip attribute: it is never read from attributes,
// the copy comes from `heading` or the title slot (C11-NOTES). No listeners and no pointer handling.
import { createState, stateLive, type State } from '@ramoslabs/core/state';
import type { Props } from '@ramoslabs/core/merge';
import type { SJStateOptions } from '../generated/state/types';
import {
  setText,
  type Bag,
  type ComponentSpec,
  type InstanceContext,
  type VanillaHost,
} from '../runtime/index';

export type StateSlot = string | Node;
export type StatePart = 'root' | 'icon' | 'title' | 'description' | 'actions';

/** Generated options plus per-part class overrides (`classes.title`, ...). */
export type VanillaStateProps = SJStateOptions & {
  readonly classes?: Readonly<Partial<Record<StatePart, string>>>;
};

type Ctx = InstanceContext<{ state: 'idle' }, never, VanillaStateProps & Bag>;
type Child = Exclude<StatePart, 'root'>;
const CHILDREN: readonly Child[] = ['icon', 'title', 'description', 'actions'];
// Elements per the contract anatomy (state.contract.json).
const TAG: Record<Child, string> = { icon: 'span', title: 'p', description: 'p', actions: 'div' };

/** Write a getter's Props onto an element; attributes dropped since the last write are removed. */
function applyProps(el: Element, props: Props, prev: Set<string>): void {
  const next = new Set<string>();
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false || typeof value === 'function')
      continue;
    el.setAttribute(key, value === true ? '' : String(value));
    next.add(key);
  }
  for (const attr of prev) if (!next.has(attr)) el.removeAttribute(attr);
  prev.clear();
  for (const a of next) prev.add(a);
}

const filled = (s: StateSlot | undefined): s is StateSlot => s !== undefined && s !== '';

function createSpec(): ComponentSpec<{ state: 'idle' }, never, VanillaStateProps & Bag, never> {
  let state: State | undefined;
  let current: VanillaStateProps = {};
  let els: Partial<Record<Child, HTMLElement>> = {};
  let drawn: Partial<Record<Child, StateSlot>> = {};
  let order = '';
  let lastKey = '';
  const seen: Record<StatePart, Set<string>> = {
    root: new Set(),
    icon: new Set(),
    title: new Set(),
    description: new Set(),
    actions: new Set(),
  };

  return {
    initial: () => ({ state: 'idle' as const }),
    reduce: (s) => ({ state: s }),
    // The contract declares liveRegions: the host inserts its region at mount (generated constant).
    live: stateLive,
    patch(_view, ctx: Ctx) {
      current = ctx.props();
      if (!state) {
        // The title slot (string) is the heading for announcements when no `heading` prop is given.
        state = createState(() => ({
          ...current,
          heading: typeof current.title === 'string' ? current.title : current.heading,
        }));
        ctx.onCleanup(() => {
          for (const e of Object.values(els)) e.remove();
          els = {};
          drawn = {};
          order = '';
          state = undefined;
        });
      }
      const cls = current.classes ?? {};
      const getters: Record<StatePart, (c?: Props) => Props> = {
        root: state.getRootProps,
        icon: state.getIconProps,
        title: state.getTitleProps,
        description: state.getDescriptionProps,
        actions: state.getActionsProps,
      };
      const own = (p: StatePart): Props => (cls[p] ? { class: cls[p] } : {});
      applyProps(ctx.el, getters.root(own('root')), seen.root);

      const want: Record<Child, StateSlot | undefined> = {
        icon: current.icon,
        title: filled(current.title) ? current.title : current.heading,
        description: filled(current.default) ? current.default : current.description,
        actions: current.actions,
      };
      const doc = ctx.el.ownerDocument;
      let nextOrder = '';
      for (const part of CHILDREN) {
        const content = want[part];
        if (!filled(content)) {
          els[part]?.remove();
          delete els[part];
          delete drawn[part];
          seen[part].clear();
          continue;
        }
        nextOrder += part + ',';
        const el = (els[part] ??= doc.createElement(TAG[part]));
        applyProps(el, getters[part](own(part)), seen[part]);
        if (drawn[part] !== content) {
          drawn[part] = content;
          if (typeof content === 'string') setText(el, content);
          else el.replaceChildren(content);
        }
      }
      if (nextOrder !== order) {
        order = nextOrder;
        ctx.el.replaceChildren(...CHILDREN.flatMap((p) => (els[p] ? [els[p]!] : [])));
      }

      // One announcement per change, handed to the registry after mount (no live markup in SSR).
      const a = state.getAnnouncement();
      const key = a ? `${a.urgent ? 'a' : 's'}:${a.text}` : '';
      if (key !== lastKey) {
        lastKey = key;
        if (a) ctx.live.announce(a.text, { urgent: a.urgent });
      }
    },
  };
}

export interface StateInstance {
  /** Replace the props; patches the DOM synchronously. */
  update(props: VanillaStateProps): void;
  /** Idempotent. Removes the parts and drops every reference. */
  destroy(): void;
  readonly destroyed: boolean;
  /** The part elements currently in the DOM (empty after destroy). */
  parts(): Readonly<Partial<Record<Child, Element>>>;
}

/** Mount an SJState onto `el` (the element becomes the root part). */
export function mountState(
  host: VanillaHost,
  el: Element,
  props: VanillaStateProps = {},
): StateInstance {
  const instance = host.mount(el, createSpec(), props as VanillaStateProps & Bag);
  return {
    update: (next: VanillaStateProps) => instance.update(next as VanillaStateProps & Bag),
    destroy: () => instance.destroy(),
    get destroyed() {
      return instance.destroyed;
    },
    parts() {
      const out: Partial<Record<Child, Element>> = {};
      if (instance.destroyed) return out;
      for (const c of Array.from(el.children)) {
        const part = c.getAttribute('data-part') as Child | null;
        if (part) out[part] = c;
      }
      return out;
    },
  } as StateInstance;
}

// `title` is deliberately absent: it is a global tooltip attribute (use `heading`).
const ATTRS = ['variant', 'heading', 'description', 'announce', 'interrupt'] as const;

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-state>` (light DOM). Explicit and idempotent: nothing registers at import.
 * Attributes: variant, heading, description, announce, interrupt. The `icon` and `actions`
 * properties take a string or a Node. `host` must come from a client-target runtime.
 */
export function define(
  host: VanillaHost,
  name = 'sj-state',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJStateElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #root: HTMLElement | undefined;
    #instance: StateInstance | undefined;
    #slots: { icon?: StateSlot; actions?: StateSlot } = {};
    #props(): VanillaStateProps {
      const get = (n: string) => this.getAttribute(n) ?? undefined;
      const variant = get('variant');
      const heading = get('heading');
      const description = get('description');
      const announce = get('announce');
      return {
        ...(variant !== undefined && { variant: variant as VanillaStateProps['variant'] }),
        ...(heading !== undefined && { heading }),
        ...(description !== undefined && { description }),
        ...(announce !== undefined && { announce }),
        interrupt: this.hasAttribute('interrupt'),
        ...this.#slots,
      };
    }
    connectedCallback(): void {
      if (this.#instance) return;
      this.#root = this.ownerDocument.createElement('div');
      this.append(this.#root);
      this.#instance = mountState(host, this.#root, this.#props());
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#root?.remove();
      this.#instance = this.#root = undefined;
    }
    attributeChangedCallback(): void {
      this.#instance?.update(this.#props());
    }
    get icon(): StateSlot | undefined {
      return this.#slots.icon;
    }
    set icon(v: StateSlot | undefined) {
      this.#slots = { ...this.#slots, icon: v };
      this.#instance?.update(this.#props());
    }
    get actions(): StateSlot | undefined {
      return this.#slots.actions;
    }
    set actions(v: StateSlot | undefined) {
      this.#slots = { ...this.#slots, actions: v };
      this.#instance?.update(this.#props());
    }
  }
  registry.define(name, SJStateElement);
}
