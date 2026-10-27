// Fixture reducer for the equivalence check: the convention a real
// packages/core/src/<slug>/reducer.ts follows (`reducerEvents` plus `reduce`).
export const reducerEvents = ['toggle', 'reset'];
export function reduce(state, event) {
  if (event.type === 'toggle') return state === 'off' ? 'on' : 'off';
  if (event.type === 'reset') return 'off';
  return state;
}
