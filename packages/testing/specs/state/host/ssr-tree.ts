// The trees SSR and hydration render (W1-C11.f), shared by the node render, the jsdom test and the browser
// hydration entry, so "what the server rendered" and "what the client hydrates" are one source.
// SJState is stateless (no ids, ADR-003). A provider carries the runtime (and with it the live registry the
// announcement goes to after mount); on the server it is a `target: 'server'` runtime, so nothing is attached.
// Composition is real: an SJIcon in the icon part and an SJButton in the actions part, on every adapter.
import { createElement, Fragment, type ReactElement, type ReactNode } from 'react';
import { h, type VNode, type VNodeChild } from 'vue';
import { createRuntime, type SJRuntime } from '@ramoslabs/core/runtime';
import { SJButton as ReactButton } from '@ramoslabs/react/button';
import { SJIcon as ReactIcon } from '@ramoslabs/react/icon';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJState as ReactState } from '@ramoslabs/react/state';
import { SJButton as VueButton } from '@ramoslabs/vue/button';
import { SJIcon as VueIcon } from '@ramoslabs/vue/icon';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJState as VueState } from '@ramoslabs/vue/state';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountButton } from '@ramoslabs/vanilla/button';
import { mountIcon } from '@ramoslabs/vanilla/icon';
import type { VanillaStateProps } from '@ramoslabs/vanilla/state';
import type { FixtureProps } from '../fixtures';

export interface TreeOptions {
  /** Runtime for the provider; default is a fresh `target: 'server'` runtime. */
  runtime?: SJRuntime;
  /** Wrap in a provider whose runtime carries this `idPrefix` (the output must not change). */
  idPrefix?: string;
  /** Skip the provider altogether (the component must still render, silently). */
  bare?: boolean;
  /** Extra React children rendered next to the state (the host adds its runtime tap). */
  tap?: ReactNode;
}

const runtimeOf = (o: TreeOptions): SJRuntime =>
  o.runtime ??
  createRuntime({ target: 'server', ...(o.idPrefix !== undefined && { idPrefix: o.idPrefix }) });

/** Contract props and consumer attributes (the slots are adapter specific and added by each builder). */
export const stateProps = (p: FixtureProps): Record<string, unknown> => ({
  ...(p.variant !== undefined && { variant: p.variant }),
  ...(p.heading !== undefined && { heading: p.heading }),
  ...(p.description !== undefined && { description: p.description }),
  ...(p.announce !== undefined && { announce: p.announce }),
  ...(p.interrupt !== undefined && { interrupt: p.interrupt }),
  ...p.attrs,
});

// ---- React ---------------------------------------------------------------------------------------------------

const reactIcon = (p: FixtureProps): ReactNode =>
  p.icon
    ? createElement(ReactIcon, {
        icon: p.icon.data,
        size: 'lg',
        ...(p.icon.label !== undefined && { label: p.icon.label }),
        ...(p.icon.spin && { 'data-spin': 'true' }),
      } as never)
    : undefined;

const reactTitle = (p: FixtureProps): ReactNode => {
  if (p.titleSlot !== undefined) return p.titleSlot;
  if (p.titleElement)
    return createElement(
      Fragment,
      null,
      createElement('b', null, p.titleElement.strong),
      p.titleElement.rest,
    );
  return undefined;
};

/** The SJState element for a fixture, with the extra props merged on top (the host's update path uses it). */
export const reactState = (p: FixtureProps, extra: Record<string, unknown> = {}): ReactElement =>
  createElement(ReactState, {
    ...stateProps(p),
    ...(reactIcon(p) !== undefined && { icon: reactIcon(p) }),
    ...(reactTitle(p) !== undefined && { title: reactTitle(p) }),
    ...(p.action !== undefined && { actions: createElement(ReactButton, null, p.action) }),
    ...extra,
  } as never);

export const reactEl = (p: FixtureProps, o: TreeOptions = {}): ReactElement =>
  o.bare
    ? reactState(p)
    : createElement(ReactProvider, { runtime: runtimeOf(o) }, o.tap, reactState(p));

// ---- Vue -----------------------------------------------------------------------------------------------------

const vueTitle = (p: FixtureProps): (() => VNodeChild) | undefined =>
  p.titleSlot !== undefined
    ? () => p.titleSlot
    : p.titleElement
      ? () => [h('b', p.titleElement!.strong), p.titleElement!.rest]
      : undefined;

export const vueState = (p: FixtureProps, extra: Record<string, unknown> = {}): VNode => {
  const title = vueTitle(p);
  const slots = {
    ...(p.icon && {
      icon: () =>
        h(VueIcon, {
          icon: p.icon!.data,
          size: 'lg',
          ...(p.icon!.label !== undefined && { label: p.icon!.label }),
          ...(p.icon!.spin && { 'data-spin': 'true' }),
        } as never),
    }),
    ...(title && { title }),
    ...(p.action !== undefined && { actions: () => h(VueButton, null, () => p.action) }),
  };
  return h(VueState, { ...stateProps(p), ...extra } as never, slots);
};

export const vueRoot = (p: FixtureProps, o: TreeOptions = {}): VNode =>
  o.bare ? vueState(p) : h(VueProvider, { runtime: runtimeOf(o) }, () => vueState(p));

// ---- Vanilla -------------------------------------------------------------------------------------------------

type VanillaHost = ReturnType<typeof createHost>;

/**
 * Vanilla options for a fixture. Slots are strings or Nodes: the icon is a real SJIcon mounted in a detached
 * span (its `<svg>` is handed over), the action a real SJButton mounted in a detached div, the element title a
 * fragment. Nodes are moved into the parts by the adapter.
 */
export function vanillaProps(p: FixtureProps, host: VanillaHost): VanillaStateProps {
  const doc = document;
  const props: Record<string, unknown> = { ...stateProps(p) };
  const { attrs: _attrs, ...contract } = props as Record<string, unknown>;
  void _attrs;
  const out: Record<string, unknown> = { ...contract };
  if (p.icon) {
    const holder = doc.createElement('span');
    const icon = mountIcon(host, holder, {
      icon: p.icon.data,
      size: 'lg',
      ...(p.icon.label !== undefined && { label: p.icon.label }),
      ...(p.icon.spin && { attrs: { 'data-spin': 'true' } }),
    });
    out['icon'] = icon.element();
  }
  if (p.titleSlot !== undefined) out['title'] = p.titleSlot;
  if (p.titleElement) {
    const f = doc.createDocumentFragment();
    f.append(
      Object.assign(doc.createElement('b'), { textContent: p.titleElement.strong }),
      p.titleElement.rest,
    );
    out['title'] = f;
  }
  if (p.action !== undefined) {
    const holder = doc.createElement('span');
    mountButton(host, holder, { text: p.action });
    // The control itself goes into the actions part (the holder only hosts the button's delegated listener).
    out['actions'] = holder.firstElementChild;
  }
  return out as VanillaStateProps;
}

// ---- Live-region observation ---------------------------------------------------------------------------------
// Records what the live-region hosts SPEAK: every time a live node receives non-empty text, one entry
// {role, text}. The registry clears a node ("") and then sets the text, so each announcement is exactly one added
// non-empty text node, whichever adapter's host made the node. Live nodes are the ones the three DOM hosts create:
// a `body`-level element with `role="status"` or `role="alert"` and an `aria-live`.
export interface Spoken {
  role: 'status' | 'alert';
  text: string;
}

export interface LiveRegionInfo {
  role: string | null;
  live: string | null;
  atomic: string | null;
  text: string;
  /** Hidden visually yet exposed (not display:none / visibility:hidden / aria-hidden). */
  exposed: boolean;
}

export const isLiveNode = (n: Node | null): n is HTMLElement =>
  !!n &&
  n.nodeType === 1 &&
  (n as HTMLElement).hasAttribute('aria-live') &&
  /^(status|alert)$/.test((n as HTMLElement).getAttribute('role') ?? '');

export function recordSpoken(into: Spoken[]): () => void {
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type !== 'childList' || !isLiveNode(r.target)) continue;
      for (const added of r.addedNodes) {
        const text = added.textContent?.trim() ?? '';
        if (text) into.push({ role: r.target.getAttribute('role') as Spoken['role'], text });
      }
    }
  });
  obs.observe(document.body, { subtree: true, childList: true });
  return () => obs.disconnect();
}

/** The live regions currently in the document (outside the mounted tree). */
export function liveRegions(): LiveRegionInfo[] {
  return [...document.querySelectorAll('[aria-live]')].filter(isLiveNode).map((n) => {
    const s = getComputedStyle(n);
    return {
      role: n.getAttribute('role'),
      live: n.getAttribute('aria-live'),
      atomic: n.getAttribute('aria-atomic'),
      text: n.textContent ?? '',
      exposed:
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        n.getAttribute('aria-hidden') !== 'true',
    };
  });
}
