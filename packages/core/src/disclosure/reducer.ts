// SJDisclosure reducer (C06.a). Pure. Built on native `<details>`: the browser owns the `open`
// attribute, summary activation (Enter/Space), focus and find-in-page; the reducer only mirrors the
// state the DOM reports (or the owner requests).
//
// One controllable field, `open` (ADR-003 controlled pipeline; ADR-010 `state.controllable`). A
// reducer never reads a controlled field (G1 SHOULD-4): every branch reads `state` only, and the
// snapshot's `open` is derived from the machine position.
//
// Exclusive groups (`<details name>`): the native engine closes siblings from Chromium 120, Firefox
// 130 and Safari 17.2. Below that the owned fallback runs as an effect descriptor: a transition into
// `open` emits `closePeers`, and the adapter executes it only when it has a group name and
// `supports.detailsName` is false (the reducer cannot know either). Never executed here.
import type { Reduction } from '../store/index';
import type { DisclosureEvent, DisclosureState } from '../generated/disclosure/index';

export type { DisclosureEvent, DisclosureState };

/** Written independently of the generated table so the equivalence check compares two sources. */
export const reducerEvents = ['open', 'close', 'toggle'] as const;

/** Store snapshot: `state` is reducer-owned; `open` is the controllable field. */
export interface DisclosureSnapshot {
  readonly state: DisclosureState;
  readonly open: boolean;
}

export interface DisclosureAction {
  readonly type: DisclosureEvent;
}

/** Owned exclusive-group fallback: close every other open member of the same `name` group. */
export interface DisclosureEffect {
  readonly type: 'closePeers';
  readonly target: 'root';
}

// Total over the two states; a missing row is a no-op that keeps the reference (generated table rule).
const table: Readonly<Record<DisclosureState, Readonly<Record<string, DisclosureState>>>> = {
  closed: { open: 'open', toggle: 'open' },
  open: { close: 'closed', toggle: 'closed' },
};

const step = (state: DisclosureState, event: { readonly type: string }): DisclosureState =>
  table[state][event.type] ?? state;

const snap = (state: DisclosureState): DisclosureSnapshot => ({ state, open: state === 'open' });

const closed = snap('closed');
const opened = snap('open');
const closePeers: readonly DisclosureEffect[] = [{ type: 'closePeers', target: 'root' }];

/**
 * Two forms of one transition function:
 * - machine form `reduce('closed', { type: 'open' }) === 'open'` (contract equivalence);
 * - store form `reduce(snapshot, event)` returning a Reduction (same reference on a no-op;
 *   `closePeers` on every transition into `open`).
 */
export function reduce(state: DisclosureState, event: { readonly type: string }): DisclosureState;
export function reduce(
  state: DisclosureSnapshot,
  event: { readonly type: string },
): Reduction<DisclosureSnapshot, DisclosureEffect>;
export function reduce(
  state: DisclosureState | DisclosureSnapshot,
  event: { readonly type: string },
): DisclosureState | Reduction<DisclosureSnapshot, DisclosureEffect> {
  if (typeof state === 'string') return step(state, event);
  const next = step(state.state, event);
  if (next === state.state) return { state };
  return next === 'open' ? { state: opened, effects: closePeers } : { state: closed };
}

/** The store reducer (the store form of `reduce`). */
export const storeReducer = (
  state: DisclosureSnapshot,
  event: { readonly type: string },
): Reduction<DisclosureSnapshot, DisclosureEffect> => reduce(state, event);

export const initialSnapshot = (open = false): DisclosureSnapshot => (open ? opened : closed);

/** Controlled-field description every adapter hands to `createControlled` (via its store bridge). */
export const disclosureFields = {
  open: {
    prop: 'open',
    onChange: 'onOpenChange',
    // Explicit open/close (idempotent) rather than toggle: a native report is an absolute state.
    toEvent: (next: boolean): DisclosureAction => ({ type: next ? 'open' : 'close' }),
    // The native `<details>` reports its own `open`; a rejected change is corrected post-commit.
    native: 'open',
    target: 'root',
  },
} as const;

/** Optional W1-308b export: enables the controlled-rejection operations in the harness. */
export const harness = {
  initial: initialSnapshot(false),
  project: (s: DisclosureSnapshot): DisclosureState => s.state,
  items: ['a', 'b'],
  targets: ['root'],
  controlled: {
    field: 'open',
    prop: 'open',
    onChange: 'onOpenChange',
    nativeEffect: 'open',
    target: 'root',
    values: [true, false],
    toEvent: (next: boolean): DisclosureAction => ({ type: next ? 'open' : 'close' }),
  },
};
