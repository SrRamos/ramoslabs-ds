// SJSwitch for Vue (C03s.c): a flat component over core `createSwitchParts`. The control is a real
// `<input type="checkbox" role="switch">` inside a wrapping `<label>`; there is no FACE and no
// mirror input (ADR-014), so form state is the bare input's. Store, controlled pipeline and effect
// drain come from the shared runtime (`useSJStore`), never a local bridge (ADR-003).
import {
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  useId,
  type PropType,
  type VNodeChild,
} from 'vue';
import {
  createSwitchParts,
  initialSnapshot,
  storeReducer,
  switchBaseId,
  switchFields,
  type SwitchProps,
} from '@ramoslabs/core/switch';
import type { DrainHost, EffectInput } from '@ramoslabs/core/effects';
import { useSJStore } from '../runtime/index';
import type { SJSwitchCheckedChangePayload } from '../generated/switch/index';

type CorrectiveX = EffectInput & { readonly value?: unknown };

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJSwitchClasses {
  root?: string;
  control?: string;
  thumb?: string;
  label?: string;
}

export const SJSwitch = defineComponent({
  name: 'SJSwitch',
  inheritAttrs: false,
  props: {
    /** Present = controlled (use `v-model:checked`). Absent = uncontrolled. */
    checked: { type: Boolean, default: undefined },
    defaultChecked: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    value: { type: String, default: undefined },
    id: { type: String, default: undefined },
    /** Visible label; the default slot wins when both are given. */
    label: { type: String, default: undefined },
    classes: { type: Object as PropType<SJSwitchClasses>, default: undefined },
  },
  emits: {
    'update:checked': (checked: boolean) => typeof checked === 'boolean',
    checkedChange: (payload: SJSwitchCheckedChangePayload) => typeof payload.checked === 'boolean',
  },
  setup(props, { attrs, emit, slots }) {
    let control: HTMLInputElement | null = null;
    // The only effect is the corrective `checked` write onto the input (controlled rejection).
    const host: DrainHost<CorrectiveX> = {
      run(effect) {
        if (effect.type === 'checked' && control) control.checked = effect.value === true;
      },
    };
    const getProps = (): SwitchProps => ({
      checked: props.checked,
      defaultChecked: props.defaultChecked,
      disabled: props.disabled,
      name: props.name,
      value: props.value,
      id: props.id,
      onCheckedChange: (checked: boolean) => {
        emit('update:checked', checked);
        emit('checkedChange', { checked });
      },
    });
    const sj = useSJStore<
      ReturnType<typeof initialSnapshot>,
      { type: 'toggle' },
      CorrectiveX,
      SwitchProps
    >({
      initial: initialSnapshot(props.checked ?? props.defaultChecked),
      reduce: storeReducer,
      host,
      props: getProps,
      fields: switchFields,
    });
    const native = (field: 'checked', actual: boolean) => {
      const dispatched = sj.native(field, actual);
      // A controlled owner that rejects the change never re-renders; reconcile after it had its turn.
      void nextTick(sj.commit);
      return dispatched;
    };
    const parts = createSwitchParts({
      view: sj.view,
      native,
      getProps,
      id: switchBaseId(props.id, () => useId() ?? '', 'sj-switch-'),
    });

    // Vue mirrors a patched `checked` into the HTML attribute, which would make `form.reset()`
    // restore the latest state instead of the default. So the vnode carries only the INITIAL value
    // (the default; also what SSR emits) and the live state is written to the property directly.
    const initialChecked = sj.view().checked;
    const syncChecked = () => {
      const want = sj.view().checked;
      if (control && control.checked !== want) control.checked = want;
    };
    // A native `form.reset()` changes the input without a change event; re-sync the model after it.
    const abort = new AbortController();
    onMounted(() => {
      control?.form?.addEventListener(
        'reset',
        () =>
          setTimeout(() => {
            if (control && control.checked !== sj.view().checked)
              native('checked', control.checked);
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
      return h(
        'label',
        parts.getRootProps({ class: cls(classes.root, attrClass), style: attrStyle }),
        [
          h('input', {
            ...parts.getControlProps({ ...inputAttrs, class: classes.control }),
            checked: initialChecked,
            ref: (el: unknown) => void (control = el as HTMLInputElement | null),
            onVnodeMounted: syncChecked,
            onVnodeUpdated: syncChecked,
          }),
          h('span', parts.getThumbProps({ class: classes.thumb })),
          hasLabel
            ? h('span', { class: cls('sj-switch__label', classes.label) }, labelNode as string)
            : null,
        ],
      );
    };
  },
});
