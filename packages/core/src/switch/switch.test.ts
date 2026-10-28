import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../store/index';
import { createControlled } from '../controlled/index';
import { switchMachine } from '../generated/switch/index';
import {
  createSwitchParts,
  initialSnapshot,
  reduce,
  reducerEvents,
  storeReducer,
  switchBaseId,
  switchFields,
  type SwitchProps,
  type SwitchSnapshot,
} from './index';

declare const console: { warn(m: string): void };
declare const process: { env: Record<string, string | undefined> };

/** What an adapter does: store + controlled + getters, props read at call time. */
function make(initialProps: SwitchProps = {}) {
  let props: SwitchProps = initialProps;
  const store = createStore(initialSnapshot(props.defaultChecked ?? false), storeReducer);
  const controlled = createControlled({ store, getProps: () => props, fields: switchFields });
  controlled.mount();
  const parts = createSwitchParts({
    view: controlled.view,
    native: controlled.native,
    getProps: () => props,
    id: switchBaseId(props.id, () => ':r1:', 'p-'),
  });
  return {
    store,
    controlled,
    parts,
    setProps: (p: SwitchProps) => void (props = p),
  };
}

const change = (p: Record<string, unknown>) => (p.onChange as () => void)();

describe('reducer (machine form)', () => {
  it('matches the generated table for every state and event', () => {
    for (const s of switchMachine.states)
      for (const e of switchMachine.events) {
        const row = (switchMachine.transitions as Record<string, Record<string, { to: string }>>)[
          s
        ]![e];
        expect(reduce(s, { type: e })).toBe(row?.to ?? s);
      }
    expect([...reducerEvents]).toEqual([...switchMachine.events]);
  });
  it('unknown events are no-ops that keep the reference', () => {
    const s = initialSnapshot(true);
    expect(reduce(s, { type: 'nope' }).state).toBe(s);
    expect(reduce('on', { type: 'nope' })).toBe('on');
  });
  it('store form keeps state and checked in step; toggle twice is identity (property)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.nat(9), (start, n) => {
        let s: SwitchSnapshot = initialSnapshot(start);
        for (let i = 0; i < n; i++) s = reduce(s, { type: 'toggle' }).state;
        expect(s.checked).toBe(n % 2 === 0 ? start : !start);
        expect(s.state).toBe(s.checked ? 'on' : 'off');
      }),
    );
  });
  it('is pure: no input mutation', () => {
    const s = Object.freeze(initialSnapshot(false));
    expect(() => reduce(s, { type: 'toggle' })).not.toThrow();
  });
});

describe('getters (frozen API)', () => {
  it('control is exactly a bare checkbox with role=switch: no aria-checked mirror, no hidden input', () => {
    const { parts } = make({ name: 'news', value: 'yes' });
    const p = parts.getControlProps();
    expect(p).toMatchObject({
      id: 'p-:r1:',
      type: 'checkbox',
      role: 'switch',
      checked: false,
      name: 'news',
      value: 'yes',
      'data-part': 'control',
      'data-state': 'off',
    });
    expect('aria-checked' in p).toBe(false);
    expect('aria-disabled' in p).toBe(false);
    expect(Object.keys(p).sort()).toEqual(
      [
        'checked',
        'class',
        'data-part',
        'data-state',
        'id',
        'name',
        'onChange',
        'role',
        'type',
        'value',
      ].sort(),
    );
  });
  it('omits name/value when absent so the native defaults apply', () => {
    const p = make().parts.getControlProps();
    expect('name' in p || 'value' in p || 'disabled' in p).toBe(false);
  });
  it('disabled sets the native attribute and data-disabled on every part', () => {
    const { parts } = make({ disabled: true });
    expect(parts.getControlProps()).toMatchObject({ disabled: true, 'data-disabled': 'true' });
    expect(parts.getRootProps()['data-disabled']).toBe('true');
    expect(parts.getThumbProps()['data-disabled']).toBe('true');
  });
  it('root and thumb carry part, state and class', () => {
    const { parts, store } = make();
    expect(parts.getRootProps()).toEqual({
      class: 'sj-switch__root',
      'data-part': 'root',
      'data-state': 'off',
    });
    store.dispatch({ type: 'toggle' });
    expect(parts.getThumbProps()).toEqual({
      class: 'sj-switch__thumb',
      'data-part': 'thumb',
      'data-state': 'on',
    });
  });
  it('the label is an anatomy part: part, state and class, protected like the others (G3A SHOULD-6)', () => {
    const { parts, store } = make({ disabled: true });
    expect(parts.getLabelProps()).toEqual({
      class: 'sj-switch__label',
      'data-part': 'label',
      'data-state': 'off',
      'data-disabled': 'true',
    });
    store.dispatch({ type: 'toggle' });
    expect(parts.getLabelProps({ class: 'mine' })).toMatchObject({
      class: 'sj-switch__label mine',
      'data-state': 'on',
    });
  });
  it('consumer cannot override role, type, checked or state attributes; class concatenates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { parts } = make();
    const p = parts.getControlProps({
      role: 'checkbox',
      type: 'text',
      checked: true,
      disabled: true,
      'data-state': 'on',
      class: 'mine',
      'aria-label': 'Notifications',
    });
    expect(p).toMatchObject({
      role: 'switch',
      type: 'checkbox',
      checked: false,
      'data-state': 'off',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(p.class).toBe('sj-switch__control mine');
    expect(p['aria-label']).toBe('Notifications');
    expect('disabled' in p).toBe(false);
  });
  it('consumer onChange runs first and preventDefault cancels the library handler', () => {
    const { parts, store } = make();
    const order: string[] = [];
    const p = parts.getControlProps({ onChange: () => order.push('consumer') });
    (p.onChange as (e: object) => void)({});
    expect(order).toEqual(['consumer']);
    expect(store.getSnapshot().checked).toBe(true);
    const q = parts.getControlProps({ onChange: () => order.push('cancel') });
    (q.onChange as (e: object) => void)({ defaultPrevented: true });
    expect(store.getSnapshot().checked).toBe(true);
  });
  it('is pure: same inputs give equal output and the module holds no state', () => {
    const a = make({ checked: true, name: 'n' }).parts;
    const b = make({ checked: true, name: 'n' }).parts;
    const strip = (p: Record<string, unknown>) => ({ ...p, onChange: typeof p.onChange });
    expect(strip(a.getControlProps())).toEqual(strip(b.getControlProps()));
    expect(strip(a.getControlProps())).toEqual(strip(a.getControlProps()));
  });
  it('ids: explicit wins, otherwise prefix + acquired id', () => {
    expect(make({ id: 'mine' }).parts.ids.control).toBe('mine');
    expect(make().parts.ids.control).toBe('p-:r1:');
  });
});

describe('controlled pipeline', () => {
  it('uncontrolled: change flips the snapshot and notifies', () => {
    const onCheckedChange = vi.fn();
    const { parts, store, controlled } = make({ onCheckedChange });
    change(parts.getControlProps());
    expect(controlled.view().checked).toBe(true);
    expect(store.getSnapshot()).toEqual({ state: 'on', checked: true });
    change(parts.getControlProps());
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
    expect(controlled.view().checked).toBe(false);
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
    expect(m.store.getSnapshot()).toBe(before); // reducer never saw it
    expect(m.parts.getControlProps().checked).toBe(false);
    expect(m.controlled.reconcile()).toEqual([
      { type: 'checked', target: 'control', value: false },
    ]);
    expect(m.controlled.reconcile()).toEqual([]);
    // the owner accepts the next one: the DOM was put back to false, so it is corrected to true
    m.setProps({ checked: true, onCheckedChange });
    expect(m.parts.getControlProps()).toMatchObject({ checked: true, 'data-state': 'on' });
    expect(m.controlled.reconcile()).toEqual([{ type: 'checked', target: 'control', value: true }]);
  });
  it('switching ownership after mount throws in development', () => {
    const m = make({ checked: false });
    m.setProps({});
    expect(typeof process).toBe('object');
    expect(() => m.controlled.view()).toThrow(/controlled and uncontrolled/);
  });
});
