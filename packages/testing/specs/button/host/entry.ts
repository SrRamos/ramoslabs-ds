// Browser host for the SJButton conformance run (W1-C01.f). Bundled by build.mjs, loaded by host.html.
// `window.__btn.mount(adapter, fixture, path, opts)` mounts the REAL SJButton of one adapter into #root
// with the path's `supports` map injected into that adapter's own runtime, and records every `press`
// the component reports plus every form `submit` the browser performs (native behaviour, not simulated).
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, type App } from 'vue';
import { createRuntime, type SJRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountButton } from '@ramoslabs/vanilla/button';
import { SJButton as ReactButton } from '@ramoslabs/react/button';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJButton as VueButton } from '@ramoslabs/vue/button';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { detectSupports } from '../../../e2e/supports/detect';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import { FIXTURES, NARROW_PX, type FixtureProps } from '../fixtures';

export type AdapterName = 'react' | 'vue' | 'vanilla';
export interface MountOptions {
  /** Wrap the button in a real `<form>` (submit and no-implicit-submit scenarios). */
  form?: boolean;
  /** Override or add props on top of the fixture. */
  props?: FixtureProps;
}
export interface PressRecord {
  /** `originalEvent.type` of the payload: `click` for every activation path. */
  type: string;
}
export interface SubmitRecord {
  /** Name/value of the submitter as the browser resolved it. */
  submitter: { name: string | null; value: string | null } | null;
  data: Record<string, string>;
}

interface BtnGlobal {
  ready: true;
  real: SupportsMap;
  seen: SupportsMap | null;
  presses: PressRecord[];
  submits: SubmitRecord[];
  mount(adapter: AdapterName, fixture: string, path?: string, opts?: MountOptions): Promise<void>;
}

declare global {
  interface Window {
    __btn: BtnGlobal;
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};

const real = detectSupports(window as never);
const presses: PressRecord[] = [];
const submits: SubmitRecord[] = [];
const onPress = (p: { originalEvent: unknown }): void =>
  void presses.push({ type: (p.originalEvent as Event).type });
const seen = (r: SJRuntime): void => void (window.__btn.seen = r.supports);
const runtimeFor = (path: string, extra: Parameters<typeof createRuntime>[0] = {}): SJRuntime =>
  createRuntime({ target: 'client', ...extra, supports: applyPath(real, parsePath(path)) });

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

const cleanups: Array<() => void> = [];

function container(fixture: string, form: boolean): HTMLElement {
  const root = rootEl();
  root.replaceChildren();
  const holder = form ? root.appendChild(document.createElement('form')) : root;
  if (holder instanceof HTMLFormElement) {
    holder.id = 'form';
    holder.addEventListener('submit', (e) => {
      // Never navigate: the record is the evidence that the browser submitted this form.
      e.preventDefault();
      const s = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      submits.push({
        submitter: s ? { name: s.getAttribute('name'), value: s.getAttribute('value') } : null,
        data: Object.fromEntries(
          [...new FormData(holder, s).entries()].map(([k, v]) => [k, String(v)]),
        ),
      });
    });
  }
  const box = holder.appendChild(document.createElement('div'));
  box.id = 'box';
  if (fixture === 'long-label') box.style.inlineSize = `${NARROW_PX}px`;
  return box;
}

/** Contract props only; text and icon are content, handled per adapter. */
function contractProps(p: FixtureProps): Record<string, unknown> {
  const { text: _t, icon: _i, name: _n, value: _v, ...rest } = p;
  void [_t, _i, _n, _v];
  return rest;
}
const nativeAttrs = (p: FixtureProps): Record<string, string> => ({
  ...(p.name !== undefined && { name: p.name }),
  ...(p.value !== undefined && { value: p.value }),
});

async function mountReact(box: HTMLElement, p: FixtureProps, path: string): Promise<() => void> {
  const rootNode = createRoot(box);
  const runtime = runtimeFor(path, { idPrefix: 'e2e-' });
  window.IS_REACT_ACT_ENVIRONMENT = false;
  // Synchronous commit so the runtime read-back and the DOM are settled when mount() resolves.
  flushSync(() =>
    rootNode.render(
      createElement(
        StrictMode,
        null,
        createElement(
          ReactProvider,
          { runtime },
          createElement(ReactTap),
          createElement(
            ReactButton,
            { ...contractProps(p), ...nativeAttrs(p), onPress, icon: p.icon },
            p.iconOnly ? undefined : p.text,
          ),
        ),
      ),
    ),
  );
  return () => rootNode.unmount();
}

async function mountVue(box: HTMLElement, p: FixtureProps, path: string): Promise<() => void> {
  const runtime = runtimeFor(path, { idPrefix: 'e2e-' });
  const app: App = createApp({
    render: () =>
      h(VueProvider, { runtime }, () => [
        h(VueTap),
        h(
          VueButton,
          { ...contractProps(p), ...nativeAttrs(p), onPress },
          {
            default: () => (p.iconOnly ? undefined : p.text),
            ...(p.icon !== undefined && { icon: () => p.icon }),
          },
        ),
      ]),
  });
  app.mount(box);
  return () => app.unmount();
}

async function mountVanilla(box: HTMLElement, p: FixtureProps, path: string): Promise<() => void> {
  let n = 0;
  const host = createHost(runtimeFor(path, { idFactory: () => `e2e-${n++}` }));
  seen(host.runtime);
  mountButton(host, box, {
    ...contractProps(p),
    ...(p.text !== undefined && !p.iconOnly && { text: p.text }),
    ...(p.icon !== undefined && { icon: p.icon }),
    attrs: nativeAttrs(p),
    onPress,
  } as never);
  return () => host.destroy();
}

window.__btn = {
  ready: true,
  real,
  seen: null,
  presses,
  submits,
  async mount(adapter, fixture, path = 'native', opts = {}) {
    const base = FIXTURES[fixture];
    if (!base) throw new Error(`unknown fixture "${fixture}"`);
    for (const c of cleanups.splice(0)) c();
    presses.length = 0;
    submits.length = 0;
    window.__btn.seen = null; // never let a previous mount's map be read as this one's
    history.replaceState(null, '', location.pathname);
    const props = { ...base, ...opts.props };
    const box = container(fixture, opts.form ?? false);
    const mount = adapter === 'react' ? mountReact : adapter === 'vue' ? mountVue : mountVanilla;
    cleanups.push(await mount(box, props, path));
    // Two frames: Vue/React/vanilla have all patched, fonts and layout are settled.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  },
};
