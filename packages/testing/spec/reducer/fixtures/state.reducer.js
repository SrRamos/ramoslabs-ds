// Test-only fixture: the string-state convention of packages/core/src/<slug>/reducer.ts
// (G-CODE-NOTES): `reduce` returns the contract state name itself, not a Reduction.
export const reducerEvents = ['toggle', 'reset'];

/** @param {string} state @param {{ type: string }} event */
export function reduce(state, event) {
  if (event.type === 'toggle') return state === 'off' ? 'on' : 'off';
  if (event.type === 'reset') return 'off';
  return state;
}
