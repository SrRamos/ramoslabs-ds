// @ts-check
// Spec derivation (W1-308a, ADR-013 option B layer 1/2): one contract in, one deterministic
// semantic action list out. Pure data: no fs, no DOM, no clock, no randomness, no module state.
// The same output feeds the reducer harness (L1, W1-308b) and the Playwright executor (L2,
// W1-309a), so both layers exercise the same actions.

/**
 * @typedef {{ id: string, from: string, to: string, emit?: string, focus?: string,
 *   aria?: Record<string, Record<string, string>>, dom?: Record<string, Record<string, string>> }} ContractAction
 * @typedef {{ actions: ContractAction[], keyboard: Record<string, Record<string, string>>,
 *   focus: { strategy: string, owner?: string }, fixtures: string[],
 *   state?: { machine?: string[] }, name?: string }} ContractInput
 * @typedef {{ kind: 'keyboard', part: string, key: string }} Trigger
 * @typedef {{ id: string, action: string, from: string, to: string, emit: string | null,
 *   triggers: Trigger[], expect: { focus: string | null, aria: object, dom: object } }} Step
 * @typedef {{ part: string, key: string, movement: string }} Movement
 * @typedef {{ fixture: string, interactive: boolean }} Scenario
 * @typedef {{ component: string | null, initial: string | null, states: string[],
 *   focus: { strategy: string, owner: string | null }, steps: Step[], movements: Movement[],
 *   scenarios: Scenario[], sequences: string[][], unreachable: string[] }} DerivedSpec
 */

/** Fixtures with this exact name render the component disabled: no action may fire. */
export const INERT_FIXTURE = 'disabled';

/** Code-unit order, locale independent. @param {string} a @param {string} b */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Plain-data deep copy with keys sorted, so output never depends on authored key order.
 * @template T @param {T} v @returns {T}
 */
function canon(v) {
  if (Array.isArray(v)) return /** @type {any} */ (v.map(canon));
  if (v && typeof v === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const k of Object.keys(v).sort(cmp)) out[k] = canon(/** @type {any} */ (v)[k]);
    return /** @type {any} */ (out);
  }
  return v;
}

/**
 * @param {ContractInput} contract
 * @returns {DerivedSpec}
 */
export function deriveSpec(contract) {
  const { actions, keyboard, focus, fixtures } = contract;

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Step[]} */
  const steps = actions.map((a) => {
    const id = `${a.id}:${a.from}>${a.to}`;
    if (seen.has(id)) throw new Error(`ambiguous action ${id}: declared twice`);
    seen.add(id);
    return {
      id,
      action: a.id,
      from: a.from,
      to: a.to,
      emit: a.emit ?? null,
      triggers: [],
      expect: { focus: a.focus ?? null, aria: canon(a.aria ?? {}), dom: canon(a.dom ?? {}) },
    };
  });

  const actionIds = new Set(actions.map((a) => a.id));
  /** @type {Movement[]} */
  const movements = [];
  for (const part of Object.keys(keyboard).sort(cmp)) {
    for (const key of Object.keys(keyboard[part]).sort(cmp)) {
      const target = keyboard[part][key];
      if (actionIds.has(target)) {
        for (const s of steps)
          if (s.action === target) s.triggers.push({ kind: 'keyboard', part, key });
      } else {
        movements.push({ part, key, movement: target });
      }
    }
  }

  const machine = contract.state?.machine ?? [];
  const initial = machine[0] ?? steps[0]?.from ?? null;
  const states = [...new Set([...machine, ...steps.flatMap((s) => [s.from, s.to])])].sort(cmp);

  // Shortest declared-order path from the initial state to each step, then the step itself.
  /** @type {Map<string, string[]>} */
  const reach = new Map();
  if (initial !== null) {
    reach.set(initial, []);
    const queue = [initial];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i];
      for (const s of steps) {
        if (s.from === at && !reach.has(s.to)) {
          reach.set(s.to, [.../** @type {string[]} */ (reach.get(at)), s.id]);
          queue.push(s.to);
        }
      }
    }
  }
  /** @type {string[][]} */
  const sequences = [];
  /** @type {string[]} */
  const unreachable = [];
  for (const s of steps) {
    const path = reach.get(s.from);
    if (path) sequences.push([...path, s.id]);
    else unreachable.push(s.id);
  }

  return {
    component: contract.name ?? null,
    initial,
    states,
    focus: { strategy: focus.strategy, owner: focus.owner ?? null },
    steps,
    movements,
    scenarios: fixtures.map((fixture) => ({ fixture, interactive: fixture !== INERT_FIXTURE })),
    sequences,
    unreachable,
  };
}
