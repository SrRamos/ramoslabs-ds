// SJProvider and the runtime context (ADR-003 "Runtime configuration", Vue row of the bridge table).
// `provide` carries one frozen runtime plus its single live-region registry. No module-scope state:
// the outside-provider fallback is parked on the app's own root `provides`, so it is one per app.
import {
  defineComponent,
  getCurrentInstance,
  inject,
  markRaw,
  onBeforeUnmount,
  onMounted,
  provide,
  type InjectionKey,
  type PropType,
} from 'vue';
import { createRuntime, type RuntimeConfig, type SJRuntime } from '@ramoslabs/core/runtime';
import { createLiveRegistry, type LiveHost, type LiveRegistry } from '@ramoslabs/core/live';
import { createDomLiveHost } from './dom';

declare const process: { env: { NODE_ENV?: string } } | undefined;

export interface SJContext {
  readonly runtime: SJRuntime;
  /** The one live-region registry (W1-111) of this runtime. Nothing is rendered before mount. */
  readonly live: LiveRegistry;
}

export const SJ_CONTEXT: InjectionKey<SJContext> = Symbol('sj-runtime');

/** Builds a context. The registry stays detached (server-safe) until `live.attach` after mount. */
export function createContext(runtime: SJRuntime): SJContext {
  return markRaw({ runtime, live: createLiveRegistry(runtime.scheduler) });
}

export const SJProvider = defineComponent({
  name: 'SJProvider',
  props: {
    /** A ready runtime (e.g. rebuilt from `serializeRuntime` on the client). */
    runtime: { type: Object as PropType<SJRuntime>, default: undefined },
    /** Used when `runtime` is omitted. Defaults to `target: 'client'` (platform timers). */
    config: { type: Object as PropType<RuntimeConfig>, default: undefined },
    /** Overrides where live regions are created (tests, custom documents). Default: the DOM. */
    liveHost: { type: Object as PropType<LiveHost>, default: undefined },
  },
  setup(props, { slots }) {
    const ctx = createContext(
      props.runtime ?? createRuntime({ ...props.config, target: props.config?.target ?? 'client' }),
    );
    provide(SJ_CONTEXT, ctx);
    let dom: ReturnType<typeof createDomLiveHost> | undefined;
    onMounted(() => {
      // Client only, after mount: the server never emits live-region markup (ADR-006).
      const host = props.liveHost ?? (dom = createDomLiveHost());
      ctx.live.attach(host);
    });
    onBeforeUnmount(() => {
      ctx.live.detach();
      dom?.dispose();
      dom = undefined;
    });
    return () => slots.default?.();
  },
});

/**
 * Reads the runtime context. Outside a provider it falls back to `createRuntime()` defaults and
 * warns in development (ADR-003), creating the fallback once per app.
 */
export function useSJContext(): SJContext {
  const found = inject(SJ_CONTEXT, undefined);
  if (found) return found;
  const inst = getCurrentInstance();
  const ctx = createContext(createRuntime({ target: 'client' }));
  if (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
    console.warn('[sj] component used outside <SJProvider>; falling back to runtime defaults');
  if (inst) inst.appContext.provides[SJ_CONTEXT as symbol] = ctx;
  return ctx;
}

export const useSJRuntime = (): SJRuntime => useSJContext().runtime;
