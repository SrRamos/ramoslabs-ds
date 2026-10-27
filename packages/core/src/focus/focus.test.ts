import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createCollection, type CollectionItem } from '../collection/index';
import { createEffectQueue } from '../effects/index';
import {
  STRATEGY,
  assertStrategy,
  createFocus,
  restoreTarget,
  type FocusEl,
  type Strategy,
} from './index';

class El implements FocusEl {
  attrs = new Map<string, string>();
  isConnected = true;
  disabled = false;
  inert = false;
  focused = 0;
  scrolled = 0;
  constructor(readonly doc: { active: El | 'body' }) {}
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
  focus() {
    this.focused++;
    this.doc.active = this;
  }
  scrollIntoView() {
    this.scrolled++;
  }
}
const items = (keys: string[]): CollectionItem[] => keys.map((key) => ({ key }));

function setup(keys: string[], strategy: Strategy) {
  const doc: { active: El | 'body' } = { active: 'body' };
  const c = createCollection<El>('b', items(keys));
  const els = new Map<string, El>();
  const mount = (k: string) => {
    const e = new El(doc);
    els.set(k, e);
    c.register(k, e);
  };
  keys.forEach(mount);
  const container = new El(doc);
  return { doc, c, els, container, f: createFocus(c, strategy), mount };
}

describe('focus (W1-106b)', () => {
  it('encodes the ADR-006 table', () => {
    expect(STRATEGY.tabs).toBe('roving');
    expect(STRATEGY.combobox).toBe('activedescendant');
    expect(STRATEGY.select).toBe('activedescendant');
    expect(STRATEGY['radio-group']).toBe('native-roving');
    expect(STRATEGY.dialog).toBe('native');
  });

  it('a composite declaring both strategies throws', () => {
    expect(() => assertStrategy(['roving', 'activedescendant'])).toThrow();
    expect(assertStrategy(['roving'])).toBe('roving');
    expect(assertStrategy([])).toBe('native');
  });

  it('roving: tabindex, data-active, one focus and one scroll', () => {
    const { f, els, container } = setup(['a', 'b', 'c'], 'roving');
    f.move('b');
    f.apply(container);
    expect(els.get('b')!.attrs.get('tabindex')).toBe('0');
    expect(els.get('a')!.attrs.get('tabindex')).toBe('-1');
    expect(els.get('b')!.attrs.has('data-active')).toBe(true);
    expect(els.get('a')!.attrs.has('data-active')).toBe(false);
    expect(els.get('b')!.focused).toBe(1);
    expect(els.get('b')!.scrolled).toBe(1);
  });

  it('activedescendant: focus stays on the container; data-active still set', () => {
    const { f, els, container } = setup(['a', 'b'], 'activedescendant');
    f.move('a');
    f.apply(container);
    expect(container.attrs.get('aria-activedescendant')).toBe('b-item-a');
    expect(container.focused).toBe(1);
    expect(els.get('a')!.focused).toBe(0);
    expect(els.get('a')!.attrs.has('data-active')).toBe(true);
  });

  it.each([
    ['roving', 'item', 1, 0, '0'],
    ['native-roving', 'item', 1, 0, undefined],
    ['activedescendant', 'container', 0, 1, undefined],
    ['native', 'none', 0, 0, undefined],
  ] as const)(
    'apply per strategy: %s focuses %s',
    (strategy, _who, itemFocus, containerFocus, tab) => {
      const { f, els, container } = setup(['a', 'b'], strategy);
      f.move('b');
      f.apply(container);
      expect(els.get('b')!.focused).toBe(itemFocus);
      expect(container.focused).toBe(containerFocus);
      expect(els.get('b')!.attrs.get('tabindex')).toBe(tab);
      expect(els.get('a')!.attrs.has('tabindex')).toBe(strategy === 'roving');
    },
  );

  it('release clears data-active on the items (NICE-8)', () => {
    const { f, els, container } = setup(['a'], 'roving');
    f.move('a');
    f.apply(container);
    expect(els.get('a')!.attrs.has('data-active')).toBe(true);
    f.release(container);
    expect(els.get('a')!.attrs.has('data-active')).toBe(false);
  });

  it('virtual item is not referenced until mounted', () => {
    const doc: { active: El | 'body' } = { active: 'body' };
    const c = createCollection<El>('b', items(['a', 'v']));
    const container = new El(doc);
    const f = createFocus(c, 'activedescendant');
    f.move('v');
    f.apply(container);
    expect(container.attrs.has('aria-activedescendant')).toBe(false);
    c.register('v', new El(doc));
    f.apply(container);
    expect(container.attrs.get('aria-activedescendant')).toBe('b-item-v');
  });

  it('release resets the active id before unmount', () => {
    const { f, container } = setup(['a'], 'activedescendant');
    f.move('a');
    f.apply(container);
    f.release(container);
    expect(container.attrs.has('aria-activedescendant')).toBe(false);
    expect(f.active).toBeUndefined();
  });

  it('ignores moves to unknown or disabled items', () => {
    const { f, c } = setup(['a', 'b'], 'roving');
    c.set([{ key: 'a' }, { key: 'b', disabled: true }]);
    expect(f.move('b')).toBe(false);
    expect(f.move('zz')).toBe(false);
  });

  it('focus effects flow through the effect queue', () => {
    const q = createEffectQueue();
    q.enqueue([{ type: 'focus', target: 'b-item-a' }], 1);
    const ran: string[] = [];
    q.drain({ run: (e) => void ran.push(e.target!) });
    expect(ran).toEqual(['b-item-a']);
  });

  it('property: after random removals focus is never <body> (item or declared container)', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
    fc.assert(
      fc.property(
        fc.constantFrom(...keys),
        fc.array(fc.subarray(keys), { minLength: 1, maxLength: 6 }),
        fc.constantFrom<'roving' | 'activedescendant'>('roving', 'activedescendant'),
        (start, steps, strategy) => {
          const { doc, f, els, container, mount } = setup(keys, strategy);
          f.move(start);
          f.apply(container);
          for (const kept of steps) {
            // the removed elements unmount; a real DOM would drop focus to <body> here
            for (const k of keys)
              if (!kept.includes(k) && els.get(k) && doc.active === els.get(k)) doc.active = 'body';
            for (const k of keys) if (!kept.includes(k)) els.delete(k);
            for (const k of kept) if (!els.has(k)) mount(k);
            f.update(items(kept));
            f.apply(container);
            expect(doc.active).not.toBe('body');
            const want = f.active === undefined ? container : els.get(f.active);
            // roving focuses the item; activedescendant keeps focus on the container
            expect(doc.active).toBe(strategy === 'roving' ? want : container);
            if (f.active !== undefined) expect(kept).toContain(f.active);
          }
        },
      ),
    );
  });

  it('restoreTarget: opener, else fallback, else none; advanced suppresses', () => {
    const doc: { active: El | 'body' } = { active: 'body' };
    const opener = new El(doc);
    const fb = new El(doc);
    expect(restoreTarget(opener, fb)).toBe(opener);
    opener.inert = true;
    expect(restoreTarget(opener, fb)).toBe(fb);
    opener.inert = false;
    opener.isConnected = false;
    expect(restoreTarget(opener, fb)).toBe(fb);
    opener.isConnected = true;
    opener.disabled = true;
    expect(restoreTarget(opener, fb)).toBe(fb);
    opener.disabled = false;
    (opener as FocusEl).checkVisibility = () => false;
    expect(restoreTarget(opener, fb)).toBe(fb);
    fb.inert = true;
    expect(restoreTarget(opener, fb)).toBeUndefined();
    expect(restoreTarget(new El(doc), fb, true)).toBeUndefined();
  });
});
