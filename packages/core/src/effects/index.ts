// Versioned effect descriptors and the post-commit drain queue (ADR-003 "State, events, effects").
// Reducers emit descriptors; nothing executes until an adapter drains after the committed DOM.

/** What a reducer emits. `target` is an element/anchor key (a raw id); omit for targetless effects. */
export interface EffectInput {
  readonly type: string;
  readonly target?: string;
}

/** A queued descriptor: the reducer's input stamped with the dispatch version (store `onEffects`). */
export type Effect<T extends EffectInput = EffectInput> = T & { readonly version: number };

/** Layout phase runs in `useLayoutEffect` / post-flush; passive phase in `useEffect` (announcements). */
export type Phase = 'layout' | 'passive';

export interface DrainHost<T extends EffectInput = EffectInput> {
  /** True when the target is in the committed DOM. Omitted: every target exists. */
  exists?(target: string): boolean;
  /** Execute one effect. Must not dispatch synchronously; call `enqueue`/schedule instead. */
  run(effect: Effect<T>): void;
}

/** Default run order inside one drain: native open/close precede dependent focus (ADR-003). */
export const EFFECT_ORDER: readonly string[] = ['open', 'close', 'geometry', 'focus', 'announce'];
const PASSIVE = new Set(['announce']);

export interface EffectQueue<T extends EffectInput = EffectInput> {
  /** Stamp and append descriptors. During a drain they wait for the next drain. */
  enqueue(effects: readonly T[], version: number): void;
  /**
   * The single drain hook. Takes the batch, drops stale (superseded by a newer effect of the
   * same type and target) and missing-target effects, runs the rest in `EFFECT_ORDER`
   * (stable otherwise). Re-entrant calls are no-ops. Returns the number executed.
   */
  drain(host: DrainHost<T>, phase?: Phase): number;
  /** Drop everything (destroy). */
  clear(): void;
  readonly size: number;
  readonly draining: boolean;
}

export function createEffectQueue<T extends EffectInput = EffectInput>(
  order: readonly string[] = EFFECT_ORDER,
): EffectQueue<T> {
  let pending: Effect<T>[] = [];
  let draining = false;
  const rank = (type: string) => {
    const i = order.indexOf(type);
    return i < 0 ? order.length : i;
  };
  const key = (e: Effect<T>) => `${e.type}\0${e.target ?? ''}`;

  return {
    enqueue(effects, version) {
      for (const e of effects) pending.push({ ...e, version });
    },
    drain(host, phase = 'layout') {
      if (draining) return 0;
      const mine = (e: Effect<T>) => PASSIVE.has(e.type) === (phase === 'passive');
      const batch = pending.filter(mine);
      pending = pending.filter((e) => !mine(e));
      const latest = new Map<string, number>();
      for (const e of batch) latest.set(key(e), Math.max(latest.get(key(e)) ?? 0, e.version));
      const live = batch
        .map((e, i) => [e, i] as const)
        .filter(
          ([e]) =>
            e.version === latest.get(key(e)) &&
            (e.target === undefined || !host.exists || host.exists(e.target)),
        )
        .sort(([a, i], [b, j]) => rank(a.type) - rank(b.type) || i - j);
      draining = true;
      try {
        for (const [e] of live) host.run(e);
      } finally {
        draining = false;
      }
      return live.length;
    },
    clear() {
      pending = [];
    },
    get size() {
      return pending.length;
    },
    get draining() {
      return draining;
    },
  };
}
