// @ts-check
// Build-time contrast matrix (W1-203, ADR-009 "Contrast at build time", ADR-013). Light theme, plus the
// `[data-theme='dark']` rules of the built CSS checked against the dark surfaces.
//
// `RECIPE` is the canonical token pairing for the `variant x tone` axes of the library. Variant CSS
// in the `sj.variant` layer must use exactly these tokens; the matrix proves, from the token source,
// that every pairing clears WCAG before anything renders. A token change that breaks a pair fails
// with the pair, the ratio and the token name.
//
// Sizes: text color does not depend on size, so each pair is evaluated per size. All sizes are
// treated as normal text (4.5:1); the large-text 3:1 allowance is deliberately not used.
import { THRESHOLDS, compositeOver, contrastRatio } from './wcag.js';
import { extractLayerUses, extractPairs, extractUiPairs } from './css.js';

export const VARIANTS = ['solid', 'soft', 'outline', 'ghost', 'link'];
export const TONES = ['primary', 'neutral', 'success', 'warning', 'error', 'info'];
export const SIZES = ['xs', 'sm', 'md', 'lg'];

/** Page surfaces a control can sit on (light theme). */
export const SURFACES = ['color-surface', 'color-surface-secondary', 'color-background'];

/** Dark page surfaces: every `[data-theme='dark']` colour is checked against both. */
export const DARK_SURFACES = ['color-surface-dark', 'color-background-dark'];

/**
 * `fg`: label/icon color. `bg`: fill the label sits on. `border`: the control outline when it is the
 * identifying boundary (outline variant), checked at 3:1 against the surface it sits on.
 * Fills of solid/soft variants are identified by their label, so they carry the text pair only.
 * @type {Record<string, Record<string, { fg: string, bg: string, border?: string }>>}
 */
export const RECIPE = {
  solid: {
    primary: { fg: 'color-white', bg: 'color-primary' },
    neutral: { fg: 'color-neutral-on-solid', bg: 'color-neutral-solid' },
    success: { fg: 'color-success-on-solid', bg: 'color-success-solid' },
    warning: { fg: 'color-warning-on-solid', bg: 'color-warning-solid' },
    error: { fg: 'color-error-on-solid', bg: 'color-error-solid' },
    info: { fg: 'color-info-on-solid', bg: 'color-info-solid' },
  },
  soft: {
    primary: { fg: 'color-primary-dark', bg: 'color-primary-surface' },
    neutral: { fg: 'color-neutral-text', bg: 'color-neutral-surface' },
    success: { fg: 'color-success-text', bg: 'color-success-surface' },
    warning: { fg: 'color-warning-text', bg: 'color-warning-surface' },
    error: { fg: 'color-error-text', bg: 'color-error-surface' },
    info: { fg: 'color-info-text', bg: 'color-info-surface' },
  },
  outline: {
    primary: { fg: 'color-primary', bg: 'transparent', border: 'color-primary' },
    neutral: { fg: 'color-neutral-text', bg: 'transparent', border: 'color-neutral-outline' },
    success: { fg: 'color-success-text', bg: 'transparent', border: 'color-success-outline' },
    warning: { fg: 'color-warning-text', bg: 'transparent', border: 'color-warning-outline' },
    error: { fg: 'color-error-text', bg: 'transparent', border: 'color-error-outline' },
    info: { fg: 'color-info-text', bg: 'transparent', border: 'color-info-outline' },
  },
  ghost: {
    primary: { fg: 'color-primary', bg: 'transparent' },
    neutral: { fg: 'color-neutral-text', bg: 'transparent' },
    success: { fg: 'color-success-text', bg: 'transparent' },
    warning: { fg: 'color-warning-text', bg: 'transparent' },
    error: { fg: 'color-error-text', bg: 'transparent' },
    info: { fg: 'color-info-text', bg: 'transparent' },
  },
  link: {
    primary: { fg: 'color-primary', bg: 'transparent' },
    neutral: { fg: 'color-neutral-text-strong', bg: 'transparent' },
    success: { fg: 'color-success-text', bg: 'transparent' },
    warning: { fg: 'color-warning-text', bg: 'transparent' },
    error: { fg: 'color-error-text', bg: 'transparent' },
    info: { fg: 'color-info-text', bg: 'transparent' },
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

/** Text roles on dark surfaces. */
export const TEXT_ROLES_DARK = [
  'color-text-heading-dark',
  'color-text-body-dark',
  'color-text-secondary-dark',
  'color-text-muted-dark',
];

/** Tones with a full semantic role set (status palette, docs/research/status-tones-2026.md). */
export const STATUS_TONES = ['success', 'warning', 'error', 'info', 'neutral'];

/**
 * Every role pair of one status tone, light and dark, at token level (alerts, badges and field messages use
 * them outside any component CSS). Solid labels are checked on the fill, on the lightest pixel of the 12%
 * sheen (light and hover) and on the pressed fill; text on white-ish surfaces and on the tone's own soft
 * fills; outlines at 3:1; the dark set on the dark surfaces and the dark soft fills.
 * @param {string} t tone
 * @returns {{ id: string, kind: 'text' | 'ui', fg: string, bg: string, sheen?: boolean }[]}
 */
export function statusRolePairs(t) {
  const c = (/** @type {string} */ r) => `color-${t}-${r}`;
  /** @type {{ id: string, kind: 'text' | 'ui', fg: string, bg: string, sheen?: boolean }[]} */
  const out = [];
  /** @type {(id: string, kind: 'text' | 'ui', fg: string, bg: string, sheen?: boolean) => number} */
  const add = (id, kind, fg, bg, sheen = false) =>
    out.push({ id: `status/${t}/${id}`, kind, fg, bg, sheen });
  for (const [sfx, surfaces] of /** @type {const} */ ([
    ['', SURFACES],
    ['-dark', DARK_SURFACES],
  ])) {
    const solid = t === 'neutral' ? sfx : '';
    add(`solid${sfx}`, 'text', c(`on-solid${solid}`), c(`solid${solid}`));
    add(`solid${sfx}-sheen`, 'text', c(`on-solid${solid}`), c(`solid${solid}`), true);
    add(`solid-hover${sfx}`, 'text', c(`on-solid${solid}`), c(`solid-hover${solid}`));
    add(`solid-hover${sfx}-sheen`, 'text', c(`on-solid${solid}`), c(`solid-hover${solid}`), true);
    add(`solid-press${sfx}`, 'text', c(`on-solid${solid}`), c(`solid-press${solid}`));
    for (const bg of [
      ...surfaces,
      c(`surface${sfx}`),
      c(`surface-hover${sfx}`),
      c(`surface-press${sfx}`),
    ])
      add(`text${sfx}-on-${bg}`, 'text', c(`text${sfx}`), bg);
    add(`text-strong${sfx}-on-surface`, 'text', c(`text-strong${sfx}`), c(`surface${sfx}`));
    add(
      `body${sfx}-on-surface`,
      'text',
      sfx ? 'color-text-body-dark' : 'color-text-body',
      c(`surface${sfx}`),
    );
    for (const bg of surfaces) add(`outline${sfx}-on-${bg}`, 'ui', c(`outline${sfx}`), bg);
  }
  return out;
}

/** AGENTS.md: muted text is never lighter than slate 500 on white. */
export const MUTED_FLOOR_TOKEN = 'color-slate-500';

/**
 * @typedef {{ id: string, kind: 'text' | 'ui' | 'focus' | 'floor', source?: 'css' | 'recipe', variant?: string, tone?: string, size?: string,
 *   fg: string, bg: string, fgValue: string, bgValue: string, ratio: number, min: number, pass: boolean }} PairResult
 */

/**
 * Pairs come from the built CSS when `options.css` is given (G2 NICE-1): every (component, variant, tone)
 * the CSS defines is checked at rest, hover and active, and replaces RECIPE for that variant x tone.
 * RECIPE stays the fallback for variant x tone pairs no component CSS defines yet.
 * @param {Record<string, string>} tokens flat token map (see loadTokens)
 * @param {{ css?: string }} [options] `css`: the built stylesheet (dist/index.css)
 * @returns {{ pairs: PairResult[], failures: PairResult[] }}
 */
export function checkContrastMatrix(tokens, options = {}) {
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

  const cssPairs = options.css ? extractPairs(options.css) : [];
  /** Variant x tone combos some component CSS resolves with a text pair at rest. */
  const covered = new Set(
    cssPairs.filter((p) => p.state === 'rest' && p.fg && p.bg).map((p) => `${p.variant}/${p.tone}`),
  );
  for (const p of cssPairs) {
    const state = p.state === 'rest' ? '' : `${p.state}/`;
    const id = `${p.component}/${p.variant}/${p.tone}/${state}`;
    const surfaces = p.bg === 'transparent' ? SURFACES : p.bg ? [p.bg] : [];
    if (p.fg && p.fg !== 'transparent')
      for (const bg of surfaces)
        add({
          id: `${id}text${surfaces.length > 1 ? `-on-${bg}` : ''}`,
          kind: 'text',
          source: 'css',
          variant: p.variant,
          tone: p.tone,
          fg: p.fg,
          bg,
          min: THRESHOLDS.text,
        });
    const boundary = p.bg === 'transparent' || (p.bg && SURFACES.includes(p.bg));
    if (p.border && p.border !== 'transparent' && boundary)
      for (const s of SURFACES)
        add({
          id: `${id}border-on-${s}`,
          kind: 'ui',
          source: 'css',
          variant: p.variant,
          tone: p.tone,
          fg: p.border,
          bg: s,
          min: THRESHOLDS.ui,
        });
  }

  // Drawn fills on the page (switch track, G3A SHOULD-2): 3:1 against every surface.
  if (options.css)
    for (const u of extractUiPairs(options.css))
      for (const s of SURFACES)
        add({
          id: `${u.component}/${u.part}${u.pseudo}/${u.state}/ui-on-${s}`,
          kind: 'ui',
          source: 'css',
          fg: u.bg,
          bg: s,
          min: THRESHOLDS.ui,
        });

  // Colours declared in sj.component / sj.state (and toneless sj.variant) rules: text 4.5:1, border 3:1, on every surface.
  if (options.css)
    for (const u of extractLayerUses(options.css))
      for (const s of u.theme === 'dark' ? DARK_SURFACES : SURFACES)
        add({
          id: `${u.theme === 'dark' ? 'dark/' : ''}${u.component}/${u.part}/${u.layer.replace('sj.', '')}/${u.prop === 'color' ? 'text' : 'border'}-on-${s}`,
          kind: u.prop === 'color' ? 'text' : 'ui',
          source: 'css',
          fg: u.token,
          bg: s,
          min: u.prop === 'color' ? THRESHOLDS.text : THRESHOLDS.ui,
        });

  // Dark theme (G-dark): the built CSS read with its `[data-theme='dark']` rules, on the dark surfaces.
  if (options.css) {
    for (const p of extractPairs(options.css, { theme: 'dark' })) {
      const state = p.state === 'rest' ? '' : `${p.state}/`;
      const id = `dark/${p.component}/${p.variant}/${p.tone}/${state}`;
      const surfaces = p.bg === 'transparent' ? DARK_SURFACES : p.bg ? [p.bg] : [];
      if (p.fg && p.fg !== 'transparent')
        for (const bg of surfaces)
          add({
            id: `${id}text${surfaces.length > 1 ? `-on-${bg}` : ''}`,
            kind: 'text',
            source: 'css',
            variant: p.variant,
            tone: p.tone,
            fg: p.fg,
            bg,
            min: THRESHOLDS.text,
          });
      if (p.border && p.border !== 'transparent' && p.bg === 'transparent')
        for (const s of DARK_SURFACES)
          add({
            id: `${id}border-on-${s}`,
            kind: 'ui',
            source: 'css',
            variant: p.variant,
            tone: p.tone,
            fg: p.border,
            bg: s,
            min: THRESHOLDS.ui,
          });
    }
  }

  for (const variant of VARIANTS) {
    for (const tone of TONES) {
      if (covered.has(`${variant}/${tone}`)) continue; // the CSS is authoritative
      const r = RECIPE[variant]?.[tone];
      if (!r) throw new Error(`RECIPE is missing ${variant} x ${tone}`);
      for (const size of SIZES) {
        const id = `${variant}/${tone}/${size}`;
        // A transparent fill sits on the page: evaluated on every surface, same as the CSS pairs.
        const surfaces = r.bg === 'transparent' ? SURFACES : [r.bg];
        for (const bg of surfaces)
          add({
            id: `${id}/text${surfaces.length > 1 ? `-on-${bg}` : ''}`,
            kind: 'text',
            source: 'recipe',
            variant,
            tone,
            size,
            fg: r.fg,
            bg,
            min: THRESHOLDS.text,
          });
        if (r.border) {
          for (const s of SURFACES) {
            add({
              id: `${id}/border-on-${s}`,
              kind: 'ui',
              source: 'recipe',
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
  for (const role of TEXT_ROLES_DARK)
    for (const s of DARK_SURFACES)
      add({ id: `text/${role}-on-${s}`, kind: 'text', fg: role, bg: s, min: THRESHOLDS.text });
  // Status role pairs at token level. The sheen pairs composite white at --opacity-sheen over the fill.
  const sheen = tokens['opacity-sheen'] ? Number.parseFloat(tokens['opacity-sheen']) / 100 : 0;
  for (const t of STATUS_TONES)
    for (const p of statusRolePairs(t)) {
      const min = p.kind === 'text' ? THRESHOLDS.text : THRESHOLDS.ui;
      if (!p.sheen) {
        add({ id: p.id, kind: p.kind, tone: t, fg: p.fg, bg: p.bg, min });
        continue;
      }
      const fgValue = value(p.fg);
      const bgValue = compositeOver('#ffffff', sheen, value(p.bg));
      const ratio = contrastRatio(fgValue, bgValue);
      pairs.push({
        id: p.id,
        kind: 'text',
        tone: t,
        fg: p.fg,
        bg: `${p.bg}+sheen`,
        fgValue,
        bgValue,
        ratio,
        min,
        pass: Math.floor(ratio * 100) / 100 >= min,
      });
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
