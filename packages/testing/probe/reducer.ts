// The probe's two-state machine (W1-316). Follows the codegen convention (G-CODE-NOTES): a pure
// `reduce(state, { type })` over the contract state names, plus `reducerEvents`, so
// `checkReducerEquivalence` accepts it. `storeReducer` adapts it to the store's reducer shape.
import type { Reducer } from '@ramoslabs/core/store';

export const reducerEvents = ['toggle'] as const;
export type ProbeEvent = { readonly type: (typeof reducerEvents)[number] };
export type ProbeState = 'off' | 'on';

/** Contract state -> state: off -> on and on -> off on `toggle`; unknown events change nothing. */
export function reduce(state: string, event: { readonly type: string }): string {
  if (event.type === 'toggle') return state === 'on' ? 'off' : 'on';
  return state;
}

/** The store snapshot. `pressed` is the controllable field (contract `state.controllable`). */
export interface ProbeSnapshot {
  readonly pressed: boolean;
}

export const stateOf = (s: ProbeSnapshot): ProbeState => (s.pressed ? 'on' : 'off');

export const storeReducer: Reducer<ProbeSnapshot, ProbeEvent, never> = (snapshot, event) => {
  const next = reduce(stateOf(snapshot), event) === 'on';
  return { state: next === snapshot.pressed ? snapshot : { pressed: next } };
};

/** Controlled-field description shared by the three wrappers. */
export const probeFields = {
  pressed: {
    prop: 'pressed',
    onChange: 'onPressedChange',
    toEvent: (): ProbeEvent => ({ type: 'toggle' }),
  },
};

export interface ProbeAttrs {
  readonly class: string;
  readonly role: 'switch';
  readonly type: 'button';
  readonly 'aria-checked': 'true' | 'false';
  readonly 'data-part': 'root';
  readonly 'data-state': ProbeState;
  readonly 'data-variant': 'solid';
  readonly 'data-tone': 'primary';
  readonly 'data-disabled'?: 'true';
  readonly disabled?: true;
}

/** Root attributes for a view, identical in every adapter (parity is the point of the probe). */
export function rootAttrs(view: ProbeSnapshot, disabled: boolean): ProbeAttrs {
  return {
    class: 'sj-probe__root',
    role: 'switch',
    type: 'button',
    'aria-checked': view.pressed ? 'true' : 'false',
    'data-part': 'root',
    'data-state': stateOf(view),
    'data-variant': 'solid',
    'data-tone': 'primary',
    ...(disabled && { 'data-disabled': 'true' as const, disabled: true as const }),
  };
}
