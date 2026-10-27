// @ts-check
// The one WCAG 2.x contrast implementation (NICE-6, W1-203). Pure, dependency-free, DOM-free.
//
// Importers: the build-time contrast matrix and the css probe tests today. Follow-ups (other streams
// own the files): the tokens test (packages/tokens/test/tokens.test.ts), the MCP `check_contrast` tool
// (apps/site/worker/index.ts) and the docs/TokenPicker should import `contrastRatio` from here
// (`@ramoslabs/testing/contrast`) instead of keeping their own copies.

/**
 * Parses `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha ignored; use `compositeOver` for translucent colors).
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function parseHex(hex) {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex color: "${hex}"`);
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) throw new Error(`Not a hex color: "${hex}"`);
  const n = Number.parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Alpha of `#rrggbbaa` / `#rgba`, else 1. @param {string} hex */
export function hexAlpha(hex) {
  const h = hex.trim().slice(1);
  if (h.length === 8) return Number.parseInt(h.slice(6), 16) / 255;
  if (h.length === 4) return Number.parseInt(h[3] + h[3], 16) / 255;
  return 1;
}

/** Composites `fg` at `alpha` over opaque `bg`; returns `#rrggbb`. @param {string} fg @param {number} alpha @param {string} bg */
export function compositeOver(fg, alpha, bg) {
  const f = parseHex(fg);
  const b = parseHex(bg);
  const c = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2.x relative luminance of an sRGB hex color. @param {string} hex */
export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21, order independent. @param {string} a @param {string} b */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Thresholds (WCAG 1.4.3 normal text, 1.4.3 large text, 1.4.11 non-text). */
export const THRESHOLDS = { text: 4.5, largeText: 3, ui: 3 };

/** @param {string} fg @param {string} bg @param {number} [min] */
export function meets(fg, bg, min = THRESHOLDS.text) {
  // Round to 2 dp like every public checker, so 4.499 never reads as 4.5.
  return Math.floor(contrastRatio(fg, bg) * 100) / 100 >= min;
}
