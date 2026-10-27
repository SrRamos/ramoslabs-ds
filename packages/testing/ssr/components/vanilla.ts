// Vanilla wrapper for the SSR runner. Vanilla has no server renderer, so the "server" pass mounts the
// spec into a detached document and serializes it; the "client" pass mounts the same spec onto that
// markup (enhance in place: existing nodes are reused, attributes are rewritten from the view) and
// onto an empty element. Ids come only from the INJECTED `idFactory` (ADR-003: vanilla has no
// framework id source); a fresh factory is made per pass, so a deterministic factory repeats.
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost, setText, type ComponentSpec } from '@ramoslabs/vanilla/runtime';
import type { MountHandle, RootSpec, SsrWrapper } from '../runner';
import {
  PROBE_KEYS,
  probeInitial,
  probeReduce,
  probeTree,
  type Node,
  type ProbeEvent,
  type ProbeState,
} from './tree';

export interface VanillaProbeProps extends Record<string, unknown> {
  readonly keys: readonly string[];
}

/** Writes `kids` into `parent`, reusing existing element children at the same index and tag. */
function sync(parent: Element, kids: readonly (Node | string)[]): void {
  if (kids.length === 1 && typeof kids[0] === 'string') return setText(parent, kids[0]);
  const doc = parent.ownerDocument;
  kids.forEach((kid, i) => {
    if (typeof kid === 'string') return;
    let el = parent.children[i];
    if (!el || el.localName !== kid.tag) {
      const fresh = doc.createElement(kid.tag);
      if (el) el.replaceWith(fresh);
      else parent.appendChild(fresh);
      el = fresh;
    }
    for (const [k, v] of Object.entries(kid.attrs)) {
      if (v === false) el.removeAttribute(k);
      else el.setAttribute(k, v === true ? '' : v);
    }
    sync(el, kid.children);
  });
}

/** Test-only component built with the real vanilla runtime (`createHost`). */
export const vanillaProbe: ComponentSpec<ProbeState, ProbeEvent, VanillaProbeProps, never> = {
  initial: (props) => probeInitial(props.keys),
  reduce: probeReduce,
  patch: (view, ctx) => sync(ctx.el, [probeTree(ctx.id, view, ctx.props().keys)]),
  attach(ctx) {
    ctx.listen(ctx.el, 'click', (e) => {
      if ((e.target as Element).closest?.('button')) ctx.dispatch({ type: 'toggle' });
    });
  },
};

export interface VanillaWrapperOptions {
  /**
   * Makes the id source for ONE pass (called once per pass). Default: a fresh sequential counter, so
   * the server and client passes agree. Seed a failure by returning one shared/random source.
   */
  readonly makeIdFactory?: () => () => string;
  readonly keys?: readonly string[];
}

const sequential = () => {
  let i = 0;
  return () => `v${i++}`;
};

export function createVanillaWrapper(options: VanillaWrapperOptions = {}): SsrWrapper {
  const makeFactory = options.makeIdFactory ?? sequential;
  const props: VanillaProbeProps = { keys: options.keys ?? PROBE_KEYS };
  const mount = (el: Element, root: RootSpec): MountHandle => {
    const host = createHost(createRuntime({ target: 'client', idPrefix: root.idPrefix }), {
      idFactory: makeFactory(),
      liveHost: { create: () => ({ setText: () => undefined }) },
    });
    host.mount(el, vanillaProbe, props);
    return { diagnostics: [], unmount: () => host.destroy() };
  };
  return {
    name: 'vanilla',
    renderServer(root, env) {
      const el = env.newDocument().createElement('div');
      const handle = mount(el, root);
      const html = el.innerHTML;
      handle.unmount();
      return html;
    },
    hydrate: async (container, root) => mount(container, root),
    renderClient: async (container, root) => mount(container, root),
  };
}
