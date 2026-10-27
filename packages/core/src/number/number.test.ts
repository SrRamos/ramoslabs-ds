import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseNumber, separators } from './index';

// [locale, localized text for 1234567.89, localized text for 1234.5, localized text for 0.5]
const LOCALES = ['de', 'en', 'es', 'fr', 'pt'] as const;
const fmt = (loc: string, v: string) =>
  new Intl.NumberFormat(loc, {
    minimumFractionDigits: (v.split('.')[1] ?? '').length,
    maximumFractionDigits: 20,
    useGrouping: true,
  }).format(v as unknown as number);

describe.each(LOCALES)('%s', (loc) => {
  it('separators come from Intl', () => {
    const [g, d] = separators(loc);
    expect(d).toBe({ de: ',', en: '.', es: ',', fr: ',', pt: ',' }[loc]);
    expect(g).toBe({ de: '.', en: ',', es: '.', fr: ' ', pt: '.' }[loc]);
  });
  const canon = [
    '0',
    '5',
    '12',
    '123',
    '1234',
    '12345',
    '123456',
    '1234567',
    '0.5',
    '12.5',
    '1234.5',
    '1234567.89',
    '0.234',
    '1.234',
    '999.999',
  ];
  it.each(canon)('format -> parse round trip: %s', (c) => {
    expect(parseNumber(fmt(loc, c), loc)).toBe(c);
  });
  it.each(canon)('parse -> format round trip: %s', (c) => {
    const text = fmt(loc, c);
    const back = parseNumber(text, loc) as string;
    expect(fmt(loc, back)).toBe(text);
  });
  it('signed: both minus signs, only when signed', () => {
    const t = fmt(loc, '1234.5');
    expect(parseNumber(`-${t}`, loc, true)).toBe('-1234.5');
    expect(parseNumber(`−${t}`, loc, true)).toBe('-1234.5');
    expect(parseNumber(`-${t}`, loc)).toBeNull();
    expect(parseNumber(`−${t}`, loc)).toBeNull();
    expect(parseNumber(fmt(loc, '-1234.5'), loc, true)).toBe('-1234.5');
  });
  it('leading zeroes are preserved', () => {
    const [, d] = separators(loc);
    expect(parseNumber('007', loc)).toBe('007');
    expect(parseNumber('00012', loc)).toBe('00012');
    expect(parseNumber(`007${d}50`, loc)).toBe('007.50');
    expect(parseNumber(`0${d}50`, loc)).toBe('0.50');
  });
  it('accepts both separators with typed plain spaces', () => {
    expect(parseNumber('1 234 567', loc)).toBe('1234567');
    expect(parseNumber('1 234,5', loc)).toBe('1234.5');
  });
});

describe('both separators and the grouping rule', () => {
  const cases: [string, string, string | null][] = [
    ['de', '1.234', '1234'],
    ['de', '1,234', '1.234'],
    ['de', '12.5', '12.5'],
    ['de', '1.234,56', '1234.56'],
    ['de', '1,234.56', '1234.56'],
    ['en', '1,234', '1234'],
    ['en', '1.234', '1.234'],
    ['en', '12,5', '12.5'],
    ['en', '1,234.56', '1234.56'],
    ['en', '1.234,56', '1234.56'],
    ['en', '1,234,567', '1234567'],
    ['en', '1.234.567', '1234567'],
    ['fr', '1 234,5', '1234.5'],
    ['fr', '1.5', '1.5'],
    ['fr', '1234.567', '1234.567'],
    ['es', '1.234', '1234'],
    ['pt', '1.234.567,89', '1234567.89'],
    ['de', '0.234', '0.234'],
    ['en', '.5', '0.5'],
    ['de', ',5', '0.5'],
    ['en', '١٬٢٣٤٫٥', '1234.5'],
    // rejected
    ['en', '', null],
    ['en', '-', null],
    ['en', '1,23,456', null],
    ['en', '1,2345,678', null],
    ['en', '1.2.3', null],
    ['en', '1,234.56.7', null],
    ['en', '1.', null],
    ['en', '1 2 3', null],
    ['en', 'abc', null],
    ['en', '12a', null],
    ['en', '1e5', null],
    ['en', '+5', null],
    ['en', '1,,234', null],
    ['en', '--5', null],
    ['en', ',', null],
  ];
  it.each(cases)('%s %j -> %j', (loc, text, want) => {
    expect(parseNumber(text, loc, true)).toBe(want);
  });
  it('accepts explicit separators', () => {
    expect(parseNumber('1’234.5', ['’', '.'])).toBe('1234.5');
  });
});

describe('Arabic numerals', () => {
  it('ASCII digits (Hindu-Arabic) fixture', () => {
    expect(parseNumber('1234567.89', 'en')).toBe('1234567.89');
    expect(parseNumber('0123', 'de')).toBe('0123');
  });
  it('Arabic-Indic digits and ar-EG separators', () => {
    expect(parseNumber('٠١٢٣', 'en')).toBe('0123');
    expect(parseNumber('۱۲۳٫۵', 'en')).toBe('123.5');
    const f = new Intl.NumberFormat('ar-EG');
    for (const c of ['0', '12', '1234', '1234567.89', '0.5']) {
      const text = f.format(c as unknown as number);
      expect(parseNumber(text, 'ar-EG')).toBe(c);
      expect(parseNumber(`−${text}`, 'ar-EG', true)).toBe(`-${c}`);
    }
    expect(parseNumber('-٥', 'ar-EG', true)).toBe('-5');
  });
});

describe('properties', () => {
  const dec = fc
    .tuple(
      fc.stringMatching(/^[1-9][0-9]{0,8}$/),
      fc.option(fc.stringMatching(/^[0-9]{1,6}$/), { nil: undefined }),
    )
    .map(([i, f]) => (f ? `${i}.${f}` : i));
  it('Intl output of any decimal parses back exactly, in every locale', () => {
    fc.assert(
      fc.property(
        dec,
        fc.constantFrom(...LOCALES),
        (c, loc) => parseNumber(fmt(loc, c), loc) === c,
      ),
    );
  });
  it('never throws and always returns canonical form or null', () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...LOCALES), fc.boolean(), (s, loc, signed) => {
        const r = parseNumber(s, loc, signed);
        expect(r === null || /^-?\d+(\.\d+)?$/.test(r)).toBe(true);
      }),
    );
  });
  it('digits are preserved verbatim (no float coercion, no precision loss)', () => {
    expect(parseNumber('12345678901234567890.123456789012345678', 'en')).toBe(
      '12345678901234567890.123456789012345678',
    );
    expect(parseNumber('0.1', 'en')).toBe('0.1');
  });
  it('does not use parseFloat or Number()', () => {
    const src = parseNumber.toString() + separators.toString();
    expect(src).not.toMatch(/parseFloat|parseInt|\bNumber\(/);
  });
});
