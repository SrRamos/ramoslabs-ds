// SJButton for Vue (W1-C01.c). The golden Vue adapter layout: later components copy it.
//   - One flat component (ADR-002): the contract has a single interactive part plus a decorative
//     icon, so there is no compound set and therefore no separate preset.
//   - Thin (ADR-004): every attribute and handler comes from the core getters; the adapter picks
//     the element, injects `onPress` (a Vue `press` emit), and renders. No store (see C01-NOTES.md).
//   - `classes` adds per-part classes (ADR-004); `class` and every other attribute go to the root
//     as consumer props, so `mergeProps` keeps its precedence rules.
import { defineComponent, h, normalizeClass, type PropType, type SlotsType } from 'vue';
import { createButton, type ButtonPressPayload } from '@ramoslabs/core/button';
import type { SJButtonProps, SJButtonSlots } from '../generated/button/types';

export interface SJButtonClasses {
  readonly root?: string;
  readonly link?: string;
  readonly icon?: string;
}

export const SJButton = defineComponent({
  name: 'SJButton',
  inheritAttrs: false,
  props: {
    variant: String as PropType<SJButtonProps['variant']>,
    tone: String as PropType<SJButtonProps['tone']>,
    size: String as PropType<SJButtonProps['size']>,
    disabled: { type: Boolean, default: false },
    type: String as PropType<SJButtonProps['type']>,
    href: String,
    target: String,
    rel: String,
    iconOnly: { type: Boolean, default: false },
    label: String,
    id: String,
    classes: Object as PropType<SJButtonClasses>,
  },
  emits: {
    press: (payload: ButtonPressPayload) => payload !== undefined,
  },
  slots: {} as SlotsType<{ [K in keyof SJButtonSlots]: () => unknown }>,
  setup(props, { attrs, slots, emit }) {
    // `props` is Vue's live reactive object, so the accessor always sees the newest values,
    // including when the click fires (ADR-003). Stateless: nothing to subscribe or destroy.
    const button = createButton(() => ({
      ...props,
      onPress: (payload) => emit('press', payload),
    }));

    return () => {
      const isLink = button.element() === 'a';
      const part = isLink ? 'link' : 'root';
      const extra = props.classes?.[part];
      const consumer = extra ? { ...attrs, class: normalizeClass([attrs.class, extra]) } : attrs;
      const bag = isLink ? button.getLinkProps(consumer) : button.getRootProps(consumer);

      // Flat children (no null placeholders, no fragments): SSR output stays minimal.
      const children: unknown[] = [];
      const icon = slots.icon?.();
      if (icon) {
        const iconProps = props.classes?.icon ? { class: props.classes.icon } : {};
        children.push(h('span', button.getIconProps(iconProps), icon as never));
      }
      const content = slots.default?.() ?? (props.iconOnly ? undefined : props.label);
      if (content !== undefined) children.push(...(Array.isArray(content) ? content : [content]));
      return h(isLink ? 'a' : 'button', bag, children as never);
    };
  },
});
