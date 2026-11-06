// SJField for Vue (W1-C02.c, ADR-014): a visible label, an optional hint and an error around one
// control (SJInput), linked by the ids `<id>-label`, `<id>-hint` and `<id>-error` (ADR-003).
//   - `aria-describedby` and `aria-invalid` are DERIVED by core `createField`, never typed here.
//   - The error is visible text, announced once through the shared live registry AFTER mount
//     (ADR-006). The error element carries no `role` or `aria-live`, so SSR output has no live
//     markup and a standing error at mount is silent. Region timing comes from `fieldLive`.
//   - label and hint are prop-or-slot; the slot wins (ADR-004).
//   - The error part holds an `aria-hidden` SJIcon (circle-alert, the `alert-circle` alias) at size
//     `sm` in the field's `icon` part, so colour is never the only cue (WCAG 1.4.1, 3.3.1).
import {
  defineComponent,
  h,
  inject,
  nextTick,
  normalizeClass,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  provide,
  useId,
  watch,
  type PropType,
  type VNodeChild,
} from 'vue';
import { baseId } from '@ramoslabs/core/ids';
import { createField } from '@ramoslabs/core/field';
import { SJIcon } from '../icon/index';
import { useSJContext } from '../runtime/index';
import { SJ_FIELD, SJ_FORM } from '../form/context';
import { circleAlert } from '../generated/icons/circle-alert';
import { fieldLive } from '../generated/field/index';

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJFieldClasses {
  root?: string;
  label?: string;
  hint?: string;
  error?: string;
  icon?: string;
}

const text = (v: string | undefined) => (v === undefined || v.trim() === '' ? undefined : v);

export const SJField = defineComponent({
  name: 'SJField',
  inheritAttrs: false,
  props: {
    id: { type: String, default: undefined },
    name: { type: String, default: undefined },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /** Forces the control to reference the hint. A `hint` prop or slot sets it by itself. */
    hasHint: { type: Boolean, default: false },
    error: { type: String, default: undefined },
    errorMessage: { type: Boolean, default: false },
    /** Visible label; the `label` slot wins. */
    label: { type: String, default: undefined },
    /** Help text; the `hint` slot wins. */
    hint: { type: String, default: undefined },
    classes: { type: Object as PropType<SJFieldClasses>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    const sj = useSJContext();
    const form = inject(SJ_FORM, undefined);
    const field = createField(
      () => ({
        id: props.id,
        name: props.name,
        required: props.required,
        disabled: props.disabled,
        hasHint: props.hasHint || text(props.hint) !== undefined || slots.hint !== undefined,
        error: props.error,
        errorMessage: props.errorMessage,
      }),
      {
        id: baseId(props.id, () => useId() ?? '', `${sj.runtime.idPrefix}sj-field-`),
        form: form?.owner,
        live: sj.live,
      },
    );
    provide(SJ_FIELD, field);

    // Children mount first (SJInput reports its kind), then this registers with the form owner.
    let off: (() => void) | undefined;
    let root: HTMLElement | null = null;
    let at: number | undefined;
    // DOM position among the form's controls (`form.elements`), so Enter order follows the page.
    const position = () => {
      const control = root?.querySelector('input,textarea,select');
      const f = root?.closest('form');
      const i = control && f ? Array.prototype.indexOf.call(f.elements, control) : -1;
      return i < 0 ? undefined : i;
    };
    const reconnect = () => {
      off?.();
      at = position();
      off = field.connect(at);
    };
    let alive = true;
    const say = () => void (alive && field.announce());
    onMounted(() => {
      if (fieldLive === 'eager') sj.requireLive?.();
      at = position();
      off = field.connect(at);
      // The provider attaches its live host in its own `onMounted`, after its children's.
      void nextTick(say);
      // The 3.3.7 key is the name (or id): a change re-registers under the new key.
      watch(() => props.name ?? field.ids.control, reconnect);
    });
    onUpdated(() => {
      say();
      if (off && position() !== at) reconnect();
    });
    onBeforeUnmount(() => {
      alive = false;
      off?.();
      off = undefined;
    });

    return () => {
      const { class: attrClass, ...rest } = attrs as Record<string, unknown>;
      const c = props.classes ?? {};
      const cls = (...v: unknown[]) => normalizeClass(v) || undefined;
      const label = (slots.label?.() ?? text(props.label)) as VNodeChild;
      const hint = (slots.hint?.() ?? text(props.hint)) as VNodeChild;
      const error = (props.error ?? '').trim();
      return h(
        'div',
        {
          ...field.getRootProps({ ...rest, class: cls(attrClass, c.root) }),
          ref: (el: unknown) => void (root = el as HTMLElement | null),
        },
        [
          label !== undefined
            ? h('label', field.getLabelProps({ class: c.label }), label as string)
            : null,
          slots.default?.(),
          hint !== undefined
            ? h('div', field.getHintProps({ class: c.hint }), hint as string)
            : null,
          error
            ? h('div', field.getErrorProps({ class: c.error }), [
                h(
                  'span',
                  {
                    class: cls('sj-field__icon', c.icon),
                    'data-part': 'icon',
                    'aria-hidden': 'true',
                  },
                  h(SJIcon, { icon: circleAlert, size: 'sm' }),
                ),
                error,
              ])
            : null,
        ],
      );
    };
  },
});
