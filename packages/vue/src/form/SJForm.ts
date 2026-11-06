// SJForm for Vue (W1-C02.c, ADR-014): context plumbing on a native `<form>`. It owns exactly two
// things, the Enter position (`enterkeyhint` from field order) and the values retained for WCAG
// 3.3.7; it adds no handlers, no `novalidate` and no validation or submission logic.
// The owner's store goes through the shared runtime bridge (`useSJStore`, ADR-003) so a field
// registering after mount re-renders the inputs that read their Enter hint.
import { defineComponent, h, normalizeClass, provide, type PropType } from 'vue';
import { createForm, type FormField, type FormSnapshot } from '@ramoslabs/core/form';
import { useSJStore } from '../runtime/index';
import { SJ_FORM } from './context';

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJFormClasses {
  root?: string;
}

export const SJForm = defineComponent({
  name: 'SJForm',
  inheritAttrs: false,
  props: {
    /** Optional ordered field list (data first, SSR safe). */
    fields: { type: Array as PropType<readonly FormField[]>, default: undefined },
    /** Enter label of the last editable field. (A native `action` attribute reaches the `<form>`.) */
    enter: { type: String as PropType<'go' | 'send' | 'search'>, default: undefined },
    submits: { type: Boolean, default: true },
    autoSubmit: { type: Boolean, default: false },
    classes: { type: Object as PropType<SJFormClasses>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    const owner = createForm(() => ({
      fields: props.fields,
      enter: props.enter,
      submits: props.submits,
      autoSubmit: props.autoSubmit,
    }));
    // The owner already holds its store; the bridge only subscribes, and destroys it on unmount.
    const sj = useSJStore<FormSnapshot, never, never>({
      initial: owner.store.getSnapshot(),
      reduce: (state) => ({ state }),
      host: { run() {} },
      makeStore: (() => owner.store) as never,
    });
    provide(SJ_FORM, { owner, snapshot: sj.snapshot });

    return () => {
      const { class: attrClass, ...rest } = attrs as Record<string, unknown>;
      const root = props.classes?.root;
      return h(
        'form',
        owner.getRootProps({ ...rest, class: normalizeClass([attrClass, root]) || undefined }),
        slots.default?.(),
      );
    };
  },
});
