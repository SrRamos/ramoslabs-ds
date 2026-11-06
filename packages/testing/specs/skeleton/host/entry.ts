// Browser host for the SJSkeleton conformance run. Bundled by build.mjs, loaded by host.html.
// `window.__skeleton.mount(adapter, fixture, path, opts)` mounts the REAL SJSkeleton of one adapter into #mount with
// the path's `supports` map injected into that adapter's own runtime (SJSkeleton reads no capability, but the
// injection still has to arrive, so a path is a label we can prove). Everything the live registry speaks is
// recorded in `window.__skeleton.spoken` from before the first mount. For the timing specs the host records, from
// the mount call on: every change of the group's data-state / aria-busy / children with a timestamp and the
// computed visibility (`trace`), one sample per animation frame (`samples`), and every layout-shift entry the
// engine reports (`shifts`; Chromium only, other engines report none and the specs fall back to geometry).
// Nothing here simulates behaviour: the timers are the platform's and the announcements are the ones the adapters
// hand to their real live hosts.
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { createApp, defineComponent, h, ref, type App } from 'vue';
import { createRuntime, detectSupports, type SJRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountSkeleton, type SkeletonInstance } from '@ramoslabs/vanilla/skeleton';
import type { StateInstance } from '@ramoslabs/vanilla/state';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import { FIXTURES, FOLLOWER_TEXT, type FixtureProps } from '../fixtures';
import {
  liveRegions,
  mountVanillaStateComposition,
  reactSkeleton,
  reactStateComposition,
  recordSpoken,
  vanillaProps,
  vueSkeleton,
  vueStateComposition,
  type LiveRegionInfo,
  type Spoken,
  type StateCompositionProps,
} from './ssr-tree';

export type AdapterName = 'react' | 'vue' | 'vanilla';
export interface MountOptions {
  /** Override or add props on top of the fixture. An explicit `undefined` removes the fixture's value. */
  props?: Partial<FixtureProps>;
  /** React only: wrap in StrictMode (the production bundle does not double-invoke effects; this still mounts twice). */
  strict?: boolean;
  /** Wait for the patch and the deferred announcement before returning (default true). The timing specs pass false. */
  settle?: boolean;
}

export interface TraceEntry {
  /** Milliseconds since the mount call. */
  t: number;
  state: string | null;
  busy: string | null;
  visibility: string;
  /** The root holds SJSkeleton shapes (the placeholder). */
  skeleton: boolean;
  /** The root holds the loaded content. */
  content: boolean;
}
export interface Sample {
  t: number;
  state: string | null;
  visibility: string;
}
export interface Shift {
  value: number;
  startTime: number;
  hadRecentInput: boolean;
}

interface SkeletonGlobal {
  ready: true;
  real: SupportsMap;
  seen: SupportsMap | null;
  /** Everything the live hosts received since the last mount (cleared by `mount`). */
  spoken: Spoken[];
  trace: TraceEntry[];
  samples: Sample[];
  shiftSupported: boolean;
  /** `performance.now()` at the start of the last mount call. */
  t0: number;
  mount(adapter: AdapterName, fixture: string, path?: string, opts?: MountOptions): Promise<void>;
  /** SJSkeleton inside SJState (loading variant), see ssr-tree.ts. */
  mountComposition(
    adapter: AdapterName,
    comp: StateCompositionProps,
    path?: string,
    opts?: { settle?: boolean },
  ): Promise<void>;
  /** Re-render the mounted instance with these props merged over the current ones. */
  update(props: Partial<FixtureProps>, opts?: { settle?: boolean }): Promise<void>;
  /** Unmount the instance (the live nodes of the provider/host go with it). */
  unmount(): void;
  regions(): LiveRegionInfo[];
  now(): number;
  /** Sum of the layout-shift values reported at or after `since` (performance.now() time), input-driven ones excluded. */
  shiftSince(since: number): number;
}

declare global {
  interface Window {
    __skeleton: SkeletonGlobal;
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};

const real = detectSupports(window as never);
const spoken: Spoken[] = [];
// Starts before the first mount, so nothing spoken at mount time can be missed.
recordSpoken(spoken);
const seen = (r: SJRuntime): void => void (window.__skeleton.seen = r.supports);
const runtimeFor = (path: string): SJRuntime =>
  createRuntime({ target: 'client', idPrefix: 'e2e-', supports: applyPath(real, parsePath(path)) });

/** Reads the runtime through the adapter's own hook, proving the injected map arrives. */
const ReactTap = (): null => {
  seen(useReactRuntime());
  return null;
};
const VueTap = defineComponent({
  setup() {
    seen(useVueRuntime());
    return () => null;
  },
});

// ---- layout shift ------------------------------------------------------------------------------------------
const shifts: Shift[] = [];
let shiftObserver: PerformanceObserver | undefined;
let shiftSupported = false;
try {
  shiftSupported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
  if (shiftSupported) {
    shiftObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<
        Shift & { value: number; hadRecentInput: boolean }
      >)
        shifts.push({ value: e.value, startTime: e.startTime, hadRecentInput: e.hadRecentInput });
    });
    shiftObserver.observe({ type: 'layout-shift', buffered: true });
  }
} catch {
  // An engine without the entry type (or without PerformanceObserver options) simply reports no shifts.
  shiftObserver = undefined;
}

// ---- trace and samples -------------------------------------------------------------------------------------
const trace: TraceEntry[] = [];
const samples: Sample[] = [];
let t0 = 0;
let stopTrace: (() => void) | undefined;

const groupRoot = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('#mount [data-shape="group"]');

function snapshot(): TraceEntry | null {
  const g = groupRoot();
  if (!g) return null;
  return {
    t: performance.now() - t0,
    state: g.getAttribute('data-state'),
    busy: g.getAttribute('aria-busy'),
    visibility: getComputedStyle(g).visibility,
    skeleton: g.querySelector('[data-shape]') !== null,
    content: g.querySelector('.w-card__line') !== null,
  };
}

function startTrace(): void {
  stopTrace?.();
  trace.length = 0;
  samples.length = 0;
  const record = () => {
    const s = snapshot();
    const last = trace[trace.length - 1];
    if (
      s &&
      (!last ||
        last.state !== s.state ||
        last.busy !== s.busy ||
        last.skeleton !== s.skeleton ||
        last.content !== s.content)
    )
      trace.push(s);
  };
  const obs = new MutationObserver(record);
  obs.observe(rootEl(), {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-state', 'aria-busy'],
  });
  let raf = 0;
  const frame = () => {
    const g = groupRoot();
    if (g && samples.length < 4000)
      samples.push({
        t: performance.now() - t0,
        state: g.getAttribute('data-state'),
        visibility: getComputedStyle(g).visibility,
      });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  stopTrace = () => {
    obs.disconnect();
    cancelAnimationFrame(raf);
    stopTrace = undefined;
  };
}

interface Live {
  update(props: FixtureProps): void;
  destroy(): void;
}
let current: Live | undefined;
let currentProps: FixtureProps = {};

/** `#mount` holds the component; the follower below it makes any layout shift measurable. */
function container(): HTMLElement {
  const root = rootEl();
  root.replaceChildren();
  const mount = root.appendChild(document.createElement('div'));
  mount.id = 'mount';
  const after = root.appendChild(document.createElement('p'));
  after.id = 'after';
  after.textContent = FOLLOWER_TEXT;
  return mount;
}

function mountReact(box: HTMLElement, p: FixtureProps, path: string, strict: boolean): Live {
  const rootNode: Root = createRoot(box);
  const runtime = runtimeFor(path);
  window.IS_REACT_ACT_ENVIRONMENT = false;
  const render = (props: FixtureProps) => {
    const tree = createElement(
      ReactProvider,
      { runtime },
      createElement(ReactTap),
      reactSkeleton(props),
    );
    flushSync(() => rootNode.render(strict ? createElement(StrictMode, null, tree) : tree));
  };
  render(p);
  return { update: render, destroy: () => rootNode.unmount() };
}

function mountVue(box: HTMLElement, p: FixtureProps, path: string): Live {
  const runtime = runtimeFor(path);
  const props = ref<FixtureProps>(p);
  const app: App = createApp({
    render: () => h(VueProvider, { runtime }, () => [h(VueTap), vueSkeleton(props.value)]),
  });
  app.mount(box);
  return { update: (next) => void (props.value = next), destroy: () => app.unmount() };
}

function mountVanilla(box: HTMLElement, p: FixtureProps, path: string): Live {
  let n = 0;
  const host = createHost(
    createRuntime({
      target: 'client',
      supports: applyPath(real, parsePath(path)),
      idFactory: () => `e2e-${n++}`,
    }),
  );
  seen(host.runtime);
  const el = box.appendChild(document.createElement('div'));
  // The slots are Nodes: build them once so an update keeps the same placeholder and content nodes.
  const first = vanillaProps(p, host);
  const slots = { skeleton: first.skeleton, default: first.default };
  const inst: SkeletonInstance = mountSkeleton(host, el, first);
  return {
    update: (next) => {
      const { skeleton, default: content, ...rest } = vanillaProps(next, host);
      void skeleton;
      void content;
      inst.update({ ...rest, ...slots });
    },
    destroy: () => host.destroy(),
  };
}

/** Two frames for the patch, then enough time for the deferred announcement (registry `soon` + the adapter tick). */
async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 120));
}

function reset(): void {
  current?.destroy();
  current = undefined;
  stopTrace?.();
  spoken.length = 0;
  window.__skeleton.seen = null; // never let a previous mount's map be read as this one's
  document.documentElement.removeAttribute('dir');
}

window.__skeleton = {
  ready: true,
  real,
  seen: null,
  spoken,
  trace,
  samples,
  shiftSupported,
  get t0() {
    return t0;
  },
  async mount(adapter, fixture, path = 'native', opts = {}) {
    const base = FIXTURES[fixture];
    if (!base) throw new Error(`unknown fixture "${fixture}"`);
    reset();
    history.replaceState(null, '', location.pathname);
    t0 = performance.now();
    currentProps = { ...base, ...opts.props };
    const box = container();
    startTrace();
    current =
      adapter === 'react'
        ? mountReact(box, currentProps, path, opts.strict === true)
        : adapter === 'vue'
          ? mountVue(box, currentProps, path)
          : mountVanilla(box, currentProps, path);
    const first = snapshot();
    if (first) trace.push(first);
    if (opts.settle !== false) await settle();
  },
  async mountComposition(adapter, comp, path = 'native', opts = {}) {
    reset();
    t0 = performance.now();
    const box = container();
    startTrace();
    const runtime = runtimeFor(path);
    if (adapter === 'react') {
      const rootNode = createRoot(box);
      window.IS_REACT_ACT_ENVIRONMENT = false;
      flushSync(() =>
        rootNode.render(
          createElement(
            ReactProvider,
            { runtime },
            createElement(ReactTap),
            reactStateComposition(comp),
          ),
        ),
      );
      current = { update: () => undefined, destroy: () => rootNode.unmount() };
    } else if (adapter === 'vue') {
      const app = createApp({
        render: () => h(VueProvider, { runtime }, () => [h(VueTap), vueStateComposition(comp)]),
      });
      app.mount(box);
      current = { update: () => undefined, destroy: () => app.unmount() };
    } else {
      let n = 0;
      const host = createHost(
        createRuntime({
          target: 'client',
          supports: applyPath(real, parsePath(path)),
          idFactory: () => `e2e-${n++}`,
        }),
      );
      seen(host.runtime);
      const el = box.appendChild(document.createElement('div'));
      const inst: StateInstance = mountVanillaStateComposition(host, el, comp);
      void inst;
      current = { update: () => undefined, destroy: () => host.destroy() };
    }
    if (opts.settle !== false) await settle();
  },
  async update(props, opts = {}) {
    currentProps = { ...currentProps, ...props };
    current?.update(currentProps);
    if (opts.settle !== false) await settle();
  },
  unmount() {
    current?.destroy();
    current = undefined;
  },
  regions: liveRegions,
  now: () => performance.now(),
  shiftSince(since) {
    for (const e of (shiftObserver?.takeRecords() ?? []) as unknown as Array<
      Shift & { value: number }
    >)
      shifts.push({ value: e.value, startTime: e.startTime, hadRecentInput: e.hadRecentInput });
    return shifts
      .filter((s) => s.startTime >= since && !s.hadRecentInput)
      .reduce((a, s) => a + s.value, 0);
  },
};
