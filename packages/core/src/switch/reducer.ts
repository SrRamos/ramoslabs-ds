// SJSwitch reducer (C03s.a). Pure; no effects (a native checkbox owns its own state, focus and
// Space handling, so there is nothing to drain). Convention from G-CODE-NOTES: `reducerEvents`
// plus `reduce`, so the codegen equivalence check, the W1-308b harness and the read-only reducer
// lint all run on this file.
//
// The controllable field is `checked`. A reducer never reads a controlled field (G1 SHOULD-4), so
// the snapshot carries the machine position in `state` and the reducer reads only that; `checked`
// is written alongside it. The prop getter computes the next value from `view().checked` and
// submits `request`/`native('checked', next)`; uncontrolled mode then dispatches `toggle`.
import type { Reduction } from '../store/index';
import type { SwitchEvent, SwitchState } from '../generated/switch/index';

export type { SwitchEvent, SwitchState };

/** Written independently of the generated table so the equivalence check compares two sources. */
export const reducerEvents = ['toggle'] as const;

/** Store snapshot. `state` is the machine position (reducer-owned); `checked` is the controllable field. */
export interface SwitchSnapshot {
  readonly state: SwitchState;
  readonly checked: boolean;
}

export interface SwitchAction {
  readonly type: SwitchEvent;
}

const step = (state: SwitchState, event: { readonly type: string }): SwitchState =>
  event.type === 'toggle' ? (state === 'on' ? 'off' : 'on') : state;

/**
 * Two forms of one transition function:
 * - machine form `reduce('off', { type: 'toggle' }) === 'on'`, which is what the contract
 *   equivalence check calls;
 * - store form `reduce(snapshot, event)` returning a Reduction (same reference on a no-op).
 */
export function reduce(state: SwitchState, event: { readonly type: string }): SwitchState;
export function reduce(
  state: SwitchSnapshot,
  event: { readonly type: string },
): Reduction<SwitchSnapshot, never>;
export function reduce(
  state: SwitchState | SwitchSnapshot,
  event: { readonly type: string },
): SwitchState | Reduction<SwitchSnapshot, never> {
  if (typeof state === 'string') return step(state, event);
  const next = step(state.state, event);
  return { state: next === state.state ? state : { state: next, checked: next === 'on' } };
}

/** The store reducer (the store form of `reduce`). */
export const storeReducer = (
  state: SwitchSnapshot,
  event: { readonly type: string },
): Reduction<SwitchSnapshot, never> => reduce(state, event);

export const initialSnapshot = (checked = false): SwitchSnapshot => ({
  state: checked ? 'on' : 'off',
  checked,
});

/** Controlled-field description every adapter hands to `createControlled` (via its store bridge). */
export const switchFields = {
  checked: {
    prop: 'checked',
    onChange: 'onCheckedChange',
    // The getter always submits the flip of view().checked, so uncontrolled mode is a plain toggle.
    toEvent: (): SwitchAction => ({ type: 'toggle' }),
    // The native input reports its own state; a rejected change is corrected post-commit.
    native: 'checked',
    target: 'control',
  },
} as const;

/** Optional W1-308b export: enables the controlled-rejection operations in the harness. */
export const harness = {
  initial: initialSnapshot(false),
  project: (s: SwitchSnapshot): SwitchState => s.state,
  items: ['a', 'b'],
  targets: ['control'],
  controlled: {
    field: 'checked',
    prop: 'checked',
    onChange: 'onCheckedChange',
    nativeEffect: 'checked',
    target: 'control',
    values: [true, false],
    toEvent: (): SwitchAction => ({ type: 'toggle' }),
  },
};
