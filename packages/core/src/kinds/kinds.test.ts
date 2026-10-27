import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import contract from '../../../contracts/contracts/kinds.contract.json';
import { KINDS, enterKeyHints, resolveKind, type Kind, type Row } from './index';

type C = {
  kind: string;
  type: string[];
  inputmode: string | null;
  autocomplete: unknown;
  enter: string;
  autocapitalize: unknown;
  autocorrect: string | null;
  spellcheck: boolean | null;
  group?: string;
  variantOf?: string;
  enterAlternatives?: string[];
  forbiddenTypes?: string[];
  noMaxlength: boolean;
};
const rows = contract.kinds as unknown as C[];

/** Project a contract row onto the table encoding (the drift oracle; W1-304 codegen must agree with it). */
function project(c: C): Row {
  const a = c.autocomplete as {
    policy: string;
    default?: string;
    tokens?: string[];
    variants?: string[];
  };
  let ac: Row[2];
  if (a.policy === 'omitted') ac = null;
  else if (a.policy === 'off') ac = 'off';
  else if (a.policy === 'context') ac = a.default ?? 'ctx';
  else {
    const toks = [...(a.tokens ?? []), ...(a.variants ?? [])];
    ac = a.policy === 'conditional' ? ['?', ...toks] : toks;
  }
  const cap = c.autocapitalize as { value: string | null; when?: string };
  return [
    c.type.length === 1 ? c.type[0]! : c.type,
    c.inputmode,
    ac,
    c.enter === 'done' && c.enterAlternatives ? 'done/go' : c.enter,
    cap.value === 'characters' && cap.when ? 'characters?' : cap.value,
    c.autocorrect as Row[5],
    c.spellcheck,
    ...(c.kind === 'tax-id'
      ? [2 as const]
      : c.group === 'postal-reference-account'
        ? [1 as const]
        : []),
  ] as unknown as Row;
}

describe('table mirrors kinds.contract.json (drift fails)', () => {
  it('same kinds, same order, no extras', () => {
    expect(Object.keys(KINDS)).toEqual(rows.map((r) => r.kind));
  });
  it.each(rows.map((r) => [r.kind, r] as const))('%s row is identical', (_k, c) => {
    expect(KINDS[c.kind as Kind]).toEqual(project(c));
  });
  it('variantOf rows share the parent row', () => {
    for (const c of rows)
      if ('variantOf' in c)
        expect(KINDS[c.kind as Kind]).toEqual(KINDS[(c as { variantOf: Kind }).variantOf]);
  });
  it('forbiddenTypes never appear in the table', () => {
    for (const c of rows)
      for (const f of c.forbiddenTypes ?? [])
        expect([KINDS[c.kind as Kind][0]].flat()).not.toContain(f);
  });
  it('a seeded drift is detected', () => {
    const tampered = { ...rows[0]!, inputmode: 'email' };
    expect(KINDS.text).not.toEqual(project(tampered));
  });
});

describe('resolveKind', () => {
  it('resolves every contract row exactly (defaults)', () => {
    for (const c of rows) {
      const r = resolveKind(c.kind as Kind);
      expect(r.type).toBe(c.type[0]);
      const gated = c.group === 'postal-reference-account' || c.kind === 'tax-id';
      if (c.inputmode && !(c.kind === 'tax-id') && c.type[0] !== 'number')
        expect(r.inputmode).toBe(c.inputmode);
      else if (!gated || c.kind === 'tax-id') expect(r.inputmode).toBeUndefined();
      const cap = c.autocapitalize as { value: string | null; when?: string };
      expect(r.autocapitalize).toBe(
        cap.when === 'canonical uppercase' ? undefined : (cap.value ?? undefined),
      );
      expect(r.autocorrect).toBe(c.autocorrect ?? undefined);
      expect(r.spellcheck).toBe(c.spellcheck ?? undefined);
    }
  });
  it('never emits maxlength, whatever the context', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(Object.keys(KINDS) as Kind[])),
        fc.record(
          {
            meaningful: fc.boolean(),
            digits: fc.boolean(),
            uppercase: fc.boolean(),
            autoSubmit: fc.boolean(),
            autocomplete: fc.string(),
          },
          { requiredKeys: [] },
        ),
        (k, ctx) => {
          const r = resolveKind(k, ctx);
          expect(Object.keys(r).some((x) => /maxlength/i.test(x))).toBe(false);
          expect(Object.values(r).every((v) => v !== undefined)).toBe(true);
        },
      ),
    );
  });
  it('numeric-looking identifiers never resolve to type=number', () => {
    for (const c of rows)
      if (c.forbiddenTypes)
        for (const v of [undefined, 'text' as const])
          expect(resolveKind(c.kind as Kind, { variant: v }).type).not.toBe('number');
  });
  it('autocomplete: tokens, variants, sections, conditionals', () => {
    expect(resolveKind('name').autocomplete).toBe('name');
    expect(resolveKind('name', { autocomplete: 'given-name' }).autocomplete).toBe('given-name');
    expect(resolveKind('name', { autocomplete: 'bogus' }).autocomplete).toBe('name');
    expect(resolveKind('phone', { autocomplete: 'tel-national' }).autocomplete).toBe(
      'tel-national',
    );
    expect(resolveKind('address-line', { autocomplete: 'address-line2' }).autocomplete).toBe(
      'address-line2',
    );
    expect(resolveKind('email', { section: 'billing' }).autocomplete).toBe('section-billing email');
    expect(resolveKind('url').autocomplete).toBeUndefined();
    expect(resolveKind('url', { meaningful: true }).autocomplete).toBe('url');
    expect(resolveKind('amount').autocomplete).toBeUndefined();
    expect(resolveKind('amount', { meaningful: true }).autocomplete).toBe('transaction-amount');
    expect(resolveKind('tax-id', { autocomplete: 'off' }).autocomplete).toBeUndefined();
    expect(resolveKind('search').autocomplete).toBe('off');
    expect(resolveKind('text').autocomplete).toBe('on');
    expect(resolveKind('quantity').autocomplete).toBe('off');
    expect(resolveKind('postal').autocomplete).toBe('postal-code');
    expect(resolveKind('reference').autocomplete).toBeUndefined();
    expect(resolveKind('reference', { autocomplete: 'postal-code' }).autocomplete).toBe(
      'postal-code',
    );
  });
  it('variants and gates', () => {
    expect(resolveKind('quantity')).toMatchObject({ type: 'number' });
    expect(resolveKind('quantity').inputmode).toBeUndefined();
    expect(resolveKind('quantity', { variant: 'text' })).toMatchObject({
      type: 'text',
      inputmode: 'numeric',
    });
    expect(resolveKind('country')).toMatchObject({ type: 'select', autocomplete: 'country' });
    expect(resolveKind('country', { variant: 'text' })).toMatchObject({
      type: 'text',
      autocomplete: 'country-name',
    });
    expect(resolveKind('postal').inputmode).toBe('numeric');
    expect(resolveKind('postal', { digits: false }).inputmode).toBeUndefined();
    expect(resolveKind('tax-id').inputmode).toBeUndefined();
    expect(resolveKind('tax-id', { digits: true }).inputmode).toBe('numeric');
    expect(resolveKind('otp-alnum').autocapitalize).toBeUndefined();
    expect(resolveKind('otp-alnum', { uppercase: true }).autocapitalize).toBe('characters');
    expect(resolveKind('amount-signed')).toEqual(resolveKind('amount'));
  });
  it('enter: kind overrides, position, textarea fixed', () => {
    expect(resolveKind('text').enterkeyhint).toBeUndefined();
    expect(resolveKind('text', { enter: 'next' }).enterkeyhint).toBe('next');
    expect(resolveKind('url', { enter: 'next' }).enterkeyhint).toBe('go');
    expect(resolveKind('search', { enter: 'next' }).enterkeyhint).toBe('search');
    expect(resolveKind('otp').enterkeyhint).toBe('done');
    expect(resolveKind('otp', { autoSubmit: true }).enterkeyhint).toBe('go');
    expect(resolveKind('otp-alnum', { autoSubmit: true }).enterkeyhint).toBe('go');
    expect(resolveKind('cc-csc', { enter: 'next' }).enterkeyhint).toBe('done');
    expect(resolveKind('address', { enter: 'done' }).enterkeyhint).toBe('enter');
  });
});

describe('enterKeyHints (form owner)', () => {
  it('next while another field follows, done on the last of a non-submitting group', () => {
    expect(enterKeyHints(['name', 'email', 'phone'])).toEqual(['next', 'next', 'done']);
  });
  it('go / send / search on the last field', () => {
    expect(enterKeyHints(['name', 'email'], { submits: true })).toEqual(['next', 'go']);
    expect(enterKeyHints(['text'], { action: 'send' })).toEqual(['send']);
    expect(enterKeyHints(['text'], { action: 'search' })).toEqual(['search']);
    expect(enterKeyHints(['name', 'text'], { action: 'send', submits: true })).toEqual([
      'next',
      'send',
    ]);
  });
  it('textarea kinds are fixed to enter and excluded from position', () => {
    expect(enterKeyHints(['name', 'address'], { submits: true })).toEqual(['go', 'enter']);
    expect(enterKeyHints(['address', 'name', 'address'])).toEqual(['enter', 'done', 'enter']);
    expect(enterKeyHints(['address'])).toEqual(['enter']);
  });
  it('kind overrides win over position', () => {
    expect(enterKeyHints(['url', 'search', 'otp', 'text'])).toEqual([
      'go',
      'search',
      'done',
      'done',
    ]);
    expect(enterKeyHints(['otp', 'text'], { autoSubmit: true })).toEqual(['go', 'done']);
    expect(enterKeyHints(['cc-number', 'cc-csc'])).toEqual(['next', 'done']);
  });
  it('invariants: textareas always enter; others never enter; empty list is empty', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...(Object.keys(KINDS) as Kind[])), { maxLength: 12 }),
        fc.boolean(),
        (ks, submits) => {
          const hs = enterKeyHints(ks, { submits });
          expect(hs).toHaveLength(ks.length);
          ks.forEach((k, i) => expect(hs[i] === 'enter').toBe(k === 'address'));
          const last = ks.map((k) => k !== 'address').lastIndexOf(true);
          ks.forEach((k, i) => {
            if (k !== 'address' && i < last && KINDS[k][3] === 'position')
              expect(hs[i]).toBe('next');
          });
        },
      ),
    );
  });
});
