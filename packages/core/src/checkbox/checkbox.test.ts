import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../store/index';
import { createControlled } from '../controlled/index';
import { checkboxMachine } from '../generated/checkbox/index';
import {
  checkboxBaseId,
  checkboxFields,
  createCheckboxParts,
  initialSnapshot,
  reduce,
  reducerEvents,
  storeReducer,
  type CheckboxProps,
  type CheckboxSnapshot,
} from './index';

declare const console: { warn(m: string): void };
declare const process: { env: Record<string, string | undefined> };

/** What an adapter does: store + controlled + getters, props read at call time. */
function make(initialProps: CheckboxProps = {}) {
  let props: CheckboxProps = initialProps;
  const store = createStore(
    initialSnapshot(props.defaultChecked ?? false, props.defaultIndeterminate ?? false),
    storeReducer,
  );
  const controlled = createControlled({ store, getProps: () => props, fields: checkboxFields });
  controlled.mount();
  const parts = createCheckboxParts({
    view: controlled.view,
    native: controlled.native,
    getProps: () => props,
    id: checkboxBaseId(props.id, () => ':r1:', 'p-'),
  });
  return { store, controlled, parts, setProps: (p: CheckboxProps) => void (props = p) };
}

const change = (p: Record<string, unknown>) => (p.onChange as () => void)();
const events = fc.constantFrom(...reducerEvents);

describe('reducer (machine form)', () => {
  it('matches the generated table for every state and event', () => {
    for (const s of checkboxMachine.states)
      for (const e of checkboxMachine.events) {
        const row = (checkboxMachine.transitions as Record<string, Record<string, { to: string }>>)[
          s
        ]![e];
        expect(reduce(s, { type: e })).toBe(row?.to ?? s);
      }
    expect([...reducerEvents]).toEqual([...checkboxMachine.events]);
  });
  it('unknown events are no-ops that keep the reference', () => {
    const s = initialSnapshot(true, true);
    expect(reduce(s, { type: 'nope' }).state).toBe(s);
    expect(reduce('checked', { type: 'nope' })).toBe('checked');
  });
});

describe('reducer invariants (property)', () => {
  const run = (start: CheckboxSnapshot, seq: readonly (typeof reducerEvents)[number][]) =>
    seq.reduce((s, type) => reduce(s, { type }).state, start);

  it('checked always agrees with the machine position', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.array(events, { maxLength: 20 }), (c, i, seq) => {
        const s = run(initialSnapshot(c, i), seq);
        expect(s.checked).toBe(s.state === 'checked');
      }),
    );
  });
  it('the store form projects onto the machine form', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.array(events, { maxLength: 20 }), (c, i, seq) => {
        const s = run(initialSnapshot(c, i), seq);
        const machine = seq.reduce((m, type) => reduce(m, { type }), initialSnapshot(c, i).state);
        expect(s.state).toBe(machine);
      }),
    );
  });
  it('toggle clears indeterminate and flips checked; toggle twice restores checked', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (c, i) => {
        const start = initialSnapshot(c, i);
        const once = reduce(start, { type: 'toggle' }).state;
        expect(once.indeterminate).toBe(false);
        expect(once.checked).toBe(!c);
        expect(reduce(once, { type: 'toggle' }).state.checked).toBe(c);
      }),
    );
  });
  it('set/clear indeterminate never change checked; both are idempotent', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (c, i) => {
        const start = initialSnapshot(c, i);
        const set = reduce(start, { type: 'setIndeterminate' }).state;
        const clr = reduce(start, { type: 'clearIndeterminate' }).state;
        expect([set.checked, clr.checked]).toEqual([c, c]);
        expect([set.indeterminate, clr.indeterminate]).toEqual([true, false]);
        expect(reduce(set, { type: 'setIndeterminate' }).state).toEqual(set);
        expect(reduce(clr, { type: 'clearIndeterminate' }).state).toEqual(clr);
      }),
    );
  });
  it('is pure: no input mutation', () => {
    const s = Object.freeze(initialSnapshot(false, true));
    for (const type of reducerEvents) expect(() => reduce(s, { type })).not.toThrow();
  });
});

describe('getters (frozen API)', () => {
  it('control is exactly a bare checkbox: no role, no aria-checked, no hidden input', () => {
    const { parts } = make({ name: 'terms', value: 'yes' });
    const p = parts.getControlProps();
    expect(p).toMatchObject({
      id: 'p-:r1:',
      type: 'checkbox',
      checked: false,
      indeterminate: false,
      name: 'terms',
      value: 'yes',
      'data-part': 'control',
      'data-state': 'unchecked',
    });
    for (const k of ['role', 'aria-checked', 'aria-disabled']) expect(k in p).toBe(false);
    expect(Object.keys(p).sort()).toEqual(
      [
        'checked',
        'class',
        'data-part',
        'data-state',
        'id',
        'indeterminate',
        'name',
        'onChange',
        'type',
        'value',
      ].sort(),
    );
  });
  it('omits name/value/disabled when absent so the native defaults apply (submit equivalence)', () => {
    const p = make().parts.getControlProps();
    expect('name' in p || 'value' in p || 'disabled' in p).toBe(false);
  });
  it('data-state: indeterminate wins over checked', () => {
    const m = make({ defaultChecked: true, defaultIndeterminate: true });
    expect(m.parts.getControlProps()).toMatchObject({ checked: true, indeterminate: true });
    for (const part of [
      m.parts.getRootProps(),
      m.parts.getIndicatorProps(),
      m.parts.getLabelProps(),
      m.parts.getControlProps(),
    ])
      expect(part['data-state']).toBe('indeterminate');
    expect(make({ defaultChecked: true }).parts.getRootProps()['data-state']).toBe('checked');
  });
  it('disabled sets the native attribute and data-disabled on every part', () => {
    const { parts } = make({ disabled: true });
    expect(parts.getControlProps()).toMatchObject({ disabled: true, 'data-disabled': 'true' });
    for (const p of [parts.getRootProps(), parts.getIndicatorProps(), parts.getLabelProps()])
      expect(p['data-disabled']).toBe('true');
  });
  it('root, indicator and label are anatomy parts: class, part, state (G3A SHOULD-6)', () => {
    const { parts } = make();
    for (const [part, get] of [
      ['root', parts.getRootProps],
      ['indicator', parts.getIndicatorProps],
      ['label', parts.getLabelProps],
    ] as const)
      expect(get()).toEqual({
        class: `sj-checkbox__${part}`,
        'data-part': part,
        'data-state': 'unchecked',
      });
    expect(parts.getLabelProps({ class: 'mine' }).class).toBe('sj-checkbox__label mine');
  });
  it('consumer cannot override type, checked, indeterminate or state attributes; class concatenates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { parts } = make();
    const p = parts.getControlProps({
      type: 'text',
      checked: true,
      indeterminate: true,
      disabled: true,
      'data-state': 'checked',
      class: 'mine',
      'aria-label': 'Terms',
    });
    expect(p).toMatchObject({
      type: 'checkbox',
      checked: false,
      indeterminate: false,
      'data-state': 'unchecked',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(p.class).toBe('sj-checkbox__control mine');
    expect(p['aria-label']).toBe('Terms');
    expect('disabled' in p).toBe(false);
  });
  it('consumer onChange runs first and preventDefault cancels the library handler', () => {
    const { parts, store } = make();
    const order: string[] = [];
    (
      parts.getControlProps({ onChange: () => order.push('consumer') }).onChange as (
        e: object,
      ) => void
    )({});
    expect(order).toEqual(['consumer']);
    expect(store.getSnapshot().checked).toBe(true);
    (
      parts.getControlProps({ onChange: () => order.push('cancel') }).onChange as (
        e: object,
      ) => void
    )({
      defaultPrevented: true,
    });
    expect(store.getSnapshot().checked).toBe(true);
  });
  it('is pure: same inputs give equal output', () => {
    const strip = (p: Record<string, unknown>) => ({ ...p, onChange: typeof p.onChange });
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (checked, indeterminate, disabled) => {
        const a = make({ checked, indeterminate, disabled, name: 'n' }).parts;
        const b = make({ checked, indeterminate, disabled, name: 'n' }).parts;
        expect(strip(a.getControlProps())).toEqual(strip(b.getControlProps()));
        expect(strip(a.getControlProps())).toEqual(strip(a.getControlProps()));
      }),
    );
  });
  it('ids: explicit wins, otherwise prefix + acquired id', () => {
    expect(make({ id: 'mine' }).parts.ids.control).toBe('mine');
    expect(make().parts.ids.control).toBe('p-:r1:');
  });
});

describe('controlled pipeline: checked', () => {
  it('uncontrolled: change flips the snapshot and notifies', () => {
    const onCheckedChange = vi.fn();
    const { parts, store, controlled } = make({ onCheckedChange });
    change(parts.getControlProps());
    expect(controlled.view().checked).toBe(true);
    expect(store.getSnapshot()).toEqual({ state: 'checked', checked: true, indeterminate: false });
    change(parts.getControlProps());
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });
  it('defaultChecked seeds the first render', () => {
    expect(make({ defaultChecked: true }).parts.getControlProps().checked).toBe(true);
  });
  it('controlled: the owner decides; a rejected change is corrected post-commit', () => {
    const onCheckedChange = vi.fn();
    const m = make({ checked: false, onCheckedChange });
    const before = m.store.getSnapshot();
    change(m.parts.getControlProps());
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(m.store.getSnapshot()).toBe(before);
    expect(m.parts.getControlProps().checked).toBe(false);
    expect(m.controlled.reconcile()).toEqual([
      { type: 'checked', target: 'control', value: false },
    ]);
    expect(m.controlled.reconcile()).toEqual([]);
    m.setProps({ checked: true, onCheckedChange });
    expect(m.controlled.reconcile()).toEqual([{ type: 'checked', target: 'control', value: true }]);
  });
  it('switching ownership after mount throws in development', () => {
    const m = make({ checked: false });
    m.setProps({});
    expect(typeof process).toBe('object');
    expect(() => m.controlled.view()).toThrow(/controlled and uncontrolled/);
  });
});

describe('controlled pipeline: indeterminate', () => {
  it('uncontrolled: user activation clears indeterminate and toggles checked, notifying both', () => {
    const onCheckedChange = vi.fn();
    const onIndeterminateChange = vi.fn();
    const m = make({ defaultIndeterminate: true, onCheckedChange, onIndeterminateChange });
    expect(m.parts.getControlProps()).toMatchObject({ indeterminate: true, checked: false });
    change(m.parts.getControlProps());
    expect(m.parts.getControlProps()).toMatchObject({
      indeterminate: false,
      checked: true,
      'data-state': 'checked',
    });
    expect(onCheckedChange.mock.calls).toEqual([[true]]);
    expect(onIndeterminateChange.mock.calls).toEqual([[false]]);
    change(m.parts.getControlProps());
    expect(onIndeterminateChange).toHaveBeenCalledTimes(1); // only while indeterminate
  });
  it('indeterminate with checked=true: activation unchecks and clears, like a native input', () => {
    const m = make({ defaultChecked: true, defaultIndeterminate: true });
    change(m.parts.getControlProps());
    expect(m.parts.getControlProps()).toMatchObject({ checked: false, indeterminate: false });
  });
  it('controlled indeterminate: the owner decides; keeping it true yields a corrective effect', () => {
    const onIndeterminateChange = vi.fn();
    const m = make({ indeterminate: true, onIndeterminateChange });
    change(m.parts.getControlProps());
    expect(onIndeterminateChange).toHaveBeenCalledWith(false);
    expect(m.parts.getControlProps().indeterminate).toBe(true);
    expect(m.controlled.reconcile()).toEqual([
      { type: 'indeterminate', target: 'control', value: true },
    ]);
    // checked was uncontrolled, so it toggled; only the controlled field is corrected
    expect(m.controlled.view().checked).toBe(true);
    m.setProps({ indeterminate: false, onIndeterminateChange });
    expect(m.parts.getControlProps().indeterminate).toBe(false);
  });
  it('controlled checked + uncontrolled indeterminate: the clear still applies', () => {
    const m = make({ checked: false, onCheckedChange: vi.fn(), defaultIndeterminate: true });
    change(m.parts.getControlProps());
    expect(m.parts.getControlProps()).toMatchObject({ checked: false, indeterminate: false });
  });
  it('setting indeterminate through the owner re-renders without touching checked', () => {
    const m = make({ indeterminate: false, defaultChecked: true });
    m.setProps({ indeterminate: true, defaultChecked: true });
    expect(m.parts.getControlProps()).toMatchObject({
      checked: true,
      indeterminate: true,
      'data-state': 'indeterminate',
    });
  });
  it('switching indeterminate ownership after mount throws in development', () => {
    const m = make({ indeterminate: false });
    m.setProps({});
    expect(() => m.controlled.view()).toThrow(/controlled and uncontrolled/);
  });
});
