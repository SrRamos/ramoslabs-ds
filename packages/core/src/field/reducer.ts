// SJField reducer (W1-C02.a1, ADR-003). The field has one state (`idle`) and no events (schema v1
// allows `actions: []` with `events: []`, ADR-010 G-ICON ruling). The file exists only so the
// codegen equivalence and the W1-308b harness discover the component with no registration.
import type { FieldEvent, FieldState } from '../generated/field/machine';

export const reducerEvents = [] as const satisfies readonly FieldEvent[];

/** Contract state -> state. There is no event, so every event is a no-op. */
export function reduce(state: FieldState): FieldState {
  return state;
}
