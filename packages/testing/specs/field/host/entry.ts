// Browser host for the SJField / SJInput / SJForm conformance run (W1-C02.f). Same contract as the L2
// runner's host (`window.__sj`: events, real, seen, mount(adapter, scene, defect, path), update) but it mounts
// a SCENE (fixtures.ts) with the REAL components of each adapter: an SJForm (or a plain form) holding
// SJField > SJInput rows. `window.__sj.update(scene)` re-renders the same instance (error transitions, late
// mounts, reorders). `window.__fl` carries what the form tests need: a bare native twin, the form readers, the
// live-region log (every non-empty text a live node was given), the field cores (for the 3.3.7 getters) and the
// `<sj-form>` custom elements. Bundled by build.mjs; the workspace is aliased to source.
import { createElement, StrictMode, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  createApp,
  defineComponent,
  h,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import type { App } from 'vue';
import { createRuntime, detectSupports, type SJRuntime } from '@ramoslabs/core/runtime';
import type { FieldParts } from '@ramoslabs/core/field';
import { createHost, type VanillaHost } from '@ramoslabs/vanilla/runtime';
import {
  define as defineForm,
  mountForm,
  type FormInstance,
  type FormOptions,
} from '@ramoslabs/vanilla/form';
import {
  define as defineField,
  mountField,
  type FieldInstance,
  type FieldOptions,
} from '@ramoslabs/vanilla/field';
import {
  define as defineInput,
  mountInput,
  type InputInstance,
  type InputOptions,
} from '@ramoslabs/vanilla/input';
import {
  SJProvider as ReactProvider,
  useRuntime as useReactRuntime,
} from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider, useSJRuntime as useVueRuntime } from '@ramoslabs/vue/runtime';
import { useSJField } from '@ramoslabs/react/field';
import { SJ_FIELD } from '../../../../vue/src/form/context';
import { applyPath, parsePath, type SupportsMap } from '../../../e2e/supports/paths';
import type { Adapter, FieldSpec, Scene } from '../fixtures';
import { reactScene, vueScene } from './ssr-tree';

interface Mounted {
  update(scene: Scene): Promise<void>;
  destroy(): void;
}

/** A bare native control for the twin form. `type` comes from the test (derived from the kinds contract). */
export interface BareSpec {
  name: string;
  type: string;
  label: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  textarea?: boolean;
}

export interface ControlState {
  name: string;
  value: string;
  defaultValue: string;
  valueAttr: string | null;
  required: boolean;
  disabled: boolean;
  valueMissing: boolean;
  matchesInvalid: boolean;
  matchesValid: boolean;
}

declare global {
  interface Window {
    __fl: {
      /** Every non-empty text any live node (`body > [role=status]`) was given, in order. */
      log: string[];
      /** The field cores by name (React/Vue probe, vanilla instance). */
      fields: Record<string, FieldParts>;
      bare(specs: BareSpec[]): void;
      read(formId: 'f' | 'bare'): { entries: [string, string][]; controls: ControlState[] };
      reset(formId: 'f' | 'bare'): void;
      query(formId: 'f' | 'bare'): string;
      /** Defines `sj-form`, `sj-field`, `sj-input` on a vanilla host (idempotent) and returns once upgraded. */
      defineElements(): Promise<void>;
    };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const rootEl = (): HTMLElement => {
  const el = document.getElementById('root');
  if (!el) throw new Error('host page has no #root');
  return el;
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

const fields: Record<string, FieldParts> = {};

// ---- live-region log ----------------------------------------------------------------------------------
const log: string[] = [];
const lastText = new WeakMap<Element, string>();
new MutationObserver(() => {
  for (const node of document.querySelectorAll('body > [role="status"], body > [role="alert"]')) {
    const t = node.textContent ?? '';
    if (t !== '' && lastText.get(node) !== t) log.push(t);
    lastText.set(node, t);
  }
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

// ---- React ----------------------------------------------------------------------------------------------
const ReactProbe = ({ name }: { name: string }): null => {
  const parts = useSJField();
  useEffect(() => {
    if (parts) fields[name] = parts;
    return () => void delete fields[name];
  }, [name, parts]);
  return null;
};

async function mountReact(scene: Scene, path: string): Promise<Mounted> {
  const root = createRoot(rootEl());
  const runtime = runtimeFor(path, { idPrefix: 'fld-' });
  const tree = (s: Scene) =>
    createElement(
      StrictMode,
      null,
      createElement(ReactProvider, { runtime }, createElement(ReactTap), reactScene(s, ReactProbe)),
    );
  const render = async (s: Scene) => flushSync(() => root.render(tree(s)));
  window.IS_REACT_ACT_ENVIRONMENT = false;
  await render(scene);
  return { update: render, destroy: () => root.unmount() };
}

// ---- Vue ------------------------------------------------------------------------------------------------
const VueProbe = defineComponent({
  props: { name: { type: String, required: true } },
  setup(props) {
    const parts = inject(SJ_FIELD, undefined);
    onMounted(() => void (parts && (fields[props.name] = parts)));
    onBeforeUnmount(() => void delete fields[props.name]);
    return () => null;
  },
});

async function mountVue(scene: Scene, path: string): Promise<Mounted> {
  const current = ref<Scene>(scene);
  const runtime = runtimeFor(path, { idPrefix: 'fld-' });
  const app: App = createApp({
    render: () => h(VueProvider, { runtime }, () => [h(VueTap), vueScene(current.value, VueProbe)]),
  });
  app.mount(rootEl());
  return {
    update: async (s) => {
      current.value = s;
      await nextTick();
      await nextTick();
    },
    destroy: () => app.unmount(),
  };
}

// ---- vanilla --------------------------------------------------------------------------------------------
interface Row {
  root: HTMLElement;
  field?: FieldInstance;
  input: InputInstance;
}

const fieldOptions = (f: FieldSpec): FieldOptions => ({
  name: f.name,
  label: f.label,
  ...(f.hint !== undefined && { hint: f.hint }),
  ...(f.error !== undefined && { error: f.error }),
  ...(f.errorMessage && { errorMessage: true }),
  ...(f.required && { required: true }),
  ...(f.disabled && { disabled: true }),
});
const inputOptions = (f: FieldSpec): InputOptions => ({
  ...(f.kind !== undefined && { kind: f.kind as never }),
  ...(f.variant && { variant: f.variant }),
  ...(f.autocomplete !== undefined && { autocomplete: f.autocomplete }),
  ...(f.section !== undefined && { section: f.section }),
  ...(f.meaningful && { meaningful: true }),
  ...(f.digits !== undefined && { digits: f.digits }),
  ...(f.uppercase && { uppercase: true }),
  ...(f.autoSubmit && { autoSubmit: true }),
  ...(f.standalone && {
    name: f.name,
    ...(f.required && { required: true }),
    ...(f.disabled && { disabled: true }),
  }),
});
const formOptions = (s: Scene): FormOptions => {
  const f = s.form;
  if (f === false) return {};
  return {
    ...(f.enter && { enter: f.enter }),
    ...(f.submits !== undefined && { submits: f.submits }),
    ...(f.autoSubmit !== undefined && { autoSubmit: f.autoSubmit }),
    ...(f.fields && { fields: f.fields as never }),
  };
};

async function mountVanilla(scene: Scene, path: string): Promise<Mounted> {
  const formEl = document.createElement('form');
  formEl.id = 'f';
  const spec = scene.form;
  formEl.method = spec === false ? 'get' : (spec.method ?? 'get');
  formEl.setAttribute('action', spec === false ? '/echo' : (spec.action ?? '/echo'));
  const go = document.createElement('button');
  go.type = 'submit';
  go.id = 'go';
  go.textContent = 'Send';
  formEl.append(go);
  rootEl().append(formEl);
  let n = 0;
  const host: VanillaHost = createHost(runtimeFor(path, { idFactory: () => `fld-${n++}` }));
  seen(host.runtime);
  const form: FormInstance | undefined =
    spec === false ? undefined : mountForm(host, formEl, formOptions(scene));
  const rows = new Map<string, Row>();

  const create = (f: FieldSpec): Row => {
    const root = document.createElement('div');
    const slot = document.createElement('span');
    let field: FieldInstance | undefined;
    if (f.standalone) root.append(slot);
    else {
      formEl.insertBefore(root, go);
      field = mountField(host, root, fieldOptions(f), { ...(form && { form }) });
      field.place(slot);
      fields[f.name] = field.parts;
    }
    if (f.standalone) formEl.insertBefore(root, go);
    const input = mountInput(host, slot, inputOptions(f), { ...(field && { field }) });
    if (f.value !== undefined && input.control) {
      // A default: the `value` attribute of an input, the text content of a textarea (what `reset` returns to).
      if (input.control.localName === 'textarea') input.control.textContent = f.value;
      else input.control.setAttribute('value', f.value);
      input.control.value = f.value;
    }
    return { root, field, input };
  };

  const apply = (s: Scene) => {
    const names = new Set(s.fields.map((f) => f.name));
    for (const [name, row] of rows)
      if (!names.has(name)) {
        row.input.destroy();
        row.field?.destroy();
        row.root.remove();
        delete fields[name];
        rows.delete(name);
      }
    for (const f of s.fields) {
      const row = rows.get(f.name);
      if (!row) rows.set(f.name, create(f));
      else {
        row.field?.update(fieldOptions(f));
        row.input.update(inputOptions(f));
      }
    }
    // Put the rows in scene order (only the ones out of place move), then let each field re-read its position.
    s.fields.forEach((f, i) => {
      const row = rows.get(f.name)!;
      if (formEl.children[i] !== row.root) formEl.insertBefore(row.root, formEl.children[i] ?? go);
    });
    form?.update(formOptions(s));
    for (const row of rows.values()) row.field?.sync();
  };
  apply(scene);

  return {
    update: async (s) => void apply(s),
    destroy: () => {
      host.destroy();
      formEl.remove();
      for (const k of Object.keys(fields)) delete fields[k];
    },
  };
}

let last: Mounted | undefined;
window.__sj = {
  events,
  real,
  seen: null,
  ready: true,
  async mount(adapter: Adapter, scene: Scene, defect = 'none', path = 'native') {
    void defect; // the probe host seeds wrapper defects; this host has none
    events.length = 0;
    window.__sj.seen = null;
    last?.destroy();
    rootEl().replaceChildren();
    for (const k of Object.keys(fields)) delete fields[k];
    last =
      adapter === 'react'
        ? await mountReact(scene, path)
        : adapter === 'vue'
          ? await mountVue(scene, path)
          : await mountVanilla(scene, path);
    return last;
  },
  async update(scene: Scene) {
    if (!last) throw new Error('nothing mounted');
    await last.update(scene);
  },
} as unknown as Window['__sj'];

// ---- bare twin and readers ------------------------------------------------------------------------------
const controlsOf = (form: HTMLFormElement): (HTMLInputElement | HTMLTextAreaElement)[] =>
  [...form.elements].filter(
    (e): e is HTMLInputElement | HTMLTextAreaElement =>
      e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement,
  );

let elementHost: VanillaHost | undefined;
window.__fl = {
  log,
  fields,
  bare(specs) {
    document.getElementById('bare')?.remove();
    const form = document.createElement('form');
    form.id = 'bare';
    form.method = 'get';
    form.setAttribute('action', '/echo');
    for (const s of specs) {
      const label = form.appendChild(document.createElement('label'));
      label.append(s.label);
      const input = label.appendChild(document.createElement(s.textarea ? 'textarea' : 'input'));
      if (input instanceof HTMLInputElement) input.type = s.type;
      input.name = s.name;
      if (s.value !== undefined) {
        if (input instanceof HTMLInputElement) input.defaultValue = s.value;
        else input.defaultValue = s.value;
        input.value = s.value;
      }
      input.required = s.required === true;
      input.disabled = s.disabled === true;
    }
    const go = form.appendChild(document.createElement('button'));
    go.type = 'submit';
    go.textContent = 'Send';
    rootEl().appendChild(form);
  },
  read(formId) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) throw new Error(`no #${formId}`);
    return {
      entries: [...new FormData(form).entries()].map(([k, v]) => [k, String(v)]),
      controls: controlsOf(form).map((c) => ({
        name: c.name,
        value: c.value,
        defaultValue: c.defaultValue,
        valueAttr: c.getAttribute('value'),
        required: c.required,
        disabled: c.disabled,
        valueMissing: c.validity.valueMissing,
        matchesInvalid: c.matches(':invalid'),
        matchesValid: c.matches(':valid'),
      })),
    };
  },
  reset: (formId) => (document.getElementById(formId) as HTMLFormElement).reset(),
  query: (formId) => {
    const form = document.getElementById(formId) as HTMLFormElement;
    // Submission normalises a textarea's line breaks to CRLF; FormData does not.
    return new URLSearchParams(
      [...new FormData(form).entries()].map(([k, v]) => [k, String(v).replace(/\r?\n/g, '\r\n')]),
    ).toString();
  },
  async defineElements() {
    if (!elementHost) {
      let n = 0;
      elementHost = createHost(createRuntime({ target: 'client', idFactory: () => `el-${n++}` }));
      // Ancestors first, so each descendant finds its form and field already upgraded.
      defineForm(elementHost);
      defineField(elementHost);
      defineInput(elementHost);
    }
    await customElements.whenDefined('sj-input');
    await new Promise((r) => setTimeout(r, 60));
  },
};
