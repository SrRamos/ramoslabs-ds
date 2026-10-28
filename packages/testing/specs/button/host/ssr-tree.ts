// The trees SSR and hydration render (W1-C01.f), shared by the node render, the jsdom test and the browser
// hydration entry, so "what the server rendered" and "what the client hydrates" are one source.
// The button has no ids (stateless core, ADR-003), so no provider is needed on the server.
import { createElement, type ReactElement } from 'react';
import { h, type VNode } from 'vue';
import { SJButton as ReactButton } from '@ramoslabs/react/button';
import { SJButton as VueButton } from '@ramoslabs/vue/button';
import type { FixtureProps } from '../fixtures';

export const split = (p: FixtureProps) => {
  const { text, icon, name, value, ...contract } = p;
  return { text, icon, native: { ...(name && { name }), ...(value && { value }) }, contract };
};

export const reactEl = (p: FixtureProps, onPress?: () => void): ReactElement => {
  const { text, icon, native, contract } = split(p);
  return createElement(
    ReactButton,
    { ...contract, ...native, ...(onPress && { onPress }), icon } as never,
    p.iconOnly ? undefined : text,
  );
};
export const vueRoot = (p: FixtureProps, onPress?: () => void): VNode => {
  const { text, icon, native, contract } = split(p);
  return h(
    VueButton,
    { ...contract, ...native, ...(onPress && { onPress }) } as never,
    {
      default: () => (p.iconOnly ? undefined : text),
      ...(icon !== undefined && { icon: () => icon }),
    } as never,
  );
};
