// SJProvider (W1-120). Holds the runtime and ONE live-region registry per runtime (W1-111).
// Registry creation is pure; attaching the DOM host happens in a layout effect (client only,
// post-commit) and is reversed on cleanup, so StrictMode's mount/cleanup/mount is safe.
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type Context,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRuntime, type RuntimeConfig, type SJRuntime } from '@ramoslabs/core/runtime';
import { createLiveRegistry, type LiveHost, type LiveRegistry } from '@ramoslabs/core/live';
import { createDomLiveHost, type DisposableLiveHost } from './live-host';
import { isDev } from './dev';

/** What a provider (or the outside-provider fallback) supplies to every machine below it. */
export interface RuntimeBag {
  readonly runtime: SJRuntime;
  readonly live: LiveRegistry;
}

export const RuntimeContext: Context<RuntimeBag | null> = createContext<RuntimeBag | null>(null);

export interface SJProviderProps extends RuntimeConfig {
  /** A ready runtime; when given, the config fields are ignored. */
  runtime?: SJRuntime;
  /** Custom live host (tests, shadow roots). Default: visually hidden nodes in `document.body`. */
  liveHost?: () => DisposableLiveHost | LiveHost;
  children?: ReactNode;
}

export function SJProvider(props: SJProviderProps): ReactElement {
  const { runtime: given, liveHost, children } = props;
  const { locale, dir, idPrefix, idFactory, density, supports, scheduler, target } = props;
  const runtime = useMemo(
    () =>
      given ??
      createRuntime({
        ...(locale !== undefined && { locale }),
        ...(dir !== undefined && { dir }),
        ...(idPrefix !== undefined && { idPrefix }),
        ...(idFactory !== undefined && { idFactory }),
        ...(density !== undefined && { density }),
        ...(supports !== undefined && { supports }),
        ...(scheduler !== undefined && { scheduler }),
        ...(target !== undefined && { target }),
      }),
    [given, locale, dir, idPrefix, idFactory, density, supports, scheduler, target],
  );
  const live = useMemo(() => createLiveRegistry(runtime.scheduler), [runtime]);
  const bag = useMemo<RuntimeBag>(() => ({ runtime, live }), [runtime, live]);

  const hostFactory = useRef(liveHost);
  hostFactory.current = liveHost;
  useLayoutEffect(() => {
    const custom = hostFactory.current;
    // No DOM (SSR never runs effects; non-DOM renderers): nothing to attach, announcements no-op.
    if (!custom && typeof document === 'undefined') return;
    const host: LiveHost & { dispose?: () => void } = custom ? custom() : createDomLiveHost();
    live.attach(host);
    return () => {
      live.detach();
      host.dispose?.();
    };
  }, [live]);

  return createElement(RuntimeContext.Provider, { value: bag }, children);
}

/**
 * The bag for the calling component. Outside a provider: a per-component default runtime (server
 * scheduler, no live host attached, so announcements are no-ops) plus a one-time dev warning.
 */
export function useRuntimeBag(): RuntimeBag {
  const ctx = useContext(RuntimeContext);
  const fallback = useMemo<RuntimeBag | null>(() => {
    if (ctx) return null;
    const runtime = createRuntime();
    return { runtime, live: createLiveRegistry(runtime.scheduler) };
  }, [ctx]);
  const warned = useRef(false);
  useEffect(() => {
    if (!ctx && !warned.current && isDev()) {
      warned.current = true;
      console.warn('[sj] SJ component rendered outside <SJProvider>; using default runtime.');
    }
  }, [ctx]);
  return (ctx ?? fallback)!;
}

export function useRuntime(): SJRuntime {
  return useRuntimeBag().runtime;
}
