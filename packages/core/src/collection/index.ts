// Data-first collection kernel (ADR-003 "Compound registration", ADR-006). The ordered item list
// is the source of truth; a key-to-id map derives from it; mounted elements register after mount.
// `compareDocumentPosition` is never used. No module-scope state.
import { itemId } from '../ids/index';

export interface CollectionItem {
  readonly key: string;
  /** Accessible name used by typeahead; defaults to the key. */
  readonly text?: string;
  readonly disabled?: boolean;
}

export interface Collection<E = unknown> {
  readonly items: readonly CollectionItem[];
  /** Replace the data; registrations of keys that left are dropped. */
  set(items: readonly CollectionItem[]): void;
  /** Stable id from the consumer key, never from a position. */
  id(key: string): string;
  /** Inverse of `id`; undefined for unknown ids. */
  key(id: string): string | undefined;
  has(key: string): boolean;
  /** Register a mounted element; returns an idempotent unregister. */
  register(key: string, el: E): () => void;
  el(key: string): E | undefined;
  /** True once the item's element is mounted (virtual items mount before activedescendant). */
  mounted(key: string): boolean;
}

export const enabled = (i: CollectionItem | undefined): i is CollectionItem => !!i && !i.disabled;

/**
 * Deterministic successor when `removed` leaves or is disabled: the nearest enabled survivor after
 * its old position, else the nearest before, else undefined (the caller focuses its declared
 * container fallback, never `<body>`). Returns `removed` itself when it is still enabled.
 */
export function successor(
  prev: readonly CollectionItem[],
  next: readonly CollectionItem[],
  removed: string,
): string | undefined {
  const live = new Map(next.map((i) => [i.key, i]));
  if (enabled(live.get(removed))) return removed;
  const at = prev.findIndex((i) => i.key === removed);
  const ok = (i?: CollectionItem) => (i && enabled(live.get(i.key)) ? i.key : undefined);
  for (let n = at + 1; n < prev.length; n++) if (ok(prev[n])) return prev[n]!.key;
  for (let n = at - 1; n >= 0; n--) if (ok(prev[n])) return prev[n]!.key;
  // `removed` was not in prev (or all prev gone): first enabled of next, if any.
  return next.find(enabled)?.key;
}

export function createCollection<E = unknown>(
  base: string,
  initial: readonly CollectionItem[] = [],
): Collection<E> {
  let items = initial;
  let ids = new Map<string, string>();
  let keys = new Map<string, string>();
  const els = new Map<string, E>();
  const index = () => {
    ids = new Map(items.map((i) => [i.key, itemId(base, i.key)]));
    keys = new Map([...ids].map(([k, v]) => [v, k]));
  };
  index();
  return {
    get items() {
      return items;
    },
    set(next) {
      items = next;
      index();
      for (const k of [...els.keys()]) if (!ids.has(k)) els.delete(k);
    },
    id: (key) => ids.get(key) ?? itemId(base, key),
    key: (id) => keys.get(id),
    has: (key) => ids.has(key),
    register(key, el) {
      els.set(key, el);
      return () => void (els.get(key) === el && els.delete(key));
    },
    el: (key) => els.get(key),
    mounted: (key) => els.has(key),
  };
}
