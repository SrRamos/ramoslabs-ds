// SJCheckbox vanilla adapter (W1-C03c.e, ADR-002 light DOM + text nodes only, ADR-014 no FACE).
// `mountCheckbox` builds root <label> > <input type=checkbox> + indicator + label text and wires the core getters
// through the vanilla runtime. `define()` registers the optional `sj-checkbox` element; nothing runs at import.
//
// FACE is deliberately NOT used (ADR-014: "only where a custom control needs native form participation"):
// the real <input type=checkbox name value> lives in the element's light DOM, so it is a form-associated
// descendant of the surrounding <form> and submits exactly like a bare checkbox. `attachInternals()` would
// add a second source of form state for no gain.
//
// Pointer handling: none. Activation is native (click on the <label>, Space on the input); this adapter
// registers no pointer/touch listener, so no part needs a `touch-action` declaration (ADR-011 Rules).
import {
  createCheckboxParts,
  initialSnapshot,
  storeReducer,
  checkboxFields,
  type CheckboxAction,
  type CheckboxProps,
  type CheckboxSnapshot,
} from '@ramoslabs/core/checkbox';
import {
  setText,
  type ComponentSpec,
  type Instance,
  type InstanceContext,
  type VanillaHost,
} from '../runtime/index';

/** Vanilla props: the core props plus a plain-text `label` (rendered as a text node, never markup). */
export type VanillaCheckboxProps = CheckboxProps & { readonly label?: string };

type Ctx = InstanceContext<CheckboxSnapshot, CheckboxAction, VanillaCheckboxProps>;
type Applied = Set<string>;

/** Write a getter's Props onto an element. Event handlers (`on*`) are wired separately. */
function applyProps(el: Element, props: Record<string, unknown>, prev: Applied): void {
  const next: Applied = new Set();
  for (const [key, value] of Object.entries(props)) {
    if (/^on[A-Z]/.test(key)) continue;
    const attr = key === 'class' ? 'class' : key;
    // `checked` and `indeterminate` are DOM properties, never attributes (a bare input has no
    // `indeterminate` attribute, and `checked` as an attribute is the reset default). `patch` writes them.
    if (key === 'checked' || key === 'indeterminate') continue;
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

function createSpec(
  kick: () => void,
): ComponentSpec<CheckboxSnapshot, CheckboxAction, VanillaCheckboxProps, never> {
  let input: HTMLInputElement | undefined;
  let indicator: HTMLElement | undefined;
  let text: HTMLElement | undefined;
  let parts: ReturnType<typeof createCheckboxParts> | undefined;
  const seen = {
    root: new Set<string>(),
    control: new Set<string>(),
    indicator: new Set<string>(),
    label: new Set<string>(),
  };

  const build = (ctx: Ctx) => {
    const doc = ctx.el.ownerDocument;
    input = doc.createElement('input');
    indicator = doc.createElement('span');
    text = doc.createElement('span');
    ctx.el.append(input, indicator, text);
    ctx.onCleanup(() => {
      input?.remove();
      indicator?.remove();
      text?.remove();
      input = indicator = text = undefined;
    });
    parts = createCheckboxParts({
      view: ctx.view,
      native: ctx.native,
      getProps: ctx.props,
      id: ctx.id,
    });
  };

  return {
    initial: (p) =>
      initialSnapshot(
        p.checked ?? p.defaultChecked ?? false,
        p.indeterminate ?? p.defaultIndeterminate ?? false,
      ),
    reduce: storeReducer,
    fields: checkboxFields,
    patch(view, ctx) {
      if (!parts) {
        build(ctx);
        // The `checked` ATTRIBUTE (`defaultChecked`) is the initial value only, exactly like a bare input
        // and like the SSR markup: it is what `form.reset()` restores. The live state is the property.
        input!.defaultChecked = view.checked;
      }
      // The live `checked` state is the property (the native input flipped it already on a click).
      input!.checked = view.checked;
      applyProps(ctx.el, parts!.getRootProps(), seen.root);
      applyProps(input!, parts!.getControlProps(), seen.control);
      // `indeterminate` has no attribute: set the property on mount and on every patch.
      input!.indeterminate = view.indeterminate;
      applyProps(indicator!, parts!.getIndicatorProps(), seen.indicator);
      applyProps(text!, parts!.getLabelProps(), seen.label);
      setText(text!, ctx.props().label ?? '');
    },
    attach(ctx) {
      const { onChange } = parts!.getControlProps();
      ctx.listen(input!, 'change', (e) => {
        // A controlled owner that rejects the change is re-synced by the runtime (PR #64).
        (onChange as (e: Event) => void)(e);
      });
      // `form.reset()` restores the input to its default silently (no `change`), so the model would keep
      // the last state. `reset` bubbles to the document, which also covers a label mounted before it is
      // placed in a form. The reset itself runs after dispatch, hence the task.
      ctx.listen(ctx.el.ownerDocument, 'reset', (e) => {
        if (!input || e.target !== input.form) return;
        setTimeout(() => {
          if (ctx.signal.aborted || !input) return;
          // Reset restores `checked` to the default; per HTML it leaves `indeterminate` alone. Read both
          // first: a dispatch re-patches synchronously and would overwrite the other property.
          const v = ctx.view();
          const { checked, indeterminate } = input;
          if (checked === v.checked && indeterminate === v.indeterminate) return;
          if (checked !== v.checked) ctx.native('checked', checked);
          if (indeterminate !== v.indeterminate) ctx.native('indeterminate', indeterminate);
          kick();
        }, 0);
      });
    },
    run(effect) {
      // `checked` / `indeterminate` on `control`: put the native input back to the committed value.
      if (!input) return;
      if (effect.type === 'checked') input.checked = effect.value === true;
      else if (effect.type === 'indeterminate') input.indeterminate = effect.value === true;
    },
    exists: (target) => target !== 'control' || input !== undefined,
  };
}

export interface CheckboxInstance extends Instance<VanillaCheckboxProps> {
  readonly control: HTMLInputElement | undefined;
}

/** Mount an SJCheckbox onto `el` (use a `<label>`; the element becomes the root part). */
export function mountCheckbox(
  host: VanillaHost,
  el: Element,
  props: VanillaCheckboxProps = {},
): CheckboxInstance {
  let latest = props;
  let mounted: Instance<VanillaCheckboxProps> | undefined;
  const spec = createSpec(() => mounted?.update(latest));
  const instance = (mounted = host.mount(el, spec, props));
  const control = el.querySelector('input') ?? undefined;
  const update = instance.update.bind(instance);
  instance.update = (next) => {
    latest = next;
    update(next);
  };
  return Object.assign(instance, {
    get control() {
      return instance.destroyed ? undefined : control;
    },
  }) as CheckboxInstance;
}

const ATTRS = ['checked', 'indeterminate', 'disabled', 'name', 'value', 'label', 'id'] as const;

function propsFromAttributes(el: Element, live: boolean): VanillaCheckboxProps {
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
    // `checked` / `indeterminate` attributes are the initial (uncontrolled) state, read once at connect.
    ...(!live && {
      defaultChecked: el.hasAttribute('checked'),
      defaultIndeterminate: el.hasAttribute('indeterminate'),
    }),
  };
}

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-checkbox>` (light DOM, no shadow root, no FACE). Explicit and idempotent: call it from app code;
 * the module never registers at import. `host` must be created from a client-target runtime.
 */
export function define(
  host: VanillaHost,
  name = 'sj-checkbox',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJCheckboxElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #label: HTMLElement | undefined;
    #instance: CheckboxInstance | undefined;
    connectedCallback(): void {
      if (this.#instance) return;
      const props = propsFromAttributes(this, false);
      const doc = this.ownerDocument;
      const label = doc.createElement('label');
      this.#label = label;
      this.append(label);
      this.#instance = mountCheckbox(host, label, props);
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#label?.remove();
      this.#instance = this.#label = undefined;
    }
    attributeChangedCallback(): void {
      if (!this.#instance) return;
      // Re-read; `checked` / `indeterminate` stay the initial state (use the native input to change it).
      this.#instance.update(propsFromAttributes(this, true));
    }
    get checked(): boolean {
      return this.#instance?.control?.checked ?? this.hasAttribute('checked');
    }
    get indeterminate(): boolean {
      return this.#instance?.control?.indeterminate ?? this.hasAttribute('indeterminate');
    }
  }
  registry.define(name, SJCheckboxElement);
}
