// The Vue reactivity bridge (ADR-003 bridge row): a `shallowRef` holding the store snapshot,
// replaced only when a dispatch changed it; `markRaw` on snapshots; the store subscription owned
// by an effect scope; effects drained in a post-flush watcher and only after mount.
import {
  effectScope,
  getCurrentInstance,
  getCurrentScope,
  markRaw,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  onUpdated,
  shallowRef,
  watch,
  type EffectScope,
  type ShallowRef,
} from 'vue';
import { createStore, type Reducer, type Store } from '@ramoslabs/core/store';
import {
  correctiveVersion,
  createEffectQueue,
  type DrainHost,
  type EffectInput,
  type EffectQueue,
} from '@ramoslabs/core/effects';
import { createControlled, type Bag, type ControlledConfig } from '@ramoslabs/core/controlled';

export interface SJStoreOptions<S extends object, E, X extends EffectInput, P extends Bag> {
  readonly initial: S;
  readonly reduce: Reducer<S, E, X>;
  /** Executes effects; called only after mount, post-commit (native open, focus, geometry, announce). */
  readonly host: DrainHost<X>;
  /** Stable accessor over the latest props. With `fields`, enables the controlled pipeline. */
  readonly props?: () => P;
  readonly fields?: ControlledConfig<S, E, P>['fields'];
  /** Store factory seam (tests count live listeners through it). Default: core `createStore`. */
  readonly makeStore?: typeof createStore;
}

export interface SJStore<S extends object, E> {
  readonly store: Store<S, E>;
  /** Reactive snapshot; the ref value changes identity only when a dispatch changed the state. */
  readonly snapshot: Readonly<ShallowRef<S>>;
  /** Snapshot with controlled props overlaid (equals the snapshot when uncontrolled). Tracks `snapshot`. */
  view(): S;
  dispatch(event: E): void;
  request<K extends keyof S & string>(field: K, next: S[K]): boolean;
  native<K extends keyof S & string>(field: K, actual: S[K]): boolean;
  /** Post-commit: reconcile controlled state, then drain layout and passive effects. After mount only. */
  commit(): void;
  readonly scope: EffectScope;
  readonly queue: EffectQueue<EffectInput>;
}

const raw = <T extends object>(v: T): T => (Object.isExtensible(v) ? markRaw(v) : v);

export function useSJStore<S extends object, E, X extends EffectInput, P extends Bag = Bag>(
  options: SJStoreOptions<S, E, X, P>,
): SJStore<S, E> {
  const queue = createEffectQueue<X>();
  const tick = shallowRef(0);
  let version = 0;
  const store = (options.makeStore ?? createStore)<S, E, X>(
    options.initial,
    options.reduce,
    (effects, v) => {
      version = v;
      queue.enqueue(effects, v);
      tick.value++;
    },
  );
  const snapshot = shallowRef(raw(store.getSnapshot())) as ShallowRef<S>;
  const controlled =
    options.props && options.fields
      ? createControlled<S, E, P>({ store, getProps: options.props, fields: options.fields })
      : undefined;

  let mounted = false;
  const commit = () => {
    if (!mounted) return;
    const corrective = controlled?.reconcile();
    if (corrective && corrective.length)
      queue.enqueue(corrective as unknown as X[], correctiveVersion(version));
    queue.drain(options.host, 'layout');
    queue.drain(options.host, 'passive');
  };

  // Attached to the component's scope when there is one, so unmount stops it; stopping tears down
  // the subscription, the post watcher, the store and the queue.
  const scope = effectScope();
  scope.run(() => {
    onScopeDispose(
      store.subscribe(() => {
        snapshot.value = raw(store.getSnapshot());
      }),
    );
    onScopeDispose(() => {
      mounted = false;
      store.destroy();
      queue.clear();
    });
    watch(() => [snapshot.value, tick.value], commit, { flush: 'post' });
  });

  if (getCurrentInstance()) {
    onMounted(() => {
      mounted = true;
      controlled?.mount();
      commit();
    });
    onUpdated(commit);
    onBeforeUnmount(() => scope.stop());
  } else if (getCurrentScope()) {
    onScopeDispose(() => scope.stop());
  }

  return {
    store,
    snapshot,
    view: () => (snapshot.value, controlled ? controlled.view() : store.getSnapshot()),
    dispatch: (event) => void store.dispatch(event),
    request: (f, n) => (controlled ? controlled.request(f, n) : false),
    native: (f, a) => (controlled ? controlled.native(f, a) : false),
    commit,
    scope,
    queue: queue as unknown as EffectQueue<EffectInput>,
  };
}
