// SJButton reducer (W1-C01.a, ADR-003). Codegen/harness convention (G-CODE-NOTES): export
// `reducerEvents` and a pure `reduce(state, { type })`, so `checkReducerEquivalence` and the W1-308b
// model-based harness discover this file with no registration.
//
// The machine is stateless: one state (`idle`), one event (`press`, a self-transition that emits the
// `press` contract event). `press` is reported to the consumer by the click handler in `./index`,
// not through a store, because there is nothing to snapshot and nothing to retain (ADR-011
// 1,000 mount/destroy). A reducer never reads a controlled field (G1 SHOULD-4): `state.controllable`
// is empty, and this file takes no field from its state parameter.
import type { ButtonEvent, ButtonState } from '../generated/button/machine';

export const reducerEvents = ['press'] as const satisfies readonly ButtonEvent[];

/** Contract state -> state. Every event leaves `idle` unchanged; an unknown event is a no-op. */
export function reduce(state: ButtonState, event: { readonly type: string }): ButtonState {
  return event.type === 'press' ? 'idle' : state;
}
