// Browser host for the SJDisclosure conformance run (W1-C06.f). Same contract as the L2 runner's host
// (`window.__sj`: events, real, seen, mount(adapter, props, defect, path), update) so the runner's
// executor drives it unchanged, but it mounts the REAL SJDisclosure of each adapter. A mount is one member or
// a list of members (an exclusive group) inside `#stage`. Events: `open:<bool>` for a single disclosure,
// `m<i>:open:<bool>` for member i of a list. Bundled by build.mjs; the workspace is aliased to source.
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import { createRuntime, detectSupports, type SJRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { define, mountDisclosure, type DisclosureInstance } from '@ramoslabs/vanilla/disclosure';
import { SJDisclosure as ReactDisclosure } from '@ramoslabs/react/disclosure';
import { SJDisclosure as VueDisclosure } from '@ramoslabs/vue/disclosure';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import type { Adapter, DisclosureFixtureProps, Mount } from '../fixtures';

interface Mounted {
  update(props: Mount): Promise<void>;
  destroy(): void;
}

declare global {
  interface Window {
    __dc: {
      /** Mounts the `<sj-disclosure>` custom element (vanilla, light DOM) into the stage. */
      mountElement(p: DisclosureFixtureProps): Promise<void>;
    };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};
const stageEl = (): HTMLElement => {
  const s = document.createElement('div');
  s.id = 'stage';
  rootEl().appendChild(s);
  return s;
};

const events: string[] = [];
const real: SupportsMap = detectSupports(window as never);
const seen = (r: SJRuntime): void => void (window.__sj.seen = r.supports);
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
const runtimeFor = (path: string, extra: Parameters<typeof createRuntime>[0]): SJRuntime =>
  createRuntime({ target: 'client', ...extra, supports: applyPath(real, parsePath(path)) });

const list = (m: Mount): DisclosureFixtureProps[] => (Array.isArray(m) ? m : [m]);
const reporter = (m: Mount, i: number) => (open: boolean) =>
  void events.push(Array.isArray(m) ? `m${i}:open:${open}` : `open:${open}`);

/** The adapter-neutral props without the text parts, which each adapter renders its own way. */
const bare = (p: DisclosureFixtureProps): Omit<DisclosureFixtureProps, 'summary' | 'content'> => {
  const rest: DisclosureFixtureProps = { ...p };
  delete rest.summary;
  delete rest.content;
  return rest;
};

async function mountReact(props: Mount, path: string): Promise<Mounted> {
  const stage = stageEl();
  const root = createRoot(stage);
  const runtime = runtimeFor(path, { idPrefix: 'dc-' });
  const tree = (m: Mount) =>
    createElement(
      StrictMode,
      null,
      createElement(
        ReactProvider,
        { runtime },
        createElement(ReactTap),
        ...list(m).map((p, i) =>
          createElement(
            ReactDisclosure.Root,
            {
              key: i,
              ...bare(p),
              summary: p.summary,
              onOpenChange: ({ open }: { open: boolean }) => reporter(m, i)(open),
            },
            p.content,
          ),
        ),
      ),
    );
  const render = async (m: Mount) => flushSync(() => root.render(tree(m)));
  window.IS_REACT_ACT_ENVIRONMENT = false;
  await render(props);
  return {
    update: render,
    destroy: () => {
      root.unmount();
      stage.remove();
    },
  };
}

async function mountVue(props: Mount, path: string): Promise<Mounted> {
  const stage = stageEl();
  const current = ref<Mount>(props);
  const runtime = runtimeFor(path, { idPrefix: 'dc-' });
  const app: App = createApp({
    render: () =>
      h(VueProvider, { runtime }, () => [
        h(VueTap),
        ...list(current.value).map((p, i) =>
          h(
            VueDisclosure,
            {
              key: i,
              ...bare(p),
              summary: p.summary,
              onOpenChange: ({ open }: { open: boolean }) => reporter(current.value, i)(open),
            },
            () => p.content,
          ),
        ),
      ]),
  });
  app.mount(stage);
  return {
    update: async (m) => {
      current.value = m;
      await nextTick();
    },
    destroy: () => {
      app.unmount();
      stage.remove();
    },
  };
}

async function mountVanilla(props: Mount, path: string): Promise<Mounted> {
  const stage = stageEl();
  let n = 0;
  const host = createHost(runtimeFor(path, { idFactory: () => `dc-${n++}` }));
  seen(host.runtime);
  const withReport = (m: Mount, i: number) => ({
    ...list(m)[i]!,
    onOpenChange: reporter(m, i),
  });
  const insts: DisclosureInstance[] = list(props).map((_, i) => {
    const el = stage.appendChild(document.createElement('details'));
    return mountDisclosure(host, el, withReport(props, i));
  });
  return {
    update: async (m) => void insts.forEach((inst, i) => inst.update(withReport(m, i))),
    destroy: () => {
      host.destroy();
      stage.remove();
    },
  };
}

let last: Mounted | undefined;
let n = 0;
let elementHost: ReturnType<typeof createHost> | undefined;

window.__sj = {
  events,
  real,
  seen: null,
  ready: true,
  async mount(adapter: Adapter, props: Mount, defect = 'none', path = 'native') {
    void defect; // the probe host seeds wrapper defects; this host has none
    events.length = 0;
    window.__sj.seen = null;
    last?.destroy();
    last =
      adapter === 'react'
        ? await mountReact(props, path)
        : adapter === 'vue'
          ? await mountVue(props, path)
          : await mountVanilla(props, path);
    return last;
  },
  async update(props: Mount) {
    if (!last) throw new Error('nothing mounted');
    await last.update(props);
  },
} as unknown as Window['__sj'];

window.__dc = {
  async mountElement(p) {
    events.length = 0;
    last?.destroy();
    const stage = stageEl();
    if (!elementHost) {
      elementHost = createHost(createRuntime({ target: 'client', idFactory: () => `dc-${n++}` }));
      define(elementHost);
    }
    const el = document.createElement('sj-disclosure');
    if (p.defaultOpen === true || p.open === true) el.setAttribute('open', '');
    if (p.disabled === true) el.setAttribute('disabled', '');
    if (p.name !== undefined) el.setAttribute('name', p.name);
    if (p.summary !== undefined) el.setAttribute('summary', p.summary);
    el.append(p.content ?? '');
    stage.appendChild(el);
    last = {
      update: async () => undefined,
      destroy: () => stage.remove(),
    };
  },
};
