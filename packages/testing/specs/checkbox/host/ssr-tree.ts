// The trees SSR and hydration render (W1-C03c.f), shared by the node render, the jsdom test and the
// browser hydration entry, so "what the server rendered" and "what the client hydrates" are one source.
// Ids come from React `useId` / Vue 3.5 `useId` (ADR-003); the root prefix is the framework's own.
import { createElement, type ReactElement } from 'react';
import { createSSRApp, createApp, defineComponent, h, type App } from 'vue';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJCheckbox as ReactCheckbox } from '@ramoslabs/react/checkbox';
import { SJCheckbox as VueCheckbox } from '@ramoslabs/vue/checkbox';
import type { CheckboxFixtureProps } from '../fixtures';

const liveHost = { create: () => ({ setText: () => undefined }) };

export function reactTree(
  props: CheckboxFixtureProps,
  idPrefix: string,
  target: 'server' | 'client',
): ReactElement {
  return createElement(
    ReactProvider,
    { idPrefix, target, liveHost: () => liveHost },
    createElement(ReactCheckbox.Root, props),
  );
}

export function vueApp(
  props: CheckboxFixtureProps,
  idPrefix: string,
  target: 'server' | 'client',
  ssr: boolean,
): App {
  const Root = defineComponent({
    render: () =>
      h(VueProvider, { config: { idPrefix, target }, liveHost }, () =>
        h(VueCheckbox, { ...props }),
      ),
  });
  const app = ssr ? createSSRApp(Root) : createApp(Root);
  app.config.idPrefix = idPrefix;
  return app;
}
