import { describe, expect, it } from 'vitest';
import button from '../../contracts/contracts/button.contract.json';
import switchContract from '../../contracts/contracts/switch.contract.json';
import {
  buttonKeyboard,
  buttonMachine,
  switchAria,
  switchKeyboard,
  switchMachine,
} from './generated/index';
import type { ButtonEvent, ButtonState, Kind, SwitchEvent, SwitchState } from './generated/index';
import { KINDS } from './generated/index';

// Hand-written files are not allowed to drift from the contract; these tests pin the generated
// tables to it at runtime, and the type assertions below pin the unions at compile time.
const ids = (c: { actions: { id: string }[] }) => [...new Set(c.actions.map((a) => a.id))];

describe('generated tables mirror the contracts', () => {
  it('machine: states, events and every transition row', () => {
    for (const [m, c] of [
      [buttonMachine, button],
      [switchMachine, switchContract],
    ] as const) {
      expect(m.initial).toBe(c.state.machine[0]);
      expect([...m.states]).toEqual(c.state.machine);
      expect([...m.events]).toEqual(ids(c));
      const rows = Object.values(m.transitions).flatMap((byEvent) => Object.keys(byEvent));
      expect(rows).toHaveLength(c.actions.length);
      for (const a of c.actions) {
        const row = (m.transitions as Record<string, Record<string, { to: string }>>)[a.from]![
          a.id
        ]!;
        expect(row.to).toBe(a.to);
      }
    }
  });
  it('keyboard maps equal the contract keyboard', () => {
    expect(buttonKeyboard).toEqual(button.keyboard);
    expect(switchKeyboard).toEqual(switchContract.keyboard);
  });
  it('every keyboard action is a declared event', () => {
    expect(Object.values(switchKeyboard.control)).toEqual(['toggle']);
    for (const action of Object.values(buttonKeyboard.root))
      expect(buttonMachine.events).toContain(action);
  });
  it('aria table keeps native state out of ARIA (switch uses dom.checked)', () => {
    expect(switchAria.parts.control.role).toBe('switch');
    expect(switchAria.transitions.off.toggle.dom.control.checked).toBe('true');
    expect('aria' in switchAria.transitions.off.toggle).toBe(false);
  });
  it('kind union and table agree', () => {
    const k: Kind = 'email';
    expect(KINDS[k][0]).toBe('email');
    // @ts-expect-error unknown kind is a type error (ADR-007)
    const bad: Kind = 'emial';
    expect(bad).toBe('emial');
  });
  it('state and event unions are the contract values', () => {
    const s: SwitchState = 'on';
    const e: SwitchEvent = 'toggle';
    const bs: ButtonState = 'idle';
    const be: ButtonEvent = 'press';
    // @ts-expect-error not a switch state
    const nope: SwitchState = 'idle';
    expect([s, e, bs, be, nope]).toHaveLength(5);
  });
});
