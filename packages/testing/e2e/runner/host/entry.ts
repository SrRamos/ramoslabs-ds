// Browser host for the L2 runner (W1-309a). Bundled by esbuild (build.mjs) and loaded by host.html.
// One page, three adapters: `window.__sj.mount(adapter, props, defect?)` mounts the W1-316 probe
// with the REAL adapter runtimes into #root and returns update/destroy. Every `pressedChange` the
// wrapper reports is recorded in `window.__sj.events` so the executor can assert the emit contract.
import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
// The probe barrel pulls node:path for its contract paths; the browser bundle takes the wrappers directly.
import { SJProbe as ReactProbe } from '../../../probe/react/index';
import { SJProbe as VueProbe } from '../../../probe/vue/index';
import { mountProbe, probeSpec, type ProbeProps } from '../../../probe/vanilla/index';

export type AdapterName = 'react' | 'vue' | 'vanilla';
/** Seeded wrapper defects. They exist only so the harness can prove it fails on a broken wrapper. */
export type DefectName = 'none' | 'vanilla-wrong-emit' | 'react-lose-focus' | 'vue-wrong-aria';

interface Mounted {
  update(props: ProbeProps): Promise<void>;
  destroy(): void;
}

interface SJGlobal {
  events: boolean[];
  mount(adapter: AdapterName, props: ProbeProps, defect?: DefectName): Promise<Mounted>;
  /** Updates the most recently mounted instance (a controlled owner changing its prop). */
  update(props: ProbeProps): Promise<void>;
  ready: true;
}

declare global {
  interface Window {
    __sj: SJGlobal;
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};

const events: boolean[] = [];
const report = (pressed: boolean): void => void events.push(pressed);
const withReport = (props: ProbeProps): ProbeProps => ({
  ...props,
  onPressedChange: (v: boolean) => {
    report(v);
    props.onPressedChange?.(v);
  },
});

async function mountReact(props: ProbeProps, defect: DefectName): Promise<Mounted> {
  const container = rootEl().appendChild(document.createElement('div'));
  const root = createRoot(container);
  const tree = (p: ProbeProps) =>
    createElement(
      StrictMode,
      null,
      createElement(
        ReactProvider,
        { idPrefix: 'e2e-' },
        createElement(ReactProbe, withReport(p), p.label ?? 'Label'),
      ),
    );
  const render = async (p: ProbeProps) => root.render(tree(p));
  window.IS_REACT_ACT_ENVIRONMENT = false;
  await render(props);
  if (defect === 'react-lose-focus') {
    // Seeded defect: the button node is replaced after each toggle, so focus falls back to <body>.
    container.addEventListener('click', () => {
      setTimeout(() => {
        const b = container.querySelector('button');
        if (b && document.activeElement === b) {
          const clone = b.cloneNode(true) as HTMLElement;
          b.replaceWith(clone);
        }
      }, 0);
    });
  }
  return {
    update: render,
    destroy: () => {
      root.unmount();
      container.remove();
    },
  };
}

async function mountVue(props: ProbeProps, defect: DefectName): Promise<Mounted> {
  const container = rootEl().appendChild(document.createElement('div'));
  const current = ref<ProbeProps>(withReport(props));
  const app: App = createApp({
    render: () =>
      h(VueProvider, { idPrefix: 'e2e-' }, () =>
        h(
          VueProbe,
          {
            pressed: current.value.pressed,
            defaultPressed: current.value.defaultPressed,
            disabled: current.value.disabled,
            onPressedChange: current.value.onPressedChange,
          },
          { default: () => current.value.label ?? 'Label' },
        ),
      ),
  });
  app.mount(container);
  if (defect === 'vue-wrong-aria') {
    // Seeded defect: aria-checked stops following the state after the first change.
    new MutationObserver(() => {
      const b = container.querySelector('button');
      if (b && b.getAttribute('aria-checked') !== 'false') b.setAttribute('aria-checked', 'false');
    }).observe(container, { attributes: true, subtree: true, attributeFilter: ['aria-checked'] });
  }
  return {
    update: async (p) => {
      current.value = withReport(p);
      await nextTick();
    },
    destroy: () => {
      app.unmount();
      container.remove();
    },
  };
}

async function mountVanilla(props: ProbeProps, defect: DefectName): Promise<Mounted> {
  const container = rootEl().appendChild(document.createElement('div'));
  const el = container.appendChild(document.createElement('button'));
  let n = 0;
  const host = createHost(createRuntime({ idFactory: () => `e2e-${n++}` }));
  const label = (p: ProbeProps): ProbeProps => ({ ...withReport(p), label: p.label ?? 'Label' });
  const inst =
    defect === 'vanilla-wrong-emit'
      ? // Seeded defect: the click handler requests the CURRENT value, so the reported pressedChange payload is wrong.
        host.mount(
          el,
          {
            ...probeSpec,
            attach: (ctx) =>
              ctx.listen(ctx.el, 'click', () => void ctx.request('pressed', ctx.view().pressed)),
          },
          label(props),
        )
      : mountProbe(host, el, label(props));
  return {
    update: async (p) => void inst.update(label(p)),
    destroy: () => {
      host.destroy();
      container.remove();
    },
  };
}

let last: Mounted | undefined;

window.__sj = {
  events,
  ready: true,
  async mount(adapter, props, defect = 'none') {
    events.length = 0;
    last?.destroy();
    last =
      adapter === 'react'
        ? await mountReact(props, defect)
        : adapter === 'vue'
          ? await mountVue(props, defect)
          : await mountVanilla(props, defect);
    return last;
  },
  async update(props) {
    if (!last) throw new Error('nothing mounted');
    await last.update(props);
  },
};
