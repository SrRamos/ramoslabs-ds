// Browser host for the SJSwitch conformance run (W1-C03s.f). Same contract as the L2 runner's host
// (`window.__sj`: events, real, seen, mount(adapter, props, defect, path), update) so the runner's
// executor drives it unchanged, but it mounts the REAL SJSwitch of each adapter inside a native
// <form>, and adds `window.__sw` for the form tests: a bare `<input type=checkbox>` twin, the
// `<sj-switch>` element, and the form readers. Bundled by build.mjs; the workspace is aliased to source.
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import { createRuntime, type SJRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { define, mountSwitch } from '@ramoslabs/vanilla/switch';
import { SJSwitch as ReactSwitch } from '@ramoslabs/react/switch';
import { SJSwitch as VueSwitch } from '@ramoslabs/vue/switch';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { detectSupports } from '../../../e2e/supports/detect';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import type { Adapter, SwitchFixtureProps } from '../fixtures';

export type HostProps = SwitchFixtureProps;

interface Mounted {
  update(props: HostProps): Promise<void>;
  destroy(): void;
}

interface FormEntries {
  entries: [string, string][];
  checked: boolean;
  defaultChecked: boolean;
  checkedAttr: boolean;
  disabled: boolean;
  matchesChecked: boolean;
  matchesDisabled: boolean;
}

declare global {
  interface Window {
    __sw: {
      /** Mounts the `<sj-switch>` custom element (vanilla, light DOM) inside the form. */
      mountElement(p: HostProps): Promise<void>;
      /** A bare `<input type=checkbox>` twin in its own form (`#bare`), same props. */
      bare(p: HostProps): void;
      /** What a form would submit and the input's own state, for `#f` (the switch) or `#bare`. */
      read(formId: 'f' | 'bare'): FormEntries;
      /** Resets `#f` or `#bare` with the native `form.reset()`. */
      reset(formId: 'f' | 'bare'): void;
      /** The current serialisation `#f` would navigate with (GET), as `name=value&...`. */
      query(formId: 'f' | 'bare'): string;
    };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
};

/** A native form for the switch. GET to /echo so a real submission can be read back from the URL. */
function formFor(id: string): HTMLFormElement {
  const f = document.createElement('form');
  f.id = id;
  f.method = 'get';
  f.action = '/echo';
  rootEl().appendChild(f);
  return f;
}

const events: boolean[] = [];
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
const report = (checked: boolean): void => void events.push(checked);

async function mountReact(props: HostProps, path: string): Promise<Mounted> {
  const form = formFor('f');
  const root = createRoot(form);
  const runtime = runtimeFor(path, { idPrefix: 'sw-' });
  const tree = (p: HostProps) =>
    createElement(
      StrictMode,
      null,
      createElement(
        ReactProvider,
        { runtime },
        createElement(ReactTap),
        createElement(ReactSwitch.Root, {
          ...p,
          onCheckedChange: ({ checked }: { checked: boolean }) => report(checked),
        }),
      ),
    );
  const render = async (p: HostProps) => flushSync(() => root.render(tree(p)));
  window.IS_REACT_ACT_ENVIRONMENT = false;
  await render(props);
  return {
    update: render,
    destroy: () => {
      root.unmount();
      form.remove();
    },
  };
}

async function mountVue(props: HostProps, path: string): Promise<Mounted> {
  const form = formFor('f');
  const current = ref<HostProps>(props);
  const runtime = runtimeFor(path, { idPrefix: 'sw-' });
  const app: App = createApp({
    render: () =>
      h(VueProvider, { runtime }, () => [
        h(VueTap),
        h(VueSwitch, {
          ...current.value,
          onCheckedChange: ({ checked }: { checked: boolean }) => report(checked),
        }),
      ]),
  });
  app.mount(form);
  return {
    update: async (p) => {
      current.value = p;
      await nextTick();
    },
    destroy: () => {
      app.unmount();
      form.remove();
    },
  };
}

async function mountVanilla(props: HostProps, path: string): Promise<Mounted> {
  const form = formFor('f');
  const label = form.appendChild(document.createElement('label'));
  let n = 0;
  const host = createHost(runtimeFor(path, { idFactory: () => `sw-${n++}` }));
  seen(host.runtime);
  const withReport = (p: HostProps) => ({ ...p, onCheckedChange: report });
  const inst = mountSwitch(host, label, withReport(props));
  return {
    update: async (p) => void inst.update(withReport(p)),
    destroy: () => {
      host.destroy();
      form.remove();
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
  async mount(adapter: Adapter, props: HostProps, defect = 'none', path = 'native') {
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
  async update(props: HostProps) {
    if (!last) throw new Error('nothing mounted');
    await last.update(props);
  },
} as unknown as Window['__sj'];

const read = (formId: 'f' | 'bare'): FormEntries => {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  const input = form?.querySelector('input[type=checkbox]') as HTMLInputElement | null;
  if (!form || !input) throw new Error(`no ${formId} form with a checkbox`);
  return {
    entries: [...new FormData(form).entries()].map(([k, v]) => [k, String(v)]),
    checked: input.checked,
    defaultChecked: input.defaultChecked,
    checkedAttr: input.hasAttribute('checked'),
    disabled: input.disabled,
    matchesChecked: input.matches(':checked'),
    matchesDisabled: input.matches(':disabled'),
  };
};

window.__sw = {
  async mountElement(p) {
    events.length = 0;
    last?.destroy();
    const form = formFor('f');
    if (!elementHost) {
      elementHost = createHost(createRuntime({ target: 'client', idFactory: () => `sw-${n++}` }));
      define(elementHost);
    }
    const el = document.createElement('sj-switch');
    for (const [k, v] of Object.entries(p)) {
      if (k === 'checked' || k === 'defaultChecked') continue;
      if (v === true) el.setAttribute(k, '');
      else if (v !== false && v !== undefined) el.setAttribute(k, String(v));
    }
    if (p.defaultChecked === true || p.checked === true) el.setAttribute('checked', '');
    el.addEventListener('change', (e) => report((e.target as HTMLInputElement).checked));
    form.appendChild(el);
    last = {
      update: async () => undefined,
      destroy: () => {
        el.remove();
        form.remove();
      },
    };
  },
  bare(p) {
    const form = formFor('bare');
    const label = form.appendChild(document.createElement('label'));
    const input = label.appendChild(document.createElement('input'));
    input.type = 'checkbox';
    if (p.name !== undefined) input.name = p.name;
    if (p.value !== undefined) input.value = p.value;
    if (p.defaultChecked === true || p.checked === true) input.defaultChecked = true;
    input.disabled = p.disabled === true;
    label.append(p.label ?? '');
  },
  read,
  reset: (formId) => (document.getElementById(formId) as HTMLFormElement).reset(),
  query: (formId) => {
    const form = document.getElementById(formId) as HTMLFormElement;
    return new URLSearchParams(
      [...new FormData(form).entries()].map(([k, v]) => [k, String(v)]),
    ).toString();
  },
};
