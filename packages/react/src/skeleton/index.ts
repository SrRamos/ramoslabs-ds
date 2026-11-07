// SJSkeleton for React: a placeholder shape (text, circle, rect, block) or, with `shape="group"`, the container that
// owns the loading timing. Thin over core `createSkeleton` / `createSkeletonTiming`.
//   - Shapes are aria-hidden decoration. The group carries `aria-busy` while loading and renders the `skeleton` prop
//     while loading, then `children` (the loaded content) once the minimum duration has elapsed.
//   - The placeholder is rendered (and reserves its space) from the first render but is invisible until `delay` has
//     passed; a load that ends sooner never shows it. The server render is the pending phase and starts no timer.
//   - delay / minDuration default to the --motion-skeleton-* CSS tokens, read from the root after mount.
//   - The single announcement goes to the shared live registry from a passive effect, one scheduler tick later and
//     cancelled by its cleanup, so StrictMode's simulated remount yields exactly one message (same as SJState). The
//     region timing comes from the generated `skeletonLive`. No live markup is ever rendered.
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from 'react';
import {
  createSkeleton,
  createSkeletonTiming,
  parseDuration,
  SKELETON_DELAY_MS,
  SKELETON_MIN_DURATION_MS,
  type SkeletonPhase,
  type SkeletonTiming,
} from '@ramoslabs/core/skeleton';
import type { Props } from '@ramoslabs/core/merge';
import { skeletonLive } from '../generated/skeleton/index';
import type { SJSkeletonProps as GeneratedProps } from '../generated/skeleton/index';
import { useRuntimeBag } from '../runtime/index';

export type { SJSkeletonProps as SJSkeletonContractProps } from '../generated/skeleton/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJSkeletonClasses {
  root?: string;
  line?: string;
}

export interface SJSkeletonRootProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children'>, GeneratedProps {
  classes?: SJSkeletonClasses;
  /** Slot (group): the loaded content, rendered once loading is over and the minimum duration has elapsed. */
  children?: ReactNode;
  /** Slot (group): the placeholder shapes that mirror the final layout, rendered while loading. */
  skeleton?: ReactNode;
}
export type SJSkeletonProps = SJSkeletonRootProps;

const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const { class: cls, ...rest } = p as { class?: string } & Record<string, unknown>;
  const className = [cls, extra].filter(Boolean).join(' ');
  return className ? { ...rest, className } : rest;
};

export const SJSkeleton: ForwardRefExoticComponent<
  SJSkeletonRootProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, SJSkeletonRootProps>(function SJSkeleton(props, ref) {
  const {
    shape,
    lines,
    ratio,
    size,
    loading = true,
    delay,
    minDuration,
    announce,
    animation,
    classes,
    children,
    skeleton,
    className,
    ...rest
  } = props;
  const group = shape === 'group';
  const [phase, setPhase] = useState<SkeletonPhase>(group && loading ? 'pending' : 'idle');
  const shown = group ? phase : 'idle';
  const model = createSkeleton(() => ({
    ...(shape !== undefined && { shape }),
    ...(lines !== undefined && { lines }),
    ...(ratio !== undefined && { ratio }),
    ...(size !== undefined && { size }),
    ...(animation !== undefined && { animation }),
    ...(announce !== undefined && { announce }),
    phase: shown,
  }));

  const { runtime, live, requireLive } = useRuntimeBag();
  const rootEl = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      rootEl.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  useLayoutEffect(() => {
    if (group && skeletonLive === 'eager') requireLive?.();
  }, [group, requireLive]);

  // Delay and minimum duration: props win, then the motion.skeleton tokens, then the core fallbacks.
  const timing = useRef<SkeletonTiming | undefined>(undefined);
  const loadingNow = useRef(loading);
  loadingNow.current = loading;
  const { scheduler } = runtime;
  useEffect(() => {
    if (!group) return;
    const css = rootEl.current ? getComputedStyle(rootEl.current) : undefined;
    const t = createSkeletonTiming({
      after: scheduler.after,
      delay:
        delay ?? parseDuration(css?.getPropertyValue('--motion-skeleton-delay'), SKELETON_DELAY_MS),
      minDuration:
        minDuration ??
        parseDuration(
          css?.getPropertyValue('--motion-skeleton-min-duration'),
          SKELETON_MIN_DURATION_MS,
        ),
      onPhase: setPhase,
    });
    timing.current = t;
    t.set(loadingNow.current);
    return () => {
      t.destroy();
      timing.current = undefined;
    };
  }, [group, delay, minDuration, scheduler]);
  useEffect(() => {
    timing.current?.set(loading);
  }, [loading]);

  // One announcement per change, after commit and client only; the pending call is cancelled by the cleanup.
  const note = model.getAnnouncement();
  const text = note?.text ?? '';
  useEffect(() => {
    if (!text) return;
    return scheduler.after(() => void live.announce(text, { urgent: false }), 0);
  }, [text, live, scheduler]);

  const own = {
    ...rest,
    ...(classes?.root || className
      ? { className: [classes?.root, className].filter(Boolean).join(' ') }
      : {}),
  };
  const rootProps = { ...fromGetter(model.getRootProps(toGetter(own))), ref: setRef };
  if (group) return createElement('div', rootProps, shown === 'idle' ? children : skeleton);
  return createElement(
    'div',
    rootProps,
    Array.from({ length: model.lineCount() }, (_, i) =>
      createElement('div', { key: i, ...fromGetter(model.getLineProps(), classes?.line) }),
    ),
  );
});
