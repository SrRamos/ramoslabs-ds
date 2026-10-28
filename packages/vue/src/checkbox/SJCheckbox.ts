// SJCheckbox for Vue (C03c.c): a flat component over core `createCheckboxParts`. The control is a
// real `<input type="checkbox">` inside a wrapping `<label>`; no FACE and no mirror input
// (ADR-014), so form state is the bare input's. Store, controlled pipeline and effect drain come
// from the shared runtime (`useSJStore`), never a local bridge (ADR-003). `indeterminate` has no
// attribute: it is a DOM property written after mount and after every change.
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  useId,
  type PropType,
  type VNodeChild,
} from 'vue';
import {
  checkboxBaseId,
  checkboxFields,
  createCheckboxParts,
  initialSnapshot,
  storeReducer,
  type CheckboxAction,
  type CheckboxProps,
} from '@ramoslabs/core/checkbox';
import type { DrainHost, EffectInput } from '@ramoslabs/core/effects';
import { useSJStore } from '../runtime/index';
import type {
  SJCheckboxCheckedChangePayload,
  SJCheckboxIndeterminateChangePayload,
} from '../generated/checkbox/index';

type CorrectiveX = EffectInput & { readonly value?: unknown };

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJCheckboxClasses {
  root?: string;
  control?: string;
  indicator?: string;
  label?: string;
}

export const SJCheckbox = defineComponent({
  name: 'SJCheckbox',
  inheritAttrs: false,
  props: {
    /** Present = controlled (use `v-model:checked`). Absent = uncontrolled. */
    checked: { type: Boolean, default: undefined },
    defaultChecked: { type: Boolean, default: false },
    /** Present = controlled (use `v-model:indeterminate`). Absent = uncontrolled. */
    indeterminate: { type: Boolean, default: undefined },
    defaultIndeterminate: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    value: { type: String, default: undefined },
    id: { type: String, default: undefined },
    /** Visible label; the default slot wins when both are given. */
    label: { type: String, default: undefined },
    classes: { type: Object as PropType<SJCheckboxClasses>, default: undefined },
  },
  emits: {
    'update:checked': (checked: boolean) => typeof checked === 'boolean',
    'update:indeterminate': (indeterminate: boolean) => typeof indeterminate === 'boolean',
    checkedChange: (payload: SJCheckboxCheckedChangePayload) =>
      typeof payload.checked === 'boolean',
    indeterminateChange: (payload: SJCheckboxIndeterminateChangePayload) =>
      typeof payload.indeterminate === 'boolean',
  },
  setup(props, { attrs, emit, slots }) {
    let control: HTMLInputElement | null = null;
    // Effects are the corrective `checked` / `indeterminate` writes onto the input (controlled rejection).
    const host: DrainHost<CorrectiveX> = {
      run(effect) {
        if (!control) return;
        if (effect.type === 'checked') control.checked = effect.value === true;
        else if (effect.type === 'indeterminate') control.indeterminate = effect.value === true;
      },
    };
    const getProps = (): CheckboxProps => ({
      checked: props.checked,
      defaultChecked: props.defaultChecked,
      indeterminate: props.indeterminate,
      defaultIndeterminate: props.defaultIndeterminate,
      disabled: props.disabled,
      name: props.name,
      value: props.value,
      id: props.id,
      onCheckedChange: (checked: boolean) => {
        emit('update:checked', checked);
        emit('checkedChange', { checked });
      },
      onIndeterminateChange: (indeterminate: boolean) => {
        emit('update:indeterminate', indeterminate);
        emit('indeterminateChange', { indeterminate });
      },
    });
    const sj = useSJStore<
      ReturnType<typeof initialSnapshot>,
      CheckboxAction,
      CorrectiveX,
      CheckboxProps
    >({
      initial: initialSnapshot(
        props.checked ?? props.defaultChecked,
        props.indeterminate ?? props.defaultIndeterminate,
      ),
      reduce: storeReducer,
      host,
      props: getProps,
      fields: checkboxFields,
    });
    const parts = createCheckboxParts({
      view: sj.view,
      native: sj.native,
      getProps,
      id: checkboxBaseId(props.id, () => useId() ?? '', 'sj-checkbox-'),
    });

    // Vue mirrors a patched `checked` into the HTML attribute, which would make `form.reset()`
    // restore the latest state instead of the default. So the vnode carries only the INITIAL value
    // (the default; also what SSR emits) and the live state is written to the properties directly.
    // `indeterminate` is never a vnode prop: it is written here after mount and on every update.
    const initialChecked = sj.view().checked;
    const syncProps = () => {
      if (!control) return;
      const v = sj.view();
      if (control.checked !== v.checked) control.checked = v.checked;
      if (control.indeterminate !== v.indeterminate) control.indeterminate = v.indeterminate;
    };
    // A native `form.reset()` changes `checked` without a change event (and leaves `indeterminate`
    // alone, like a bare input); re-sync the model after it.
    const abort = new AbortController();
    onMounted(() => {
      control?.form?.addEventListener(
        'reset',
        () =>
          setTimeout(() => {
            if (!control) return;
            const indeterminate = control.indeterminate;
            if (control.checked !== sj.view().checked) sj.native('checked', control.checked);
            // `toggle` leaves the mixed positions; restore the flag the DOM still carries.
            if (indeterminate !== sj.view().indeterminate)
              sj.native('indeterminate', indeterminate);
            syncProps();
          }, 0),
        { signal: abort.signal },
      );
    });
    onBeforeUnmount(() => abort.abort());

    return () => {
      const {
        class: attrClass,
        style: attrStyle,
        ...inputAttrs
      } = attrs as Record<string, unknown>;
      const classes = props.classes ?? {};
      const cls = (...c: unknown[]) => c.filter(Boolean).join(' ') || undefined;
      const labelNode = (slots.default?.() ?? props.label) as VNodeChild;
      const hasLabel = slots.default !== undefined || props.label !== undefined;
      const {
        checked: _checked,
        indeterminate: _indeterminate,
        ...controlProps
      } = parts.getControlProps({ ...inputAttrs, class: classes.control }) as Record<
        string,
        unknown
      >;
      void _checked;
      void _indeterminate;
      return h(
        'label',
        parts.getRootProps({ class: cls(classes.root, attrClass), style: attrStyle }),
        [
          h('input', {
            ...controlProps,
            checked: initialChecked,
            ref: (el: unknown) => void (control = el as HTMLInputElement | null),
            onVnodeMounted: syncProps,
            onVnodeUpdated: syncProps,
          }),
          h('span', parts.getIndicatorProps({ class: classes.indicator })),
          hasLabel
            ? h('span', parts.getLabelProps({ class: classes.label }), labelNode as string)
            : null,
        ],
      );
    };
  },
});
