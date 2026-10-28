// Vanilla runtime (W1-122, ADR-003 "Reactivity bridge", ADR-002 text nodes only, light DOM).
// The only vanilla module allowed to touch the core store (lint: store-via-runtime).
// Nothing here runs at import time; browser APIs are touched only after `mount`.
import {
  createControlled,
  type Bag,
  type Controlled,
  type ControlledConfig,
  type CorrectiveEffect,
} from '@ramoslabs/core/controlled';
import {
  correctiveVersion,
  createEffectQueue,
  type Effect,
  type EffectInput,
  type EffectQueue,
} from '@ramoslabs/core/effects';
import { baseId, itemId, partId } from '@ramoslabs/core/ids';
import {
  HIDDEN_STYLE,
  createLiveRegistry,
  type LiveHost,
  type LiveNode,
  type LiveRegistry,
  type LiveRole,
} from '@ramoslabs/core/live';
import type { SJRuntime } from '@ramoslabs/core/runtime';
import { createStore, type Reducer, type Store } from '@ramoslabs/core/store';

export type { Bag, CorrectiveEffect, Effect, EffectInput, LiveHost, SJRuntime };

/** Everything the adapter hands to a component's `patch`/`attach`/`run`. Valid until `destroy`. */
export interface InstanceContext<S extends object, E, P extends Bag> {
  readonly el: Element;
  /** The instance AbortController signal: pass it to every listener/observer. */
  readonly signal: AbortSignal;
  readonly runtime: SJRuntime;
  /** One live-region registry per runtime, shared by every instance of the host. */
  readonly live: LiveRegistry;
  /** Base id (explicit `props.id`, else `idPrefix` + the injected `idFactory`). */
  readonly id: string;
  part(name: string): string;
  item(key: string | number): string;
  props(): P;
  /** State with controlled props overlaid. */
  view(): S;
  /** Reducer dispatch. Throws in development when called from inside an effect (ADR-003). */
  dispatch(event: E): void;
  /** Controlled/uncontrolled pipeline (K1b). */
  request: Controlled<S>['request'];
  native: Controlled<S>['native'];
  /** `addEventListener` with the instance signal always attached. */
  listen<K extends string>(
    target: EventTarget,
    type: K,
    handler: (event: Event) => void,
    options?: Omit<AddEventListenerOptions, 'signal'>,
  ): void;
  /** Runs on destroy, newest first, after the signal aborts. */
  onCleanup(fn: () => void): void;
}

export interface ComponentSpec<S extends object, E, P extends Bag, X extends EffectInput> {
  initial(props: P): S;
  reduce: Reducer<S, E, X>;
  fields?: ControlledConfig<S, E, P>['fields'];
  /** Write the DOM from the view (text nodes only). Runs after mount and after every change. */
  patch(view: S, ctx: InstanceContext<S, E, P>): void;
  /** Add listeners (through `ctx.listen`). Runs once, after the first patch and `mount()`. */
  attach?(ctx: InstanceContext<S, E, P>): void;
  /** Execute one effect after the patch. Must not dispatch synchronously. */
  run?(effect: Effect<X | CorrectiveEffect>, ctx: InstanceContext<S, E, P>): void;
  /** True when the effect target is in the DOM. Omitted: every target exists. */
  exists?(target: string, ctx: InstanceContext<S, E, P>): boolean;
}

export interface Instance<P extends Bag> {
  /** Replace the props. Patches synchronously; effects drain in a microtask. */
  update(props: P): void;
  /** Idempotent. Aborts every listener, destroys the store, clears the queue. */
  destroy(): void;
  readonly destroyed: boolean;
}

export interface HostOptions {
  /** Injected id source (W1-114 relies on it); wins over `runtime.idFactory`. */
  idFactory?: () => string;
  /** Overrides how live-region nodes are created; default appends hidden divs to the document body. */
  liveHost?: LiveHost;
  /** Tests and SSR harnesses that deliberately drive a fake scheduler. */
  allowFakeScheduler?: boolean;
}

export interface VanillaHost {
  readonly runtime: SJRuntime;
  readonly live: LiveRegistry;
  mount<S extends object, E, P extends Bag, X extends EffectInput>(
    el: Element,
    spec: ComponentSpec<S, E, P, X>,
    props: P,
  ): Instance<P>;
  /** Destroys every live instance, detaches the live registry and removes its nodes. */
  destroy(): void;
}

/** Light-DOM, text-only live node. Hidden by the inline `HIDDEN_STYLE`; `sj-sr-only` stays as a hook. */
function domLiveHost(doc: Document, made: Element[]): LiveHost {
  return {
    create(role: LiveRole): LiveNode {
      // Lazy: the registry hands out its status node at attach, but the element is only inserted on
      // the first announce (its first `setText`), so a component that never announces adds nothing.
      let node: HTMLElement | undefined;
      return {
        setText(text) {
          if (!node) {
            node = doc.createElement('div');
            node.setAttribute('role', role);
            node.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
            node.setAttribute('aria-atomic', 'true');
            node.setAttribute('style', HIDDEN_STYLE);
            node.className = 'sj-sr-only'; // styling hook only; hiding never depends on a stylesheet
            doc.body.appendChild(node);
            made.push(node);
          }
          node.textContent = text;
        },
      };
    },
  };
}

/** Set an element's text. Text nodes only: consumer strings are never parsed as markup (ADR-002). */
export function setText(el: Node, text: string | number): void {
  el.textContent = String(text);
}

declare const process: { env: { NODE_ENV?: string } } | undefined;

/** One host per runtime: owns the live-region registry and the set of live instances. */
export function createHost(runtime: SJRuntime, options: HostOptions = {}): VanillaHost {
  // A fake scheduler's timers never fire in a browser: effects would never drain and the live
  // region would never clear. Fail loudly in development (G1 SHOULD-1).
  if (
    !options.allowFakeScheduler &&
    'advance' in runtime.scheduler &&
    (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
  )
    throw new Error(
      "[sj] createHost needs a platform scheduler: createRuntime({ target: 'client' }) (pass allowFakeScheduler for tests)",
    );
  const live = createLiveRegistry(runtime.scheduler);
  const instances = new Set<{ destroy(): void }>();
  const nodes: Element[] = [];
  let attached = false;
  let closed = false;

  const mount: VanillaHost['mount'] = <S extends object, E, P extends Bag, X extends EffectInput>(
    el: Element,
    spec: ComponentSpec<S, E, P, X>,
    initialProps: P,
  ): Instance<P> => {
    if (closed) throw new Error('[sj] mount on a destroyed host');
    if (!attached) {
      attached = true;
      live.attach(options.liveHost ?? domLiveHost(el.ownerDocument, nodes));
    }

    const acquire = options.idFactory ?? runtime.idFactory;
    const id = baseId(
      initialProps.id as string | undefined,
      () => {
        if (!acquire) throw new Error('[sj] vanilla needs an explicit id or an injected idFactory');
        return acquire();
      },
      runtime.idPrefix,
    );

    const abort = new AbortController();
    const { signal } = abort;
    const queue: EffectQueue<X | CorrectiveEffect> = createEffectQueue();
    let props = initialProps;
    let version = 0;
    let dead = false;
    let scheduled = false;
    let patching = false;
    let dirty = false;
    const cleanups: (() => void)[] = [];

    const store: Store<S, E> = createStore<S, E, X>(spec.initial(props), spec.reduce, (fx, v) => {
      version = v;
      queue.enqueue(fx, v);
      // The store listener fires only on a state change; an effect-only dispatch must still drain.
      schedule();
    });
    const controlled = createControlled<S, E, P>({
      store,
      getProps: () => props,
      fields: spec.fields ?? {},
    });

    const ctx: InstanceContext<S, E, P> = {
      el,
      signal,
      runtime,
      live,
      id,
      part: (name) => partId(id, name),
      item: (key) => itemId(id, key),
      props: () => props,
      view: () => controlled.view(),
      dispatch(event) {
        if (
          queue.draining &&
          (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
        )
          throw new Error('[sj] no synchronous re-dispatch from an effect (ADR-003)');
        store.dispatch(event);
      },
      // A rejected controlled change changes nothing, so schedule the flush that resyncs the control.
      request(field, next) {
        const r = controlled.request(field, next);
        if (!r) schedule();
        return r;
      },
      native(field, actual) {
        const r = controlled.native(field, actual);
        if (!r) schedule();
        return r;
      },
      listen(target, type, handler, opts) {
        target.addEventListener(type, handler, { ...opts, signal });
      },
      onCleanup: (fn) => void cleanups.push(fn),
    };

    const patch = () => {
      if (dead) return;
      if (patching) {
        dirty = true;
        return;
      }
      patching = true;
      try {
        do {
          dirty = false;
          spec.patch(controlled.view(), ctx);
        } while (dirty && !dead);
      } finally {
        patching = false;
      }
    };

    const flush = () => {
      if (dead) return;
      queue.enqueue(controlled.reconcile(), correctiveVersion(version));
      const host = {
        run: (e: Effect<X | CorrectiveEffect>) => spec.run?.(e, ctx),
        ...(spec.exists && { exists: (t: string) => spec.exists!(t, ctx) }),
      };
      queue.drain(host, 'layout');
      queue.drain(host, 'passive');
      if (!dead && queue.size) schedule();
    };
    const schedule = () => {
      if (scheduled || dead) return;
      scheduled = true;
      runtime.scheduler.soon(() => {
        scheduled = false;
        flush();
      });
    };

    // First patch, then ownership lock, then listeners (K1b follow-up: mount() after first commit).
    patch();
    controlled.mount();
    const unsubscribe = store.subscribe(() => {
      patch();
      schedule();
    });
    spec.attach?.(ctx);
    schedule();

    const instance: Instance<P> = {
      update(next) {
        if (dead) return;
        props = next;
        controlled.view(); // surfaces an ownership switch to the caller (development)
        patch();
        schedule();
      },
      destroy() {
        if (dead) return;
        dead = true;
        abort.abort();
        unsubscribe();
        store.destroy();
        queue.clear();
        while (cleanups.length) cleanups.pop()!();
        instances.delete(instance);
      },
      get destroyed() {
        return dead;
      },
    };
    instances.add(instance);
    return instance;
  };

  return {
    runtime,
    live,
    mount,
    destroy() {
      if (closed) return;
      closed = true;
      for (const i of [...instances]) i.destroy();
      live.detach();
      for (const n of nodes.splice(0)) n.remove();
    },
  };
}
