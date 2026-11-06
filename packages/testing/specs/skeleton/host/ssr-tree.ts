// The trees SSR and hydration render, shared by the node render, the jsdom test and the browser hydration entry,
// so "what the server rendered" and "what the client hydrates" are one source. SJSkeleton is stateless in markup
// (no ids, ADR-003). A provider carries the runtime (and with it the live registry and the scheduler); on the
// server it is a `target: 'server'` runtime whose scheduler never fires, so no timer starts and nothing is attached.
// A group composes real SJSkeleton shapes in its `skeleton` slot and plain content (the same box) as its default
// slot, on every adapter.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { h, type VNode } from 'vue';
import { createRuntime, type SJRuntime } from '@ramoslabs/core/runtime';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJSkeleton as ReactSkeleton } from '@ramoslabs/react/skeleton';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { SJSkeleton as VueSkeleton } from '@ramoslabs/vue/skeleton';
import { SJState as ReactState } from '@ramoslabs/react/state';
import { SJState as VueState } from '@ramoslabs/vue/state';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountSkeleton, type VanillaSkeletonProps } from '@ramoslabs/vanilla/skeleton';
import { mountState } from '@ramoslabs/vanilla/state';
import { FOLLOWER_TEXT, LOADED_LINES, type FixtureProps } from '../fixtures';

export interface TreeOptions {
  /** Runtime for the provider; default is a fresh `target: 'server'` runtime. */
  runtime?: SJRuntime;
  /** Wrap in a provider whose runtime carries this `idPrefix` (the output must not change). */
  idPrefix?: string;
  /** Skip the provider altogether (the component must still render, silently). */
  bare?: boolean;
  /** Extra React children rendered next to the skeleton (the host adds its runtime tap). */
  tap?: ReactNode;
}

const runtimeOf = (o: TreeOptions): SJRuntime =>
  o.runtime ??
  createRuntime({ target: 'server', ...(o.idPrefix !== undefined && { idPrefix: o.idPrefix }) });

/** Contract props and consumer attributes (the slots are adapter specific and added by each builder). */
export const skeletonProps = (p: FixtureProps): Record<string, unknown> => ({
  ...(p.shape !== undefined && { shape: p.shape }),
  ...(p.lines !== undefined && { lines: p.lines }),
  ...(p.ratio !== undefined && { ratio: p.ratio }),
  ...(p.size !== undefined && { size: p.size }),
  ...(p.animation !== undefined && { animation: p.animation }),
  ...(p.loading !== undefined && { loading: p.loading }),
  ...(p.delay !== undefined && { delay: p.delay }),
  ...(p.minDuration !== undefined && { minDuration: p.minDuration }),
  ...(p.announce !== undefined && { announce: p.announce }),
  ...p.attrs,
});

const isGroup = (p: FixtureProps): boolean => p.shape === 'group';

// ---- React ---------------------------------------------------------------------------------------------------

const rEl = createElement;
/** The placeholder layout: an avatar circle and a three-line text, in the card box. */
const reactPlaceholder = (): ReactNode =>
  rEl(
    'div',
    { className: 'w-card' },
    rEl(ReactSkeleton, { shape: 'circle' }),
    rEl('div', { className: 'w-card__body' }, rEl(ReactSkeleton, { shape: 'text', lines: 3 })),
  );
/** The loaded layout: the same box, made of real content. */
const reactLoaded = (): ReactNode =>
  rEl(
    'div',
    { className: 'w-card' },
    rEl('div', { className: 'w-card__avatar', 'aria-hidden': 'true' }),
    rEl(
      'div',
      { className: 'w-card__body' },
      ...LOADED_LINES.map((t) => rEl('p', { key: t, className: 'w-card__line' }, t)),
    ),
  );

/** The SJSkeleton element for a fixture, with the extra props merged on top (the host's update path uses it). */
export const reactSkeleton = (
  p: FixtureProps,
  extra: Record<string, unknown> = {},
): ReactElement =>
  isGroup(p)
    ? rEl(
        ReactSkeleton,
        { ...skeletonProps(p), skeleton: reactPlaceholder(), ...extra } as never,
        reactLoaded(),
      )
    : rEl(ReactSkeleton, { ...skeletonProps(p), ...extra } as never);

export const reactEl = (p: FixtureProps, o: TreeOptions = {}): ReactElement =>
  o.bare
    ? reactSkeleton(p)
    : rEl(ReactProvider, { runtime: runtimeOf(o) }, o.tap, reactSkeleton(p));

// ---- Vue -----------------------------------------------------------------------------------------------------

const vuePlaceholder = (): VNode =>
  h('div', { class: 'w-card' }, [
    h(VueSkeleton, { shape: 'circle' }),
    h('div', { class: 'w-card__body' }, [h(VueSkeleton, { shape: 'text', lines: 3 })]),
  ]);
const vueLoaded = (): VNode =>
  h('div', { class: 'w-card' }, [
    h('div', { class: 'w-card__avatar', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'w-card__body' },
      LOADED_LINES.map((t) => h('p', { class: 'w-card__line' }, t)),
    ),
  ]);

export const vueSkeleton = (p: FixtureProps, extra: Record<string, unknown> = {}): VNode =>
  h(
    VueSkeleton,
    { ...skeletonProps(p), ...extra } as never,
    isGroup(p) ? { skeleton: vuePlaceholder, default: vueLoaded } : undefined,
  );

export const vueRoot = (p: FixtureProps, o: TreeOptions = {}): VNode =>
  o.bare ? vueSkeleton(p) : h(VueProvider, { runtime: runtimeOf(o) }, () => vueSkeleton(p));

// ---- Vanilla -------------------------------------------------------------------------------------------------

type VanillaHost = ReturnType<typeof createHost>;

const text = (doc: Document, tag: string, cls: string, content?: string): HTMLElement => {
  const e = doc.createElement(tag);
  e.className = cls;
  if (content !== undefined) e.textContent = content;
  return e;
};

/**
 * Vanilla options for a fixture. Slots are strings or Nodes: the placeholder is a card holding real SJSkeleton
 * shapes mounted on detached divs (the div becomes the root part), the loaded content a plain card.
 */
export function vanillaProps(p: FixtureProps, host: VanillaHost): VanillaSkeletonProps {
  const doc = document;
  const { attrs: _attrs, ...contract } = skeletonProps(p) as Record<string, unknown>;
  void _attrs;
  const out: Record<string, unknown> = { ...contract };
  if (isGroup(p)) {
    const card = text(doc, 'div', 'w-card');
    const circle = doc.createElement('div');
    mountSkeleton(host, circle, { shape: 'circle' });
    const body = text(doc, 'div', 'w-card__body');
    const lines = doc.createElement('div');
    mountSkeleton(host, lines, { shape: 'text', lines: 3 });
    body.append(lines);
    card.append(circle, body);
    out['skeleton'] = card;
    const loaded = text(doc, 'div', 'w-card');
    const loadedBody = text(doc, 'div', 'w-card__body');
    loadedBody.append(...LOADED_LINES.map((t) => text(doc, 'p', 'w-card__line', t)));
    const avatar = text(doc, 'div', 'w-card__avatar');
    avatar.setAttribute('aria-hidden', 'true');
    loaded.append(avatar, loadedBody);
    out['default'] = loaded;
  }
  return out as VanillaSkeletonProps;
}

// ---- Composition: SJSkeleton inside SJState ------------------------------------------------------------------

/** A state in the loading variant whose `skeleton` slot holds SJSkeleton shapes (optionally a group). */
export interface StateCompositionProps {
  heading: string;
  /** `announce` of the state (default: the heading speaks). */
  stateAnnounce?: string;
  /** What fills the state's skeleton slot. */
  inner: 'shapes' | 'group-silent' | 'group-announce';
  /** The group's announce text when `inner === 'group-announce'`. */
  groupAnnounce?: string;
  delay?: number;
  minDuration?: number;
  loading?: boolean;
}

const innerProps = (c: StateCompositionProps): Record<string, unknown> => ({
  shape: 'group',
  loading: c.loading ?? true,
  ...(c.delay !== undefined && { delay: c.delay }),
  ...(c.minDuration !== undefined && { minDuration: c.minDuration }),
  ...(c.inner === 'group-announce' && { announce: c.groupAnnounce ?? c.heading }),
});

export const reactStateComposition = (c: StateCompositionProps): ReactElement =>
  rEl(ReactState, {
    variant: 'loading',
    heading: c.heading,
    ...(c.stateAnnounce !== undefined && { announce: c.stateAnnounce }),
    skeleton:
      c.inner === 'shapes'
        ? rEl(
            'div',
            { className: 'w-card' },
            rEl(ReactSkeleton, { shape: 'circle' }),
            rEl('div', { className: 'w-card__body' }, rEl(ReactSkeleton, { shape: 'text' })),
          )
        : rEl(
            ReactSkeleton,
            { ...innerProps(c), skeleton: reactPlaceholder() } as never,
            reactLoaded(),
          ),
  } as never);

export const vueStateComposition = (c: StateCompositionProps): VNode =>
  h(
    VueState,
    {
      variant: 'loading',
      heading: c.heading,
      ...(c.stateAnnounce !== undefined && { announce: c.stateAnnounce }),
    } as never,
    {
      skeleton: () =>
        c.inner === 'shapes'
          ? h('div', { class: 'w-card' }, [
              h(VueSkeleton, { shape: 'circle' }),
              h('div', { class: 'w-card__body' }, [h(VueSkeleton, { shape: 'text' })]),
            ])
          : h(VueSkeleton, innerProps(c) as never, {
              skeleton: vuePlaceholder,
              default: vueLoaded,
            }),
    },
  );

export function mountVanillaStateComposition(
  host: VanillaHost,
  el: Element,
  c: StateCompositionProps,
) {
  const doc = document;
  let slot: Node;
  if (c.inner === 'shapes') {
    const card = text(doc, 'div', 'w-card');
    const circle = doc.createElement('div');
    mountSkeleton(host, circle, { shape: 'circle' });
    const body = text(doc, 'div', 'w-card__body');
    const lines = doc.createElement('div');
    mountSkeleton(host, lines, { shape: 'text' });
    body.append(lines);
    card.append(circle, body);
    slot = card;
  } else {
    const group = doc.createElement('div');
    mountSkeleton(host, group, vanillaProps({ ...(innerProps(c) as FixtureProps) }, host));
    slot = group;
  }
  return mountState(host, el, {
    variant: 'loading',
    heading: c.heading,
    ...(c.stateAnnounce !== undefined && { announce: c.stateAnnounce }),
    skeleton: slot,
  });
}

/** The server markup of a composition (react), for the SSR tests. */
export const reactCompositionEl = (c: StateCompositionProps, o: TreeOptions = {}): ReactElement =>
  rEl(ReactProvider, { runtime: runtimeOf(o) }, reactStateComposition(c));

export { FOLLOWER_TEXT };

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
        const t = added.textContent?.trim() ?? '';
        if (t) into.push({ role: r.target.getAttribute('role') as Spoken['role'], text: t });
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
