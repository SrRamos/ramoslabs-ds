// @ts-check
// Build-time contrast matrix (W1-203, ADR-009 "Contrast at build time", ADR-013). LIGHT THEME ONLY.
//
// `RECIPE` is the canonical token pairing for the `variant x tone` axes of the library. Variant CSS
// in the `sj.variant` layer must use exactly these tokens; the matrix proves, from the token source,
// that every pairing clears WCAG before anything renders. A token change that breaks a pair fails
// with the pair, the ratio and the token name.
//
// Sizes: text color does not depend on size, so each pair is evaluated per size. All sizes are
// treated as normal text (4.5:1); the large-text 3:1 allowance is deliberately not used.
import { THRESHOLDS, contrastRatio } from './wcag.js';

export const VARIANTS = ['solid', 'soft', 'outline', 'ghost'];
export const TONES = ['primary', 'neutral', 'success', 'warning', 'error', 'info'];
export const SIZES = ['sm', 'md', 'lg'];

/** Page surfaces a control can sit on (light theme). */
export const SURFACES = ['color-surface', 'color-surface-secondary', 'color-background'];

/**
 * `fg`: label/icon color. `bg`: fill the label sits on. `border`: the control outline when it is the
 * identifying boundary (outline variant), checked at 3:1 against the surface it sits on.
 * Fills of solid/soft variants are identified by their label, so they carry the text pair only.
 * @type {Record<string, Record<string, { fg: string, bg: string, border?: string }>>}
 */
export const RECIPE = {
  solid: {
    primary: { fg: 'color-white', bg: 'color-primary' },
    neutral: { fg: 'color-white', bg: 'color-slate-800' },
    success: { fg: 'color-white', bg: 'color-emerald-700' },
    warning: { fg: 'color-slate-900', bg: 'color-amber-500' },
    error: { fg: 'color-white', bg: 'color-error-strong' },
    info: { fg: 'color-white', bg: 'color-blue-700' },
  },
  soft: {
    primary: { fg: 'color-primary-dark', bg: 'color-primary-surface' },
    neutral: { fg: 'color-text-body', bg: 'color-surface-hover' },
    success: { fg: 'color-success-text', bg: 'color-success-surface' },
    warning: { fg: 'color-warning-text', bg: 'color-warning-surface' },
    error: { fg: 'color-error-text', bg: 'color-error-surface' },
    info: { fg: 'color-info-text', bg: 'color-info-surface' },
  },
  outline: {
    primary: { fg: 'color-primary', bg: 'color-surface', border: 'color-primary' },
    neutral: { fg: 'color-text-body', bg: 'color-surface', border: 'color-text-muted' },
    success: { fg: 'color-success-text', bg: 'color-surface', border: 'color-success-text' },
    warning: { fg: 'color-warning-text', bg: 'color-surface', border: 'color-warning-text' },
    error: { fg: 'color-error-text', bg: 'color-surface', border: 'color-error-text' },
    info: { fg: 'color-info-text', bg: 'color-surface', border: 'color-info-text' },
  },
  ghost: {
    primary: { fg: 'color-primary', bg: 'color-surface' },
    neutral: { fg: 'color-text-body', bg: 'color-surface' },
    success: { fg: 'color-success-text', bg: 'color-surface' },
    warning: { fg: 'color-warning-text', bg: 'color-surface' },
    error: { fg: 'color-error-text', bg: 'color-surface' },
    info: { fg: 'color-info-text', bg: 'color-surface' },
  },
};

/** Text roles that sit directly on page surfaces. `text-disabled` is exempt (WCAG 1.4.3 inactive). */
export const TEXT_ROLES = [
  'color-text-heading',
  'color-text-strong',
  'color-text-body',
  'color-text-secondary',
  'color-text-muted',
];

/** AGENTS.md: muted text is never lighter than slate 500 on white. */
export const MUTED_FLOOR_TOKEN = 'color-slate-500';

/**
 * @typedef {{ id: string, kind: 'text' | 'ui' | 'focus' | 'floor', variant?: string, tone?: string, size?: string,
 *   fg: string, bg: string, fgValue: string, bgValue: string, ratio: number, min: number, pass: boolean }} PairResult
 */

/**
 * @param {Record<string, string>} tokens flat token map (see loadTokens)
 * @returns {{ pairs: PairResult[], failures: PairResult[] }}
 */
export function checkContrastMatrix(tokens) {
  /** @type {PairResult[]} */
  const pairs = [];
  /** @param {string} name */
  const value = (name) => {
    const v = tokens[name];
    if (!v) throw new Error(`Contrast matrix references unknown token "${name}"`);
    return v;
  };
  /** @param {Omit<PairResult, 'fgValue' | 'bgValue' | 'ratio' | 'pass'>} p */
  const add = (p) => {
    const fgValue = value(p.fg);
    const bgValue = value(p.bg);
    const ratio = contrastRatio(fgValue, bgValue);
    pairs.push({ ...p, fgValue, bgValue, ratio, pass: Math.floor(ratio * 100) / 100 >= p.min });
  };

  for (const variant of VARIANTS) {
    for (const tone of TONES) {
      const r = RECIPE[variant]?.[tone];
      if (!r) throw new Error(`RECIPE is missing ${variant} x ${tone}`);
      for (const size of SIZES) {
        const id = `${variant}/${tone}/${size}`;
        add({
          id: `${id}/text`,
          kind: 'text',
          variant,
          tone,
          size,
          fg: r.fg,
          bg: r.bg,
          min: THRESHOLDS.text,
        });
        if (r.border) {
          for (const s of SURFACES) {
            add({
              id: `${id}/border-on-${s}`,
              kind: 'ui',
              variant,
              tone,
              size,
              fg: r.border,
              bg: s,
              min: THRESHOLDS.ui,
            });
          }
        }
      }
    }
  }
  for (const role of TEXT_ROLES) {
    for (const s of SURFACES)
      add({ id: `text/${role}-on-${s}`, kind: 'text', fg: role, bg: s, min: THRESHOLDS.text });
  }
  for (const s of SURFACES)
    add({ id: `focus/ring-on-${s}`, kind: 'focus', fg: 'color-focus', bg: s, min: THRESHOLDS.ui });
  // Muted floor: never lighter than slate 500 on white, even if the token is re-pointed.
  const floor =
    Math.floor(contrastRatio(value(MUTED_FLOOR_TOKEN), value('color-white')) * 100) / 100;
  add({
    id: 'floor/muted-on-white',
    kind: 'floor',
    fg: 'color-text-muted',
    bg: 'color-white',
    min: floor,
  });

  return { pairs, failures: pairs.filter((p) => !p.pass) };
}

/** One line per failure: pair, ratio, tokens (and their values). @param {PairResult} f */
export function formatFailure(f) {
  return `${f.id}: ${f.fg} (${f.fgValue}) on ${f.bg} (${f.bgValue}) = ${f.ratio.toFixed(2)}:1, needs ${f.min.toFixed(2)}:1`;
}
