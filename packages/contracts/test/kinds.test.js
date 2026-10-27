import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateKinds } from '../scripts/validate.mjs';

const load = () =>
  JSON.parse(readFileSync(new URL('../contracts/kinds.contract.json', import.meta.url), 'utf8'));
const row = (data, kind) => data.kinds.find((k) => k.kind === kind);
const paths = (data) => validateKinds(data).errors.map((e) => e.path);

// Every row of the ADR-007 table, with the combined rows split into their kinds.
const ADR_007_KINDS = [
  'text',
  'name',
  'username',
  'email',
  'url',
  'phone',
  'otp',
  'otp-alnum',
  'amount',
  'amount-signed',
  'quantity',
  'postal',
  'reference',
  'account',
  'tax-id',
  'search',
  'password',
  'password-new',
  'date',
  'time',
  'choice',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-name',
  'address',
  'address-line',
  'country',
  'organization',
];

describe('kinds.contract.json (ADR-007)', () => {
  it('validates against kinds.schema.json', () => {
    expect(validateKinds(load()).errors).toEqual([]);
  });

  it('contains every ADR-007 kind and nothing else', () => {
    expect(
      load()
        .kinds.map((k) => k.kind)
        .sort(),
    ).toEqual([...ADR_007_KINDS].sort());
  });

  it('carries the named notes: otp-alnum, amount-signed, cc-exp*', () => {
    const d = load();
    expect(row(d, 'otp-alnum').autocapitalize).toEqual({
      value: 'characters',
      when: 'canonical uppercase',
    });
    expect(row(d, 'amount-signed')).toMatchObject({
      variantOf: 'amount',
      requiresSignControl: true,
    });
    expect(row(d, 'amount-signed').notes).toMatch(/minus/);
    expect(row(d, 'cc-exp').notes).toMatch(/inserts the display separator/);
    expect(row(d, 'cc-exp-month').group).toBe('cc-exp');
    expect(row(d, 'cc-exp-year').group).toBe('cc-exp');
  });

  it('applies the table rules: no maxlength, never type=number, address is a textarea', () => {
    const d = load();
    for (const kind of ['phone', 'otp', 'amount', 'reference', 'tax-id', 'cc-number'])
      expect(row(d, kind).noMaxlength, kind).toBe(true);
    for (const kind of ['otp', 'postal', 'reference', 'account', 'cc-number'])
      expect(row(d, kind).forbiddenTypes, kind).toEqual(['number']);
    expect(row(d, 'address')).toMatchObject({
      type: ['textarea'],
      enter: 'enter',
      excludeFromEnterPosition: true,
    });
    expect(row(d, 'tax-id').autocomplete).toEqual({ policy: 'omitted' });
    expect(row(d, 'url').enter).toBe('go');
    expect(row(d, 'search').enter).toBe('search');
    expect(row(d, 'otp')).toMatchObject({ enter: 'done', enterAlternatives: ['go'] });
  });

  it('keeps the attached rules and the certification block', () => {
    const d = load();
    expect(d.rules.map((r) => r.id)).toEqual(
      expect.arrayContaining([
        'otp-single-control',
        'no-type-number',
        'no-maxlength',
        'enterkeyhint',
      ]),
    );
    expect(d.certification['android-chrome']).toBe('not-run');
    expect(d.certification.scenarios).toHaveLength(10);
  });

  describe('seeded invalid tables fail with a path', () => {
    it('removed required row field', () => {
      const d = load();
      delete d.kinds[3].inputmode;
      expect(paths(d)).toContain('/kinds/3/inputmode');
    });
    it('unknown enterkeyhint, inputmode or type', () => {
      const d = load();
      d.kinds[0].enter = 'next-ish';
      d.kinds[1].inputmode = 'money';
      d.kinds[2].type = ['color'];
      const p = paths(d);
      expect(p).toContain('/kinds/0/enter');
      expect(p).toContain('/kinds/1/inputmode');
      expect(p).toContain('/kinds/2/type/0');
    });
    it('missing top-level field and conditional autocomplete without "when"', () => {
      const d = load();
      d.kinds[4].autocomplete = { policy: 'conditional', tokens: ['url'] };
      delete d.rules;
      const p = paths(d);
      expect(p).toContain('/rules');
      expect(p).toContain('/kinds/4/autocomplete/when');
    });
    it('duplicate kind', () => {
      const d = load();
      d.kinds.push({ ...d.kinds[0] });
      expect(paths(d)).toContain('/kinds/31/kind');
    });
  });
});
