import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import contract from '../../../contracts/contracts/input.contract.json';
import kindsContract from '../../../contracts/contracts/kinds.contract.json';
import { inputMachine } from '../generated/input/index';
import { KINDS, resolveKind, type Kind } from '../kinds/index';
import { createField } from '../field/index';
import { createForm } from '../form/index';
import { createInput, reduce, reducerEvents, initialSnapshot, type InputProps } from './index';

const allKinds = Object.keys(KINDS) as Kind[];
// SJSelect owns `choice` (and the select form of `country`).
const kinds = allKinds.filter((k) => k !== 'choice');
const attr = (p: Record<string, unknown>) => (k: string) => p[k];
const mk = (p: InputProps = {}, ctx: Parameters<typeof createInput>[1] = {}) =>
  createInput(() => p, ctx);

describe('contract and reducer', () => {
  it('machine, events and kinds match the contract and the kinds table', () => {
    expect([...reducerEvents]).toEqual([...inputMachine.events]);
    expect(reduce('pristine', { type: 'touch' })).toBe('touched');
    expect(reduce('touched', { type: 'touch' })).toBe('touched');
    expect(reduce('pristine', { type: 'x' })).toBe('pristine');
    expect(reduce('touched', { type: 'reset' })).toBe('pristine');
    expect(reduce('pristine', { type: 'reset' })).toBe('pristine');
    const s = initialSnapshot;
    expect(reduce(s, { type: 'x' }).state).toBe(s);
    expect(reduce(s, { type: 'touch' }).state).toEqual({ state: 'touched' });
    expect([...contract.kinds].sort()).toEqual([...kinds].sort());
    expect(kindsContract.kinds.map((k) => k.kind).sort()).toEqual([...allKinds].sort());
  });
  it('declares the user-invalid support row with a Chromium 114-118 fallback', () => {
    expect(contract.actions.map((a) => a.id)).toEqual(['touch', 'reset']);
    expect(contract.support).toEqual([
      {
        feature: 'user-invalid',
        nativeFrom: { chromium: 119, firefox: 88, safari: 17 },
        fallbackUntil: { chromium: 118, firefox: 87, safari: 16 },
      },
    ]);
    expect(contract.runtime).toContain('supports');
  });
  it('no slot shares a prop name; core budget is 3 KiB', () => {
    const props = new Set(contract.props.map((p) => p.name));
    for (const s of contract.slots as { name: string }[]) expect(props.has(s.name)).toBe(false);
    expect(contract.budgets.gzipKiB).toBe(3);
    expect(contract.props.map((p) => p.name).sort()).toEqual(
      [
        'autoSubmit',
        'autocomplete',
        'digits',
        'disabled',
        'id',
        'kind',
        'meaningful',
        'name',
        'required',
        'section',
        'uppercase',
        'variant',
      ].sort(),
    );
  });
});

describe('every ADR-007 kind row in the control bag', () => {
  it('resolves exactly what resolveKind says, for every kind', () => {
    for (const kind of kinds) {
      const input = mk({ kind });
      const r = resolveKind(kind, kind === 'country' ? { variant: 'text' } : {});
      const bag = input.getControlProps();
      const a = attr(bag);
      expect(a('inputmode')).toBe(r.inputmode);
      expect(a('autocomplete')).toBe(r.autocomplete);
      expect(a('enterkeyhint')).toBe(r.enterkeyhint);
      expect(a('autocapitalize')).toBe(r.autocapitalize);
      expect(a('autocorrect')).toBe(r.autocorrect);
      expect(a('spellcheck')).toBe(r.spellcheck === undefined ? undefined : String(r.spellcheck));
      expect(a('type')).toBe(input.tag() === 'input' ? r.type : undefined);
      expect(r.type).not.toBe('select');
    }
  });
  it('never emits maxlength or type=number for identifiers', () => {
    for (const kind of kinds) {
      const bag = mk({ kind }).getControlProps();
      expect(bag).not.toHaveProperty('maxlength');
      expect(bag).not.toHaveProperty('maxLength');
      if (kind !== 'quantity') expect(bag.type).not.toBe('number');
    }
    expect(mk({ kind: 'quantity' }).getControlProps().type).toBe('number');
    expect(mk({ kind: 'quantity', variant: 'text' }).getControlProps()).toMatchObject({
      type: 'text',
      inputmode: 'numeric',
    });
  });
  it('spot rows: email, phone, otp, password, url, cc-number', () => {
    const b = (kind: Kind, p: InputProps = {}) => mk({ kind, ...p }).getControlProps();
    expect(b('email')).toMatchObject({
      type: 'email',
      inputmode: 'email',
      autocomplete: 'email',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
    });
    expect(b('phone')).toMatchObject({ type: 'tel', inputmode: 'tel', autocomplete: 'tel' });
    expect(b('otp')).toMatchObject({
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'one-time-code',
      enterkeyhint: 'done',
    });
    expect(b('otp', { autoSubmit: true }).enterkeyhint).toBe('go');
    expect(b('otp-alnum', { uppercase: true }).autocapitalize).toBe('characters');
    expect(b('otp-alnum').autocapitalize).toBeUndefined();
    expect(b('password')).toMatchObject({ type: 'password', autocomplete: 'current-password' });
    expect(b('password-new').autocomplete).toBe('new-password');
    expect(b('url').enterkeyhint).toBe('go');
    expect(b('url').autocomplete).toBeUndefined();
    expect(b('url', { meaningful: true }).autocomplete).toBe('url');
    expect(b('search').enterkeyhint).toBe('search');
    expect(b('cc-number')).toMatchObject({ inputmode: 'numeric', autocomplete: 'cc-number' });
    expect(b('cc-csc').enterkeyhint).toBe('done');
    expect(b('postal').inputmode).toBe('numeric');
    expect(b('postal', { digits: false }).inputmode).toBeUndefined();
    expect(b('tax-id').inputmode).toBeUndefined();
    expect(b('tax-id', { digits: true }).inputmode).toBe('numeric');
    expect(b('tax-id').autocomplete).toBeUndefined();
    expect(b('name', { autocomplete: 'given-name', section: 'ship' }).autocomplete).toBe(
      'section-ship given-name',
    );
  });
  it('address renders a textarea with no type; country is always the text variant', () => {
    const address = mk({ kind: 'address' });
    expect(address.tag()).toBe('textarea');
    expect(address.getControlProps()).not.toHaveProperty('type');
    expect(address.getControlProps().enterkeyhint).toBe('enter');
    for (const p of [{}, { variant: 'text' as const }]) {
      const c = mk({ kind: 'country', ...p });
      expect(c.tag()).toBe('input');
      expect(c.getControlProps()).toMatchObject({ type: 'text', autocomplete: 'country-name' });
    }
    expect(mk({}).tag()).toBe('input');
  });
  it('property: a consumer attribute overrides, unknown kind defaults to text', () => {
    fc.assert(
      fc.property(fc.constantFrom(...kinds), fc.string(), (kind, v) => {
        const bag = mk({ kind }).getControlProps({ inputmode: v });
        expect(bag.inputmode).toBe(v);
      }),
    );
    expect(mk().getControlProps().type).toBe('text');
  });
});

describe('inside an SJField and SJForm', () => {
  const setup = (
    inputs: { id: string; kind: Kind; name?: string }[],
    fieldProps: Record<string, unknown> = {},
  ) => {
    const form = createForm(() => ({}));
    const parts = inputs.map((i) => {
      const field = createField(() => ({ name: i.name, ...fieldProps }), { id: i.id, form });
      const input = createInput(() => ({ kind: i.kind }), { field });
      return { field, input };
    });
    // children mount first, then the field connects
    const offs = parts.flatMap((p) => [p.input.connect(), p.field.connect()]);
    return { form, parts, offs };
  };

  it('IDREFs and invalid state come from the field; name and required are native', () => {
    const f = createField(() => ({ name: 'mail', required: true, hasHint: true, error: ' bad ' }), {
      id: 'x',
    });
    const bag = createInput(() => ({ kind: 'email', id: 'ignored', name: 'ignored' }), {
      field: f,
    }).getControlProps({ 'aria-describedby': 'extra' });
    expect(bag).toMatchObject({
      id: 'x',
      name: 'mail',
      required: true,
      type: 'email',
      'aria-invalid': 'true',
      'aria-describedby': 'x-hint x-error extra',
    });
  });
  it('the Enter hint follows field order, textarea kinds excluded', () => {
    const { parts } = setup([
      { id: 'a', kind: 'name', name: 'a' },
      { id: 'b', kind: 'address', name: 'b' },
      { id: 'c', kind: 'email', name: 'c' },
    ]);
    const hint = (i: number) => parts[i]!.input.getControlProps().enterkeyhint;
    expect(hint(0)).toBe('next');
    expect(hint(1)).toBe('enter');
    expect(hint(2)).toBe('go');
  });
  it('connect reports the kind (children first) and the cleanup unregisters it', () => {
    const { form, parts, offs } = setup([{ id: 'a', kind: 'password', name: 'pw' }]);
    expect(form.store.getSnapshot().fields).toEqual([{ key: 'pw', kind: 'password' }]);
    parts[0]!.input.connect()();
    expect(form.store.getSnapshot().fields).toEqual([{ key: 'pw', kind: undefined }]);
    offs.forEach((o) => o());
    expect(form.store.getSnapshot().fields).toEqual([]);
  });
  it('a value change retains the entered value (3.3.7), never for secret kinds', () => {
    const { form, parts } = setup([
      { id: 'a', kind: 'name', name: 'n' },
      { id: 'b', kind: 'password', name: 'pw' },
    ]);
    const change = (i: number, value: string) =>
      (parts[i]!.input.getControlProps().onChange as (e: unknown) => void)({ target: { value } });
    change(0, 'Ada');
    change(1, 'hunter2');
    expect(form.store.getSnapshot().values).toEqual({ n: 'Ada' });
    expect(parts[1]!.field.offers()).toEqual(['Ada']);
  });
});

describe(':user-invalid fallback', () => {
  const fire = (bag: Record<string, unknown>, h: 'onChange' | 'onInvalid', value = 'x') =>
    (bag[h] as (e: unknown) => void)({ target: { value } });
  it('a user change or an invalid event touches; blur alone (tab-through) does not', () => {
    const input = mk({ kind: 'email', required: true });
    const bag = input.getControlProps();
    expect(bag).not.toHaveProperty('onBlur');
    expect(bag['data-touched']).toBeUndefined();
    fire(bag, 'onChange');
    expect(input.getControlProps()['data-touched']).toBe('true');
    const second = mk();
    fire(second.getControlProps(), 'onInvalid');
    expect(second.getControlProps()['data-touched']).toBe('true');
    expect(input.store.getSnapshot().state).toBe('touched');
  });
  it('the form reset clears the touched state', () => {
    const input = mk();
    fire(input.getControlProps(), 'onInvalid');
    input.reset();
    expect(input.getControlProps()['data-touched']).toBeUndefined();
    expect(input.store.getSnapshot().state).toBe('pristine');
  });
  it('is inert with native :user-invalid (forced-true) and a consumer cannot fake it', () => {
    const input = mk({}, { userInvalid: true });
    fire(input.getControlProps(), 'onChange');
    fire(input.getControlProps(), 'onInvalid');
    expect(input.store.getSnapshot().state).toBe('pristine');
    expect(input.getControlProps({ 'data-touched': 'true' })['data-touched']).toBeUndefined();
    expect(mk().getControlProps({ 'data-touched': 'true' })['data-touched']).toBeUndefined();
  });
  it('tabbing through (no change) keeps a value retained earlier under the same key', () => {
    const form = createForm(() => ({}));
    const field = createField(() => ({ name: 'n' }), { id: 'a', form });
    const input = createInput(() => ({ kind: 'name' }), { field });
    field.connect();
    fire(input.getControlProps(), 'onChange', 'Ada');
    expect(form.store.getSnapshot().values).toEqual({ n: 'Ada' });
    expect(input.getControlProps()).not.toHaveProperty('onBlur');
    expect(form.store.getSnapshot().values).toEqual({ n: 'Ada' });
  });
});

describe('standalone and root', () => {
  it('standalone input carries its own id, name, required and disabled', () => {
    expect(
      mk({ id: 'i', name: 'n', required: true, disabled: true }).getControlProps(),
    ).toMatchObject({
      id: 'i',
      name: 'n',
      required: true,
      disabled: true,
    });
    expect(mk().getControlProps()).not.toHaveProperty('required');
  });
  it('root and control carry parts and classes; the root reports the kind', () => {
    const i = mk({ kind: 'phone' });
    expect(i.getRootProps()).toMatchObject({
      class: 'sj-input__root',
      'data-part': 'root',
      'data-kind': 'phone',
    });
    expect(i.getControlProps({ class: 'x' }).class).toBe('sj-input__control x');
  });
});
