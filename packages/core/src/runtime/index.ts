// The single injection surface for everything ambient (ADR-003 "Runtime configuration").
// This module never reads `navigator`, `document` or `documentElement`: adapters read
// `<html lang dir>` from the server render input and pass the values in.

/** Capability keys detected by an adapter on the client (ADR-013 L6 forces each to false). */
export const SUPPORT_KEYS = [
  'anchorPositioning',
  'popover',
  'dialogRequestClose',
  'invokerCommands',
  'detailsName',
  'userInvalid',
  'viewTransitions',
  'schedulerYield',
  'weekInfo',
  'focusVisible',
] as const;
export type SupportKey = (typeof SUPPORT_KEYS)[number];
export type SupportsMap = Readonly<Record<SupportKey, boolean>>;

/** Every anchor property the contracts emit, with a representative valid value for `CSS.supports`. */
export const ANCHOR_PROPERTIES = [
  ['anchor-name', '--a'],
  ['position-area', 'top'],
  ['position-try-fallbacks', 'flip-block'],
  ['position-try-order', 'most-width'],
  ['position-visibility', 'anchors-visible'],
] as const;

/**
 * The `anchorPositioning` capability (ADR-013): true only when EVERY anchor property the contracts
 * emit passes `CSS.supports`, so a partial engine (Chromium 125-128: core anchors, no `position-area`;
 * Firefox 147) takes the fallback. Pure: the adapter passes `CSS.supports` after mount.
 */
export function detectAnchorPositioning(
  cssSupports: (property: string, value: string) => boolean,
): boolean {
  return ANCHOR_PROPERTIES.every(([p, v]) => cssSupports(p, v) === true);
}

/** The slice of `window` that `detectSupports` reads. Injected: core never touches a global. */
export interface SupportsEnv {
  CSS?: { supports(...args: string[]): boolean };
  HTMLElement?: { prototype: object };
  HTMLButtonElement?: { prototype: object };
  HTMLDialogElement?: { prototype: object };
  HTMLDetailsElement?: { prototype: object };
  Intl?: { Locale?: { prototype: object } };
  document?: object;
  scheduler?: object;
}

/**
 * Feature detection for every `SupportKey` (ADR-013). Pure: `env` is `window` (or a fake). A probe
 * that throws or is absent is `false`, so a missing API never takes the native path.
 */
export function detectSupports(env: SupportsEnv): SupportsMap {
  // Each probe is isolated: one that throws (a partial fake, a locked-down engine) is false alone.
  const t = (probe: () => boolean): boolean => {
    try {
      return probe() === true;
    } catch {
      return false;
    }
  };
  const css = (...a: string[]): boolean => t(() => env.CSS!.supports(...a));
  const fn = (o: object | undefined, k: string): boolean =>
    t(() => typeof (o as Record<string, unknown>)[k] === 'function');
  const proto = (c: { prototype: object } | undefined, ...ks: string[]): boolean =>
    t(() => ks.some((k) => k in c!.prototype));
  return {
    anchorPositioning: t(() => detectAnchorPositioning(css)),
    popover: proto(env.HTMLElement, 'popover'),
    dialogRequestClose: proto(env.HTMLDialogElement, 'requestClose'),
    invokerCommands: proto(env.HTMLButtonElement, 'commandForElement'),
    detailsName: proto(env.HTMLDetailsElement, 'name'),
    userInvalid: css('selector(:user-invalid)'),
    viewTransitions: fn(env.document, 'startViewTransition'),
    schedulerYield: fn(env.scheduler, 'yield'),
    weekInfo: proto(env.Intl?.Locale, 'getWeekInfo', 'weekInfo'),
    focusVisible: css('selector(:focus-visible)'),
  };
}

export interface Scheduler {
  /** Run `fn` after `ms`; returns a cancel function. */
  after(fn: () => void, ms: number): () => void;
  /** Run `fn` as soon as possible after the current task (microtask on the platform). */
  soon(fn: () => void): void;
}

export interface FakeScheduler extends Scheduler {
  /** Move virtual time forward, running due timers in order. */
  advance(ms: number): void;
  /** Run queued `soon` callbacks. */
  flush(): void;
  readonly pending: number;
}

export interface SJRuntime {
  readonly locale: string;
  readonly dir: 'ltr' | 'rtl';
  readonly idPrefix: string;
  readonly idFactory?: () => string;
  readonly density: 'touch' | 'compact';
  readonly supports: SupportsMap;
  /** True when `config.supports` was given: adapters then skip detection, so a forced run keeps winning. */
  readonly supportsExplicit?: true;
  readonly scheduler: Scheduler;
}

export interface RuntimeConfig {
  /** Default `'server'`: fake scheduler. `'client'`: platform timers. Never sniffed. */
  target?: 'server' | 'client';
  locale?: string;
  dir?: 'ltr' | 'rtl';
  idPrefix?: string;
  idFactory?: () => string;
  density?: 'touch' | 'compact';
  supports?: Partial<SupportsMap>;
  scheduler?: Scheduler;
}

/** The part of a runtime that is serialized from the server render to the client. */
export type SerializedRuntime = Pick<SJRuntime, 'locale' | 'dir' | 'idPrefix' | 'density'> & {
  /** Present only when the server runtime was created with explicit `supports`. */
  readonly supports?: SupportsMap;
  readonly supportsExplicit?: true;
};

export const noSupport: SupportsMap = Object.freeze(
  Object.fromEntries(SUPPORT_KEYS.map((k) => [k, false])) as Record<SupportKey, boolean>,
);

/** Deterministic scheduler with a virtual clock; each call owns its state. */
export function createFakeScheduler(): FakeScheduler {
  let now = 0;
  let seq = 0;
  let timers: { at: number; seq: number; fn: () => void }[] = [];
  const queue: (() => void)[] = [];
  return {
    after(fn, ms) {
      const t = { at: now + ms, seq: seq++, fn };
      timers.push(t);
      return () => {
        timers = timers.filter((x) => x !== t);
      };
    },
    soon: (fn) => void queue.push(fn),
    flush() {
      while (queue.length) queue.shift()!();
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = timers
          .filter((t) => t.at <= end)
          .sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        now = due.at;
        due.fn();
      }
      now = end;
    },
    get pending() {
      return timers.length + queue.length;
    },
  };
}

type Host = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  queueMicrotask(fn: () => void): void;
};

/** Platform timers, resolved at call time so importing this module touches no globals. */
export const platformScheduler: Scheduler = {
  after(fn, ms) {
    const h = globalThis as unknown as Host;
    const id = h.setTimeout(fn, ms);
    return () => h.clearTimeout(id);
  },
  soon: (fn) => (globalThis as unknown as Host).queueMicrotask(fn),
};

/** Drops `undefined` entries so a spread cannot turn a boolean capability into a non-boolean. */
const definedOnly = (m: Partial<SupportsMap> | undefined): Partial<SupportsMap> =>
  Object.fromEntries(Object.entries(m ?? {}).filter(([, v]) => v !== undefined));

export function createRuntime(config: RuntimeConfig = {}): SJRuntime {
  const runtime: SJRuntime = {
    locale: config.locale ?? 'en',
    dir: config.dir ?? 'ltr',
    idPrefix: config.idPrefix ?? '',
    density: config.density ?? 'touch',
    supports: Object.freeze({ ...noSupport, ...definedOnly(config.supports) }),
    scheduler:
      config.scheduler ?? (config.target === 'client' ? platformScheduler : createFakeScheduler()),
    ...(config.idFactory && { idFactory: config.idFactory }),
    ...(config.supports !== undefined && { supportsExplicit: true as const }),
  };
  return Object.freeze(runtime);
}

/**
 * Plain JSON-safe values that must match between server render and hydration. The scheduler and
 * `idFactory` are not serialized: the client rebuilds its runtime from these values plus
 * `target: 'client'` (R2-NICE-1).
 */
export function serializeRuntime(r: SJRuntime): SerializedRuntime {
  return {
    locale: r.locale,
    dir: r.dir,
    idPrefix: r.idPrefix,
    density: r.density,
    // A default server runtime knows nothing about the client: omit `supports` so the client
    // rebuilt from this value is not explicit and detects after mount.
    ...(r.supportsExplicit && { supports: r.supports, supportsExplicit: true as const }),
  };
}

/** Applied after hydration: a new runtime with real detection; the original is untouched. */
export function withSupports(r: SJRuntime, supports: Partial<SupportsMap>): SJRuntime {
  return Object.freeze({
    ...r,
    supports: Object.freeze({ ...r.supports, ...definedOnly(supports) }),
  });
}
