// SJCheckbox reducer (C03c.a). Pure; no effects (a native checkbox owns its own state, focus and
// Space handling). Same shape as the switch golden: `reducerEvents` plus a two-form `reduce`.
//
// Two controllable fields, `checked` and `indeterminate` (ADR-003 controlled pipeline; ADR-010
// `state.controllable`). The machine position is the `checked` axis only (`unchecked`/`checked`);
// `indeterminate` is orthogonal, exactly like the native input where `checked` and `indeterminate`
// are independent properties. A reducer never reads a controlled field (G1 SHOULD-4), so every
// branch reads `state` only and writes `checked` and `indeterminate` as a function of the event.
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

const step = (state: CheckboxState, event: { readonly type: string }): CheckboxState =>
  event.type === 'toggle' ? (state === 'checked' ? 'unchecked' : 'checked') : state;

const snap = (state: CheckboxState, indeterminate: boolean): CheckboxSnapshot => ({
  state,
  checked: state === 'checked',
  indeterminate,
});

/**
 * Two forms of one transition function:
 * - machine form `reduce('unchecked', { type: 'toggle' }) === 'checked'` (contract equivalence);
 * - store form `reduce(snapshot, event)` returning a Reduction. `toggle` is user activation and
 *   clears `indeterminate` like a native input; the two indeterminate events set or clear it only.
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
  const type = event.type;
  if (type === 'toggle') return { state: snap(step(state.state, event), false) };
  if (type === 'setIndeterminate') return { state: snap(state.state, true) };
  if (type === 'clearIndeterminate') return { state: snap(state.state, false) };
  return { state };
}

/** The store reducer (the store form of `reduce`). */
export const storeReducer = (
  state: CheckboxSnapshot,
  event: { readonly type: string },
): Reduction<CheckboxSnapshot, never> => reduce(state, event);

export const initialSnapshot = (checked = false, indeterminate = false): CheckboxSnapshot =>
  snap(checked ? 'checked' : 'unchecked', indeterminate);

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
