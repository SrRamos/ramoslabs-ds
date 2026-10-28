// SJSwitch vanilla adapter (W1-C03s.e, ADR-002 light DOM + text nodes only, ADR-014 no FACE).
// `mountSwitch` builds root <label> > <input role=switch> + thumb + label text and wires the core getters
// through the vanilla runtime. `define()` registers the optional `sj-switch` element; nothing runs at import.
//
// FACE is deliberately NOT used (ADR-014: "only where a custom control needs native form participation"):
// the real <input type=checkbox name value> lives in the element's light DOM, so it is a form-associated
// descendant of the surrounding <form> and submits exactly like a bare checkbox. `attachInternals()` would
// add a second source of form state for no gain.
//
// Pointer handling: none. Activation is native (click on the <label>, Space on the input); this adapter
// registers no pointer/touch listener, so no part needs a `touch-action` declaration (ADR-011 Rules).
import {
  createSwitchParts,
  initialSnapshot,
  storeReducer,
  switchFields,
  type SwitchAction,
  type SwitchProps,
  type SwitchSnapshot,
} from '@ramoslabs/core/switch';
import {
  setText,
  type ComponentSpec,
  type Instance,
  type InstanceContext,
  type VanillaHost,
} from '../runtime/index';

/** Vanilla props: the core props plus a plain-text `label` (rendered as a text node, never markup). */
export type VanillaSwitchProps = SwitchProps & { readonly label?: string };

type Ctx = InstanceContext<SwitchSnapshot, SwitchAction, VanillaSwitchProps>;
type Applied = Set<string>;

/** Write a getter's Props onto an element. Event handlers (`on*`) are wired separately. */
function applyProps(el: Element, props: Record<string, unknown>, prev: Applied): void {
  const next: Applied = new Set();
  for (const [key, value] of Object.entries(props)) {
    if (/^on[A-Z]/.test(key)) continue;
    const attr = key === 'class' ? 'class' : key;
    if (key === 'checked') {
      (el as HTMLInputElement).checked = value === true;
      continue;
    }
    if (value === undefined || value === false || value === null) continue;
    if (key === 'disabled') (el as HTMLInputElement).disabled = true;
    el.setAttribute(attr, value === true ? '' : String(value));
    next.add(attr);
  }
  for (const attr of prev) {
    if (next.has(attr)) continue;
    el.removeAttribute(attr);
    if (attr === 'disabled') (el as HTMLInputElement).disabled = false;
  }
  prev.clear();
  for (const a of next) prev.add(a);
}

function createSpec(): ComponentSpec<SwitchSnapshot, SwitchAction, VanillaSwitchProps, never> {
  let input: HTMLInputElement | undefined;
  let thumb: HTMLElement | undefined;
  let text: HTMLElement | undefined;
  let parts: ReturnType<typeof createSwitchParts> | undefined;
  const seen = { root: new Set<string>(), control: new Set<string>(), thumb: new Set<string>() };

  const build = (ctx: Ctx) => {
    const doc = ctx.el.ownerDocument;
    input = doc.createElement('input');
    thumb = doc.createElement('span');
    text = doc.createElement('span');
    ctx.el.append(input, thumb, text);
    ctx.onCleanup(() => {
      input?.remove();
      thumb?.remove();
      text?.remove();
      input = thumb = text = undefined;
    });
    parts = createSwitchParts({
      view: ctx.view,
      native: ctx.native,
      getProps: ctx.props,
      id: ctx.id,
    });
  };

  return {
    initial: (p) => initialSnapshot(p.checked ?? p.defaultChecked ?? false),
    reduce: storeReducer,
    fields: switchFields,
    patch(_view, ctx) {
      if (!parts) build(ctx);
      applyProps(ctx.el, parts!.getRootProps(), seen.root);
      applyProps(input!, parts!.getControlProps(), seen.control);
      applyProps(thumb!, parts!.getThumbProps(), seen.thumb);
      setText(text!, ctx.props().label ?? '');
    },
    attach(ctx) {
      const { onChange } = parts!.getControlProps();
      ctx.listen(input!, 'change', (e) => (onChange as (e: Event) => void)(e));
    },
    run(effect) {
      // `checked` / target `control`: put the native input back to the committed value.
      if (effect.type === 'checked' && input) input.checked = effect.value === true;
    },
    exists: (target) => target !== 'control' || input !== undefined,
  };
}

export interface SwitchInstance extends Instance<VanillaSwitchProps> {
  readonly control: HTMLInputElement | undefined;
}

/** Mount an SJSwitch onto `el` (use a `<label>`; the element becomes the root part). */
export function mountSwitch(
  host: VanillaHost,
  el: Element,
  props: VanillaSwitchProps = {},
): SwitchInstance {
  const spec = createSpec();
  const instance = host.mount(el, spec, props);
  const control = el.querySelector('input') ?? undefined;
  return Object.assign(instance, {
    get control() {
      return instance.destroyed ? undefined : control;
    },
  }) as SwitchInstance;
}

const ATTRS = ['checked', 'disabled', 'name', 'value', 'label', 'id'] as const;

function propsFromAttributes(el: Element, live: boolean): VanillaSwitchProps {
  const get = (n: string) => el.getAttribute(n) ?? undefined;
  const name = get('name');
  const value = get('value');
  const label = get('label');
  const id = get('id');
  return {
    ...(name !== undefined && { name }),
    ...(value !== undefined && { value }),
    ...(label !== undefined && { label }),
    ...(id !== undefined && { id }),
    disabled: el.hasAttribute('disabled'),
    // The `checked` attribute is the initial (uncontrolled) state, read once at connect.
    ...(!live && { defaultChecked: el.hasAttribute('checked') }),
  };
}

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-switch>` (light DOM, no shadow root, no FACE). Explicit and idempotent: call it from app code;
 * the module never registers at import. `host` must be created from a client-target runtime.
 */
export function define(
  host: VanillaHost,
  name = 'sj-switch',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJSwitchElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #label: HTMLElement | undefined;
    #instance: SwitchInstance | undefined;
    connectedCallback(): void {
      if (this.#instance) return;
      const props = propsFromAttributes(this, false);
      const doc = this.ownerDocument;
      const label = doc.createElement('label');
      this.#label = label;
      this.append(label);
      this.#instance = mountSwitch(host, label, props);
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#label?.remove();
      this.#instance = this.#label = undefined;
    }
    attributeChangedCallback(): void {
      if (!this.#instance) return;
      // Re-read; `checked` stays the initial state (use the native input to change it).
      this.#instance.update(propsFromAttributes(this, true));
    }
    get checked(): boolean {
      return this.#instance?.control?.checked ?? this.hasAttribute('checked');
    }
  }
  registry.define(name, SJSwitchElement);
}
