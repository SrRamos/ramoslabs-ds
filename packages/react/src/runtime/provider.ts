// SJProvider (W1-120). Holds the runtime and ONE live-region registry per runtime (W1-111).
// Registry creation is pure; attaching the DOM host happens in a layout effect (client only,
// post-commit) and is reversed on cleanup, so StrictMode's mount/cleanup/mount is safe.
import {
  createContext,
  createElement,
  useCallback,
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

// Dev-only guard (K2 convention): inline, never throws unbundled, strips under a bundler define.
declare const process: { env: { NODE_ENV?: string } } | undefined;

/** What a provider (or the outside-provider fallback) supplies to every machine below it. */
export interface RuntimeBag {
  readonly runtime: SJRuntime;
  readonly live: LiveRegistry;
  /** Called at mount by a component whose contract declares `liveRegions`: the region exists before any text. */
  readonly requireLive?: () => void;
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
        // Effects and timers only run on the client; the server render never reads the scheduler.
        // A fake scheduler on the client would never clear the live region (G1 SHOULD-1).
        target: target ?? 'client',
      }),
    [given, locale, dir, idPrefix, idFactory, density, supports, scheduler, target],
  );
  const live = useMemo(() => createLiveRegistry(runtime.scheduler), [runtime]);
  const eager = useRef(false);
  const attachedHost = useRef<(LiveHost & { ensure?: () => void }) | undefined>(undefined);
  const requireLive = useCallback(() => {
    // Children mount before this provider's effect attaches the host, so remember the request.
    eager.current = true;
    attachedHost.current?.ensure?.();
  }, []);
  const bag = useMemo<RuntimeBag>(
    () => ({ runtime, live, requireLive }),
    [runtime, live, requireLive],
  );

  const hostFactory = useRef(liveHost);
  hostFactory.current = liveHost;
  useLayoutEffect(() => {
    const custom = hostFactory.current;
    // No DOM (SSR never runs effects; non-DOM renderers): nothing to attach, announcements no-op.
    if (!custom && typeof document === 'undefined') return;
    const host: LiveHost & { dispose?: () => void; ensure?: () => void } = custom
      ? custom()
      : createDomLiveHost();
    live.attach(host);
    attachedHost.current = host;
    if (eager.current) host.ensure?.();
    return () => {
      attachedHost.current = undefined;
      live.detach();
      host.dispose?.();
    };
  }, [live]);

  return createElement(RuntimeContext.Provider, { value: bag }, children);
}

/**
 * The bag for the calling component. Outside a provider: a per-component default runtime (platform
 * scheduler, no live host attached, so announcements are no-ops) plus a one-time dev warning.
 */
export function useRuntimeBag(): RuntimeBag {
  const ctx = useContext(RuntimeContext);
  const fallback = useMemo<RuntimeBag | null>(() => {
    if (ctx) return null;
    const runtime = createRuntime({ target: 'client' });
    return { runtime, live: createLiveRegistry(runtime.scheduler) };
  }, [ctx]);
  const warned = useRef(false);
  useEffect(() => {
    if (
      !ctx &&
      !warned.current &&
      (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
    ) {
      warned.current = true;
      console.warn('[sj] SJ component rendered outside <SJProvider>; using default runtime.');
    }
  }, [ctx]);
  return (ctx ?? fallback)!;
}

/**
 * The provider's runtime, or null outside one: `useContext` only, no fallback, no warning (G-ICON SHOULD-2).
 * For components that need the runtime only sometimes (an icon reads `dir` for mirrored glyphs only).
 */
export function useOptionalRuntime(): SJRuntime | null {
  return useContext(RuntimeContext)?.runtime ?? null;
}

export function useRuntime(): SJRuntime {
  return useRuntimeBag().runtime;
}
