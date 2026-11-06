// SJDisclosure vanilla adapter (W1-C06.e, ADR-002 light DOM + text nodes only, ADR-008 native-first).
// `mountDisclosure` drives a real `<details>` root: it adopts an existing `<summary>` / panel child (the
// slot form, also what SSR markup looks like) or creates them, and takes plain-text `summary` / `content`
// props (the prop form, written as text nodes, never markup). `define()` registers the optional
// `sj-disclosure` element; nothing runs at import.
//
// Native-first: the browser owns `open`, Enter/Space activation and focus. The adapter keeps the DOM in step
// with the view (`details.open` is a property), reports the native `toggle` back, and emits no
// `aria-expanded` (registry decision). No pointer or touch listener: activation is native, so no part needs
// a `touch-action` declaration (ADR-011 Rules). No animation: reduced motion is a CSS concern (ADR-009).
import {
  createDisclosureParts,
  disclosureFields,
  initialSnapshot,
  peersToClose,
  storeReducer,
  type DisclosureAction,
  type DisclosureProps,
  type DisclosureSnapshot,
} from '@ramoslabs/core/disclosure';
import {
  setText,
  type ComponentSpec,
  type Instance,
  type InstanceContext,
  type VanillaHost,
} from '../runtime/index';

/** Per-part class overrides, appended after the library class (ADR-004 `classes`). */
export type VanillaDisclosureClasses = {
  readonly root?: string;
  readonly trigger?: string;
  readonly content?: string;
};

/** Core props plus plain-text `summary` / `content` (text nodes, never markup) and `classes`. */
export type VanillaDisclosureProps = DisclosureProps & {
  readonly summary?: string;
  readonly content?: string;
  readonly classes?: VanillaDisclosureClasses;
};

type Ctx = InstanceContext<DisclosureSnapshot, DisclosureAction, VanillaDisclosureProps>;
type Applied = Set<string>;

/** Write a getter's Props onto an element. `open` is a DOM property and `on*` handlers are wired separately. */
function applyProps(el: Element, props: Record<string, unknown>, prev: Applied): void {
  const next: Applied = new Set();
  for (const [key, value] of Object.entries(props)) {
    if (/^on[A-Z]/.test(key) || key === 'open') continue;
    if (value === undefined || value === false || value === null) continue;
    el.setAttribute(key, value === true ? '' : String(value));
    next.add(key);
  }
  for (const attr of prev) if (!next.has(attr)) el.removeAttribute(attr);
  prev.clear();
  for (const a of next) prev.add(a);
}

const isSummary = (n: Element) => n.tagName.toLowerCase() === 'summary';

function createSpec(): ComponentSpec<
  DisclosureSnapshot,
  DisclosureAction,
  VanillaDisclosureProps,
  never
> {
  let summary: Element | undefined;
  let content: Element | undefined;
  let parts: ReturnType<typeof createDisclosureParts> | undefined;
  let closeGroup: ((rootId: string) => void) | undefined;
  // `open` the element had before the first patch (the user may toggle before any script runs).
  let pre = false;
  const seen = { root: new Set<string>(), trigger: new Set<string>(), content: new Set<string>() };

  const build = (ctx: Ctx) => {
    const el = ctx.el as HTMLDetailsElement;
    const doc = el.ownerDocument;
    const kids = Array.from(el.children);
    summary = kids.find(isSummary);
    // Only server/author markup (an existing `<summary>`) can carry a pre-script toggle. A bare `<details>`
    // has no history: its `open` is just the default, so the view wins.
    pre = summary ? el.open : ctx.view().open;
    content = kids.find((k) => !isSummary(k));
    const madeSummary = !summary;
    const madeContent = !content;
    if (!summary) {
      summary = doc.createElement('summary');
      el.prepend(summary);
    }
    if (!content) {
      content = doc.createElement('div');
      el.append(content);
    }
    ctx.onCleanup(() => {
      if (madeSummary) summary?.remove();
      if (madeContent) content?.remove();
      summary = content = undefined;
    });
    closeGroup = (rootId: string) => {
      // Native engines close the siblings themselves; the owned fallback is only for those without it.
      if (ctx.runtime.supports.detailsName) return;
      const name = ctx.props().name;
      if (!name) return;
      const root = el.getRootNode() as ParentNode;
      const scope = typeof root.querySelectorAll === 'function' ? root : doc;
      const all = Array.from(scope.querySelectorAll<HTMLDetailsElement>('details[name]'));
      const members = all.map((d, i) => ({
        id: d === el ? rootId : String(i),
        name: d.getAttribute('name'),
        open: d.open,
      }));
      const close = new Set(peersToClose(rootId, members));
      all.forEach((d, i) => {
        if (d !== el && close.has(String(i))) d.open = false;
      });
    };
    parts = createDisclosureParts({
      view: ctx.view,
      native: ctx.native,
      getProps: ctx.props,
      id: ctx.id,
      closePeers: closeGroup,
    });
  };

  return {
    initial: (p) => initialSnapshot(p.open ?? p.defaultOpen ?? false),
    reduce: storeReducer,
    fields: disclosureFields,
    patch(view, ctx) {
      const first = !parts;
      if (first) build(ctx);
      const el = ctx.el as HTMLDetailsElement;
      const props = ctx.props();
      const cls = props.classes;
      applyProps(el, parts!.getRootProps(cls?.root ? { class: cls.root } : {}), seen.root);
      applyProps(
        summary!,
        parts!.getTriggerProps(cls?.trigger ? { class: cls.trigger } : {}),
        seen.trigger,
      );
      applyProps(
        content!,
        parts!.getContentProps(cls?.content ? { class: cls.content } : {}),
        seen.content,
      );
      // The first patch leaves a pre-script toggle alone: `attach` reports it to the store.
      if (!(first && pre !== view.open) && el.open !== view.open) el.open = view.open;
      if (props.summary !== undefined) setText(summary!, props.summary);
      if (props.content !== undefined) setText(content!, props.content);
    },
    attach(ctx) {
      const el = ctx.el as HTMLDetailsElement;
      const root = parts!.getRootProps();
      const trigger = parts!.getTriggerProps();
      ctx.listen(el, 'toggle', (e) => (root.onToggle as (e: Event) => void)(e));
      ctx.listen(summary!, 'click', (e) => (trigger.onClick as (e: Event) => void)(e));
      // Pre-hydration: `<details>` worked before any script, so report a state that differs from the view.
      if (pre !== ctx.view().open) {
        if (pre && ctx.props().name) closeGroup!(ctx.id);
        ctx.native('open', pre);
      }
    },
    run(effect, ctx) {
      // `open` on `root`: put the native element back to the committed value (a rejected controlled change).
      if (effect.type === 'open') (ctx.el as HTMLDetailsElement).open = effect.value === true;
    },
  };
}

export interface DisclosureInstance extends Instance<VanillaDisclosureProps> {
  readonly trigger: Element | undefined;
  readonly content: Element | undefined;
}

/** Mount an SJDisclosure onto `el` (use a `<details>`; the element becomes the root part). */
export function mountDisclosure(
  host: VanillaHost,
  el: Element,
  props: VanillaDisclosureProps = {},
): DisclosureInstance {
  const instance = host.mount(el, createSpec(), props);
  // Live accessors, not values frozen at mount.
  const part = (pick: (kids: Element[]) => Element | undefined) => () =>
    instance.destroyed ? undefined : pick(Array.from(el.children));
  Object.defineProperties(instance, {
    trigger: { get: part((k) => k.find(isSummary)), enumerable: true, configurable: true },
    content: {
      get: part((k) => k.find((c) => !isSummary(c))),
      enumerable: true,
      configurable: true,
    },
  });
  return instance as DisclosureInstance;
}

const ATTRS = ['open', 'disabled', 'name', 'summary', 'id'] as const;

function propsFromAttributes(el: Element, live: boolean): VanillaDisclosureProps {
  const get = (n: string) => el.getAttribute(n) ?? undefined;
  const name = get('name');
  const summary = get('summary');
  const id = get('id');
  return {
    ...(name !== undefined && { name }),
    ...(summary !== undefined && { summary }),
    ...(id !== undefined && { id }),
    disabled: el.hasAttribute('disabled'),
    // The `open` attribute is the initial (uncontrolled) state, read once at connect.
    ...(!live && { defaultOpen: el.hasAttribute('open') }),
  };
}

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-disclosure>` (light DOM, no shadow root). Its children become the panel content.
 * Explicit and idempotent: call it from app code; the module never registers at import.
 * `host` must be created from a client-target runtime.
 */
export function define(
  host: VanillaHost,
  name = 'sj-disclosure',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJDisclosureElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #details: HTMLElement | undefined;
    #content: HTMLElement | undefined;
    #instance: DisclosureInstance | undefined;
    connectedCallback(): void {
      if (this.#instance) return;
      const doc = this.ownerDocument;
      const details = doc.createElement('details');
      const summary = doc.createElement('summary');
      const content = doc.createElement('div');
      // Move (not parse) the host's own child nodes into the panel.
      content.append(...Array.from(this.childNodes));
      details.append(summary, content);
      this.append(details);
      this.#details = details;
      this.#content = content;
      const props = propsFromAttributes(this, false);
      // The details is ours (no pre-script history): start it at the initial state, then mount.
      (details as HTMLDetailsElement).open = props.defaultOpen === true;
      this.#instance = mountDisclosure(host, details, props);
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      // Give the children back, so a reconnect finds them where the author put them.
      if (this.#content) this.append(...Array.from(this.#content.childNodes));
      this.#details?.remove();
      this.#instance = this.#details = this.#content = undefined;
    }
    attributeChangedCallback(): void {
      this.#instance?.update(propsFromAttributes(this, true));
    }
    get open(): boolean {
      return (this.#details as HTMLDetailsElement | undefined)?.open ?? this.hasAttribute('open');
    }
  }
  registry.define(name, SJDisclosureElement);
}
