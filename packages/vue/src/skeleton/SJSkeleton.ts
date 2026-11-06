// SJSkeleton for Vue: a placeholder shape (text, circle, rect, block) or, with `shape="group"`, the container
// that owns the loading timing. Thin over core `createSkeleton` / `createSkeletonTiming`.
//   - Shapes are aria-hidden decoration. The group carries `aria-busy` while loading and swaps the `skeleton`
//     slot for the default slot (the loaded content) once the minimum duration has elapsed.
//   - The placeholder is rendered (and reserves its space) from the first render but is invisible until `delay`
//     has passed; a load that ends sooner never shows it. The server render is the pending phase and starts no timer.
//   - delay / minDuration default to the --motion-skeleton-* CSS tokens, read from the root after mount.
//   - The one announcement goes to the shared live registry after mount, when the placeholder becomes visible
//     (region timing from the generated `skeletonLive`, never a literal). No live markup is ever rendered.
import {
  defineComponent,
  h,
  nextTick,
  normalizeClass,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue';
import {
  createSkeleton,
  createSkeletonTiming,
  parseDuration,
  SKELETON_DELAY_MS,
  SKELETON_MIN_DURATION_MS,
  type SkeletonAnimation,
  type SkeletonPhase,
  type SkeletonRatio,
  type SkeletonShape,
  type SkeletonSize,
  type SkeletonTiming,
} from '@ramoslabs/core/skeleton';
import { skeletonLive } from '../generated/skeleton/index';
import { useSJContext } from '../runtime/index';

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJSkeletonClasses {
  root?: string;
  line?: string;
}

export const SJSkeleton = defineComponent({
  name: 'SJSkeleton',
  inheritAttrs: false,
  props: {
    shape: { type: String as PropType<SkeletonShape>, default: undefined },
    lines: { type: Number, default: undefined },
    ratio: { type: String as PropType<SkeletonRatio>, default: undefined },
    size: { type: String as PropType<SkeletonSize>, default: undefined },
    loading: { type: Boolean, default: true },
    delay: { type: Number, default: undefined },
    minDuration: { type: Number, default: undefined },
    announce: { type: String, default: undefined },
    animation: { type: String as PropType<SkeletonAnimation>, default: undefined },
    classes: { type: Object as PropType<SJSkeletonClasses>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    const ctx = useSJContext();
    const isGroup = () => props.shape === 'group';
    const phase = ref<SkeletonPhase>(isGroup() && props.loading ? 'pending' : 'idle');
    const model = createSkeleton(() => ({
      shape: props.shape,
      lines: props.lines,
      ratio: props.ratio,
      size: props.size,
      animation: props.animation,
      announce: props.announce,
      phase: phase.value,
    }));

    let root: HTMLElement | null = null;
    let timing: SkeletonTiming | undefined;
    let alive = true;
    // Props win; otherwise the motion.skeleton tokens (read from the cascade); otherwise the core fallbacks.
    const durations = (): [number, number] => {
      const css = root ? getComputedStyle(root) : undefined;
      return [
        props.delay ??
          parseDuration(css?.getPropertyValue('--motion-skeleton-delay'), SKELETON_DELAY_MS),
        props.minDuration ??
          parseDuration(
            css?.getPropertyValue('--motion-skeleton-min-duration'),
            SKELETON_MIN_DURATION_MS,
          ),
      ];
    };
    const say = () => {
      const a = model.getAnnouncement();
      if (alive && a) ctx.live.announce(a.text, { urgent: a.urgent });
    };
    onMounted(() => {
      if (!isGroup()) return;
      if (skeletonLive === 'eager') ctx.requireLive?.();
      const [delay, minDuration] = durations();
      timing = createSkeletonTiming({
        after: ctx.runtime.scheduler.after,
        delay,
        minDuration,
        onPhase: (p) => void (phase.value = p),
      });
      timing.set(props.loading);
      watch(
        () => props.loading,
        (v) => timing?.set(v),
      );
      watch(
        () => [props.delay, props.minDuration],
        () => {
          const [d, m] = durations();
          timing?.configure(d, m);
        },
      );
      watch(
        () => {
          const a = model.getAnnouncement();
          return a ? a.text : '';
        },
        () => void nextTick(say),
        { flush: 'post' },
      );
    });
    onBeforeUnmount(() => {
      alive = false;
      timing?.destroy();
    });

    return () => {
      const { class: attrClass, ...rest } = attrs as Record<string, unknown>;
      const c = props.classes ?? {};
      const cls = (...v: unknown[]) => normalizeClass(v) || undefined;
      const rootProps = {
        ...model.getRootProps({ ...rest, class: cls(attrClass, c.root) }),
        ref: (e: unknown) => void (root = e as HTMLElement | null),
      };
      if (isGroup())
        return h('div', rootProps, phase.value === 'idle' ? slots.default?.() : slots.skeleton?.());
      return h(
        'div',
        rootProps,
        Array.from({ length: model.lineCount() }, () =>
          h('div', model.getLineProps({ class: c.line })),
        ),
      );
    };
  },
});
