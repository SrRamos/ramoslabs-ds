// G2 NICE-1: contrast pairs are read from built CSS; RECIPE is only the fallback.
import { describe, expect, it } from 'vitest';
import {
  checkContrastMatrix,
  extractPairs,
  extractUiPairs,
  formatFailure,
  loadTokens,
} from './index.js';

const tokens = loadTokens();
const CSS = `
@layer sj.base { .sj-x__root { color: #000; } }
@layer sj.variant {
  /* comment { with braces } */
  .sj-x__root[data-variant='solid'][data-tone='primary'] {
    color: var(--color-white);
    background-color: var(--color-primary);
  }
  @media (hover: hover) {
    .sj-x__root[data-variant='solid'][data-tone='primary']:hover { background-color: var(--color-primary-dark); }
  }
  .sj-x__root[data-variant='solid'][data-tone='primary']:active { background-color: var(--color-indigo-800); }
  :is(.sj-x__root, .sj-x__link)[data-variant='outline'][data-tone='primary'] {
    color: var(--color-primary);
    background-color: transparent;
    border-color: var(--color-primary);
  }
}`;

describe('extractPairs', () => {
  it('resolves rest, hover (inside @media) and active with cascade order', () => {
    const p = extractPairs(CSS);
    const solid = (/** @type {string} */ st) =>
      p.find((x) => x.variant === 'solid' && x.state === st);
    expect(solid('rest')).toMatchObject({ component: 'x', fg: 'color-white', bg: 'color-primary' });
    expect(solid('hover')).toMatchObject({ fg: 'color-white', bg: 'color-primary-dark' });
    expect(solid('active')).toMatchObject({ bg: 'color-indigo-800' });
    expect(p.find((x) => x.variant === 'outline')).toMatchObject({
      bg: 'transparent',
      border: 'color-primary',
    });
  });
  it('ignores rules outside sj.variant and rejects raw colors', () => {
    expect(extractPairs(CSS).every((x) => x.fg !== '#000')).toBe(true);
    expect(() =>
      extractPairs(
        `@layer sj.variant { .sj-x__root[data-variant='a'][data-tone='b'] { color: #fff; } }`,
      ),
    ).toThrow(/tokens only/);
  });
});

describe('checkContrastMatrix with css', () => {
  it('uses css for covered combos and RECIPE as the fallback for the rest', () => {
    const { pairs, failures } = checkContrastMatrix(tokens, { css: CSS });
    expect(failures.map(formatFailure)).toEqual([]);
    expect(pairs.some((p) => p.id === 'x/solid/primary/hover/text' && p.source === 'css')).toBe(
      true,
    );
    expect(pairs.some((p) => p.id === 'solid/primary/md/text')).toBe(false); // covered by css
    expect(pairs.some((p) => p.id === 'solid/neutral/md/text' && p.source === 'recipe')).toBe(true);
    expect(pairs.some((p) => p.id.startsWith('x/outline/primary/border-on-'))).toBe(true);
  });
  it('seeded weak css pairs fail at 4.5:1 (text) and 3:1 (border)', () => {
    const weak = CSS.replace(
      'var(--color-primary);\n  }\n  @media',
      'var(--color-indigo-200);\n  }\n  @media',
    ).replace('border-color: var(--color-primary)', 'border-color: var(--color-slate-200)');
    const { failures } = checkContrastMatrix(tokens, { css: weak });
    const text = failures.find((f) => f.id === 'x/solid/primary/text');
    expect(text?.ratio).toBeLessThan(4.5);
    expect(
      failures.some((f) => f.id.startsWith('x/outline/primary/border-on-') && f.min === 3),
    ).toBe(true);
  });
});

describe('extractUiPairs', () => {
  const UI = `
@layer sj.component { .sj-x__root::before { background-color: var(--color-red-500); } }
@layer sj.state {
  .sj-x__root[data-state='off']::before { background-color: var(--color-slate-500); }
  .sj-x__thumb[data-state='on'] { inset-inline-start: 0; }
  .sj-x__root[data-disabled]:not([data-disabled='false'])::before { background-color: var(--color-slate-300); }
  @media (forced-colors: active) { .sj-x__root[data-state='on']::before { background-color: var(--color-primary); } }
}`;
  it('reads state-keyed fills from sj.state only, skipping disabled and other layers', () => {
    expect(extractUiPairs(UI)).toEqual([
      { component: 'x', part: 'root', pseudo: '::before', state: 'off', bg: 'color-slate-500' },
      { component: 'x', part: 'root', pseudo: '::before', state: 'on', bg: 'color-primary' },
    ]);
  });
  it('fails a seeded weak fill on every surface', () => {
    const { failures } = checkContrastMatrix(tokens, {
      css: UI.replace('var(--color-slate-500)', 'var(--color-slate-300)'),
    });
    expect(failures.filter((f) => f.id.startsWith('x/root::before/off/ui-on-')).length).toBe(3);
  });
  it('rejects a raw color', () => {
    expect(() =>
      extractUiPairs(
        `@layer sj.state { .sj-x__root[data-state='on'] { background-color: #fff; } }`,
      ),
    ).toThrow(/tokens only/);
  });
});
