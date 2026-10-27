import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { mergeProps } from './index';

declare const console: { warn(m: string): void };

const quiet = { warn: () => {} };

describe('library-owned attributes win', () => {
  const cases: [string, string, unknown, unknown][] = [
    ['role', 'role', 'button', 'link'],
    ['id', 'id', 'sj-1-trigger', 'mine'],
    ['aria-expanded', 'aria-expanded', 'false', 'true'],
    ['aria-controls (IDREF)', 'aria-controls', 'sj-1-panel', 'other'],
    ['aria-labelledby (IDREF)', 'aria-labelledby', 'sj-1-label', 'other'],
    ['aria-selected (state)', 'aria-selected', false, true],
    ['for (IDREF)', 'for', 'sj-1-input', 'x'],
    ['htmlFor (IDREF)', 'htmlFor', 'sj-1-input', 'x'],
    ['popovertarget (IDREF)', 'popovertarget', 'sj-1-pop', 'x'],
  ];
  it.each(cases)('%s', (_n, key, lib, own) => {
    expect(mergeProps({ [key]: own }, { [key]: lib }, quiet)[key]).toBe(lib);
  });
  it('library undefined still removes the consumer value', () => {
    const out = mergeProps({ 'aria-expanded': 'true' }, { 'aria-expanded': undefined }, quiet);
    expect('aria-expanded' in out).toBe(false);
  });
  it('options.protect extends the owned set', () => {
    expect(
      mergeProps({ tabIndex: 0 }, { tabIndex: -1 }, { ...quiet, protect: ['tabIndex'] }),
    ).toEqual({
      tabIndex: -1,
    });
  });
  it('consumer keeps aria-* / role the library does not set', () => {
    expect(mergeProps({ 'aria-label': 'Save', role: 'switch' }, { id: 'a' }, quiet)).toEqual({
      'aria-label': 'Save',
      role: 'switch',
      id: 'a',
    });
  });
  it('property: no consumer spread overrides owned keys', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.string()), (spread) => {
        const lib = { role: 'tab', id: 'x', 'aria-selected': true, 'aria-controls': 'p' };
        const out = mergeProps(spread, lib, quiet);
        expect(out.role).toBe('tab');
        expect(out.id).toBe('x');
        expect(out['aria-selected']).toBe(true);
        expect(out['aria-controls']).toBe('p');
      }),
    );
  });
});

describe('other attributes', () => {
  it('consumer wins over library defaults', () => {
    expect(
      mergeProps({ type: 'submit', 'data-x': 1 }, { type: 'button', 'data-y': 2 }, quiet),
    ).toEqual({
      type: 'submit',
      'data-x': 1,
      'data-y': 2,
    });
  });
  it('ignores __proto__', () => {
    const own = JSON.parse('{"__proto__":{"polluted":1}}') as Record<string, unknown>;
    const out = mergeProps(own, {}, quiet);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('class and style concatenate', () => {
  const cls: [unknown, unknown, unknown][] = [
    ['a', 'b', 'a b'],
    ['a', undefined, 'a'],
    [undefined, 'b', 'b'],
    ['', 'b', 'b'],
    ['a', '', 'a'],
  ];
  it.each(cls)('class %j + %j', (lib, own, expected) => {
    expect(mergeProps({ class: own }, { class: lib }, quiet).class).toBe(expected);
    expect(mergeProps({ className: own }, { className: lib }, quiet).className).toBe(expected);
  });
  it('class from consumer only passes through', () => {
    expect(mergeProps({ class: 'c' }, {}, quiet).class).toBe('c');
  });
  const sty: [unknown, unknown, unknown][] = [
    [{ color: 'red', top: 0 }, { color: 'blue' }, { color: 'blue', top: 0 }],
    ['a:1;', 'b:2', 'a:1;b:2'],
    ['a:1', undefined, 'a:1'],
    [undefined, { b: 2 }, { b: 2 }],
    [{ a: 1 }, 'b:2', 'b:2'],
  ];
  it.each(sty)('style %j + %j', (lib, own, expected) => {
    expect(mergeProps({ style: own }, { style: lib }, quiet).style).toEqual(expected);
  });
});

describe('handlers: consumer first, then library', () => {
  it('runs in order with the same args', () => {
    const order: string[] = [];
    const out = mergeProps(
      { onClick: (e: unknown, x: number) => order.push(`c${x}`, String(e !== undefined)) },
      { onClick: () => order.push('l') },
      quiet,
    );
    (out.onClick as (e: object, x: number) => void)({}, 7);
    expect(order).toEqual(['c7', 'true', 'l']);
  });
  it('consumer preventDefault cancels the library handler', () => {
    const lib = vi.fn();
    const out = mergeProps(
      { onKeyDown: (e: { defaultPrevented: boolean }) => (e.defaultPrevented = true) },
      { onKeyDown: lib },
      quiet,
    );
    (out.onKeyDown as (e: object) => void)({ defaultPrevented: false });
    expect(lib).not.toHaveBeenCalled();
  });
  it('already-prevented event after consumer still cancels', () => {
    const lib = vi.fn();
    const out = mergeProps({ onClick: () => {} }, { onClick: lib }, quiet);
    (out.onClick as (e: object) => void)({ defaultPrevented: true });
    expect(lib).not.toHaveBeenCalled();
  });
  it('library runs when not prevented', () => {
    const lib = vi.fn();
    const out = mergeProps({ onClick: () => {} }, { onClick: lib }, quiet);
    (out.onClick as (e: object) => void)({ defaultPrevented: false });
    expect(lib).toHaveBeenCalledOnce();
  });
  it('consumer throw stops the library handler', () => {
    const lib = vi.fn();
    const out = mergeProps(
      {
        onClick: () => {
          throw new Error('x');
        },
      },
      { onClick: lib },
      quiet,
    );
    expect(() => (out.onClick as (e: object) => void)({})).toThrow('x');
    expect(lib).not.toHaveBeenCalled();
  });
  it('single-sided handlers pass through; non-handler on* names are not chained', () => {
    const f = vi.fn();
    expect(mergeProps({ onClick: f }, {}, quiet).onClick).toBe(f);
    expect(mergeProps({}, { onClick: f }, quiet).onClick).toBe(f);
    expect(mergeProps({ onClick: undefined }, { onClick: f }, quiet).onClick).toBe(f);
    expect(mergeProps({ only: 1 }, { only: 2 }, quiet).only).toBe(1);
  });
});

describe('dev warning', () => {
  it('warns on a discarded owned key, naming it and the part', () => {
    const warn = vi.fn();
    mergeProps(
      { role: 'x', id: 'y', 'aria-label': 'ok' },
      { role: 'button', id: 'y' },
      { warn, part: 'trigger' },
    );
    expect(warn).toHaveBeenCalledOnce();
    const msg = warn.mock.calls[0]![0] as string;
    expect(msg).toContain('role');
    expect(msg).toContain('trigger": role.');
    expect(msg).toContain('trigger');
  });
  it('is silent when values agree or nothing is dropped', () => {
    const warn = vi.fn();
    mergeProps({ role: 'button' }, { role: 'button' }, { warn });
    mergeProps({ 'aria-label': 'a' }, { role: 'button' }, { warn });
    expect(warn).not.toHaveBeenCalled();
  });
  it('defaults to console.warn', () => {
    const spy = vi
      .spyOn(console as unknown as { warn(m: string): void }, 'warn')
      .mockImplementation(() => {});
    mergeProps({ role: 'x' }, { role: 'y' });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
  it('does not warn and still merges in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.fn();
    expect(mergeProps({ role: 'x' }, { role: 'y' }, { warn }).role).toBe('y');
    expect(warn).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe('without a process global', () => {
  it('does not throw and skips the warning', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = g.process;
    delete g.process;
    try {
      const warn = vi.fn();
      expect(mergeProps({ role: 'x' }, { role: 'y' }, { warn }).role).toBe('y');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      g.process = saved;
    }
  });
});

describe('purity', () => {
  it('does not mutate inputs', () => {
    const c = Object.freeze({ class: 'a', role: 'x' });
    const l = Object.freeze({ class: 'b', role: 'y' });
    expect(() => mergeProps(c, l, quiet)).not.toThrow();
  });
});
