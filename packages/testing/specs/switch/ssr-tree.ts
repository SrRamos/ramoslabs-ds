// The trees SSR and hydration render (W1-C03s.f), shared by the node render, the jsdom test and the
// browser hydration entry, so "what the server rendered" and "what the client hydrates" are one source.
// Ids come from React `useId` / Vue 3.5 `useId` (ADR-003); the root prefix is the framework's own.
import { createElement, type ReactElement } from 'react';
import { createSSRApp, createApp, defineComponent, h, type App } from 'vue';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJSwitch as ReactSwitch } from '@ramoslabs/react/switch';
import { SJSwitch as VueSwitch } from '@ramoslabs/vue/switch';
import type { SwitchFixtureProps } from './fixtures';

const liveHost = { create: () => ({ setText: () => undefined }) };

export function reactTree(
  props: SwitchFixtureProps,
  idPrefix: string,
  target: 'server' | 'client',
): ReactElement {
  return createElement(
    ReactProvider,
    { idPrefix, target, liveHost: () => liveHost },
    createElement(ReactSwitch.Root, props),
  );
}

export function vueApp(
  props: SwitchFixtureProps,
  idPrefix: string,
  target: 'server' | 'client',
  ssr: boolean,
): App {
  const Root = defineComponent({
    render: () =>
      h(VueProvider, { config: { idPrefix, target }, liveHost }, () => h(VueSwitch, { ...props })),
  });
  const app = ssr ? createSSRApp(Root) : createApp(Root);
  app.config.idPrefix = idPrefix;
  return app;
}
