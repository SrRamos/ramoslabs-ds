// SJSkeleton vanilla adapter (ADR-002 light DOM + text nodes only, ADR-006 live regions).
//   mountSkeleton(host, el, props) -> { update, destroy, destroyed, phase() }
//   define(host, name?, registry?) registers the optional `sj-skeleton` element (explicit; never at import)
// A shape (text, circle, rect, block) is aria-hidden decoration. `shape: 'group'` is the container: it carries
// aria-busy while loading and draws the `skeleton` slot while loading, then the `default` slot (the loaded content)
// once the minimum duration has elapsed. The placeholder is drawn at once (it reserves its space) but is invisible
// until `delay` has passed. delay / minDuration default to the --motion-skeleton-* tokens, read after mount.
// The single announcement goes to the host live registry when the placeholder becomes visible (client only, so a
// server render has none). A Node slot is moved in and left to the caller on destroy.
import {
  createSkeleton,
  createSkeletonTiming,
  parseDuration,
  SKELETON_DELAY_MS,
  SKELETON_MIN_DURATION_MS,
  type Skeleton,
  type SkeletonPhase,
  type SkeletonTiming,
} from '@ramoslabs/core/skeleton';
import type { Props } from '@ramoslabs/core/merge';
import { skeletonLive } from '../generated/skeleton/index';
import type { SJSkeletonOptions } from '../generated/skeleton/types';
import {
  setText,
  type Bag,
  type ComponentSpec,
  type InstanceContext,
  type VanillaHost,
} from '../runtime/index';

export type SkeletonSlot = string | Node;
export type SkeletonPart = 'root' | 'line';

/** Generated options plus per-part class overrides (`classes.line`, ...). */
export type VanillaSkeletonProps = SJSkeletonOptions & {
  readonly classes?: Readonly<Partial<Record<SkeletonPart, string>>>;
};

type Ctx = InstanceContext<{ state: 'idle' }, never, VanillaSkeletonProps & Bag>;

/** Write a getter's Props onto an element; attributes dropped since the last write are removed. */
function applyProps(el: Element, props: Props, prev: Set<string>): void {
  const next = new Set<string>();
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false || typeof value === 'function')
      continue;
    el.setAttribute(key, value === true ? '' : String(value));
    next.add(key);
  }
  for (const attr of prev) if (!next.has(attr)) el.removeAttribute(attr);
  prev.clear();
  for (const a of next) prev.add(a);
}

function createSpec(
  group: boolean,
): ComponentSpec<{ state: 'idle' }, never, VanillaSkeletonProps & Bag, never> {
  let model: Skeleton | undefined;
  let current: VanillaSkeletonProps = {};
  let phase: SkeletonPhase = 'idle';
  let timing: SkeletonTiming | undefined;
  let ctxRef: Ctx | undefined;
  let lines: HTMLElement[] = [];
  let drawn: unknown = undefined;
  let lastKey = '';
  const seenRoot = new Set<string>();
  const seenLines: Set<string>[] = [];

  const isGroup = () => current.shape === 'group';

  const draw = (ctx: Ctx) => {
    const el = ctx.el;
    const cls = current.classes ?? {};
    applyProps(el, model!.getRootProps(cls.root ? { class: cls.root } : {}), seenRoot);
    if (isGroup()) {
      const content = phase === 'idle' ? current.default : current.skeleton;
      if (drawn !== content) {
        drawn = content;
        if (content === undefined || content === '') el.replaceChildren();
        else if (typeof content === 'string') setText(el, content);
        else el.replaceChildren(content);
      }
      return;
    }
    const want = model!.lineCount();
    if (lines.length !== want || drawn !== 'lines') {
      drawn = 'lines';
      const doc = el.ownerDocument;
      lines = Array.from({ length: want }, () => doc.createElement('div'));
      seenLines.length = 0;
      el.replaceChildren(...lines);
    }
    lines.forEach((l, i) => {
      applyProps(
        l,
        model!.getLineProps(cls.line ? { class: cls.line } : {}),
        (seenLines[i] ??= new Set()),
      );
    });
  };

  // One announcement per change, handed to the registry after mount (no live markup in SSR).
  const say = (ctx: Ctx) => {
    const a = model!.getAnnouncement();
    const key = a ? a.text : '';
    if (key !== lastKey) {
      lastKey = key;
      if (a) ctx.live.announce(a.text, { urgent: a.urgent });
    }
  };

  const durations = (ctx: Ctx): [number, number] => {
    const css = ctx.el.ownerDocument.defaultView?.getComputedStyle(ctx.el);
    return [
      current.delay ??
        parseDuration(css?.getPropertyValue('--motion-skeleton-delay'), SKELETON_DELAY_MS),
      current.minDuration ??
        parseDuration(
          css?.getPropertyValue('--motion-skeleton-min-duration'),
          SKELETON_MIN_DURATION_MS,
        ),
    ];
  };

  return {
    initial: () => ({ state: 'idle' as const }),
    reduce: (s) => ({ state: s }),
    // Only the group announces, so only the group inserts the region at mount (generated constant); a shape stays lazy, as in React and Vue.
    live: group ? skeletonLive : undefined,
    patch(_view, ctx: Ctx) {
      current = ctx.props();
      ctxRef = ctx;
      if (!model) {
        model = createSkeleton(() => ({ ...current, phase }));
        ctx.onCleanup(() => {
          timing?.destroy();
          timing = undefined;
          ctxRef = undefined;
          model = undefined;
          lines = [];
          drawn = undefined;
          ctx.el.replaceChildren();
        });
        if (isGroup()) {
          phase = current.loading === false ? 'idle' : 'pending';
          const [delay, minDuration] = durations(ctx);
          timing = createSkeletonTiming({
            after: ctx.runtime.scheduler.after,
            delay,
            minDuration,
            onPhase: (p) => {
              phase = p;
              if (ctxRef) {
                draw(ctxRef);
                say(ctxRef);
              }
            },
          });
          timing.set(current.loading !== false);
        }
      } else if (isGroup() && timing) {
        const [delay, minDuration] = durations(ctx);
        timing.configure(delay, minDuration);
        timing.set(current.loading !== false);
      }
      draw(ctx);
      say(ctx);
    },
  };
}

export interface SkeletonInstance {
  /** Replace the props; patches the DOM synchronously. */
  update(props: VanillaSkeletonProps): void;
  /** Idempotent. Cancels the timers, removes the children and drops every reference. */
  destroy(): void;
  readonly destroyed: boolean;
}

/** Mount an SJSkeleton onto `el` (the element becomes the root part). */
export function mountSkeleton(
  host: VanillaHost,
  el: Element,
  props: VanillaSkeletonProps = {},
): SkeletonInstance {
  const instance = host.mount(
    el,
    createSpec(props.shape === 'group'),
    props as VanillaSkeletonProps & Bag,
  );
  return {
    update: (next: VanillaSkeletonProps) => instance.update(next as VanillaSkeletonProps & Bag),
    destroy: () => instance.destroy(),
    get destroyed() {
      return instance.destroyed;
    },
  };
}

const ATTRS = [
  'shape',
  'lines',
  'ratio',
  'size',
  'loading',
  'delay',
  'min-duration',
  'announce',
  'animation',
] as const;

interface Registry {
  get(name: string): unknown;
  define(name: string, ctor: CustomElementConstructor): void;
}

/**
 * Register `<sj-skeleton>` (light DOM). Explicit and idempotent: nothing registers at import.
 * Attributes: shape, lines, ratio, size, loading (`loading="false"` ends the load), delay, min-duration, announce,
 * animation. The `skeleton` and `content` properties take a string or a Node (group slots). `host` must come from a
 * client-target runtime.
 */
export function define(
  host: VanillaHost,
  name = 'sj-skeleton',
  registry: Registry = globalThis.customElements,
): void {
  if (registry.get(name)) return;
  class SJSkeletonElement extends HTMLElement {
    static observedAttributes = [...ATTRS];
    #root: HTMLElement | undefined;
    #instance: SkeletonInstance | undefined;
    #slots: { skeleton?: SkeletonSlot; default?: SkeletonSlot } = {};
    #props(): VanillaSkeletonProps {
      const get = (n: string) => this.getAttribute(n) ?? undefined;
      const num = (n: string) => (get(n) === undefined ? undefined : Number(get(n)));
      const shape = get('shape');
      const ratio = get('ratio');
      const size = get('size');
      const announce = get('announce');
      const animation = get('animation');
      const lines = num('lines');
      const delay = num('delay');
      const minDuration = num('min-duration');
      return {
        ...(shape !== undefined && { shape: shape as VanillaSkeletonProps['shape'] }),
        ...(ratio !== undefined && { ratio: ratio as VanillaSkeletonProps['ratio'] }),
        ...(size !== undefined && { size: size as VanillaSkeletonProps['size'] }),
        ...(announce !== undefined && { announce }),
        ...(animation !== undefined && {
          animation: animation as VanillaSkeletonProps['animation'],
        }),
        ...(lines !== undefined && { lines }),
        ...(delay !== undefined && { delay }),
        ...(minDuration !== undefined && { minDuration }),
        loading: get('loading') !== 'false',
        ...this.#slots,
      };
    }
    connectedCallback(): void {
      if (this.#instance) return;
      this.#root = this.ownerDocument.createElement('div');
      this.append(this.#root);
      this.#instance = mountSkeleton(host, this.#root, this.#props());
    }
    disconnectedCallback(): void {
      this.#instance?.destroy();
      this.#root?.remove();
      this.#instance = this.#root = undefined;
    }
    attributeChangedCallback(): void {
      this.#instance?.update(this.#props());
    }
    get skeleton(): SkeletonSlot | undefined {
      return this.#slots.skeleton;
    }
    set skeleton(v: SkeletonSlot | undefined) {
      this.#slots = { ...this.#slots, skeleton: v };
      this.#instance?.update(this.#props());
    }
    get content(): SkeletonSlot | undefined {
      return this.#slots.default;
    }
    set content(v: SkeletonSlot | undefined) {
      this.#slots = { ...this.#slots, default: v };
      this.#instance?.update(this.#props());
    }
  }
  registry.define(name, SJSkeletonElement);
}
