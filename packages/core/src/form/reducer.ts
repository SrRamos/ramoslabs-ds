// SJForm reducer (W1-C02.a1). The contract has one state (`idle`) and no actions (schema v1 allows
// `actions: []` with `events: []`, ADR-010 G-ICON ruling), so there is nothing to reduce. The file
// exists only so codegen equivalence and the W1-308b harness discover the component with no
// registration. The owner's own store (fields, retained values) lives in `index.ts`.
import type { FormEvent, FormState } from '../generated/form/machine';

export const reducerEvents = [] as const satisfies readonly FormEvent[];

/** Contract state -> state. There is no event, so every event is a no-op. */
export function reduce(state: FormState): FormState {
  return state;
}
