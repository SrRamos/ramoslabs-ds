// SJSkeleton reducer (ADR-003). The contract has one state (`idle`) and no events: the timing phase
// (pending, visible, holding) is derived by `createSkeletonTiming`, not machine state, and the
// announcement is a value the adapter hands to the live registry after mount. The file exists so the
// codegen equivalence and the harness discover the component with no registration (same shape as SJState).
import type { SkeletonEvent, SkeletonState } from '../generated/skeleton/machine';

export const reducerEvents = [] as const satisfies readonly SkeletonEvent[];

/** Contract state -> state. There is no event, so every event is a no-op. */
export function reduce(state: SkeletonState): SkeletonState {
  return state;
}
