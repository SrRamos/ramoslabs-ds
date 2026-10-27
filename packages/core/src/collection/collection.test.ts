import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createCollection, enabled, successor, type CollectionItem } from './index';

const mk = (keys: string[], off: string[] = []): CollectionItem[] =>
  keys.map((key) => ({ key, disabled: off.includes(key) }));

describe('collection (W1-106a)', () => {
  it('derives ids from keys, not positions, and inverts them', () => {
    const c = createCollection('b', mk(['a', 'b c']));
    expect(c.id('a')).toBe('b-item-a');
    expect(c.key(c.id('b c'))).toBe('b c');
    c.set(mk(['b c', 'a']));
    expect(c.id('a')).toBe('b-item-a');
  });

  it('registers elements and drops those whose key left', () => {
    const c = createCollection<object>('b', mk(['a', 'z']));
    const el = {};
    const off = c.register('a', el);
    expect(c.mounted('a')).toBe(true);
    c.register('z', {});
    c.set(mk(['a']));
    expect(c.mounted('z')).toBe(false);
    off();
    off();
    expect(c.mounted('a')).toBe(false);
  });

  it('unregister of a replaced element does not drop the new one', () => {
    const c = createCollection<object>('b', mk(['a']));
    const off = c.register('a', {});
    const next = {};
    c.register('a', next);
    off();
    expect(c.el('a')).toBe(next);
  });

  it('successor: next enabled, else previous, else undefined', () => {
    const prev = mk(['a', 'b', 'c', 'd']);
    expect(successor(prev, mk(['a', 'c', 'd']), 'b')).toBe('c');
    expect(successor(prev, mk(['a', 'b', 'c']), 'd')).toBe('c');
    expect(successor(prev, mk(['a', 'c', 'd'], ['c', 'd']), 'b')).toBe('a');
    expect(successor(prev, mk([]), 'b')).toBeUndefined();
    expect(successor(prev, prev, 'b')).toBe('b');
  });

  it('property: random removals/disables always give an enabled survivor or undefined', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    fc.assert(
      fc.property(
        fc.subarray(keys),
        fc.subarray(keys),
        fc.constantFrom(...keys),
        (kept, disabled, removed) => {
          const prev = mk(keys);
          const next = mk(kept, disabled);
          const s = successor(prev, next, removed);
          const alive = next.filter(enabled);
          if (alive.length === 0) expect(s).toBeUndefined();
          else {
            expect(s).toBeDefined();
            expect(alive.map((i) => i.key)).toContain(s);
            // nearest-forward then nearest-backward determinism
            const at = keys.indexOf(removed);
            const fwd = keys.slice(at + 1).find((k) => alive.some((i) => i.key === k));
            const back = keys
              .slice(0, at)
              .reverse()
              .find((k) => alive.some((i) => i.key === k));
            const self = alive.some((i) => i.key === removed) ? removed : undefined;
            expect(s).toBe(self ?? fwd ?? back);
          }
        },
      ),
    );
  });
});
