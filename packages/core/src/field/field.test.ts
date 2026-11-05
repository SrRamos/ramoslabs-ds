import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import contract from '../../../contracts/contracts/field.contract.json';
import { fieldMachine } from '../generated/field/index';
import { createForm } from '../form/index';
import { createLiveRegistry, type LiveHost, type LiveRole } from '../live/index';
import { createFakeScheduler } from '../runtime/index';
import { createField, type FieldContext, type FieldProps } from './index';
import { reduce, reducerEvents } from './reducer';

const mk = (p: FieldProps = {}, ctx: Partial<FieldContext> = {}) => {
  let props = p;
  const field = createField(() => props, { id: 'f1', ...ctx });
  return { field, set: (n: FieldProps) => void (props = n) };
};
const tokens = (v: unknown) => (typeof v === 'string' ? v.split(' ') : []);

describe('contract', () => {
  it('no actions or events, one idle state; reducer is a no-op', () => {
    expect(contract.actions).toEqual([]);
    expect(contract.events).toEqual([]);
    expect(fieldMachine.states).toEqual(['idle']);
    expect([...reducerEvents]).toEqual([]);
    expect((reduce as (s: 'idle', e: object) => 'idle')('idle', { type: 'x' })).toBe('idle');
  });
  it('declares the error live region, polite; evidence is the text-field file', () => {
    expect(contract.a11y.liveRegions).toEqual([{ id: 'error', politeness: 'polite' }]);
    expect(contract.pattern.evidence).toBe('text-field');
    expect(contract.budgets.gzipKiB).toBe(3);
  });
  it('props name exactly what FieldProps reads; anatomy names every getter part', () => {
    expect(contract.props.map((p) => p.name).sort()).toEqual(
      ['disabled', 'error', 'errorMessage', 'hasHint', 'id', 'kind', 'name', 'required'].sort(),
    );
    expect(contract.anatomy.map((a) => a.part).sort()).toEqual(
      ['control', 'error', 'hint', 'label', 'root'].sort(),
    );
  });
});

describe('ids', () => {
  it('are <id>-label, -hint, -error and the control id; label points at the control', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z0-9_:-]{0,12}$/), (id) => {
        const { field } = mk({ hasHint: true, error: 'x' }, { id });
        expect(field.ids).toEqual({
          control: id,
          label: `${id}-label`,
          hint: `${id}-hint`,
          error: `${id}-error`,
        });
        expect(field.getControlProps().id).toBe(id);
        expect(field.getLabelProps()).toMatchObject({ id: `${id}-label`, for: id });
        expect(field.getHintProps().id).toBe(`${id}-hint`);
        expect(field.getErrorProps().id).toBe(`${id}-error`);
      }),
    );
  });
  it('are library owned: a consumer id is discarded', () => {
    const { field } = mk();
    expect(field.getControlProps({ id: 'mine' }).id).toBe('f1');
    expect(field.getLabelProps({ id: 'mine', for: 'x' })).toMatchObject({
      id: 'f1-label',
      for: 'f1',
    });
  });
});

describe('derived ARIA (ADR-014)', () => {
  it('aria-describedby lists exactly the rendered hint and error, in that order, and every token resolves', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.string(), (hasHint, error) => {
        const { field } = mk({ hasHint, error });
        const bag = field.getControlProps();
        const shown = error.trim() !== '';
        const want = [hasHint && 'f1-hint', shown && 'f1-error'].filter(Boolean);
        expect(tokens(bag['aria-describedby'])).toEqual(want.length ? want : []);
        if (!want.length) expect(bag).not.toHaveProperty('aria-describedby');
        const ids = Object.values(field.ids);
        for (const t of tokens(bag['aria-describedby'])) expect(ids).toContain(t);
        expect(bag['aria-invalid']).toBe(shown ? 'true' : undefined);
      }),
    );
  });
  it('aria-invalid is never "false"; a whitespace error is valid', () => {
    expect(mk({ error: '   ' }).field.getControlProps()).not.toHaveProperty('aria-invalid');
    expect(mk({}).field.getControlProps()).not.toHaveProperty('aria-invalid');
    expect(mk({ error: 'Required' }).field.getControlProps()['aria-invalid']).toBe('true');
  });
  it('consumer describedby ids are appended after the library ones, never replace them', () => {
    const { field } = mk({ hasHint: true, error: 'Bad' });
    expect(field.getControlProps({ 'aria-describedby': 'count' })['aria-describedby']).toBe(
      'f1-hint f1-error count',
    );
    expect(mk().field.getControlProps({ 'aria-describedby': 'count' })['aria-describedby']).toBe(
      'count',
    );
  });
  it('aria-errormessage only on explicit opt-in and only while invalid; a consumer value is dropped', () => {
    expect(mk({ error: 'Bad' }).field.getControlProps()).not.toHaveProperty('aria-errormessage');
    expect(
      mk({ error: 'Bad' }).field.getControlProps({ 'aria-errormessage': 'x' }),
    ).not.toHaveProperty('aria-errormessage');
    expect(
      mk({ error: 'Bad', errorMessage: true }).field.getControlProps()['aria-errormessage'],
    ).toBe('f1-error');
    expect(mk({ errorMessage: true }).field.getControlProps()).not.toHaveProperty(
      'aria-errormessage',
    );
  });
  it('error text updates the derivation on the next call (props are read at call time)', () => {
    const { field, set } = mk();
    expect(field.getControlProps()).not.toHaveProperty('aria-invalid');
    set({ error: 'Bad' });
    expect(field.getControlProps()['aria-invalid']).toBe('true');
    set({});
    expect(field.getControlProps()).not.toHaveProperty('aria-invalid');
  });
  it('the error part carries no live attributes (the registry is the only announcer)', () => {
    const bag = mk({ error: 'Bad' }).field.getErrorProps();
    for (const k of ['role', 'aria-live', 'aria-atomic', 'aria-relevant'])
      expect(bag).not.toHaveProperty(k);
  });
  it('native required, disabled and name pass through and are library owned', () => {
    const bag = mk({ required: true, disabled: true, name: 'email' }).field.getControlProps({
      required: false,
      name: 'z',
    });
    expect(bag).toMatchObject({ required: true, disabled: true, name: 'email' });
    expect(bag).not.toHaveProperty('aria-required');
    const plain = mk().field.getControlProps();
    for (const k of ['required', 'disabled', 'name']) expect(plain).not.toHaveProperty(k);
  });
  it('root state flags', () => {
    expect(mk({ error: 'x', disabled: true }).field.getRootProps()).toMatchObject({
      class: 'sj-field__root',
      'data-part': 'root',
      'data-invalid': 'true',
      'data-disabled': 'true',
    });
    const ok = mk().field.getRootProps();
    expect(ok).not.toHaveProperty('data-invalid');
    expect(ok).not.toHaveProperty('data-disabled');
  });
  it('seeded defect: a describedby that points at a missing hint is caught by the resolve check', () => {
    const bag = mk({ hasHint: false }).field.getControlProps({ 'aria-describedby': 'f1-hint' });
    const rendered = new Set(['f1']); // no hint element is rendered
    expect(tokens(bag['aria-describedby']).every((t) => rendered.has(t))).toBe(false);
  });
});

describe('error announcement (ADR-006)', () => {
  function live() {
    const s = createFakeScheduler();
    const writes: string[] = [];
    const created: LiveRole[] = [];
    const host: LiveHost = {
      create: (role) => (
        created.push(role),
        { setText: (t) => void (t && writes.push(`${role}:${t}`)) }
      ),
    };
    const registry = createLiveRegistry(s);
    registry.attach(host);
    const settle = () => (s.flush(), s.advance(5000), s.flush());
    return { registry, writes, created, settle };
  }
  it('announces a new error once, politely, however often the adapter syncs', () => {
    const l = live();
    const { field, set } = mk({}, { live: l.registry });
    set({ error: 'Enter an email' });
    expect(field.announce()).toBe(true);
    for (let i = 0; i < 5; i++) expect(field.announce()).toBe(false);
    l.settle();
    expect(field.announce()).toBe(false);
    l.settle();
    expect(l.writes).toEqual(['status:Enter an email']);
    expect(l.created).toEqual(['status']);
  });
  it('a changed message announces again; clearing then repeating announces again', () => {
    const l = live();
    const { field, set } = mk({}, { live: l.registry });
    set({ error: 'A' });
    field.announce();
    l.settle();
    set({ error: 'B' });
    field.announce();
    l.settle();
    set({});
    expect(field.announce()).toBe(false);
    set({ error: 'B' });
    field.announce();
    l.settle();
    expect(l.writes).toEqual(['status:A', 'status:B', 'status:B']);
  });
  it('is trimmed; blank is silent; no registry (server) is silent', () => {
    const l = live();
    const a = mk({ error: '   ' }, { live: l.registry });
    expect(a.field.announce()).toBe(false);
    const b = mk({ error: 'Bad' });
    expect(b.field.announce()).toBe(false);
    l.settle();
    expect(l.writes).toEqual([]);
  });
  it('never uses the alert role', () => {
    const l = live();
    const { field } = mk({ error: 'Bad' }, { live: l.registry });
    field.announce();
    l.settle();
    expect(l.created).not.toContain('alert');
  });
  it('connect cleanup lets a remounted field announce its standing error again', () => {
    const l = live();
    const { field } = mk({ error: 'Bad' }, { live: l.registry });
    const off = field.connect();
    field.announce();
    l.settle();
    off();
    field.announce();
    l.settle();
    expect(l.writes).toEqual(['status:Bad', 'status:Bad']);
  });
});

describe('form owner context', () => {
  it('registers by name (or id), reports the Enter hint, textarea excluded, and cleans up', () => {
    const form = createForm();
    const a = mk({ name: 'email', kind: 'email' }, { id: 'a', form });
    const b = mk({ kind: 'text' }, { id: 'b', form });
    const c = mk({ name: 'notes', kind: 'address' }, { id: 'c', form });
    const offs = [a, b, c].map((x) => x.field.connect());
    expect(a.field.enterHint()).toBe('next');
    expect(b.field.enterHint()).toBe('go');
    expect(c.field.enterHint()).toBe('enter');
    expect(form.store.getSnapshot().fields.map((f) => f.key)).toEqual(['email', 'b', 'notes']);
    offs[1]!();
    expect(a.field.enterHint()).toBe('go');
    expect(b.field.enterHint()).toBeUndefined();
  });
  it('outside a form there is no hint and nothing to retain', () => {
    const { field } = mk({ kind: 'text' });
    expect(field.enterHint()).toBeUndefined();
    field.retain('x');
    expect(field.prior()).toBeUndefined();
    expect(field.offers()).toEqual([]);
    expect(() => field.connect()()).not.toThrow();
  });
  it('3.3.7: a value entered in one field is retained and offered to another', () => {
    const form = createForm();
    const a = mk({ name: 'billing', kind: 'address-line' }, { id: 'a', form });
    const b = mk({ name: 'shipping', kind: 'address-line' }, { id: 'b', form });
    a.field.connect();
    b.field.connect();
    a.field.retain('12 Main St');
    expect(a.field.prior()).toBe('12 Main St');
    expect(b.field.prior()).toBeUndefined();
    expect(b.field.offers()).toEqual(['12 Main St']);
  });
  it('a password field retains nothing', () => {
    const form = createForm();
    const a = mk({ name: 'pw', kind: 'password' }, { id: 'a', form });
    a.field.connect();
    a.field.retain('secret');
    expect(a.field.prior()).toBeUndefined();
  });
});

describe('SSR', () => {
  it('getters are pure: the same props give equal bags, and nothing needs a runtime or document', () => {
    const p: FieldProps = { hasHint: true, error: 'Bad', name: 'n', required: true };
    expect(mk(p).field.getControlProps()).toEqual(mk(p).field.getControlProps());
    expect(mk(p).field.getRootProps()).toEqual(mk(p).field.getRootProps());
  });
});
