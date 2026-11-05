import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../store/index';
import { createControlled } from '../controlled/index';
import { disclosureMachine } from '../generated/disclosure/index';
import {
  createDisclosureParts,
  disclosureBaseId,
  disclosureFields,
  initialSnapshot,
  peersToClose,
  reduce,
  reducerEvents,
  storeReducer,
  type DisclosureMember,
  type DisclosureProps,
  type DisclosureSnapshot,
} from './index';

declare const console: { warn(m: string): void };

/** What an adapter does: store + controlled + getters, props read at call time. */
function make(initialProps: DisclosureProps = {}) {
  let props: DisclosureProps = initialProps;
  const closed: string[] = [];
  const store = createStore(initialSnapshot(props.defaultOpen ?? false), storeReducer);
  const controlled = createControlled({ store, getProps: () => props, fields: disclosureFields });
  controlled.mount();
  const parts = createDisclosureParts({
    view: controlled.view,
    native: controlled.native,
    getProps: () => props,
    id: disclosureBaseId(props.id, () => ':r1:', 'p-'),
    closePeers: (id) => void closed.push(id),
  });
  return { store, controlled, parts, closed, setProps: (p: DisclosureProps) => void (props = p) };
}

/** The `toggle` event the browser fires after it flipped `details.open`. */
const toggled = (open: boolean) => ({ currentTarget: { open } });
const fireToggle = (root: Record<string, unknown>, open: boolean) =>
  (root.onToggle as (e: unknown) => void)(toggled(open));

describe('reducer (machine form)', () => {
  it('matches the generated table for every state and event', () => {
    for (const s of disclosureMachine.states)
      for (const e of disclosureMachine.events) {
        const row = (
          disclosureMachine.transitions as Record<string, Record<string, { to: string }>>
        )[s]![e];
        expect(reduce(s, { type: e })).toBe(row?.to ?? s);
      }
    expect([...reducerEvents]).toEqual([...disclosureMachine.events]);
  });
  it('unknown events are no-ops that keep the reference', () => {
    const s = initialSnapshot(true);
    expect(reduce(s, { type: 'nope' }).state).toBe(s);
    expect(reduce('open', { type: 'nope' })).toBe('open');
  });
  it('open and close are idempotent; toggle flips', () => {
    expect(reduce('open', { type: 'open' })).toBe('open');
    expect(reduce('closed', { type: 'close' })).toBe('closed');
    expect(reduce('closed', { type: 'toggle' })).toBe('open');
    expect(reduce('open', { type: 'toggle' })).toBe('closed');
  });
});

describe('reducer invariants (property)', () => {
  const events = fc.constantFrom(...reducerEvents);
  const run = (start: DisclosureSnapshot, seq: readonly (typeof reducerEvents)[number][]) =>
    seq.reduce((s, type) => reduce(s, { type }).state, start);

  it('open always agrees with the machine position', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.array(events, { maxLength: 20 }), (o, seq) => {
        const s = run(initialSnapshot(o), seq);
        expect(s.open).toBe(s.state === 'open');
      }),
    );
  });
  it('the store form projects onto the machine form', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.array(events, { maxLength: 20 }), (o, seq) => {
        const machine = seq.reduce((m, type) => reduce(m, { type }), initialSnapshot(o).state);
        expect(run(initialSnapshot(o), seq).state).toBe(machine);
      }),
    );
  });
  it('toggle twice is identity', () => {
    fc.assert(
      fc.property(fc.boolean(), (o) => {
        const start = initialSnapshot(o);
        const once = reduce(start, { type: 'toggle' }).state;
        expect(once.open).toBe(!o);
        expect(reduce(once, { type: 'toggle' }).state.open).toBe(o);
      }),
    );
  });
  it('the reducer emits no effects', () => {
    fc.assert(
      fc.property(fc.boolean(), events, (o, type) => {
        expect(reduce(initialSnapshot(o), { type }).effects).toBeUndefined();
      }),
    );
  });
  it('is pure: no input mutation, deterministic', () => {
    const s = Object.freeze(initialSnapshot(false));
    for (const type of reducerEvents) {
      expect(() => reduce(s, { type })).not.toThrow();
      expect(reduce(s, { type })).toEqual(reduce(s, { type }));
    }
  });
});

describe('getters (frozen API)', () => {
  it('root is a bare details: id, open, state; no aria-expanded anywhere', () => {
    const { parts } = make({ name: 'faq' });
    const root = parts.getRootProps();
    expect(root).toMatchObject({
      id: 'p-:r1:',
      class: 'sj-disclosure__root',
      open: false,
      name: 'faq',
      'data-part': 'root',
      'data-state': 'closed',
    });
    for (const p of [root, parts.getTriggerProps(), parts.getContentProps()])
      for (const k of ['aria-expanded', 'aria-controls', 'role']) expect(k in p).toBe(false);
  });
  it('omits name when absent (a bare details)', () => {
    expect('name' in make().parts.getRootProps()).toBe(false);
  });
  it('ids derive from the base id (ADR-003) and an explicit id wins', () => {
    const { parts } = make();
    expect(parts.ids).toEqual({
      root: 'p-:r1:',
      trigger: 'p-:r1:-trigger',
      content: 'p-:r1:-panel',
    });
    expect(parts.getTriggerProps().id).toBe('p-:r1:-trigger');
    expect(parts.getContentProps().id).toBe('p-:r1:-panel');
    expect(make({ id: 'mine' }).parts.ids.root).toBe('mine');
  });
  it('data-state follows the view on every part', () => {
    const m = make({ defaultOpen: true });
    expect(m.parts.getRootProps().open).toBe(true);
    for (const p of [m.parts.getRootProps(), m.parts.getTriggerProps(), m.parts.getContentProps()])
      expect(p['data-state']).toBe('open');
  });
  it('disabled: data-disabled and aria-disabled on the trigger, click is cancelled', () => {
    const { parts } = make({ disabled: true });
    expect(parts.getTriggerProps()).toMatchObject({
      'data-disabled': 'true',
      'aria-disabled': 'true',
    });
    const preventDefault = vi.fn();
    (parts.getTriggerProps().onClick as (e: unknown) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    const enabled = make().parts.getTriggerProps();
    expect(enabled['aria-disabled']).toBeUndefined();
    const spy = vi.fn();
    (enabled.onClick as (e: unknown) => void)({ preventDefault: spy });
    expect(spy).not.toHaveBeenCalled();
  });
  it('consumer cannot override id, open, name or state attributes; class concatenates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { parts } = make({ name: 'faq' });
    const p = parts.getRootProps({
      id: 'x',
      open: true,
      name: 'other',
      'data-state': 'open',
      class: 'mine',
      'aria-label': 'FAQ',
    });
    expect(p).toMatchObject({ id: 'p-:r1:', open: false, name: 'faq', 'data-state': 'closed' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(p.class).toBe('sj-disclosure__root mine');
    expect(p['aria-label']).toBe('FAQ');
  });
  it('consumer onToggle runs first and preventDefault cancels the library handler', () => {
    const m = make();
    const calls: string[] = [];
    const root = m.parts.getRootProps({
      onToggle: () => void calls.push('consumer'),
    });
    fireToggle(root, true);
    expect(calls).toEqual(['consumer']);
    expect(m.store.getSnapshot().open).toBe(true);
  });
  it('getters are pure: same inputs, same output', () => {
    const { parts } = make({ defaultOpen: true, name: 'a' });
    const strip = (p: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v !== 'function'));
    expect(strip(parts.getRootProps())).toEqual(strip(parts.getRootProps()));
    expect(strip(parts.getTriggerProps())).toEqual(strip(parts.getTriggerProps()));
  });
});

describe('native toggle reporting', () => {
  it('uncontrolled: a user toggle dispatches open/close and notifies once', () => {
    const onOpenChange = vi.fn();
    const m = make({ onOpenChange });
    fireToggle(m.parts.getRootProps(), true);
    expect(m.store.getSnapshot()).toMatchObject({ state: 'open', open: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    fireToggle(m.parts.getRootProps(), false);
    expect(m.store.getSnapshot().state).toBe('closed');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
  it('a toggle that matches the view (programmatic or corrective) is ignored', () => {
    const onOpenChange = vi.fn();
    const m = make({ onOpenChange, defaultOpen: true });
    fireToggle(m.parts.getRootProps(), true);
    expect(onOpenChange).not.toHaveBeenCalled();
    (m.parts.getRootProps().onToggle as (e: unknown) => void)({});
    (m.parts.getRootProps().onToggle as (e: unknown) => void)(undefined);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it('controlled accepting: owner updates the prop, no corrective effect', () => {
    let open = false;
    const m = make({ open, onOpenChange: (n) => void (open = n) });
    const onOpenChange = (n: boolean) => {
      open = n;
      m.setProps({ open, onOpenChange });
    };
    m.setProps({ open, onOpenChange });
    fireToggle(m.parts.getRootProps(), true);
    expect(m.store.getSnapshot().open).toBe(false); // the reducer never saw it
    expect(m.controlled.view().open).toBe(true);
    expect(m.controlled.reconcile()).toEqual([]);
    expect(m.parts.getRootProps().open).toBe(true);
  });
  it('controlled rejecting: reconcile yields a corrective open effect; the correction is not re-reported', () => {
    const onOpenChange = vi.fn();
    const m = make({ open: false, onOpenChange });
    fireToggle(m.parts.getRootProps(), true);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(m.store.getSnapshot()).toBe(m.store.getSnapshot());
    expect(m.controlled.reconcile()).toEqual([{ type: 'open', target: 'root', value: false }]);
    // the adapter sets details.open = false; the resulting toggle matches the view
    fireToggle(m.parts.getRootProps(), false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(m.controlled.reconcile()).toEqual([]);
  });
  it('controlled: switching ownership after mount throws in development', () => {
    const m = make({ open: false });
    m.setProps({});
    expect(() => m.controlled.view()).toThrow(/controlled and uncontrolled/);
  });
  it('opening closes peers (named group) even when controlled, matching the view, or rejected', () => {
    const open = make({ name: 'g' });
    fireToggle(open.parts.getRootProps(), true);
    expect(open.closed).toEqual(['p-:r1:']);
    fireToggle(open.parts.getRootProps(), false);
    expect(open.closed).toHaveLength(1);
    // controlled, accepting
    const acc = make({ name: 'g', open: false, onOpenChange: () => {} });
    fireToggle(acc.parts.getRootProps(), true);
    expect(acc.closed).toHaveLength(1);
    // controlled rejecting: view stays closed, peers still close
    const rej = make({ name: 'g', open: false, onOpenChange: vi.fn() });
    fireToggle(rej.parts.getRootProps(), true);
    expect(rej.controlled.view().open).toBe(false);
    expect(rej.closed).toHaveLength(1);
    // programmatic: toggle matches the view, still closes peers
    const prog = make({ name: 'g', defaultOpen: true });
    fireToggle(prog.parts.getRootProps(), true);
    expect(prog.closed).toHaveLength(1);
  });
  it('no group name, or no adapter hook: no call, no throw', () => {
    const m = make();
    fireToggle(m.parts.getRootProps(), true);
    expect(m.closed).toEqual([]);
    const bare = createDisclosureParts({
      view: () => initialSnapshot(false),
      native: () => true,
      getProps: () => ({ name: 'g' }),
      id: 'x',
    });
    expect(() => fireToggle(bare.getRootProps(), true)).not.toThrow();
  });
});

describe('exclusive-group fallback (peersToClose)', () => {
  const m = (id: string, name: string | null | undefined, open: boolean): DisclosureMember => ({
    id,
    name,
    open,
  });
  it('returns the other open members of the same non-empty name, in DOM order', () => {
    const group = [
      m('a', 'g', true),
      m('b', 'g', true),
      m('c', 'h', true),
      m('d', 'g', false),
      m('e', 'g', true),
    ];
    expect(peersToClose('b', group)).toEqual(['a', 'e']);
  });
  it('is empty without a name, with an empty name, for an unknown id, or when alone', () => {
    expect(peersToClose('a', [m('a', undefined, true), m('b', undefined, true)])).toEqual([]);
    expect(peersToClose('a', [m('a', '', true), m('b', '', true)])).toEqual([]);
    expect(peersToClose('z', [m('a', 'g', true)])).toEqual([]);
    expect(peersToClose('a', [m('a', 'g', true)])).toEqual([]);
  });
  it('property: after closing the returned peers at most one member of the group stays open', () => {
    const member = fc.record({
      name: fc.constantFrom('g', 'h', null, undefined),
      open: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(member, { minLength: 1, maxLength: 8 }), fc.nat(), (raw, k) => {
        const members = raw.map((r, i) => ({ id: `m${i}`, ...r }));
        const self = members[k % members.length]!;
        const open = members.map((x) => (x.id === self.id ? { ...x, open: true } : x));
        const close = new Set(peersToClose(self.id, open));
        const after = open.map((x) => (close.has(x.id) ? { ...x, open: false } : x));
        if (self.name) {
          expect(after.filter((x) => x.name === self.name && x.open)).toHaveLength(1);
          for (const x of open) if (x.name !== self.name) expect(close.has(x.id)).toBe(false);
        } else expect(close.size).toBe(0);
      }),
    );
  });
  it('does not mutate its input', () => {
    const group = Object.freeze([
      Object.freeze(m('a', 'g', true)),
      Object.freeze(m('b', 'g', true)),
    ]);
    expect(() => peersToClose('a', group)).not.toThrow();
  });
});
