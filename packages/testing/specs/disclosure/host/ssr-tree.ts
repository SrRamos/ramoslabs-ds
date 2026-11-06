// The trees SSR and hydration render (W1-C06.f), shared by the node render, the jsdom test and the browser
// hydration entry, so "what the server rendered" and "what the client hydrates" are one source. Ids come from
// React `useId` / Vue 3.5 `useId` (ADR-003); the root prefix is the framework's own. `onOpen` is the owner's
// `openChange` listener: the server ignores it, the hydration page logs what the adapter reports.
import { createElement, type ReactElement } from 'react';
import { createSSRApp, createApp, defineComponent, h, type App } from 'vue';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJDisclosure as ReactDisclosure } from '@ramoslabs/react/disclosure';
import { SJDisclosure as VueDisclosure } from '@ramoslabs/vue/disclosure';
import type { DisclosureFixtureProps } from '../fixtures';

const liveHost = { create: () => ({ setText: () => undefined }) };

const bare = (p: DisclosureFixtureProps) => {
  const rest: DisclosureFixtureProps = { ...p };
  delete rest.summary;
  delete rest.content;
  return rest;
};

export function reactTree(
  props: DisclosureFixtureProps,
  idPrefix: string,
  target: 'server' | 'client',
  onOpen?: (open: boolean) => void,
): ReactElement {
  return createElement(
    ReactProvider,
    { idPrefix, target, liveHost: () => liveHost },
    createElement(
      ReactDisclosure.Root,
      {
        ...bare(props),
        summary: props.summary,
        ...(onOpen && { onOpenChange: ({ open }: { open: boolean }) => onOpen(open) }),
      },
      props.content,
    ),
  );
}

export function vueApp(
  props: DisclosureFixtureProps,
  idPrefix: string,
  target: 'server' | 'client',
  ssr: boolean,
  onOpen?: (open: boolean) => void,
): App {
  const Root = defineComponent({
    render: () =>
      h(VueProvider, { config: { idPrefix, target }, liveHost }, () =>
        h(
          VueDisclosure,
          {
            ...bare(props),
            summary: props.summary,
            ...(onOpen && { onOpenChange: ({ open }: { open: boolean }) => onOpen(open) }),
          },
          () => props.content,
        ),
      ),
  });
  const app = ssr ? createSSRApp(Root) : createApp(Root);
  app.config.idPrefix = idPrefix;
  return app;
}
