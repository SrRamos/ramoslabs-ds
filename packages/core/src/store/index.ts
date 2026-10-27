// Per-instance snapshot store (ADR-003). No module-scope state: every call owns its closure.

/** What a reducer returns: the next state plus effect descriptors (never executed here). */
export interface Reduction<S, X> {
  readonly state: S;
  readonly effects?: readonly X[];
}

export type Reducer<S, E, X> = (state: S, event: E) => Reduction<S, X>;
export type Listener = () => void;

export interface Store<S, E> {
  /** Stable: the same reference until a dispatch changes the state. */
  getSnapshot(): S;
  /** The initial state, forever (SSR / hydration snapshot). */
  getServerSnapshot(): S;
  /** Deduped by listener identity; the returned function is idempotent. */
  subscribe(listener: Listener): () => void;
  /** Returns the current snapshot; the same reference when nothing changed. */
  dispatch(event: E): S;
  /** Idempotent. Drops every listener; later dispatches are ignored. */
  destroy(): void;
}

/**
 * `onEffects` receives the descriptors of every non-no-op dispatch together with a
 * per-store version that grows by one per such dispatch (stamp for stale-effect dropping).
 */
export function createStore<S, E, X = never>(
  initial: S,
  reduce: Reducer<S, E, X>,
  onEffects?: (effects: readonly X[], version: number) => void,
): Store<S, E> {
  let state = initial;
  let version = 0;
  let live = true;
  const listeners = new Set<Listener>();

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(listener) {
      if (live) listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispatch(event) {
      if (!live) return state;
      const { state: next, effects } = reduce(state, event);
      const changed = !Object.is(next, state);
      const fx = effects && effects.length ? effects : undefined;
      if (!changed && !fx) return state;
      state = next;
      version++;
      if (fx && onEffects) onEffects(fx, version);
      if (changed) for (const l of [...listeners]) if (listeners.has(l)) l();
      return state;
    },
    destroy() {
      live = false;
      listeners.clear();
    },
  };
}
