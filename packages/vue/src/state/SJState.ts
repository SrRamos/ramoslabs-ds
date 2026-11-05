// SJState for Vue (W1-C11.c): a flat, stateless component over core `createState`. There is no
// store: the only runtime work is the announcement, handed to the shared live registry AFTER mount
// (ADR-006). The render function never emits `role`/`aria-live`, so SSR output has no live markup.
//   - Polite `status` for loading, no-results and counts; `alert` only for an error with `interrupt`.
//   - Region timing comes from the generated `stateLive` (eager), never a literal.
//   - heading / description / icon / actions are prop-or-slot; the slot wins (ADR-004).
import {
  defineComponent,
  h,
  nextTick,
  Comment,
  Fragment,
  isVNode,
  normalizeClass,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  Text,
  watch,
  type PropType,
  type VNodeChild,
} from 'vue';
import { createState, type StateVariant } from '@ramoslabs/core/state';
import { stateLive } from '../generated/state/index';
import { useSJContext } from '../runtime/index';

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJStateClasses {
  root?: string;
  icon?: string;
  title?: string;
  description?: string;
  actions?: string;
}

/** True when a slot result has something to show: comments, empty text and empty fragments do not count. */
const filled = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.some(filled);
  if (isVNode(v)) {
    if (v.type === Comment) return false;
    if (v.type === Text) return v.children !== '';
    if (v.type === Fragment) return filled(v.children);
    return true;
  }
  return v !== undefined && v !== null && v !== '' && v !== false;
};

export const SJState = defineComponent({
  name: 'SJState',
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<StateVariant>, default: undefined },
    /** Heading copy (not `title`: that is a global tooltip attribute). The `title` slot wins. */
    heading: { type: String, default: undefined },
    /** Supporting copy. The default slot wins. */
    description: { type: String, default: undefined },
    /** Text for the live registry; defaults to `heading` for loading, no-results and error. */
    announce: { type: String, default: undefined },
    /** Only an error may interrupt (`role="alert"`). */
    interrupt: { type: Boolean, default: false },
    classes: { type: Object as PropType<SJStateClasses>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    const ctx = useSJContext();
    // A `title` slot has no prop value: its rendered text is read back after render so the
    // announcement matches the other adapters (a string slot announces like `heading`).
    let slotHeading: string | undefined;
    let titleEl: HTMLElement | null = null;
    const state = createState(() => ({
      variant: props.variant,
      heading: props.heading ?? slotHeading,
      description: props.description,
      announce: props.announce,
      interrupt: props.interrupt,
    }));

    let alive = true;
    const say = () => {
      const a = state.getAnnouncement();
      if (alive && a) ctx.live.announce(a.text, { urgent: a.urgent });
    };
    onMounted(() => {
      if (stateLive === 'eager') ctx.requireLive?.();
      // The provider attaches its host in its own `onMounted`, after its children's: wait one tick.
      void nextTick(say);
      watch(
        () => {
          const a = state.getAnnouncement();
          return a ? `${a.urgent ? '!' : ''}${a.text}` : '';
        },
        say,
        { flush: 'post' },
      );
    });
    const readSlot = () => {
      const next = props.heading === undefined && titleEl ? titleEl.textContent?.trim() : undefined;
      if (next !== slotHeading) {
        slotHeading = next || undefined;
        say();
      }
    };
    onMounted(() => void nextTick(readSlot));
    onUpdated(readSlot);
    onBeforeUnmount(() => void (alive = false));

    return () => {
      const { class: attrClass, ...rest } = attrs as Record<string, unknown>;
      const c = props.classes ?? {};
      const cls = (...v: unknown[]) => normalizeClass(v) || undefined;
      const icon = slots.icon?.() as VNodeChild;
      const title = (slots.title?.() ?? props.heading) as VNodeChild;
      const body = (slots.default?.() ?? props.description) as VNodeChild;
      const actions = slots.actions?.() as VNodeChild;
      const has = filled;
      return h('div', state.getRootProps({ ...rest, class: cls(attrClass, c.root) }), [
        has(icon) ? h('span', state.getIconProps({ class: c.icon }), icon as string) : null,
        has(title)
          ? h(
              'p',
              {
                ...state.getTitleProps({ class: c.title }),
                ref: (e: unknown) => void (titleEl = e as HTMLElement | null),
              },
              title as string,
            )
          : null,
        has(body)
          ? h('p', state.getDescriptionProps({ class: c.description }), body as string)
          : null,
        has(actions)
          ? h('div', state.getActionsProps({ class: c.actions }), actions as string)
          : null,
      ]);
    };
  },
});
