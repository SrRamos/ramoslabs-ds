// @ts-check
// Reducer harness (W1-308b, ADR-013 L1). Model-based fast-check sequences over a reducer wired to
// the real kernel: store, effect queue, collection and controlled pipeline. The input is the
// derived spec (W1-308a `deriveSpec`), the same object the L2 executor (W1-309a) consumes, so one
// spec feeds both layers: `replaySequences` runs exactly `spec.sequences`, and `l2Plan` hands those
// same arrays to L2. Defects are reported as problems with a shrunk counterexample, never swallowed.
//
// Reducer module convention (packages/core/src/<slug>/reducer.ts, G-CODE-NOTES): export
// `reducerEvents: string[]` and `reduce(state, { type, ...payload })`, returning a state or a
// `{ state, effects? }` Reduction. Optional `harness` export:
//   initial   reducer state (default `spec.initial`)
//   project   reducer state -> contract machine state name (default identity)
//   items     collection keys used by the item operations (default: a short fixed alphabet)
//   targets   effect targets the drain host may report as missing (default: seen in effects)
//   controlled { field, prop, onChange, nativeEffect, target, values, toEvent } enables the
//             controlled-rejection operations
import fc from 'fast-check';
import { createStore } from '../../../core/src/store/index';
import { createEffectQueue, EFFECT_ORDER } from '../../../core/src/effects/index';
import { createCollection, successor } from '../../../core/src/collection/index';
import { createControlled } from '../../../core/src/controlled/index';

/** The kernel under test. Injectable so seeded kernel defects can prove the harness catches them. */
export const defaultKernel = Object.freeze({
  createStore,
  createEffectQueue,
  createCollection,
  successor,
  createControlled,
});

/** Fixed default so a CI failure reproduces; pass `seed` to explore. */
export const DEFAULT_SEED = 0x5eed;
const UNKNOWN_EVENT = '__sj_unknown_event__';
const DEFAULT_ITEMS = ['a', 'b', 'c', 'd', 'x y'];

/** @param {any} v */
const json = (v) => JSON.stringify(v) ?? 'undefined';

/** @param {boolean} ok @param {string} msg */
function must(ok, msg) {
  if (!ok) throw new Error(msg);
}

/** Accept both reducer return shapes. @param {any} r */
function normalize(r) {
  if (r && typeof r === 'object' && 'state' in r) return r;
  return { state: r };
}

/**
 * Same action list the L2 executor runs: the sequences are the spec's own arrays (no copy, no
 * re-derivation), so L1 and L2 cannot drift apart.
 * @param {import('../derive/index.js').DerivedSpec} spec
 */
export function l2Plan(spec) {
  return { sequences: spec.sequences, scenarios: spec.scenarios, steps: spec.steps };
}

/** Model transition: first declared step matching (event, state); otherwise a no-op. */
function modelStep(/** @type {any} */ spec, /** @type {string} */ at, /** @type {string} */ type) {
  const s = spec.steps.find((/** @type {any} */ t) => t.action === type && t.from === at);
  return s ? s.to : at;
}

/**
 * Independent restatement of the successor rule (not a copy of the kernel code).
 * @param {{ key: string, disabled?: boolean }[]} prev
 * @param {{ key: string, disabled?: boolean }[]} next
 * @param {string} gone
 */
function oracleSuccessor(prev, next, gone) {
  const ok = new Set(next.filter((i) => !i.disabled).map((i) => i.key));
  if (ok.has(gone)) return gone;
  const keys = prev.map((i) => i.key);
  const at = keys.indexOf(gone);
  if (at >= 0) {
    const after = keys.slice(at + 1).find((k) => ok.has(k));
    if (after !== undefined) return after;
    const before = keys
      .slice(0, at)
      .reverse()
      .find((k) => ok.has(k));
    if (before !== undefined) return before;
  }
  return next.find((i) => !i.disabled)?.key;
}

/** Static checks that need no execution. */
function staticProblems(/** @type {any} */ spec, /** @type {any} */ mod) {
  const events = mod.reducerEvents;
  if (!Array.isArray(events)) return ['reducer must export reducerEvents: string[]'];
  const want = new Set(spec.steps.map((/** @type {any} */ s) => s.action));
  const have = new Set(events);
  /** @type {string[]} */
  const out = [];
  for (const e of have) if (!want.has(e)) out.push(`reducer event "${e}" is not a contract action`);
  for (const w of want) if (!have.has(w)) out.push(`contract action "${w}" has no reducer event`);
  if (typeof mod.reduce !== 'function') out.push('reducer must export reduce(state, event)');
  return out;
}

/**
 * Build one fresh world around the reducer and return an `apply(op)` function. Every violation
 * throws an Error with a readable message; the property wrapper turns it into a counterexample.
 */
function makeWorld(/** @type {any} */ spec, /** @type {any} */ mod, /** @type {any} */ kernel) {
  const cfg = mod.harness ?? {};
  const project = cfg.project ?? ((/** @type {any} */ s) => s);
  const initial = structuredClone(cfg.initial ?? spec.initial);
  // A reducer may return a bare state or a Reduction (header); the store always sees a Reduction.
  const reduce = (/** @type {any} */ st, /** @type {any} */ ev) => normalize(mod.reduce(st, ev));

  // Effects the reducer emitted, as seen by the store (type, target, version, in dispatch order).
  /** @type {any[]} */
  const pending = [];
  let lastVersion = 0;
  let emittedThisDispatch = false;
  const queue = kernel.createEffectQueue();
  const store = kernel.createStore(
    initial,
    reduce,
    (/** @type {any[]} */ fx, /** @type {number} */ version) => {
      must(version > lastVersion, `effect version ${version} did not grow past ${lastVersion}`);
      lastVersion = version;
      emittedThisDispatch = true;
      for (const e of fx) if (e && typeof e.type === 'string') pending.push({ ...e, version });
      queue.enqueue(
        fx.filter((/** @type {any} */ e) => e && typeof e.type === 'string'),
        version,
      );
    },
  );

  let model = project(initial);
  let destroyed = false;

  // ---- subscribers (dedupe by identity, idempotent unsubscribe)
  const listeners = [0, 1, 2].map(() => ({ calls: 0, off: /** @type {any} */ (null) }));
  const fns = listeners.map((l) => () => void l.calls++);
  const active = new Set();

  // ---- drain host
  /** @type {Set<string>} */
  const missing = new Set();
  /** @type {any[]} */
  const ran = [];
  const host = {
    exists: (/** @type {string} */ t) => !missing.has(t),
    run: (/** @type {any} */ e) => void ran.push(e),
  };

  // ---- collection
  const keys = cfg.items ?? DEFAULT_ITEMS;
  /** @type {{ key: string, disabled?: boolean }[]} */
  let items = [];
  const col = kernel.createCollection('base', []);
  /** @type {Map<string, object>} */
  const regs = new Map();
  /** @type {{ key: string, el: object, off: () => void }[]} */
  const handles = [];
  /** @type {string | undefined} */
  let focused;

  const setItems = (/** @type {typeof items} */ next) => {
    const prev = items;
    if (focused !== undefined) {
      const got = kernel.successor(prev, next, focused);
      const want = oracleSuccessor(prev, next, focused);
      must(
        got === want,
        `successor(${json(prev)} -> ${json(next)}, "${focused}") = ${got}, want ${want}`,
      );
      const anyEnabled = next.some((i) => !i.disabled);
      must(
        anyEnabled ? next.some((i) => i.key === got && !i.disabled) : got === undefined,
        `successor "${got}" is not an enabled survivor`,
      );
      focused = got;
    }
    items = next;
    col.set(next);
    for (const k of [...regs.keys()]) if (!next.some((i) => i.key === k)) regs.delete(k);
    checkCollection();
  };

  function checkCollection() {
    must(
      json(col.items) === json(items),
      `collection items ${json(col.items)} != model ${json(items)}`,
    );
    const ids = new Set();
    for (const i of items) {
      const id = col.id(i.key);
      must(!ids.has(id), `duplicate id "${id}"`);
      ids.add(id);
      must(col.key(id) === i.key, `id/key round trip failed for "${i.key}"`);
      must(col.has(i.key), `has("${i.key}") false for a present item`);
      must(
        col.el(i.key) === regs.get(i.key),
        `element for "${i.key}" does not match the last registration`,
      );
      must(
        col.mounted(i.key) === regs.has(i.key),
        `mounted("${i.key}") disagrees with registrations`,
      );
    }
    for (const k of keys)
      if (!items.some((i) => i.key === k)) {
        must(!col.has(k), `has("${k}") true for a removed item`);
        must(col.el(k) === undefined, `removed item "${k}" kept its element`);
      }
  }

  // ---- controlled
  const cc = cfg.controlled;
  /** @type {any} */
  let props = {};
  /** @type {any[]} */
  const changes = [];
  /** @type {Map<string, unknown>} */
  const actual = new Map();
  /** @type {any} */
  let ctl;
  let controlledMode = false;
  const initControlled = (/** @type {boolean} */ controlled, /** @type {any} */ value) => {
    if (!cc) return;
    controlledMode = controlled;
    props = { [cc.onChange]: (/** @type {any} */ v) => void changes.push(v) };
    if (controlled) props[cc.prop] = value;
    ctl = kernel.createControlled({
      store,
      getProps: () => props,
      fields: {
        [cc.field]: {
          prop: cc.prop,
          onChange: cc.onChange,
          toEvent: cc.toEvent,
          native: cc.nativeEffect,
          target: cc.target,
        },
      },
    });
    ctl.mount();
  };

  /** Purity and no-op rules for one event against the current snapshot. */
  const checkEvent = (/** @type {any} */ event) => {
    const before = store.getSnapshot();
    const frozen = json(before);
    const a = normalize(reduce(before, event));
    const b = normalize(reduce(before, event));
    must(json(before) === frozen, `reduce mutated its input state on "${event.type}"`);
    must(json(a) === json(b), `reduce is not deterministic on "${event.type}"`);
    const next = modelStep(spec, project(before), event.type);
    must(
      project(a.state) === next,
      `"${event.type}" from "${project(before)}": reducer gave "${project(a.state)}", spec says "${next}"`,
    );
    if (!spec.steps.some((/** @type {any} */ s) => s.action === event.type))
      must(!a.effects || a.effects.length === 0, `unknown event "${event.type}" emitted effects`);
    if (next === project(before) && !(a.effects && a.effects.length))
      must(Object.is(a.state, before), `no-op "${event.type}" did not reuse the state reference`);
    return next;
  };

  const dispatch = (/** @type {any} */ event) => {
    const before = store.getSnapshot();
    const wasDestroyed = destroyed;
    const next = wasDestroyed ? model : checkEvent(event);
    const calls = listeners.map((l) => l.calls);
    emittedThisDispatch = false;
    const after = store.dispatch(event);
    if (wasDestroyed) {
      must(
        Object.is(after, before) && !emittedThisDispatch,
        'dispatch after destroy must be inert',
      );
      return;
    }
    must(project(after) === next, `store holds "${project(after)}", spec says "${next}"`);
    model = next;
    const changed = !Object.is(before, after);
    listeners.forEach((l, i) => {
      const want = active.has(i) && changed ? 1 : 0;
      must(
        l.calls - calls[i] === want,
        `listener ${i} notified ${l.calls - calls[i]}x, want ${want}`,
      );
    });
    must(Object.is(store.getSnapshot(), after), 'getSnapshot is not stable after dispatch');
    must(Object.is(store.getServerSnapshot(), initial), 'getServerSnapshot changed');
  };

  /** Oracle for one drain: filter by phase, drop superseded and missing, order, compare. */
  const drain = (/** @type {'layout' | 'passive'} */ phase) => {
    const passive = (/** @type {any} */ e) => e.type === 'announce';
    const batch = pending.filter((e) => passive(e) === (phase === 'passive'));
    for (let i = pending.length - 1; i >= 0; i--)
      if (passive(pending[i]) === (phase === 'passive')) pending.splice(i, 1);
    const k = (/** @type {any} */ e) => `${e.type}\0${e.target ?? ''}`;
    /** @type {Map<string, number>} */
    const latest = new Map();
    for (const e of batch) latest.set(k(e), Math.max(latest.get(k(e)) ?? 0, e.version));
    const rank = (/** @type {string} */ t) => {
      const i = EFFECT_ORDER.indexOf(t);
      return i < 0 ? EFFECT_ORDER.length : i;
    };
    const want = batch
      .map((e, i) => [e, i])
      .filter(
        ([e]) =>
          e.version === latest.get(k(e)) && (e.target === undefined || !missing.has(e.target)),
      )
      .sort(([a, i], [b, j]) => rank(a.type) - rank(b.type) || i - j)
      .map(([e]) => e);
    ran.length = 0;
    const n = queue.drain(host, phase);
    must(
      n === want.length && n === ran.length,
      `drain(${phase}) ran ${n}, expected ${want.length}`,
    );
    must(
      json(ran) === json(want),
      `drain(${phase}) ran ${json(ran.map((e) => e.type))}, expected ${json(want.map((e) => e.type))} (stale or missing-target effect mishandled)`,
    );
    const seen = new Set(ran.map(k));
    must(seen.size === ran.length, 'drain executed two effects with the same type and target');
  };

  /** @param {any} op */
  const apply = (op) => {
    switch (op.op) {
      case 'dispatch':
        return dispatch({ type: op.type });
      case 'sub': {
        const l = listeners[op.n];
        l.off = store.subscribe(fns[op.n]);
        store.subscribe(fns[op.n]); // duplicate registration is deduped by identity
        if (!destroyed) active.add(op.n);
        return;
      }
      case 'unsub': {
        listeners[op.n].off?.();
        listeners[op.n].off?.(); // idempotent
        active.delete(op.n);
        return;
      }
      case 'drain':
        return drain(op.phase);
      case 'exist':
        return void (op.on ? missing.delete(op.target) : missing.add(op.target));
      case 'add': {
        if (items.some((i) => i.key === op.key)) return;
        return setItems([...items, { key: op.key }]);
      }
      case 'remove':
        return setItems(items.filter((i) => i.key !== op.key));
      case 'disable':
        return setItems(
          items.map((i) =>
            i.key === op.key ? { key: i.key, ...(op.on && { disabled: true }) } : i,
          ),
        );
      case 'focus':
        if (items.some((i) => i.key === op.key && !i.disabled)) focused = op.key;
        return;
      case 'register': {
        if (!items.some((i) => i.key === op.key)) return;
        const el = { n: handles.length };
        const off = col.register(op.key, el);
        regs.set(op.key, el);
        handles.push({ key: op.key, el, off });
        return checkCollection();
      }
      case 'unregister': {
        if (!handles.length) return;
        const h = handles[op.i % handles.length];
        h.off();
        h.off(); // idempotent; must never remove a newer registration
        if (regs.get(h.key) === h.el) regs.delete(h.key);
        return checkCollection();
      }
      case 'prop': {
        if (!cc || !controlledMode) return;
        props = { ...props, [cc.prop]: op.value };
        const view = ctl.view();
        must(view[cc.field] === op.value, `view did not overlay the controlled prop`);
        return;
      }
      case 'request':
      case 'native': {
        if (!cc || destroyed) return;
        const isNative = op.op === 'native';
        const before = store.getSnapshot();
        const seenChanges = changes.length;
        const event = cc.toEvent(op.value);
        const expect = controlledMode ? model : modelStep(spec, model, event.type);
        if (isNative) actual.set(cc.field, op.value);
        emittedThisDispatch = false;
        const calls = listeners.map((l) => l.calls);
        const did = isNative ? ctl.native(cc.field, op.value) : ctl.request(cc.field, op.value);
        must(
          changes.length === seenChanges + 1 && changes[changes.length - 1] === op.value,
          'onChange was not called exactly once with the requested value',
        );
        if (controlledMode) {
          must(did === false, 'controlled request must not dispatch');
          must(
            Object.is(store.getSnapshot(), before),
            'controlled request changed reducer state (rejection violated)',
          );
          must(!emittedThisDispatch, 'controlled request emitted effects');
          listeners.forEach((l, i) =>
            must(l.calls === calls[i], `listener ${i} notified by a rejected request`),
          );
        } else {
          must(did === true, 'uncontrolled request must dispatch');
          must(
            project(store.getSnapshot()) === expect,
            `uncontrolled request gave "${project(store.getSnapshot())}", spec says "${expect}"`,
          );
          model = expect;
        }
        return;
      }
      case 'reconcile': {
        if (!cc || destroyed) return;
        const view = ctl.view();
        const out = ctl.reconcile();
        const want = actual.has(cc.field) && !Object.is(actual.get(cc.field), view[cc.field]);
        must(
          out.length === (want ? 1 : 0),
          `reconcile returned ${out.length} corrective effects, want ${want ? 1 : 0}`,
        );
        if (want) {
          must(
            out[0].type === cc.nativeEffect && Object.is(out[0].value, view[cc.field]),
            'corrective effect is wrong',
          );
          actual.set(cc.field, view[cc.field]);
        }
        must(ctl.reconcile().length === 0, 'reconcile is not idempotent');
        return;
      }
      case 'destroy':
        store.destroy();
        queue.clear();
        pending.length = 0;
        destroyed = true;
        active.clear();
        return;
      default:
        throw new Error(`unknown op ${op.op}`);
    }
  };

  return { apply, initControlled, project, getModel: () => model, store, cfg };
}

/** Operation arbitrary: the alphabet comes from the spec and the optional harness config. */
function opArbitrary(/** @type {any} */ spec, /** @type {any} */ mod) {
  const cfg = mod.harness ?? {};
  const keys = cfg.items ?? DEFAULT_ITEMS;
  const actions = [...new Set(spec.steps.map((/** @type {any} */ s) => s.action)), UNKNOWN_EVENT];
  const key = fc.constantFrom(...keys);
  /** @type {[number, fc.Arbitrary<any>][]} */
  const ops = [
    [8, fc.constantFrom(...actions).map((type) => ({ op: 'dispatch', type }))],
    [2, fc.integer({ min: 0, max: 2 }).map((n) => ({ op: 'sub', n }))],
    [1, fc.integer({ min: 0, max: 2 }).map((n) => ({ op: 'unsub', n }))],
    [3, fc.constantFrom('layout', 'passive').map((phase) => ({ op: 'drain', phase }))],
    [
      2,
      fc.record({
        op: fc.constant('exist'),
        target: fc.constantFrom(...(cfg.targets ?? ['root'])),
        on: fc.boolean(),
      }),
    ],
    [2, key.map((k) => ({ op: 'add', key: k }))],
    [2, key.map((k) => ({ op: 'remove', key: k }))],
    [3, fc.record({ op: fc.constant('disable'), key, on: fc.boolean() })],
    [2, key.map((k) => ({ op: 'focus', key: k }))],
    [3, key.map((k) => ({ op: 'register', key: k }))],
    [2, fc.nat(8).map((i) => ({ op: 'unregister', i }))],
    [1 / 8, fc.constant({ op: 'destroy' })],
  ];
  if (cfg.controlled) {
    const v = fc.constantFrom(...cfg.controlled.values);
    ops.push(
      [3, v.map((value) => ({ op: 'request', value }))],
      [2, v.map((value) => ({ op: 'native', value }))],
      [2, v.map((value) => ({ op: 'prop', value }))],
      [2, fc.constant({ op: 'reconcile' })],
    );
  }
  return fc.oneof(
    ...ops.map(([weight, arbitrary]) => ({ weight: Math.max(1, Math.round(weight)), arbitrary })),
  );
}

/**
 * Run the harness. Returns `{ ok, problems, counterexample, seed, runs }`; never throws on a
 * reducer defect. Options: `numRuns` (default 150), `seed`, `kernel` (injectable kernel).
 * @param {import('../derive/index.js').DerivedSpec} spec
 * @param {any} mod  reducer module (`reducerEvents`, `reduce`, optional `harness`)
 * @param {{ numRuns?: number, seed?: number, kernel?: any, maxOps?: number }} [options]
 */
export function runReducerHarness(spec, mod, options = {}) {
  const kernel = options.kernel ?? defaultKernel;
  const seed = options.seed ?? DEFAULT_SEED;
  const problems = staticProblems(spec, mod);
  if (problems.length) return { ok: false, problems, counterexample: null, seed, runs: 0 };

  const replay = replaySequences(spec, mod);
  if (replay.length) return { ok: false, problems: replay, counterexample: null, seed, runs: 0 };

  const cfg = mod.harness ?? {};
  const ops = opArbitrary(spec, mod);
  const modeArb = cfg.controlled
    ? fc.record({ controlled: fc.boolean(), value: fc.constantFrom(...cfg.controlled.values) })
    : fc.constant({ controlled: false, value: undefined });

  const result = fc.check(
    fc.property(
      modeArb,
      fc.array(ops, { minLength: 12, maxLength: options.maxOps ?? 60 }),
      (mode, seq) => {
        const world = makeWorld(spec, mod, kernel);
        world.initControlled(mode.controlled, mode.value);
        for (const op of seq) world.apply(op);
      },
    ),
    { numRuns: options.numRuns ?? 150, seed },
  );
  if (!result.failed)
    return { ok: true, problems: [], counterexample: null, seed, runs: result.numRuns };
  const err = /** @type {any} */ (result.errorInstance);
  return {
    ok: false,
    problems: [String(err?.message ?? /** @type {any} */ (result).error)],
    counterexample: result.counterexample,
    seed,
    runs: result.numRuns,
  };
}

/**
 * Deterministic L1 replay of `spec.sequences` (the arrays L2 executes). Returns problems.
 * @param {import('../derive/index.js').DerivedSpec} spec @param {any} mod
 */
export function replaySequences(spec, mod) {
  const cfg = mod.harness ?? {};
  const project = cfg.project ?? ((/** @type {any} */ s) => s);
  const byId = new Map(spec.steps.map((s) => [s.id, s]));
  /** @type {string[]} */
  const out = [];
  for (const seq of spec.sequences) {
    const store = createStore(
      structuredClone(cfg.initial ?? spec.initial),
      (/** @type {any} */ st, /** @type {any} */ ev) => normalize(mod.reduce(st, ev)),
    );
    for (const id of seq) {
      const step = /** @type {any} */ (byId.get(id));
      const at = project(store.getSnapshot());
      if (at !== step.from) {
        out.push(
          `sequence ${json(seq)}: step ${id} expected to start in "${step.from}", was "${at}"`,
        );
        break;
      }
      const to = project(store.dispatch({ type: step.action }));
      if (to !== step.to) {
        out.push(`sequence ${json(seq)}: step ${id} ended in "${to}", spec says "${step.to}"`);
        break;
      }
    }
  }
  return out;
}

/** Throwing wrapper for test files. */
export function assertReducerHarness(
  /** @type {any} */ spec,
  /** @type {any} */ mod,
  /** @type {any} */ options = {},
) {
  const r = runReducerHarness(spec, mod, options);
  if (!r.ok)
    throw new Error(
      `reducer harness failed (seed ${r.seed}): ${r.problems.join('; ')}${
        r.counterexample ? `\ncounterexample: ${json(r.counterexample)}` : ''
      }`,
    );
  return r;
}
