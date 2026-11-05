// SJState reducer (W1-C11.a, ADR-003). The component has one state (`idle`) and no events: the
// variant is a prop, not machine state, and the announcement is a derived value the adapter hands to
// the live registry after mount. The file exists so the codegen equivalence and the W1-308b harness
// discover the component with no registration (same shape as SJIcon).
import type { StateEvent, StateState } from '../generated/state/machine';

export const reducerEvents = [] as const satisfies readonly StateEvent[];

/** Contract state -> state. There is no event, so every event is a no-op. */
export function reduce(state: StateState): StateState {
  return state;
}
