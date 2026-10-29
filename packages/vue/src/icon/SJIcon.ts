// SJIcon for Vue (W1-C12.c, ADR-016). Stateless flat component, copied from the SJButton layout.
//   - Renders an inline <svg> by created elements (`h`), never `innerHTML`/`v-html` (ADR-002 text
//     safety); the node allowlist lives in core `getNodes()`.
//   - `dir` is read from the runtime only for a mirrored icon without a `dir` prop, through
//     `useOptionalSJRuntime`: outside an SJProvider it yields null. Non-mirrored icons and icons with
//     a `dir` prop never warn (G-ICON SHOULD-2); a mirrored icon with neither cannot know its
//     direction, so it renders `ltr` and warns once per instance in development.
//   - No ids, no store, no listeners: SSR output is a pure function of the props.
import { defineComponent, h, normalizeClass, type PropType } from 'vue';
import { createIcon, type IconData } from '@ramoslabs/core/icon';
import type { SJIconProps } from '../generated/icon/types';
import { useOptionalSJRuntime } from '../runtime/context';

declare const console: { warn(message: string): void };
declare const process: { env: { NODE_ENV?: string } } | undefined;

export interface SJIconClasses {
  readonly root?: string;
}

export const SJIcon = defineComponent({
  name: 'SJIcon',
  inheritAttrs: false,
  props: {
    icon: Object as PropType<IconData>,
    size: String as PropType<SJIconProps['size']>,
    label: String,
    dir: String as PropType<SJIconProps['dir']>,
    classes: Object as PropType<SJIconClasses>,
  },
  setup(props, { attrs }) {
    const runtime = useOptionalSJRuntime();
    const icon = createIcon(() => ({
      icon: props.icon,
      size: props.size,
      label: props.label,
      dir: props.dir ?? (props.icon?.mirror ? runtime?.dir : undefined),
    }));

    let warned = false;
    return () => {
      if (
        !warned &&
        props.icon?.mirror &&
        props.dir === undefined &&
        !runtime &&
        (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
      ) {
        warned = true;
        console.warn('[ramoslabs] SJIcon mirrored icon outside SJProvider: rendering ltr');
      }
      const extra = props.classes?.root;
      const consumer = extra ? { ...attrs, class: normalizeClass([attrs.class, extra]) } : attrs;
      return h(
        'svg',
        icon.getRootProps(consumer),
        icon.getNodes().map(([tag, a]) => h(tag, a)),
      );
    };
  },
});
