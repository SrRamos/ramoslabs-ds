// SJInput for Vue (W1-C02.c, ADR-007, ADR-014): the text control. SJInput OWNS `kind`: core
// `createInput` resolves it into type, inputmode, autocomplete, enterkeyhint, autocapitalize,
// autocorrect and spellcheck (never maxlength, `type=number` only for quantity), and the element
// is a `<textarea>` for `address`.
//   - Inside an SJField the field supplies id, name, required, disabled, aria-describedby and
//     aria-invalid, and the Enter position comes from the form owner through the field.
//   - `:user-invalid` fallback: below the native floor (`runtime.supports.userInvalid` false or no
//     provider) a user change or an `invalid` event sets `data-touched`; the owning form's `reset`
//     event clears it. Native support makes the handlers inert.
//   - Attributes other than class/style (value, placeholder, onInput, ...) go to the control.
import {
  defineComponent,
  h,
  inject,
  normalizeClass,
  onBeforeUnmount,
  onMounted,
  watch,
  type PropType,
} from 'vue';
import { createInput, storeReducer, type InputSnapshot } from '@ramoslabs/core/input';
import { useOptionalSJRuntime, useSJStore } from '../runtime/index';
import { SJ_FIELD, SJ_FORM } from '../form/context';
import type { SJInputProps } from '../generated/input/index';

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJInputClasses {
  root?: string;
  control?: string;
}

export const SJInput = defineComponent({
  name: 'SJInput',
  inheritAttrs: false,
  props: {
    kind: { type: String as PropType<SJInputProps['kind']>, default: undefined },
    variant: { type: String as PropType<SJInputProps['variant']>, default: undefined },
    autocomplete: { type: String, default: undefined },
    section: { type: String, default: undefined },
    meaningful: { type: Boolean, default: false },
    digits: { type: Boolean, default: undefined },
    uppercase: { type: Boolean, default: false },
    autoSubmit: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    name: { type: String, default: undefined },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    classes: { type: Object as PropType<SJInputClasses>, default: undefined },
  },
  setup(props, { attrs }) {
    const field = inject(SJ_FIELD, undefined);
    const form = inject(SJ_FORM, undefined);
    const runtime = useOptionalSJRuntime();
    const input = createInput(
      () => ({
        kind: props.kind,
        variant: props.variant,
        autocomplete: props.autocomplete,
        section: props.section,
        meaningful: props.meaningful,
        digits: props.digits,
        uppercase: props.uppercase,
        autoSubmit: props.autoSubmit,
        id: props.id,
        name: props.name,
        required: props.required,
        disabled: props.disabled,
      }),
      { field, userInvalid: runtime?.supports.userInvalid },
    );
    // The input already holds its store; the bridge subscribes and destroys it on unmount.
    const sj = useSJStore<InputSnapshot, never, never>({
      initial: input.store.getSnapshot(),
      reduce: storeReducer as never,
      host: { run() {} },
      makeStore: (() => input.store) as never,
    });

    let control: HTMLElement | null = null;
    let offKind: (() => void) | undefined;
    const abort = new AbortController();
    onMounted(() => {
      // Children mount before the field: the kind is recorded before `field.connect()`.
      offKind = input.connect();
      watch(
        () => props.kind,
        () => {
          offKind?.();
          offKind = input.connect();
        },
      );
      // `reset` does not fire a change event: the owning form clears the touched fallback.
      control?.closest('form')?.addEventListener('reset', () => input.reset(), {
        signal: abort.signal,
      });
    });
    onBeforeUnmount(() => {
      abort.abort();
      offKind?.();
      offKind = undefined;
    });

    return () => {
      // Tracked reads: the input's own touched state and the form's registrations (Enter hint).
      void sj.snapshot.value;
      void form?.snapshot.value;
      const { class: attrClass, style: attrStyle, ...rest } = attrs as Record<string, unknown>;
      const c = props.classes ?? {};
      const cls = (...v: unknown[]) => normalizeClass(v) || undefined;
      return h(
        'span',
        input.getRootProps({ class: cls(attrClass, c.root), style: attrStyle }),
        h(input.tag(), {
          ...input.getControlProps({ ...rest, class: c.control }),
          ref: (el: unknown) => void (control = el as HTMLElement | null),
        }),
      );
    };
  },
});
