// Probe wrapper for @ramoslabs/vue (W1-316). Uses the shared bridge (useSJStore) only.
import { defineComponent, h, type PropType } from 'vue';
import { useSJStore } from '@ramoslabs/vue/runtime';
import { probeFields, rootAttrs, storeReducer, type ProbeSnapshot } from '../reducer';

export const SJProbe = defineComponent({
  name: 'SJProbe',
  props: {
    // `default: undefined` keeps an absent boolean uncontrolled (Vue casts it to false otherwise).
    pressed: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    defaultPressed: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: { pressedChange: (pressed: boolean) => typeof pressed === 'boolean' },
  setup(props, { emit, slots }) {
    const s = useSJStore<ProbeSnapshot, { type: 'toggle' }, never>({
      initial: { pressed: props.defaultPressed },
      reduce: storeReducer,
      host: { run: () => undefined },
      props: () => ({
        pressed: props.pressed,
        onPressedChange: (v: boolean) => emit('pressedChange', v),
      }),
      fields: probeFields,
    });
    return () => {
      const view = s.view();
      const { class: className, ...attrs } = rootAttrs(view, props.disabled);
      return h(
        'button',
        { ...attrs, class: className, onClick: () => void s.request('pressed', !view.pressed) },
        [h('span', { class: 'sj-probe__indicator', 'data-part': 'indicator' }), slots.default?.()],
      );
    };
  },
});
