// The shared React bridge (W1-120, ADR-003 bridge row). One hook every React component uses:
// store + controlled pipeline + effect queue per instance, snapshot via useSyncExternalStore,
// stable callback identities, no DOM access in render, effects drained after commit.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { createStore, type Reducer, type Store } from '@ramoslabs/core/store';
import {
  createEffectQueue,
  type Effect,
  type EffectInput,
  type EffectQueue,
} from '@ramoslabs/core/effects';
import {
  createControlled,
  type Bag,
  type Controlled,
  type ControlledConfig,
} from '@ramoslabs/core/controlled';
import type { SJRuntime } from '@ramoslabs/core/runtime';
import type { AnnounceOptions } from '@ramoslabs/core/live';
import { useRuntimeBag } from './provider';

/** Effect emitted by reducers to speak through the shared live region. */
export interface AnnounceEffect extends EffectInput {
  readonly type: 'announce';
  readonly text: string;
  readonly urgent?: boolean;
  readonly activeDescendant?: boolean;
}

export interface MachineOptions<S extends object, E, X extends EffectInput, P extends Bag> {
  /** Called once per instance, lazily and purely (StrictMode may call it twice; one is discarded). */
  initial: () => S;
  reduce: Reducer<S, E, X | AnnounceEffect>;
  /** The component's latest props. Controlled fields are read from here. */
  props: P;
  fields: ControlledConfig<S, E, P>['fields'];
  /** Executes a non-announce effect (native open, focus, geometry). Runs post-commit in a layout effect. */
  run?: (effect: Effect<X>, runtime: SJRuntime) => void;
  /** True when the effect target is in the committed DOM. */
  exists?: (target: string) => boolean;
}

export interface Machine<S extends object, E> {
  /** State with controlled props overlaid; same reference while nothing changed. */
  readonly state: S;
  readonly runtime: SJRuntime;
  /** All stable across renders for the lifetime of the instance. */
  readonly dispatch: (event: E) => void;
  readonly request: Controlled<S>['request'];
  readonly native: Controlled<S>['native'];
  readonly announce: (text: string, options?: AnnounceOptions) => boolean;
}

interface Instance<S extends object, E, X extends EffectInput> {
  store: Store<S, E>;
  queue: EffectQueue<X | AnnounceEffect>;
  controlled: Controlled<S>;
  version: number;
  scoped: Bag | undefined;
  committed: Bag;
}

export function useMachine<S extends object, E, X extends EffectInput, P extends Bag>(
  options: MachineOptions<S, E, X, P>,
): Machine<S, E> {
  const { runtime, live } = useRuntimeBag();
  const opts = useRef(options);

  const inst = useMemoOnce<Instance<S, E, X>>(() => {
    const queue = createEffectQueue<X | AnnounceEffect>();
    const i = {
      queue,
      version: 0,
      scoped: undefined as Bag | undefined,
      committed: options.props as Bag,
    } as Instance<S, E, X>;
    i.store = createStore<S, E, X | AnnounceEffect>(options.initial(), options.reduce, (fx, v) => {
      i.version = v;
      queue.enqueue(fx, v);
    });
    i.controlled = createControlled<S, E, P>({
      store: i.store,
      getProps: () => (i.scoped ?? i.committed) as P,
      fields: options.fields,
    });
    return i;
  });

  const state = useSyncExternalStore(
    inst.store.subscribe,
    inst.store.getSnapshot,
    inst.store.getServerSnapshot,
  );
  // Overlay controlled props for THIS render's props; reads inside view() see them, nothing escapes.
  inst.scoped = options.props;
  let view: S;
  try {
    view = inst.controlled.view();
  } finally {
    inst.scoped = undefined;
  }
  void state; // subscribed above; the overlaid view is derived from the same snapshot

  const first = useRef(true);
  // Post-commit, children first. Commits props, locks ownership once, reconciles, then drains.
  useLayoutEffect(() => {
    opts.current = options;
    inst.committed = options.props;
    if (first.current) {
      first.current = false;
      inst.controlled.mount();
    }
    const corrective = inst.controlled.reconcile();
    if (corrective.length)
      inst.queue.enqueue(corrective as unknown as readonly X[], inst.version + 0.5);
    inst.queue.drain(
      {
        ...(opts.current.exists && { exists: (t: string) => opts.current.exists!(t) }),
        run(e) {
          opts.current.run?.(e as Effect<X>, runtime);
        },
      },
      'layout',
    );
  });

  useEffect(() => {
    inst.queue.drain(
      {
        run(e) {
          const a = e as Effect<AnnounceEffect>;
          live.announce(a.text, {
            ...(a.urgent !== undefined && { urgent: a.urgent }),
            ...(a.activeDescendant !== undefined && { activeDescendant: a.activeDescendant }),
          });
        },
      },
      'passive',
    );
  });

  // Pending work is dropped on unmount; the store needs no teardown beyond React's unsubscribe
  // (destroying here would break StrictMode's simulated unmount, which keeps the instance).
  useEffect(
    () => () => {
      inst.queue.clear();
    },
    [inst],
  );

  const dispatch = useCallback((event: E) => void inst.store.dispatch(event), [inst]);
  const request = useCallback<Controlled<S>['request']>(
    (f, n) => inst.controlled.request(f, n),
    [inst],
  );
  const native = useCallback<Controlled<S>['native']>(
    (f, a) => inst.controlled.native(f, a),
    [inst],
  );
  const announce = useCallback((t: string, o?: AnnounceOptions) => live.announce(t, o), [live]);

  return useMemo(
    () => ({ state: view, runtime, dispatch, request, native, announce }),
    [view, runtime, dispatch, request, native, announce],
  );
}

/** Lazy per-instance value; the factory must be pure (StrictMode may run it twice and keep one). */
function useMemoOnce<T>(factory: () => T): T {
  const ref = useRef<T | null>(null);
  ref.current ??= factory();
  return ref.current;
}
