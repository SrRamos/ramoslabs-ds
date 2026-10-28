// SJIcon reducer (W1-C12.a, ADR-003). The icon has one state (`idle`) and no events (schema v1
// allows `actions: []` with `events: []`, ADR-010 G-ICON ruling). The file exists only so the
// codegen equivalence and the W1-308b harness discover the component with no registration.
import type { IconEvent, IconState } from '../generated/icon/machine';

export const reducerEvents = [] as const satisfies readonly IconEvent[];

/** Contract state -> state. There is no event, so every event is a no-op. */
export function reduce(state: IconState): IconState {
  return state;
}
