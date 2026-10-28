import { existsSync, readFileSync } from 'node:fs';
import { contrastRatio, relativeLuminance } from '../../testing/contrast/wcag.js';
import { describe, expect, it } from 'vitest';

const flatUrl = new URL('../dist/tokens.json', import.meta.url);
const cssUrl = new URL('../dist/tokens.css', import.meta.url);
const tsUrl = new URL('../dist/tokens.js', import.meta.url);

const map = (): Record<string, string> => JSON.parse(readFileSync(flatUrl, 'utf8'));

const ratio = contrastRatio;

describe('@ramoslabs/tokens build output', () => {
  it('emits the flat token map', () => {
    expect(existsSync(flatUrl)).toBe(true);
    expect(map()['color-indigo-600']).toBe('#4f46e5');
  });

  // W1-008: interaction and overlay tokens exist in every generated format.
  const expected: Record<string, string> = {
    'target-min': '2.75rem',
    'target-floor': '1.5rem',
    'focus-ring-width': '0.125rem',
    'focus-ring-offset': '0.125rem',
    'control-text-min': '1rem',
    'scroll-margin': '2.75rem',
    'border-width-hairline': '1px',
    'overlay-max-width': '24rem',
    'overlay-max-height': '20rem',
    'overlay-dialog-max-width': '32rem',
    'overlay-viewport-margin': '1rem',
  };

  it.each(Object.entries(expected))('has %s = %s in JSON, CSS and TS', (name, value) => {
    expect(map()[name]).toBe(value);
    expect(readFileSync(cssUrl, 'utf8')).toContain(`--${name}: ${value};`);
    const camel = name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
    expect(readFileSync(tsUrl, 'utf8')).toContain(`export const ${camel} = "${value}";`);
  });

  it('keeps the touch target at 44px and control text at 16px', () => {
    expect(parseFloat(map()['target-min']) * 16).toBe(44);
    expect(parseFloat(map()['control-text-min']) * 16).toBeGreaterThanOrEqual(16);
  });

  // `check_contrast` still passes for the system's core pairs (ADR-009, risk 11).
  it.each([
    ['color-indigo-600', 'color-white', 4.5],
    ['color-text-muted', 'color-white', 4.5],
    ['color-slate-900', 'color-white', 4.5],
  ])('contrast %s on %s is at least %s:1', (fg, bg, min) => {
    expect(ratio(map()[fg], map()[bg])).toBeGreaterThanOrEqual(min);
  });
});

// G2 SHOULD-5: the retired copies used the 0.03928 sRGB threshold; the shared module uses 0.04045.
// For 8-bit channels both branches agree (no integer v/255 lies in (0.03928, 0.04045]), proven here.
describe('shared luminance equals the legacy 0.03928 formula', () => {
  const legacy = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  it('matches for every 8-bit gray level', () => {
    for (let v = 0; v < 256; v++) {
      const h = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      expect(relativeLuminance(h)).toBe(legacy(h));
    }
  });
  it('matches for every color token pair', () => {
    const colors = Object.values(map()).filter((v) => /^#[0-9a-f]{6}$/i.test(v));
    for (const a of colors)
      for (const b of colors) {
        const [hi, lo] = [legacy(a), legacy(b)].sort((x, y) => y - x);
        expect(contrastRatio(a, b)).toBe((hi + 0.05) / (lo + 0.05));
      }
  });
});
