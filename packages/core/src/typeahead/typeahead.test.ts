import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createFakeScheduler } from '../runtime/index';
import { createTypeahead, nextMatch, normalize } from './index';

const it_ = (...t: string[]) => t.map((text) => ({ key: text, text }));

describe('typeahead (W1-107)', () => {
  it('normalizes: NFC, trim/collapse, locale folding, diacritics kept', () => {
    expect(normalize('  Cafe\u0301   Au  Lait ')).toBe('caf\u00e9 au lait');
    expect(normalize('é')).not.toBe('e');
    expect(normalize('I', 'tr')).toBe('ı');
    expect(normalize('I', 'en')).toBe('i');
  });

  it('prefix match, wrap, cycling on repeated char', () => {
    const l = it_('Apple', 'Avocado', 'Banana', 'Apricot');
    expect(nextMatch(l, 0, 'a')).toBe(1);
    expect(nextMatch(l, 3, 'a')).toBe(0);
    expect(nextMatch(l, 0, 'aa')).toBe(1);
    expect(nextMatch(l, 0, 'ap')).toBe(0);
    expect(nextMatch(l, 0, 'apr')).toBe(3);
    expect(nextMatch(l, 0, 'z')).toBeUndefined();
    expect(nextMatch(l, 0, '  ')).toBeUndefined();
    expect(nextMatch([], 0, 'a')).toBeUndefined();
  });

  it('skips disabled items; diacritics are not stripped', () => {
    const l = [
      { key: 'a', text: 'Ápice', disabled: true },
      { key: 'b', text: 'Apice' },
      { key: 'c', text: 'Ápex' },
    ];
    expect(nextMatch(l, 2, 'á')).toBe(2);
    expect(nextMatch(l, 0, 'a')).toBe(1);
  });

  it('property: deterministic, in range, and the result matches the prefix', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 5 }), { maxLength: 8 }),
        fc.nat(10),
        fc.string({ maxLength: 3 }),
        (texts, from, q) => {
          const l = it_(...texts);
          const r = nextMatch(l, from, q);
          expect(nextMatch(l, from, q)).toBe(r);
          if (r !== undefined) {
            expect(r).toBeLessThan(l.length);
            const nq = normalize(q);
            const c = nq.length > 1 && [...nq].every((x) => x === nq[0]) ? nq[0]! : nq;
            expect(normalize(l[r]!.text).startsWith(c)).toBe(true);
          }
        },
      ),
    );
  });

  it('accumulates over keydown and resets after the timeout', () => {
    const s = createFakeScheduler();
    const t = createTypeahead({ scheduler: s });
    const l = it_('Apple', 'Avocado', 'Apricot');
    expect(t.keydown({ key: 'a' }, l, 0)).toBe(1);
    expect(t.keydown({ key: 'p' }, l, 1)).toBe(2);
    expect(t.buffer).toBe('ap');
    s.advance(499);
    expect(t.buffer).toBe('ap');
    s.advance(1);
    expect(t.buffer).toBe('');
  });

  it('ignores modifiers, named keys, bare space and keyCode 229', () => {
    const t = createTypeahead({ scheduler: createFakeScheduler() });
    const l = it_('a');
    expect(t.keydown({ key: 'a', ctrlKey: true }, l, 0)).toBeUndefined();
    expect(t.keydown({ key: 'Enter' }, l, 0)).toBeUndefined();
    expect(t.keydown({ key: ' ' }, l, 0)).toBeUndefined();
    expect(t.keydown({ key: 'Unidentified', keyCode: 229 }, l, 0)).toBeUndefined();
    expect(t.keydown({ key: 'a', keyCode: 229 }, l, 0)).toBeUndefined();
  });

  it('no match during composition (event flag and session flag)', () => {
    const t = createTypeahead({ scheduler: createFakeScheduler() });
    const l = it_('apple', 'berry');
    expect(t.keydown({ key: 'b', isComposing: true }, l, 0)).toBeUndefined();
    expect(
      t.beforeinput({ inputType: 'insertCompositionText', data: 'b', isComposing: true }, l, 0),
    ).toBeUndefined();
    t.compositionstart();
    expect(t.composing).toBe(true);
    expect(t.beforeinput({ inputType: 'insertText', data: 'b' }, l, 0)).toBeUndefined();
    expect(t.keydown({ key: 'b' }, l, 0)).toBeUndefined();
    expect(t.buffer).toBe('');
    t.compositionend();
    expect(t.beforeinput({ inputType: 'insertText', data: 'b' }, l, 0)).toBe(1);
  });

  it('beforeinput fixture (Android: keydown is 229, beforeinput carries the text)', () => {
    const t = createTypeahead({ scheduler: createFakeScheduler() });
    const l = it_('apple', 'berry');
    expect(t.keydown({ key: 'Unidentified', keyCode: 229 }, l, 0)).toBeUndefined();
    expect(t.beforeinput({ inputType: 'insertText', data: 'b' }, l, 0)).toBe(1);
    expect(t.beforeinput({ inputType: 'deleteContentBackward', data: null }, l, 1)).toBeUndefined();
    expect(t.beforeinput({ inputType: 'insertText', data: null }, l, 1)).toBeUndefined();
  });

  it('compositionstart clears the buffer; reset is idempotent', () => {
    const s = createFakeScheduler();
    const t = createTypeahead({ scheduler: s });
    t.keydown({ key: 'a' }, it_('a'), 0);
    t.compositionstart();
    expect(t.buffer).toBe('');
    t.reset();
    t.reset();
    expect(s.pending).toBe(0);
  });
});
