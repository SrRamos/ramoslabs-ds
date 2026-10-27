// Focus kernel (ADR-006): the strategy table, active-item bookkeeping, `data-active`, one focus
// plus one scrollIntoView, and scope/return. Elements are structural so core touches no DOM globals.
import { enabled, successor, type Collection, type CollectionItem } from '../collection/index';

export type Strategy = 'roving' | 'activedescendant' | 'native' | 'native-roving';

/** ADR-006 strategy table, encoded. */
export const STRATEGY = {
  tabs: 'roving',
  'radio-group': 'native-roving',
  menu: 'roving',
  listbox: 'roving',
  grid: 'roving',
  combobox: 'activedescendant',
  select: 'activedescendant',
  disclosure: 'native',
  switch: 'native',
  dialog: 'native',
  tooltip: 'native',
} as const satisfies Record<string, Strategy>;
export type Pattern = keyof typeof STRATEGY;

/** One strategy per composite: roving and activedescendant together throw. */
export function assertStrategy(declared: readonly Strategy[]): Strategy {
  const s = new Set(declared);
  if (s.has('roving') && s.has('activedescendant'))
    throw new Error('focus: a composite declares both roving and activedescendant');
  return declared[0] ?? 'native';
}

export interface FocusEl {
  isConnected?: boolean;
  disabled?: boolean;
  inert?: boolean;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
  focus(o?: { preventScroll?: boolean }): void;
  scrollIntoView?(o?: { block?: 'nearest' }): void;
  checkVisibility?(): boolean;
}

export interface Focus {
  readonly active: string | undefined;
  /** Move the active item (ignored if unknown or disabled). */
  move(key: string): boolean;
  /**
   * Replace the data. If the active item left or was disabled, the active key becomes its
   * deterministic successor (undefined only when nothing is enabled: focus the container).
   */
  update(items: readonly CollectionItem[]): string | undefined;
  /** Write attributes and focus; `container` carries activedescendant and is the fallback. */
  apply(container?: FocusEl, o?: { focus?: boolean }): void;
  /** Reset before the active element unmounts (clears aria-activedescendant). */
  release(container?: FocusEl): void;
}

export function createFocus<E extends FocusEl>(
  collection: Collection<E>,
  strategy: Strategy,
  initial?: string,
): Focus {
  let active =
    initial && enabled(collection.items.find((i) => i.key === initial)) ? initial : undefined;
  const self: Focus = {
    get active() {
      return active;
    },
    move(key) {
      if (!enabled(collection.items.find((i) => i.key === key))) return false;
      active = key;
      return true;
    },
    update(items) {
      const prev = collection.items;
      collection.set(items);
      if (active !== undefined) active = successor(prev, items, active);
      return active;
    },
    apply(container, o = {}) {
      const tabstop = active ?? collection.items.find(enabled)?.key;
      for (const { key } of collection.items) {
        const el = collection.el(key);
        if (!el) continue;
        if (key === active) el.setAttribute('data-active', '');
        else el.removeAttribute('data-active');
        if (strategy === 'roving') el.setAttribute('tabindex', key === tabstop ? '0' : '-1');
      }
      const el = active === undefined ? undefined : collection.el(active);
      if (strategy === 'activedescendant' && container) {
        // Only an owned, mounted element may be referenced (ADR-003/006).
        if (el) container.setAttribute('aria-activedescendant', collection.id(active!));
        else container.removeAttribute('aria-activedescendant');
      }
      if (o.focus === false) return;
      const target = strategy === 'roving' ? (el ?? container) : container;
      target?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: 'nearest' });
    },
    release(container) {
      container?.removeAttribute('aria-activedescendant');
      active = undefined;
    },
  };
  return self;
}

const usable = (el: FocusEl | undefined): el is FocusEl =>
  !!el && el.isConnected !== false && !el.disabled && !el.inert && el.checkVisibility?.() !== false;

/**
 * Focus scope return: the opener when connected, visible, enabled and not inert; else the
 * declared fallback under the same test; else undefined. `advanced` (the workflow deliberately
 * moved focus on) suppresses any restore.
 */
export function restoreTarget(
  opener: FocusEl | undefined,
  fallback?: FocusEl,
  advanced = false,
): FocusEl | undefined {
  if (advanced) return undefined;
  return usable(opener) ? opener : usable(fallback) ? fallback : undefined;
}
