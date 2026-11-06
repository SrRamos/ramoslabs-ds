// Browser host for the SJIcon conformance run (W1-C12.f). Bundled by build.mjs, loaded by host.html.
// `window.__icon.mount(adapter, fixture, path, opts)` mounts the REAL SJIcon of one adapter into #mount with
// the path's `supports` map injected into that adapter's own runtime (the icon reads only `dir`, but the
// injection still has to arrive, so a path is a label we can prove). `mountComposition` mounts an SJIcon in the
// `icon` slot of the real SJButton. Nothing here simulates behaviour: the icon has no events.
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, type App } from 'vue';
import { createRuntime, detectSupports, type SJRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountButton } from '@ramoslabs/vanilla/button';
import { mountIcon } from '@ramoslabs/vanilla/icon';
import { SJButton as ReactButton } from '@ramoslabs/react/button';
import { SJIcon as ReactIcon } from '@ramoslabs/react/icon';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJButton as VueButton } from '@ramoslabs/vue/button';
import { SJIcon as VueIcon } from '@ramoslabs/vue/icon';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import { COMPOSITIONS, type CompositionProps } from '../composition/fixtures';
import { CONTEXT_TEXT, FIXTURES, type FixtureProps } from '../fixtures';
import { iconProps } from './ssr-tree';

export type AdapterName = 'react' | 'vue' | 'vanilla';
export interface MountOptions {
  /** Override or add props on top of the fixture (the size scenarios loop through this). */
  props?: Partial<FixtureProps>;
  /** Width/height (CSS px) of a box the icon is mounted in, for `size: 'fit'`. */
  box?: number;
  /** Root font size (CSS px) of the mount point, for the no-stylesheet and `1em` checks. */
  fontSize?: number;
}

interface IconGlobal {
  ready: true;
  real: SupportsMap;
  seen: SupportsMap | null;
  mount(adapter: AdapterName, fixture: string, path?: string, opts?: MountOptions): Promise<void>;
  mountComposition(adapter: AdapterName, name: string, path?: string): Promise<void>;
}

declare global {
  interface Window {
    __icon: IconGlobal;
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};

const real = detectSupports(window as never);
const seen = (r: SJRuntime): void => void (window.__icon.seen = r.supports);
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

/** `#box > span#mount` holds the icon; the visible words sit next to it (what a decorative icon leaves out). */
function container(opts: { box?: number; fontSize?: number; text: boolean }): HTMLElement {
  const root = rootEl();
  root.replaceChildren();
  const box = root.appendChild(document.createElement('div'));
  box.id = 'box';
  if (opts.fontSize) box.style.fontSize = `${opts.fontSize}px`;
  const mount = box.appendChild(document.createElement('span'));
  mount.id = 'mount';
  if (opts.box) {
    mount.style.display = 'inline-block';
    mount.style.inlineSize = `${opts.box}px`;
    mount.style.blockSize = `${opts.box}px`;
  }
  if (opts.text) box.appendChild(document.createTextNode(` ${CONTEXT_TEXT}`));
  return mount;
}

async function mountReact(box: HTMLElement, p: FixtureProps, path: string): Promise<() => void> {
  const rootNode = createRoot(box);
  const runtime = runtimeFor(path, {
    idPrefix: 'e2e-',
    ...(p.runtimeDir && { dir: p.runtimeDir }),
  });
  window.IS_REACT_ACT_ENVIRONMENT = false;
  flushSync(() =>
    rootNode.render(
      createElement(
        StrictMode,
        null,
        createElement(
          ReactProvider,
          { runtime },
          createElement(ReactTap),
          createElement(ReactIcon, iconProps(p) as never),
        ),
      ),
    ),
  );
  return () => rootNode.unmount();
}

async function mountVue(box: HTMLElement, p: FixtureProps, path: string): Promise<() => void> {
  const runtime = runtimeFor(path, {
    idPrefix: 'e2e-',
    ...(p.runtimeDir && { dir: p.runtimeDir }),
  });
  const app: App = createApp({
    render: () => h(VueProvider, { runtime }, () => [h(VueTap), h(VueIcon, iconProps(p) as never)]),
  });
  app.mount(box);
  return () => app.unmount();
}

async function mountVanilla(box: HTMLElement, p: FixtureProps, path: string): Promise<() => void> {
  let n = 0;
  const host = createHost(
    runtimeFor(path, {
      idFactory: () => `e2e-${n++}`,
      ...(p.runtimeDir && { dir: p.runtimeDir }),
    }),
  );
  seen(host.runtime);
  const { attrs, ...contract } = p;
  const { runtimeDir: _r, ...rest } = contract;
  void _r;
  mountIcon(host, box, { ...rest, ...(attrs && { attrs }) });
  return () => host.destroy();
}

async function frames(): Promise<void> {
  // Two frames: all three adapters have patched, fonts and layout are settled.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function reset(): void {
  for (const c of cleanups.splice(0)) c();
  window.__icon.seen = null; // never let a previous mount's map be read as this one's
  document.documentElement.removeAttribute('dir');
}

// ---- composition: SJIcon inside SJButton's `icon` slot -------------------------------------------------------

const iconOf = (c: CompositionProps) => ({
  icon: c.icon,
  size: 'fit' as const,
  ...(c.iconLabel !== undefined && { label: c.iconLabel }),
});
const buttonProps = (c: CompositionProps) => ({
  ...(c.iconOnly && { iconOnly: true }),
  ...(c.label !== undefined && { label: c.label }),
  ...(c.href !== undefined && { href: c.href }),
});

async function composeReact(box: HTMLElement, c: CompositionProps, path: string) {
  const rootNode = createRoot(box);
  const runtime = runtimeFor(path, { idPrefix: 'e2e-' });
  window.IS_REACT_ACT_ENVIRONMENT = false;
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
            { ...buttonProps(c), icon: createElement(ReactIcon, iconOf(c)) },
            c.iconOnly ? undefined : c.text,
          ),
        ),
      ),
    ),
  );
  return () => rootNode.unmount();
}

async function composeVue(box: HTMLElement, c: CompositionProps, path: string) {
  const runtime = runtimeFor(path, { idPrefix: 'e2e-' });
  const app = createApp({
    render: () =>
      h(VueProvider, { runtime }, () => [
        h(VueTap),
        h(VueButton, buttonProps(c), {
          default: () => (c.iconOnly ? undefined : c.text),
          icon: () => h(VueIcon, iconOf(c) as never),
        }),
      ]),
  });
  app.mount(box);
  return () => app.unmount();
}

/**
 * Vanilla: the button's `icon` accepts a Node (C01 .e, #90), so the SJIcon is mounted into a detached element and
 * its `<svg>` is handed to the button as the `icon` Node; the button appends it into the icon part.
 */
async function composeVanilla(box: HTMLElement, c: CompositionProps, path: string) {
  let n = 0;
  const host = createHost(runtimeFor(path, { idFactory: () => `e2e-${n++}` }));
  seen(host.runtime);
  const holder = box.ownerDocument.createElement('span');
  const icon = mountIcon(host, holder, iconOf(c));
  const svg = icon.element();
  if (!svg) throw new Error('icon rendered no svg');
  mountButton(host, box, {
    ...buttonProps(c),
    ...(c.text !== undefined && !c.iconOnly && { text: c.text }),
    icon: svg,
  } as never);
  return () => host.destroy();
}

window.__icon = {
  ready: true,
  real,
  seen: null,
  async mount(adapter, fixture, path = 'native', opts = {}) {
    const base = FIXTURES[fixture];
    if (!base) throw new Error(`unknown fixture "${fixture}"`);
    reset();
    history.replaceState(null, '', location.pathname);
    const props = { ...base, ...opts.props };
    const box = container({ ...opts, text: true });
    const mount = adapter === 'react' ? mountReact : adapter === 'vue' ? mountVue : mountVanilla;
    cleanups.push(await mount(box, props, path));
    await frames();
  },
  async mountComposition(adapter, name, path = 'native') {
    const c = COMPOSITIONS[name];
    if (!c) throw new Error(`unknown composition "${name}"`);
    reset();
    history.replaceState(null, '', location.pathname);
    const box = container({ text: false });
    const compose =
      adapter === 'react' ? composeReact : adapter === 'vue' ? composeVue : composeVanilla;
    cleanups.push(await compose(box, c, path));
    await frames();
  },
};
