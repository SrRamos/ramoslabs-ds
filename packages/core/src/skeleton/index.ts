// SJSkeleton core (ADR-003, ADR-006 "Live regions"). Pure getters over props plus a timing controller; no DOM.
//   createSkeleton(getProps)  getRootProps / getLineProps(consumer?) => Props; lineCount(); getAnnouncement()
//   createSkeletonTiming(o)   delay + minimum-duration controller over an injected scheduler
// Shapes (text, circle, rect, block) are hidden from assistive tech. The `group` shape is the container: it
// carries `aria-busy` while loading, and its placeholder is laid out at once (it reserves the space, so the
// swap shifts nothing) but stays invisible until `delay` has passed. Nothing here renders live markup.
import { mergeProps } from '../merge/index';
import type { Props } from '../merge/index';

declare const console: { warn(message: string): void };
declare const process: { env: { NODE_ENV?: string } } | undefined;

export type SkeletonShape = 'group' | 'text' | 'circle' | 'rect' | 'block';
export type SkeletonRatio = '1/1' | '4/3' | '3/2' | '16/9' | '21/9';
export type SkeletonSize = 'sm' | 'md' | 'lg' | 'xl';
export type SkeletonAnimation = 'shimmer' | 'none';
/** idle: showing the content. pending: loading, placeholder laid out but invisible (inside the delay).
 *  visible: placeholder shown. holding: loading is over but the minimum duration has not elapsed. */
export type SkeletonPhase = 'idle' | 'pending' | 'visible' | 'holding';

export interface SkeletonProps {
  readonly shape?: SkeletonShape;
  readonly lines?: number;
  readonly ratio?: SkeletonRatio;
  readonly size?: SkeletonSize;
  readonly animation?: SkeletonAnimation;
  readonly announce?: string;
  /** Group only: the current timing phase (from `createSkeletonTiming`). Defaults to pending. */
  readonly phase?: SkeletonPhase;
}

export interface SkeletonAnnouncement {
  readonly text: string;
  readonly urgent: false;
}

export interface Skeleton {
  readonly getRootProps: (consumer?: Props) => Props;
  readonly getLineProps: (consumer?: Props) => Props;
  /** Number of line parts to render: 1..12 for the text shape, 0 for every other shape. */
  readonly lineCount: () => number;
  readonly getAnnouncement: () => SkeletonAnnouncement | undefined;
}

/** Fallbacks when the CSS tokens cannot be read (server, tests). Kept equal to motion.skeleton.* by a test. */
export const SKELETON_DELAY_MS = 300;
export const SKELETON_MIN_DURATION_MS = 500;

/** Parse a CSS duration (`300ms`, `0.3s`) into milliseconds; anything else gives `fallback`. */
export function parseDuration(raw: string | undefined | null, fallback: number): number {
  const m = /^\s*(\d*\.?\d+)\s*(ms|s)\s*$/.exec(raw ?? '');
  return m ? Math.round(parseFloat(m[1]!) * (m[2] === 's' ? 1000 : 1)) : fallback;
}

const SHAPES = /^(group|text|circle|rect)$/;
const shapeOf = (v: unknown): SkeletonShape =>
  SHAPES.test(v as string) ? (v as SkeletonShape) : 'block';
const ratioOf = (v: unknown): SkeletonRatio =>
  /^(1\/1|4\/3|3\/2|21\/9)$/.test(v as string) ? (v as SkeletonRatio) : '16/9';
const sizeOf = (v: unknown): SkeletonSize =>
  /^(sm|lg|xl)$/.test(v as string) ? (v as SkeletonSize) : 'md';
const linesOf = (v: unknown): number =>
  Math.min(12, Math.max(1, Math.round(typeof v === 'number' && v === v ? v : 3)));

export function createSkeleton(getProps: () => SkeletonProps): Skeleton {
  const w = (bad: unknown, m: string) =>
    bad &&
    (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') &&
    console.warn(`[ramoslabs] SJSkeleton ${m}`);

  return {
    getRootProps(consumer = {}) {
      const p = getProps();
      const shape = shapeOf(p.shape);
      w(p.shape !== undefined && shape !== p.shape, `unknown shape "${p.shape}"`);
      w(
        ['role', 'aria-live', 'aria-atomic'].some((k) => k in consumer),
        'live markup belongs to the live registry, not the root',
      );
      const phase = p.phase ?? 'pending';
      const own: Props = {
        'data-part': 'root',
        'data-shape': shape,
        'data-animation': p.animation === 'none' ? 'none' : 'shimmer',
        'data-lines': shape === 'text' ? linesOf(p.lines) : undefined,
        'data-ratio': shape === 'rect' ? ratioOf(p.ratio) : undefined,
        'data-size': shape === 'circle' ? sizeOf(p.size) : undefined,
        // The group is the busy region; a shape is decoration that assistive tech never meets.
        'data-state': shape === 'group' ? phase : undefined,
        'aria-busy': shape === 'group' && phase !== 'idle' ? 'true' : undefined,
        'aria-hidden': shape === 'group' ? undefined : 'true',
        role: undefined,
        'aria-live': undefined,
        'aria-atomic': undefined,
      };
      return mergeProps(consumer, { class: 'sj-skeleton', ...own }, { protect: Object.keys(own) });
    },
    getLineProps(consumer = {}) {
      const own: Props = { 'data-part': 'line' };
      return mergeProps(
        consumer,
        { class: 'sj-skeleton__line', ...own },
        { protect: ['data-part'] },
      );
    },
    lineCount: () => (shapeOf(getProps().shape) === 'text' ? linesOf(getProps().lines) : 0),
    getAnnouncement() {
      const p = getProps();
      const text = `${p.announce ?? ''}`.trim();
      const shown = p.phase === 'visible' || p.phase === 'holding';
      return shapeOf(p.shape) === 'group' && shown && text ? { text, urgent: false } : undefined;
    },
  };
}

export interface SkeletonTimingOptions {
  /** `runtime.scheduler.after`: returns a cancel function. The server scheduler never fires. */
  readonly after: (fn: () => void, ms: number) => () => void;
  /** Milliseconds before the placeholder becomes visible. */
  readonly delay: number;
  /** Milliseconds the placeholder stays visible once shown. */
  readonly minDuration: number;
  readonly onPhase: (phase: SkeletonPhase) => void;
}

export interface SkeletonTiming {
  readonly phase: () => SkeletonPhase;
  /** Report whether the content is loading; idempotent. */
  readonly set: (loading: boolean) => void;
  /** Change the delay and minimum duration for the next cycle. */
  readonly configure: (delay: number, minDuration: number) => void;
  /** Cancel every timer; the phase is left as it is. */
  readonly destroy: () => void;
}

/**
 * Delay and minimum-duration state machine. A load that ends inside `delay` goes pending -> idle and the
 * placeholder is never visible (no flash). Once visible it is kept for `minDuration`: a load that ends
 * earlier goes visible -> holding -> idle when the minimum elapses. Loading again while holding resumes visible.
 */
export function createSkeletonTiming(o: SkeletonTimingOptions): SkeletonTiming {
  let phase: SkeletonPhase = 'idle';
  let delay = o.delay;
  let minDuration = o.minDuration;
  let wantsDone = false;
  let minElapsed = false;
  let cancelDelay: (() => void) | undefined;
  let cancelMin: (() => void) | undefined;
  const go = (next: SkeletonPhase) => {
    if (next !== phase) o.onPhase((phase = next));
  };
  const reveal = () => {
    cancelDelay = undefined;
    minElapsed = false;
    cancelMin = o.after(() => {
      cancelMin = undefined;
      minElapsed = true;
      if (wantsDone) go('idle');
    }, minDuration);
    go('visible');
  };
  return {
    phase: () => phase,
    configure(d, m) {
      delay = d;
      minDuration = m;
    },
    set(loading) {
      if (loading) {
        wantsDone = false;
        if (phase === 'holding') go('visible');
        else if (phase === 'idle') {
          go('pending');
          if (delay <= 0) reveal();
          else cancelDelay = o.after(reveal, delay);
        }
      } else if (phase === 'pending') {
        cancelDelay?.();
        cancelDelay = undefined;
        go('idle');
      } else if (phase === 'visible') {
        wantsDone = true;
        if (minElapsed) go('idle');
        else go('holding');
      }
    },
    destroy() {
      cancelDelay?.();
      cancelMin?.();
      cancelDelay = cancelMin = undefined;
    },
  };
}
