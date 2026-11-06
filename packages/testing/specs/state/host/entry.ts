// Browser host for the SJState conformance run (W1-C11.f). Bundled by build.mjs, loaded by host.html.
// `window.__state.mount(adapter, fixture, path, opts)` mounts the REAL SJState of one adapter into #mount with the
// path's `supports` map injected into that adapter's own runtime (SJState reads no capability, but the injection
// still has to arrive, so a path is a label we can prove). Everything the live registry speaks is recorded in
// `window.__state.spoken` from before the first mount; `update` re-renders the same instance with new props.
// Nothing here simulates behaviour: the announcements are the ones the adapters hand to their real live hosts.
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { createApp, defineComponent, h, ref, type App } from 'vue';
import { createRuntime, type SJRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountState, type StateInstance } from '@ramoslabs/vanilla/state';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { detectSupports } from '../../../e2e/supports/detect';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import { FIXTURES, type FixtureProps } from '../fixtures';
import {
  liveRegions,
  reactState,
  recordSpoken,
  vanillaProps,
  vueState,
  type LiveRegionInfo,
  type Spoken,
} from './ssr-tree';

export type AdapterName = 'react' | 'vue' | 'vanilla';
export interface MountOptions {
  /** Override or add props on top of the fixture. */
  props?: Partial<FixtureProps>;
  /** React only: wrap in StrictMode (the production bundle does not double-invoke effects; this still mounts twice). */
  strict?: boolean;
}

interface StateGlobal {
  ready: true;
  real: SupportsMap;
  seen: SupportsMap | null;
  /** Everything the live hosts received since the last mount (cleared by `mount`). */
  spoken: Spoken[];
  mount(adapter: AdapterName, fixture: string, path?: string, opts?: MountOptions): Promise<void>;
  /** Re-render the mounted instance with these props merged over the current ones. */
  update(props: Partial<FixtureProps>): Promise<void>;
  /** Unmount the instance (the live nodes of the provider/host go with it). */
  unmount(): void;
  regions(): LiveRegionInfo[];
}

declare global {
  interface Window {
    __state: StateGlobal;
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
const seen = (r: SJRuntime): void => void (window.__state.seen = r.supports);
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

interface Live {
  update(props: FixtureProps): void;
  destroy(): void;
}
let current: Live | undefined;
let currentProps: FixtureProps = {};

/** `#mount` holds the state; the surrounding chrome is the page (no live node may be inside it). */
function container(): HTMLElement {
  const root = rootEl();
  root.replaceChildren();
  const mount = root.appendChild(document.createElement('div'));
  mount.id = 'mount';
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
      reactState(props),
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
    render: () => h(VueProvider, { runtime }, () => [h(VueTap), vueState(props.value)]),
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
  const inst: StateInstance = mountState(host, el, vanillaProps(p, host));
  return { update: (next) => inst.update(vanillaProps(next, host)), destroy: () => host.destroy() };
}

/** Two frames for the patch, then enough time for the deferred announcement (registry `soon` + the adapter tick). */
async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 120));
}

function reset(): void {
  current?.destroy();
  current = undefined;
  spoken.length = 0;
  window.__state.seen = null; // never let a previous mount's map be read as this one's
  document.documentElement.removeAttribute('dir');
}

window.__state = {
  ready: true,
  real,
  seen: null,
  spoken,
  async mount(adapter, fixture, path = 'native', opts = {}) {
    const base = FIXTURES[fixture];
    if (!base) throw new Error(`unknown fixture "${fixture}"`);
    reset();
    history.replaceState(null, '', location.pathname);
    currentProps = { ...base, ...opts.props };
    const box = container();
    current =
      adapter === 'react'
        ? mountReact(box, currentProps, path, opts.strict === true)
        : adapter === 'vue'
          ? mountVue(box, currentProps, path)
          : mountVanilla(box, currentProps, path);
    await settle();
  },
  async update(props) {
    currentProps = { ...currentProps, ...props };
    current?.update(currentProps);
    await settle();
  },
  unmount() {
    current?.destroy();
    current = undefined;
  },
  regions: liveRegions,
};
