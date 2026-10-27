// Test-only browser host for the W1-311 text-safety test (ADR-002 text-nodes-only, ADR-013 L2).
// `window.__ts.mount(adapter, label, mode)` renders the W1-316 probe with the REAL adapter runtime and
// the consumer string as its label.
//   - `safe`: the label is passed as the probe's children (React), default slot (Vue) or text node
//     (vanilla). This is the path the adapters must keep.
//   - `innerhtml`: SEEDED DEFECT. The same label is written through `innerHTML`. Only the text-safety
//     test uses it, to prove the test fails when a wrapper injects markup.
import { createElement, StrictMode, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, h, type App, type VNode } from 'vue';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost, type VanillaHost } from '@ramoslabs/vanilla/runtime';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJProbe as ReactProbe } from '../../probe/react/index';
import { SJProbe as VueProbe } from '../../probe/vue/index';
import { mountProbe } from '../../probe/vanilla/index';

export type AdapterName = 'react' | 'vue' | 'vanilla';
export type Mode = 'safe' | 'innerhtml';

const INDICATOR = '<span class="sj-probe__indicator" data-part="indicator"></span>';

interface Mounted {
  destroy(): void;
}

interface TextHost {
  ready: true;
  mount(adapter: AdapterName, label: string, mode: Mode): void;
}

declare global {
  interface Window {
    __ts: TextHost;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};

// Seeded defect, React: the label is written into a span through innerHTML.
function unsafeReact(label: string): ReactElement {
  return createElement(
    'button',
    { type: 'button' },
    createElement('span', { className: 'sj-probe__indicator', 'data-part': 'indicator' }),
    createElement('span', {
      ref: (el: HTMLElement | null) => {
        if (el) el.innerHTML = label;
      },
    }),
  );
}

// Seeded defect, Vue: the label is written into a span through the innerHTML prop.
function unsafeVue(label: string): VNode {
  return h('button', { type: 'button' }, [
    h('span', { class: 'sj-probe__indicator', 'data-part': 'indicator' }),
    h('span', { innerHTML: label }),
  ]);
}

function mountReact(container: HTMLElement, label: string, mode: Mode): Mounted {
  const root = createRoot(container);
  const tree =
    mode === 'safe'
      ? createElement(
          StrictMode,
          null,
          createElement(ReactProvider, { idPrefix: 'ts-' }, createElement(ReactProbe, {}, label)),
        )
      : unsafeReact(label);
  flushSync(() => root.render(tree));
  return { destroy: () => root.unmount() };
}

function mountVue(container: HTMLElement, label: string, mode: Mode): Mounted {
  const app: App = createApp({
    render: () =>
      mode === 'safe'
        ? h(VueProvider, { idPrefix: 'ts-' }, () => h(VueProbe, null, { default: () => label }))
        : unsafeVue(label),
  });
  app.mount(container);
  return { destroy: () => app.unmount() };
}

function mountVanilla(container: HTMLElement, label: string, mode: Mode): Mounted {
  const el = container.appendChild(document.createElement('button'));
  if (mode === 'innerhtml') {
    // Seeded defect: the consumer label is concatenated into innerHTML.
    el.innerHTML = `${INDICATOR}<span>${label}</span>`;
    return { destroy: () => el.remove() };
  }
  let n = 0;
  const host: VanillaHost = createHost(createRuntime({ idFactory: () => `ts-${n++}` }));
  mountProbe(host, el, { label });
  return { destroy: () => host.destroy() };
}

let current: Mounted | undefined;

window.__ts = {
  ready: true,
  mount(adapter, label, mode) {
    current?.destroy();
    const root = rootEl();
    root.replaceChildren();
    const container = root.appendChild(document.createElement('div'));
    current =
      adapter === 'react'
        ? mountReact(container, label, mode)
        : adapter === 'vue'
          ? mountVue(container, label, mode)
          : mountVanilla(container, label, mode);
  },
};
