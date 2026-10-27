import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  baseId,
  cssEscape,
  encodeKey,
  idSelector,
  itemId,
  partId,
  safeName,
  sanitizedMap,
} from './index';

describe('ids (W1-102, ADR-003)', () => {
  it('base id: explicit wins, otherwise prefix + acquired', () => {
    expect(baseId('mine', () => 'x', 'p-')).toBe('mine');
    expect(baseId(undefined, () => ':r1:', 'app2-')).toBe('app2-:r1:');
    expect(baseId('', () => 'a')).toBe('a');
  });

  it('acquires lazily: not called when explicit', () => {
    let calls = 0;
    baseId('e', () => (calls++, 'x'));
    expect(calls).toBe(0);
  });

  it('suffixes', () => {
    expect(partId('b', 'label')).toBe('b-label');
    expect(itemId('b', 'apple')).toBe('b-item-apple');
  });

  it('same key gives the same id regardless of order, filtering or mount order', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { maxLength: 20 }), fc.nat(), (keys, rot) => {
        const all = new Map(keys.map((k) => [k, itemId('b', k)]));
        const cut = keys.length ? rot % keys.length : 0;
        const shuffled = [...keys.slice(cut), ...keys.slice(0, cut)].reverse();
        const filtered = shuffled.filter((_, i) => i % 2 === 0);
        for (const k of filtered) expect(itemId('b', k)).toBe(all.get(k));
      }),
    );
  });

  it('encodeKey is injective and whitespace/IDREF safe', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        fc.pre(a !== b);
        expect(encodeKey(a)).not.toBe(encodeKey(b));
        expect(encodeKey(a)).toMatch(/^[A-Za-z0-9_~-]*$/);
      }),
    );
    expect(encodeKey(7)).toBe('7');
    expect(encodeKey('a b')).toBe('a~20~b');
  });

  it('safeName is a dashed-ident, injective, and a map entry is independent of the set', () => {
    expect(safeName(':r1:')).toBe('--_3a_r1_3a_');
    expect(safeName(':r1:')).toMatch(/^--[A-Za-z0-9_-]+$/);
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        fc.pre(a !== b);
        expect(safeName(a)).not.toBe(safeName(b));
      }),
    );
    fc.assert(
      fc.property(fc.uniqueArray(fc.string()), (ids) => {
        const fwd = sanitizedMap(ids);
        const rev = sanitizedMap([...ids].reverse());
        for (const id of ids) expect(fwd.get(id)).toBe(rev.get(id));
      }),
    );
  });

  it('cssEscape matches the CSSOM reference cases', () => {
    expect(cssEscape('a')).toBe('a');
    expect(cssEscape('0a')).toBe('\\30 a');
    expect(cssEscape('-0')).toBe('-\\30 ');
    expect(cssEscape('-')).toBe('\\-');
    expect(cssEscape(':r1:')).toBe('\\:r1\\:');
    expect(cssEscape('a b')).toBe('a\\ b');
    expect(cssEscape('\u0000')).toBe('�');
    expect(cssEscape('\u0001')).toBe('\\1 ');
    expect(cssEscape('é_-')).toBe('é_-');
    expect(idSelector('x.y')).toBe('#x\\.y');
  });
});
