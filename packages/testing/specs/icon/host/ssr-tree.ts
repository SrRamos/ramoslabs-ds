// The trees SSR and hydration render (W1-C12.f), shared by the node render, the jsdom test and the browser
// hydration entry, so "what the server rendered" and "what the client hydrates" are one source.
// The icon has no ids (stateless core, ADR-003), so a provider is needed only to carry a runtime `dir`
// (fixture `rtl-runtime`) or to prove that a different `idPrefix` changes nothing.
import { createElement, type ReactElement } from 'react';
import { h, type VNode } from 'vue';
import { createRuntime } from '@ramoslabs/core/runtime';
import { SJIcon as ReactIcon } from '@ramoslabs/react/icon';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJIcon as VueIcon } from '@ramoslabs/vue/icon';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import type { FixtureProps } from '../fixtures';

export interface TreeOptions {
  /** Wraps the icon in a provider whose runtime carries this `idPrefix` (the output must not change). */
  idPrefix?: string;
}

/** Contract props and consumer attributes, as one bag. */
export const iconProps = (p: FixtureProps): Record<string, unknown> => ({
  icon: p.icon,
  ...(p.size !== undefined && { size: p.size }),
  ...(p.label !== undefined && { label: p.label }),
  ...(p.dir !== undefined && { dir: p.dir }),
  ...p.attrs,
});

const needsProvider = (p: FixtureProps, o: TreeOptions) =>
  p.runtimeDir !== undefined || o.idPrefix !== undefined;
const runtimeOf = (p: FixtureProps, o: TreeOptions) =>
  createRuntime({
    target: 'server',
    ...(p.runtimeDir !== undefined && { dir: p.runtimeDir }),
    ...(o.idPrefix !== undefined && { idPrefix: o.idPrefix }),
  });

export const reactEl = (p: FixtureProps, o: TreeOptions = {}): ReactElement => {
  const icon = createElement(ReactIcon, iconProps(p) as never);
  return needsProvider(p, o)
    ? createElement(ReactProvider, { runtime: runtimeOf(p, o) }, icon)
    : icon;
};

export const vueRoot = (p: FixtureProps, o: TreeOptions = {}): VNode =>
  needsProvider(p, o)
    ? h(VueProvider, { runtime: runtimeOf(p, o) }, () => h(VueIcon, iconProps(p) as never))
    : h(VueIcon, iconProps(p) as never);
