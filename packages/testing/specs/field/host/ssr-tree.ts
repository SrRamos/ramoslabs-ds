// The trees SSR, hydration and the browser host render (W1-C02.f), shared by the node render, the jsdom test
// and the browser entries, so "what the server rendered" and "what the client hydrates" are one source. A
// scene (fixtures.ts) becomes an SJForm (or a plain `<form>`) holding SJField > SJInput rows and one native
// submit button. Ids come from React `useId` / Vue 3.5 `useId` (ADR-003); the root prefix is the framework's.
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { createSSRApp, createApp, defineComponent, h, type App, type VNodeChild } from 'vue';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJForm as ReactForm } from '@ramoslabs/react/form';
import { SJField as ReactField } from '@ramoslabs/react/field';
import { SJInput as ReactInput } from '@ramoslabs/react/input';
import { SJForm as VueForm } from '@ramoslabs/vue/form';
import { SJField as VueField } from '@ramoslabs/vue/field';
import { SJInput as VueInput } from '@ramoslabs/vue/input';
import type { FieldSpec, Scene } from '../fixtures';

const liveHost = { create: () => ({ setText: () => undefined }) };

/** The input props of a field spec (contract vocabulary), without undefined keys. */
function inputProps(f: FieldSpec): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const k of [
    'kind',
    'variant',
    'autocomplete',
    'section',
    'meaningful',
    'digits',
    'uppercase',
    'autoSubmit',
  ] as const)
    if (f[k] !== undefined) p[k] = f[k];
  if (f.standalone) {
    p['name'] = f.name;
    if (f.required) p['required'] = true;
    if (f.disabled) p['disabled'] = true;
  }
  return p;
}

const fieldProps = (f: FieldSpec): Record<string, unknown> => {
  const p: Record<string, unknown> = { name: f.name, label: f.label };
  if (f.hint !== undefined) p['hint'] = f.hint;
  if (f.error !== undefined) p['error'] = f.error;
  if (f.errorMessage) p['errorMessage'] = true;
  if (f.required) p['required'] = true;
  if (f.disabled) p['disabled'] = true;
  return p;
};

export type ReactProbe = ComponentType<{ name: string }>;
export type VueProbe = ReturnType<typeof defineComponent>;

export function reactRows(scene: Scene, probe?: ReactProbe): ReactNode[] {
  const rows = scene.fields.map((f) => {
    const control = createElement(ReactInput, {
      ...inputProps(f),
      ...(f.value !== undefined && { defaultValue: f.value }),
      key: 'c',
    });
    return f.standalone
      ? createElement('div', { key: f.name }, control)
      : createElement(
          ReactField.Root,
          { ...fieldProps(f), key: f.name },
          control,
          probe ? createElement(probe, { name: f.name, key: 'p' }) : null,
        );
  });
  rows.push(
    createElement(
      'button',
      { key: '__go', ...(scene.fixedIds !== false && { id: 'go' }), type: 'submit' },
      'Send',
    ),
  );
  return rows;
}

export function reactScene(scene: Scene, probe?: ReactProbe): ReactElement {
  const rows = reactRows(scene, probe);
  const f = scene.form;
  if (f === false)
    return createElement(
      'form',
      { ...(scene.fixedIds !== false && { id: 'f' }), method: 'get', action: '/echo' },
      ...rows,
    );
  return createElement(
    ReactForm.Root,
    {
      ...(scene.fixedIds !== false && { id: 'f' }),
      method: f.method ?? 'get',
      action: f.action ?? '/echo',
      ...(f.enter && { enter: f.enter }),
      ...(f.submits !== undefined && { submits: f.submits }),
      ...(f.autoSubmit !== undefined && { autoSubmit: f.autoSubmit }),
      ...(f.fields && { fields: f.fields as never }),
    },
    ...rows,
  );
}

export function vueRows(scene: Scene, probe?: VueProbe): VNodeChild[] {
  const rows: VNodeChild[] = scene.fields.map((f) => {
    const control = () =>
      h(VueInput, {
        ...inputProps(f),
        ...(f.value !== undefined && { '^value': f.value }),
        key: 'c',
      });
    return f.standalone
      ? h('div', { key: f.name }, control())
      : h(VueField, { ...fieldProps(f), key: f.name }, () => [
          control(),
          probe ? h(probe, { name: f.name, key: 'p' }) : null,
        ]);
  });
  rows.push(
    h(
      'button',
      { key: '__go', ...(scene.fixedIds !== false && { id: 'go' }), type: 'submit' },
      'Send',
    ),
  );
  return rows;
}

export function vueScene(scene: Scene, probe?: VueProbe): VNodeChild {
  const rows = vueRows(scene, probe);
  const f = scene.form;
  if (f === false)
    return h(
      'form',
      { ...(scene.fixedIds !== false && { id: 'f' }), method: 'get', action: '/echo' },
      rows,
    );
  return h(
    VueForm,
    {
      ...(scene.fixedIds !== false && { id: 'f' }),
      method: f.method ?? 'get',
      action: f.action ?? '/echo',
      ...(f.enter && { enter: f.enter }),
      ...(f.submits !== undefined && { submits: f.submits }),
      ...(f.autoSubmit !== undefined && { autoSubmit: f.autoSubmit }),
      ...(f.fields && { fields: f.fields }),
    } as Record<string, unknown>,
    () => rows,
  );
}

export function reactTree(
  scene: Scene,
  idPrefix: string,
  target: 'server' | 'client',
): ReactElement {
  return createElement(
    ReactProvider,
    { idPrefix, target, liveHost: () => liveHost },
    reactScene(scene),
  );
}

export function vueApp(
  scene: Scene,
  idPrefix: string,
  target: 'server' | 'client',
  ssr: boolean,
): App {
  const Root = defineComponent({
    render: () => h(VueProvider, { config: { idPrefix, target }, liveHost }, () => vueScene(scene)),
  });
  const app = ssr ? createSSRApp(Root) : createApp(Root);
  app.config.idPrefix = idPrefix;
  return app;
}
