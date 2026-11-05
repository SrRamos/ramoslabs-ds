import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import contract from '../../../contracts/contracts/form.contract.json';
import { formMachine } from '../generated/form/index';
import { KINDS, resolveKind, type Kind } from '../kinds/index';
import { createForm, type FormProps } from './index';
import { reduce, reducerEvents } from './reducer';

const kinds = Object.keys(KINDS) as Kind[];
const kindArb = fc.constantFrom(...kinds);
const isTextarea = (k: Kind) => resolveKind(k).type === 'textarea';
const secrets: Kind[] = ['password', 'password-new', 'otp', 'otp-alnum', 'cc-csc'];

/** Independent oracle: fixed rows from resolveKind, textarea excluded, position by last editable. */
function oracle(list: Kind[], o: FormProps = {}) {
  const editable = list.map((k) => !isTextarea(k));
  const last = editable.lastIndexOf(true);
  return list.map((k, i) => {
    if (!editable[i]) return 'enter';
    const fixed = resolveKind(k, { autoSubmit: o.autoSubmit }).enterkeyhint;
    if (fixed) return fixed;
    return i < last ? 'next' : (o.enter ?? (o.submits !== false ? 'go' : 'done'));
  });
}
const keyed = (list: Kind[]) => list.map((kind, i) => ({ key: `f${i}`, kind }));

describe('contract', () => {
  it('has no actions, no events, one idle state; reducer is a no-op', () => {
    expect(contract.actions).toEqual([]);
    expect(contract.events).toEqual([]);
    expect(formMachine.states).toEqual(['idle']);
    expect([...reducerEvents]).toEqual([]);
    expect((reduce as (s: 'idle', e: object) => 'idle')('idle', { type: 'x' })).toBe('idle');
    expect(contract.anatomy).toEqual([{ part: 'root', element: 'form' }]);
    expect(contract.pattern.evidence).toBe('form');
  });
  it('props are exactly the ones the owner reads', () => {
    expect(contract.props.map((p) => p.name).sort()).toEqual(
      ['autoSubmit', 'enter', 'fields', 'submits'].sort(),
    );
  });
});

describe('root', () => {
  it('is a plain native form: no handlers, no submit or validation attributes', () => {
    const bag = createForm().getRootProps({ action: '/x', onSubmit: () => {} });
    expect(Object.keys(bag).sort()).toEqual(['action', 'class', 'data-part', 'onSubmit']);
    expect(bag).toMatchObject({ class: 'sj-form__root', 'data-part': 'root', action: '/x' });
    expect(bag).not.toHaveProperty('noValidate');
    expect(bag).not.toHaveProperty('novalidate');
  });
  it('data-part is library owned', () => {
    expect(createForm().getRootProps({ 'data-part': 'x' })['data-part']).toBe('root');
  });
});

describe('Enter position (ADR-007)', () => {
  it('data-first fields match the oracle for any order, with no registration (SSR safe)', () => {
    fc.assert(
      fc.property(
        fc.array(kindArb, { maxLength: 8 }),
        fc.constantFrom(undefined, 'go', 'send', 'search'),
        fc.boolean(),
        fc.boolean(),
        (list, enter, submits, autoSubmit) => {
          const p: FormProps = { fields: keyed(list), enter, submits, autoSubmit };
          const f = createForm(() => p);
          expect(keyed(list).map((x) => f.hint(x.key))).toEqual(oracle(list, p));
        },
      ),
    );
  });
  it('textarea kinds are always enter and never the last field', () => {
    const f = createForm(() => ({ fields: keyed(['email', 'address', 'name', 'address']) }));
    expect(['f0', 'f1', 'f2', 'f3'].map(f.hint)).toEqual(['next', 'enter', 'go', 'enter']);
    const g = createForm(() => ({ fields: keyed(['address']) }));
    expect(g.hint('f0')).toBe('enter');
  });
  it('a non-submitting group ends with done; enter wins; unknown key is undefined', () => {
    const p: FormProps = { fields: keyed(['text', 'text']), submits: false };
    expect(createForm(() => p).hint('f1')).toBe('done');
    expect(createForm(() => ({ ...p, enter: 'send' })).hint('f1')).toBe('send');
    expect(createForm(() => p).hint('nope')).toBeUndefined();
    expect(createForm().hint('f0')).toBeUndefined();
  });
  it('the native form `action` is never read by core (the prop is `enter`)', () => {
    const p = { fields: keyed(['text', 'text']), action: 'send' } as unknown as FormProps;
    const f = createForm(() => p);
    expect(['f0', 'f1'].map(f.hint)).toEqual(['next', 'go']);
    for (const a of ['go', 'send', 'search', '/submit', 'https://x.test/post']) {
      const q = { fields: keyed(['text']), action: a } as unknown as FormProps;
      expect(createForm(() => q).hint('f0')).toBe('go');
    }
    expect(createForm(() => ({ ...p, enter: 'send' })).hint('f1')).toBe('send');
  });
  it('kind overrides win over position (url go, search search)', () => {
    const f = createForm(() => ({ fields: keyed(['url', 'search', 'text']) }));
    expect(['f0', 'f1', 'f2'].map(f.hint)).toEqual(['go', 'search', 'go']);
  });
  it('registration order is the order; unregister is idempotent; hints follow', () => {
    const f = createForm();
    const off = ['a', 'b', 'c'].map((key) => f.register({ key, kind: 'text' }));
    expect(['a', 'b', 'c'].map(f.hint)).toEqual(['next', 'next', 'go']);
    off[2]!();
    off[2]!();
    expect(['a', 'b'].map(f.hint)).toEqual(['next', 'go']);
    expect(f.hint('c')).toBeUndefined();
    off[0]!();
    expect(f.hint('b')).toBe('go');
  });
  it('registration changes notify subscribers; a no-op keeps the snapshot reference', () => {
    const f = createForm();
    let n = 0;
    f.store.subscribe(() => n++);
    f.register({ key: 'a', kind: 'text' });
    const snap = f.store.getSnapshot();
    f.register({ key: 'a', kind: 'text' });
    expect(f.store.getSnapshot()).toBe(snap);
    expect(n).toBe(1);
    f.register({ key: 'a', kind: 'email' });
    expect(f.store.getSnapshot().fields).toEqual([{ key: 'a', kind: 'email' }]);
    expect(n).toBe(2);
  });
  it('seeded defect: counting textareas in the position fails the oracle', () => {
    const wrong = (list: Kind[]) => list.map((_, i) => (i < list.length - 1 ? 'next' : 'go'));
    expect(wrong(['text', 'address'])).not.toEqual(oracle(['text', 'address']));
  });
});

describe('WCAG 3.3.7 retained values', () => {
  const owner = (list: Kind[]) => {
    const f = createForm();
    keyed(list).forEach((x) => f.register(x));
    return f;
  };
  it('retains the latest value per key and offers values entered elsewhere', () => {
    const f = owner(['text', 'text', 'text']);
    f.retain('f0', '12 Main St');
    f.retain('f1', '12 Main St');
    f.retain('f2', 'Ana');
    f.retain('f0', '14 Main St');
    expect(f.prior('f0')).toBe('14 Main St');
    expect(f.offers('f2')).toEqual(['14 Main St', '12 Main St']);
    expect(f.offers('f0')).toEqual(['12 Main St', 'Ana']);
  });
  it('retained values survive unregistering the field (multi-step flows)', () => {
    const f = createForm();
    const off = f.register({ key: 'a', kind: 'email' });
    f.retain('a', 'a@b.co');
    off();
    expect(f.prior('a')).toBe('a@b.co');
  });
  it('empty clears; offers are distinct and never include the own key or empty values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom('a', 'b', 'c'), fc.string()), { maxLength: 12 }),
        (writes) => {
          const f = owner(['text', 'text', 'text']);
          const model = new Map<string, string>();
          for (const [k, v] of writes) {
            const key = ({ a: 'f0', b: 'f1', c: 'f2' } as const)[k as 'a' | 'b' | 'c'];
            f.retain(key, v);
            if (v) model.set(key, v);
            else model.delete(key);
          }
          for (const key of ['f0', 'f1', 'f2']) {
            expect(f.prior(key)).toBe(model.get(key));
            const offers = f.offers(key);
            expect(new Set(offers).size).toBe(offers.length);
            expect(offers).not.toContain('');
            const others = [...model].filter(([k]) => k !== key).map(([, v]) => v);
            expect([...offers].sort()).toEqual([...new Set(others)].sort());
          }
        },
      ),
    );
  });
  it('secrets are never retained or offered (password, one-time code, card security code)', () => {
    for (const k of secrets) {
      const f = createForm();
      f.register({ key: 's', kind: k });
      f.register({ key: 'o', kind: 'text' });
      f.retain('s', 'hunter2');
      expect(f.prior('s')).toBeUndefined();
      expect(f.offers('o')).toEqual([]);
    }
  });
  it('data-first secrets are guarded without any registration', () => {
    const f = createForm(() => ({
      fields: [
        { key: 'pw', kind: 'password' },
        { key: 'n', kind: 'text' },
      ],
    }));
    f.retain('pw', 'x');
    expect(f.prior('pw')).toBeUndefined();
    expect(f.offers('n')).toEqual([]);
  });
  it('every non-secret kind is retained', () => {
    for (const k of kinds.filter((x) => !secrets.includes(x))) {
      const f = createForm();
      f.register({ key: 'x', kind: k });
      f.retain('x', 'v');
      expect(f.prior('x')).toBe('v');
    }
  });
  it('seeded defect: a retain that keeps a secret fails the secret test', () => {
    const naive = new Map<string, string>();
    naive.set('s', 'hunter2');
    expect(naive.get('s')).toBeDefined(); // the owner must differ from this
    const f = createForm();
    f.register({ key: 's', kind: 'password' });
    f.retain('s', 'hunter2');
    expect(f.prior('s')).not.toBe(naive.get('s'));
  });
});
