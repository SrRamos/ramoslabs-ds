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
  readonly supports: SupportsMap;
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

export function createRuntime(config: RuntimeConfig = {}): SJRuntime {
  const runtime: SJRuntime = {
    locale: config.locale ?? 'en',
    dir: config.dir ?? 'ltr',
    idPrefix: config.idPrefix ?? '',
    density: config.density ?? 'touch',
    supports: Object.freeze({ ...noSupport, ...config.supports }),
    scheduler:
      config.scheduler ?? (config.target === 'client' ? platformScheduler : createFakeScheduler()),
    ...(config.idFactory && { idFactory: config.idFactory }),
  };
  return Object.freeze(runtime);
}

/** Plain JSON-safe values that must match between server render and hydration. */
export function serializeRuntime(r: SJRuntime): SerializedRuntime {
  return {
    locale: r.locale,
    dir: r.dir,
    idPrefix: r.idPrefix,
    density: r.density,
    supports: r.supports,
  };
}

/** Applied after hydration: a new runtime with real detection; the original is untouched. */
export function withSupports(r: SJRuntime, supports: Partial<SupportsMap>): SJRuntime {
  return Object.freeze({ ...r, supports: Object.freeze({ ...r.supports, ...supports }) });
}
