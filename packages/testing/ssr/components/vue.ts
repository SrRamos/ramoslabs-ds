// Vue wrapper for the SSR runner: createSSRApp + vue/server-renderer, then a real hydration
// (`createSSRApp(...).mount(container)`), then a fresh `createApp`. Ids come from Vue 3.5 `useId`;
// the root `idPrefix` is `app.config.idPrefix` (ADR-003: prefix '' to baseId).
import {
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  useId,
  type App,
  type VNode,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { baseId } from '@ramoslabs/core/ids';
import { SJProvider, useSJStore } from '@ramoslabs/vue/runtime';
import type { MountHandle, RootSpec, SsrWrapper } from '../runner';
import {
  PROBE_KEYS,
  captureConsole,
  probeInitial,
  probeReduce,
  probeTree,
  type Node,
  type ProbeEvent,
  type ProbeState,
} from './tree';

export interface VueProbeProps {
  readonly keys?: readonly string[];
  /** Seeded nondeterminism: replaces `useId` as the id source. */
  readonly idSource?: () => string;
}

function toVue(node: Node | string): VNode | string {
  if (typeof node === 'string') return node;
  const attrs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.attrs)) attrs[k] = v;
  return h(
    node.tag,
    attrs,
    node.children.length === 1 && typeof node.children[0] === 'string'
      ? (node.children[0] as string)
      : node.children.map(toVue),
  );
}

/** Test-only component built with the real Vue runtime (`useSJStore`). */
export const VueProbe = defineComponent({
  name: 'VueProbe',
  props: {
    keys: { type: Array as () => readonly string[], default: () => PROBE_KEYS },
    idSource: { type: Function as unknown as () => (() => string) | undefined, default: undefined },
  },
  setup(props) {
    const vid = useId();
    const base = baseId(undefined, props.idSource ?? (() => vid), '');
    const s = useSJStore<ProbeState, ProbeEvent, never>({
      initial: probeInitial(props.keys),
      reduce: probeReduce,
      host: { run: () => undefined },
    });
    return () => toVue(probeTree(base, s.view(), props.keys)) as VNode;
  },
});

const make = (root: RootSpec, props: VueProbeProps, ssr: boolean): App => {
  const Root = defineComponent({
    render: () =>
      h(
        SJProvider,
        {
          config: { idPrefix: root.idPrefix, target: ssr ? 'server' : 'client' },
          liveHost: { create: () => ({ setText: () => undefined }) },
        },
        () => h(VueProbe, props as Record<string, unknown>),
      ),
  });
  const app = ssr ? createSSRApp(Root) : createApp(Root);
  app.config.idPrefix = root.idPrefix;
  return app;
};

export function createVueWrapper(props: VueProbeProps = {}): SsrWrapper {
  const mount = async (container: Element, app: App): Promise<MountHandle> => {
    const { messages } = await captureConsole(async () => {
      app.mount(container);
      await nextTick();
    });
    return { diagnostics: messages, unmount: () => app.unmount() };
  };
  return {
    name: 'vue',
    renderServer: (root) => renderToString(make(root, props, true)),
    // createSSRApp.mount on a container that holds markup hydrates it.
    hydrate: (container, root) => mount(container, make(root, props, true)),
    renderClient: (container, root) => mount(container, make(root, props, false)),
  };
}
