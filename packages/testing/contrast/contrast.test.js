// W1-203: seeded token changes fail with pair, ratio and token; the real tokens pass.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RECIPE,
  SIZES,
  SURFACES,
  TONES,
  VARIANTS,
  checkContrastMatrix,
  compositeOver,
  contrastRatio,
  formatFailure,
  loadTokens,
  meets,
  parseHex,
  relativeLuminance,
} from './index.js';

// Dynamic specifier: the css build script is plain JS outside this package's typecheck graph.
const buildScript = new URL('../../css/scripts/build.mjs', import.meta.url).href;
const { buildCss } = await import(/* @vite-ignore */ buildScript);

describe('wcag', () => {
  it('matches published reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#4f46e5', '#ffffff')).toBeCloseTo(6.3, 1); // indigo 600 on white
    expect(contrastRatio('#64748b', '#ffffff')).toBeCloseTo(4.76, 1); // slate 500 on white
    expect(contrastRatio('#94a3b8', '#ffffff')).toBeLessThan(4.5); // slate 400 fails (AGENTS.md)
  });
  it('is symmetric and parses short and alpha hex', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBe(contrastRatio('#fedcba', '#123456'));
    expect(parseHex('#fa0')).toEqual([255, 170, 0]);
    expect(parseHex('#ff8800cc')).toEqual([255, 136, 0]);
    expect(() => parseHex('red')).toThrow();
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
  it('composites translucent colors over a background', () => {
    expect(compositeOver('#000000', 0.5, '#ffffff')).toBe('#808080');
  });
  it('does not round 4.499 up to 4.5', () => {
    // #777 on white is 4.48:1
    expect(meets('#777777', '#ffffff')).toBe(false);
    expect(meets('#767676', '#ffffff')).toBe(true);
  });
});

describe('contrast matrix (light theme)', () => {
  const tokens = loadTokens();
  // NICE-1: the CI step named "Contrast matrix" also reads the real pairs from the built stylesheet.
  const outDir = mkdtempSync(join(tmpdir(), 'sj-contrast-'));
  buildCss({ srcDir: new URL('../../css/src', import.meta.url).pathname, outDir });
  const css = readFileSync(join(outDir, 'index.css'), 'utf8');

  it('resolves aliases from the DTCG source', () => {
    expect(tokens['color-indigo-600']).toBe('#4f46e5');
    expect(tokens['color-primary']).toBe('#4f46e5');
    expect(tokens['target-min']).toBe('2.75rem');
  });

  it('covers every variant x tone x size', () => {
    const { pairs } = checkContrastMatrix(tokens);
    for (const v of VARIANTS)
      for (const t of TONES)
        for (const s of SIZES)
          expect(pairs.some((p) => p.id.startsWith(`${v}/${t}/${s}/text`))).toBe(true);
    expect(Object.keys(RECIPE)).toEqual(VARIANTS);
  });

  it('passes with the current tokens', () => {
    const { failures } = checkContrastMatrix(tokens);
    expect(failures.map(formatFailure)).toEqual([]);
  });

  it('passes with the built component css, and a seeded weak fill fails there', () => {
    const { pairs, failures } = checkContrastMatrix(tokens, { css });
    expect(pairs.some((p) => p.source === 'css')).toBe(true);
    expect(failures.map(formatFailure)).toEqual([]);
    const weak = css.replace(
      /(\.sj-switch__root\[data-state='on'\]::before\s*\{\s*background-color:\s*)var\(--color-primary\)/,
      '$1var(--color-indigo-200)',
    );
    expect(weak).not.toBe(css);
    expect(checkContrastMatrix(tokens, { css: weak }).failures.length).toBeGreaterThan(0);
  });

  it('expands the transparent outline and ghost RECIPE fills across every surface', () => {
    const { pairs } = checkContrastMatrix(tokens);
    for (const sf of SURFACES) {
      expect(pairs.some((p) => p.id === `outline/primary/md/text-on-${sf}`)).toBe(true);
      expect(pairs.some((p) => p.id === `ghost/error/md/text-on-${sf}`)).toBe(true);
    }
    expect(RECIPE.outline.primary.bg).toBe('transparent');
    expect(RECIPE.ghost.primary.bg).toBe('transparent');
  });

  it('applies 4.5:1 to text and 3:1 to ui and focus', () => {
    const { pairs } = checkContrastMatrix(tokens);
    expect(new Set(pairs.filter((p) => p.kind === 'text').map((p) => p.min))).toEqual(
      new Set([4.5]),
    );
    expect(
      new Set(pairs.filter((p) => p.kind === 'ui' || p.kind === 'focus').map((p) => p.min)),
    ).toEqual(new Set([3]));
  });

  it('fails a seeded token change, naming the pair, ratio and token', () => {
    const { failures } = checkContrastMatrix({ ...tokens, 'color-error-strong': '#fca5a5' });
    const f = failures.find((x) => x.id === 'solid/error/md/text');
    if (!f) throw new Error('expected a failure');
    expect(f.bg).toBe('color-error-strong');
    expect(f.ratio).toBeLessThan(4.5);
    const line = formatFailure(f);
    expect(line).toContain('solid/error/md/text');
    expect(line).toContain('color-error-strong');
    expect(line).toMatch(/= \d\.\d\d:1, needs 4\.50:1/);
  });

  it('fails the muted text floor when muted text is re-pointed lighter than slate 500', () => {
    const { failures } = checkContrastMatrix({
      ...tokens,
      'color-text-muted': tokens['color-slate-400'],
    });
    expect(failures.map((f) => f.id)).toEqual(
      expect.arrayContaining(['floor/muted-on-white', 'text/color-text-muted-on-color-surface']),
    );
  });

  it('fails a weak focus color and a weak outline border', () => {
    const t = { ...tokens, 'color-focus': '#a5b4fc', 'color-text-muted': '#cbd5e1' };
    const ids = checkContrastMatrix(t).failures.map((f) => f.id);
    expect(ids).toContain('focus/ring-on-color-surface');
    expect(ids).toContain('outline/neutral/sm/border-on-color-surface');
  });

  it('rejects an unknown token loudly', () => {
    const t = { ...tokens };
    delete t['color-blue-700'];
    expect(() => checkContrastMatrix(t)).toThrow(/color-blue-700/);
  });
});
