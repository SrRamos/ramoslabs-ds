// Test-only fixture reducer for the W1-308b harness. It follows the codegen convention of a real
// packages/core/src/<slug>/reducer.ts: `reducerEvents` plus `reduce`, and the optional `harness`.
// State is an object so the controlled pipeline can overlay it; `harness.project` maps it to the
// contract machine state.
export const reducerEvents = ['toggle', 'reset'];

/** @param {{ open: boolean }} state @param {{ type: string }} event */
export function reduce(state, event) {
  if (event.type === 'toggle') {
    const open = !state.open;
    return {
      state: { open },
      effects: [{ type: open ? 'open' : 'close', target: 'root' }, { type: 'announce' }],
    };
  }
  if (event.type === 'reset') {
    if (!state.open) return { state };
    return { state: { open: false }, effects: [{ type: 'close', target: 'root' }] };
  }
  return { state };
}

export const harness = {
  initial: { open: false },
  /** @param {{ open: boolean }} s */
  project: (s) => (s.open ? 'on' : 'off'),
  items: ['a', 'b', 'c', 'd'],
  targets: ['root'],
  controlled: {
    field: 'open',
    prop: 'open',
    onChange: 'onOpenChange',
    nativeEffect: 'native-open',
    target: 'root',
    values: [true, false],
    /** @param {boolean} next */
    toEvent: (next) => ({ type: next ? 'toggle' : 'reset' }),
  },
};
