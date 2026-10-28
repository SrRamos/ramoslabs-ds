// SJCheckbox reducer (C03c.a). Pure; no effects (a native checkbox owns its own state, focus and
// Space handling). Same shape as the switch golden: `reducerEvents` plus a two-form `reduce`.
//
// Two controllable fields, `checked` and `indeterminate` (ADR-003 controlled pipeline; ADR-010
// `state.controllable`). Native `checked` and `indeterminate` are independent properties, so the
// machine has four positions (`unchecked`, `checked`, `mixed-unchecked`, `mixed-checked`) and both
// fields are derived from the position. A reducer never reads a controlled field (G1 SHOULD-4):
// every branch reads `state` only. Every self-transition is a missing row, so the store keeps the
// reference on a no-op (W1-308b).
import type { Reduction } from '../store/index';
import type { CheckboxEvent, CheckboxState } from '../generated/checkbox/index';

export type { CheckboxEvent, CheckboxState };

/** Written independently of the generated table so the equivalence check compares two sources. */
export const reducerEvents = ['toggle', 'setIndeterminate', 'clearIndeterminate'] as const;

/** Store snapshot: `state` is reducer-owned; `checked` and `indeterminate` are the controllable fields. */
export interface CheckboxSnapshot {
  readonly state: CheckboxState;
  readonly checked: boolean;
  readonly indeterminate: boolean;
}

export interface CheckboxAction {
  readonly type: CheckboxEvent;
}

// Total over the four states; a missing row is a no-op that keeps the reference (generated table rule).
const table: Readonly<Record<CheckboxState, Readonly<Record<string, CheckboxState>>>> = {
  unchecked: { toggle: 'checked', setIndeterminate: 'mixed-unchecked' },
  checked: { toggle: 'unchecked', setIndeterminate: 'mixed-checked' },
  'mixed-unchecked': { toggle: 'checked', clearIndeterminate: 'unchecked' },
  'mixed-checked': { toggle: 'unchecked', clearIndeterminate: 'checked' },
};

const step = (state: CheckboxState, event: { readonly type: string }): CheckboxState =>
  table[state][event.type] ?? state;

const snap = (state: CheckboxState): CheckboxSnapshot => ({
  state,
  checked: state === 'checked' || state === 'mixed-checked',
  indeterminate: state === 'mixed-unchecked' || state === 'mixed-checked',
});

/**
 * Two forms of one transition function:
 * - machine form `reduce('unchecked', { type: 'toggle' }) === 'checked'` (contract equivalence);
 * - store form `reduce(snapshot, event)` returning a Reduction (same reference on a no-op).
 *   `toggle` is user activation and leaves the `mixed-*` states like a native input; the two
 *   indeterminate events only set or clear that flag.
 */
export function reduce(state: CheckboxState, event: { readonly type: string }): CheckboxState;
export function reduce(
  state: CheckboxSnapshot,
  event: { readonly type: string },
): Reduction<CheckboxSnapshot, never>;
export function reduce(
  state: CheckboxState | CheckboxSnapshot,
  event: { readonly type: string },
): CheckboxState | Reduction<CheckboxSnapshot, never> {
  if (typeof state === 'string') return step(state, event);
  const next = step(state.state, event);
  return { state: next === state.state ? state : snap(next) };
}

/** The store reducer (the store form of `reduce`). */
export const storeReducer = (
  state: CheckboxSnapshot,
  event: { readonly type: string },
): Reduction<CheckboxSnapshot, never> => reduce(state, event);

export const initialSnapshot = (checked = false, indeterminate = false): CheckboxSnapshot =>
  snap(
    indeterminate
      ? checked
        ? 'mixed-checked'
        : 'mixed-unchecked'
      : checked
        ? 'checked'
        : 'unchecked',
  );

/** Controlled-field description every adapter hands to `createControlled` (via its store bridge). */
export const checkboxFields = {
  checked: {
    prop: 'checked',
    onChange: 'onCheckedChange',
    // The getter always submits the flip of view().checked, so uncontrolled mode is a plain toggle.
    toEvent: (): CheckboxAction => ({ type: 'toggle' }),
    // The native input reports its own state; a rejected change is corrected post-commit.
    native: 'checked',
    target: 'control',
  },
  indeterminate: {
    prop: 'indeterminate',
    onChange: 'onIndeterminateChange',
    toEvent: (next: boolean): CheckboxAction => ({
      type: next ? 'setIndeterminate' : 'clearIndeterminate',
    }),
    // `indeterminate` is a property with no attribute: the adapter sets `input.indeterminate`.
    native: 'indeterminate',
    target: 'control',
  },
} as const;

/** Optional W1-308b export: enables the controlled-rejection operations in the harness. */
export const harness = {
  initial: initialSnapshot(false),
  project: (s: CheckboxSnapshot): CheckboxState => s.state,
  items: ['a', 'b'],
  targets: ['control'],
  controlled: {
    field: 'checked',
    prop: 'checked',
    onChange: 'onCheckedChange',
    nativeEffect: 'checked',
    target: 'control',
    values: [true, false],
    toEvent: (): CheckboxAction => ({ type: 'toggle' }),
  },
};
