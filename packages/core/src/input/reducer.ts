// SJInput reducer (W1-C02.a2, ADR-014). `touch` moves `pristine` to `touched`, the state the
// `:user-invalid` fallback keys on (Chromium 114-118); the form `reset` event moves it back. Pure; a repeated touch is a missing
// row, so the store keeps the reference. Nothing is controllable, so no field is read here.
import type { Reduction } from '../store/index';
import type { InputEvent, InputState } from '../generated/input/machine';

export type { InputEvent, InputState };

/** Written independently of the generated table so the equivalence check compares two sources. */
export const reducerEvents = ['touch', 'reset'] as const;

export interface InputSnapshot {
  readonly state: InputState;
}
export interface InputAction {
  readonly type: InputEvent;
}

const table: Readonly<Record<InputState, Readonly<Record<string, InputState>>>> = {
  pristine: { touch: 'touched' },
  touched: { reset: 'pristine' },
};
const step = (state: InputState, event: { readonly type: string }): InputState =>
  table[state][event.type] ?? state;

/** Machine form `reduce('pristine', { type: 'touch' }) === 'touched'`, or store form on a snapshot. */
export function reduce(state: InputState, event: { readonly type: string }): InputState;
export function reduce(
  state: InputSnapshot,
  event: { readonly type: string },
): Reduction<InputSnapshot, never>;
export function reduce(
  state: InputState | InputSnapshot,
  event: { readonly type: string },
): InputState | Reduction<InputSnapshot, never> {
  if (typeof state === 'string') return step(state, event);
  const next = step(state.state, event);
  return { state: next === state.state ? state : { state: next } };
}

export const storeReducer = (
  state: InputSnapshot,
  event: { readonly type: string },
): Reduction<InputSnapshot, never> => reduce(state, event);

export const initialSnapshot: InputSnapshot = { state: 'pristine' };
