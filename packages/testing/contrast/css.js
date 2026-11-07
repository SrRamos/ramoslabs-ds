// @ts-check
// Contrast pairs read from BUILT component CSS (G2 NICE-1). No dependencies: a small brace parser.
//
// Reads rules inside `@layer sj.variant` (media queries are flattened). A rule contributes when its
// selector names a component part (`.sj-<c>__<part>`) and optionally constrains
// `[data-variant='v']`, `[data-tone='t']` and `:hover` / `:active`. Declarations read: `color`,
// `background-color`, `border-color`, as `var(--color-x)` (token name `color-x`) or `transparent`.
// Cascade per (component, variant, tone, state): matching rules sorted by number of constraints, then
// source order. A `transparent` fill sits on the page, so it is evaluated against every surface.
// The border is an identifying boundary (3:1) only when the fill is transparent or a surface token.

/** @typedef {'rest' | 'hover' | 'active'} CssState */
/** @typedef {'light' | 'dark'} Theme */
/** @typedef {{ component: string, variant: string, tone: string, state: CssState,
 *   fg?: string, bg?: string, border?: string }} CssPair */
/** @typedef {{ component: string | null, variant: string | null, tone: string | null,
 *   state: CssState | null, theme: Theme, order: number, decls: Record<string, string> }} CssRule */

/** A selector scoped under a `[data-theme='dark']` ancestor belongs to the dark theme. @param {string} sel @returns {Theme} */
export const themeOf = (sel) => (/\[data-theme=['"]?dark/.test(sel) ? 'dark' : 'light');

/** Splits `text` on top-level `sep` (outside parens, brackets and quotes). @param {string} text @param {string} sep */
function splitTop(text, sep) {
  const out = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** @param {string} css @returns {{ prelude: string, body: string }[]} blocks at the top level of `css` */
function blocks(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        out.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) start = i + 1; // statement at-rule: `@layer a, b;`
  }
  return out;
}

/**
 * @param {string} prelude @param {string} body @param {number} order @param {CssRule[]} out
 */
function addRule(prelude, body, order, out) {
  /** @type {Record<string, string>} */
  const decls = {};
  for (const d of splitTop(body, ';')) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const prop = d.slice(0, i).trim();
    if (['color', 'background-color', 'border-color'].includes(prop))
      decls[prop] = d.slice(i + 1).trim();
  }
  if (Object.keys(decls).length === 0) return;
  for (const sel of splitTop(prelude, ',')) {
    const component = /\.sj-([a-z0-9-]+)__[a-z0-9-]+/.exec(sel)?.[1] ?? null;
    if (!component) continue;
    const variant = /\[data-variant=['"]?([\w-]+)/.exec(sel)?.[1] ?? null;
    const tone = /\[data-tone=['"]?([\w-]+)/.exec(sel)?.[1] ?? null;
    const pseudo = /:(hover|active)\b/.exec(sel)?.[1];
    if (/:(focus|focus-visible|disabled|checked)\b/.test(sel)) continue;
    out.push({
      component,
      variant,
      tone,
      state: /** @type {CssState | null} */ (pseudo ?? null),
      theme: themeOf(sel),
      order: order++,
      decls,
    });
  }
}

/** @param {string} css @returns {CssRule[]} */
function rulesIn(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {CssRule[]} */
  const out = [];
  /** @param {string} src @param {boolean} inVariant */
  const walk = (src, inVariant) => {
    for (const { prelude, body } of blocks(src)) {
      if (prelude.startsWith('@layer'))
        walk(body, prelude.replace('@layer', '').trim() === 'sj.variant');
      else if (prelude.startsWith('@media') || prelude.startsWith('@supports'))
        walk(body, inVariant);
      else if (prelude.startsWith('@')) continue;
      else if (inVariant) addRule(prelude, body, out.length, out);
    }
  };
  walk(text, false);
  return out.map((r, i) => ({ ...r, order: i }));
}

/**
 * @typedef {{ component: string, part: string, pseudo: string, state: string, bg: string, theme: Theme }} CssUiPair
 * A drawn fill that sits on the page: `sj.state` rule keyed on `[data-state]` that sets `background-color`
 * on a part or its pseudo-element. Disabled rules are skipped (WCAG 1.4.11 exempts inactive components).
 */

/**
 * Drawn (non-text) fills from `@layer sj.state`, G3A SHOULD-2. Each is checked at 3:1 against every
 * surface. A pair between two drawn parts (knob on track) is not on the page and stays in component tests.
 * @param {string} css built stylesheet
 * @returns {CssUiPair[]}
 */
export function extractUiPairs(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {CssUiPair[]} */
  const out = [];
  /** @param {string} src @param {boolean} inState */
  const walk = (src, inState) => {
    for (const { prelude, body } of blocks(src)) {
      if (prelude.startsWith('@layer'))
        walk(body, prelude.replace('@layer', '').trim() === 'sj.state');
      else if (prelude.startsWith('@media') || prelude.startsWith('@supports')) walk(body, inState);
      else if (prelude.startsWith('@') || !inState) continue;
      else {
        let bg;
        for (const d of splitTop(body, ';')) {
          const i = d.indexOf(':');
          if (i > 0 && d.slice(0, i).trim() === 'background-color') bg = d.slice(i + 1).trim();
        }
        if (!bg) continue;
        for (const sel of splitTop(prelude, ',')) {
          const m = /\.sj-([a-z0-9-]+)__([a-z0-9-]+)/.exec(sel);
          const state = /\[data-state=['"]?([\w-]+)/.exec(sel)?.[1];
          if (!m || !state || /\[data-disabled|:disabled/.test(sel)) continue;
          if (tokenOf(bg) === 'transparent') continue;
          out.push({
            component: m[1],
            part: m[2],
            pseudo: /::(before|after)\b/.exec(sel)?.[0] ?? '',
            state,
            bg: /** @type {string} */ (tokenOf(bg)),
            theme: themeOf(sel),
          });
        }
      }
    }
  };
  walk(text, false);
  return out;
}

/**
 * @typedef {{ component: string, part: string, layer: string, selector: string, prop: 'color' | 'border-color', token: string, theme: Theme }} CssLayerUse
 * A `color` or `border-color` declared in a component or state layer (SHOULD-2). Each is checked against every
 * page surface: `color` at 4.5:1, `border-color` at 3:1. Rules in `sj.variant` that name a `[data-tone]` belong
 * to the variant matrix and are skipped here; toneless variant rules (state kinds) are read.
 * Exempt (WCAG 1.4.3 / 1.4.11 inactive components): `--color-text-disabled` (and `-dark`), and any selector with `:disabled`
 * or `[data-disabled]`; `border-color` on `::before`/`::after` is a drawn glyph, not on the page. Keywords (`currentColor`, `inherit`, system colours, `transparent`) carry no token and
 * are skipped; a raw hex or functional colour throws (tokens only).
 */

const LAYER_PASS = ['sj.component', 'sj.state', 'sj.variant'];

/**
 * @param {string} css built stylesheet
 * @returns {CssLayerUse[]}
 */
export function extractLayerUses(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {CssLayerUse[]} */
  const out = [];
  /** @param {string} src @param {string} layer */
  const walk = (src, layer) => {
    for (const { prelude, body } of blocks(src)) {
      if (prelude.startsWith('@layer')) walk(body, prelude.replace('@layer', '').trim());
      else if (prelude.startsWith('@media') || prelude.startsWith('@supports')) walk(body, layer);
      else if (prelude.startsWith('@') || !LAYER_PASS.includes(layer)) continue;
      else {
        for (const d of splitTop(body, ';')) {
          const i = d.indexOf(':');
          if (i < 0) continue;
          const prop = d.slice(0, i).trim();
          if (prop !== 'color' && prop !== 'border-color') continue;
          const v = d.slice(i + 1).trim();
          if (/^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/i.test(v))
            throw new Error(`Layer CSS ${prop} "${v}" is not var(--color-*) (tokens only)`);
          const token = /^var\(\s*--(color-[\w-]+)\s*\)$/.exec(v)?.[1];
          if (!token || token === 'color-text-disabled' || token === 'color-text-disabled-dark')
            continue;
          for (const sel of splitTop(prelude, ',')) {
            if (/:disabled\b|\[data-disabled/.test(sel)) continue;
            if (layer === 'sj.variant' && /\[data-tone/.test(sel)) continue;
            // A border on a pseudo-element is a glyph drawn inside its part (checkmark on the checked fill):
            // it is not on the page, and the component test proves it against the fill.
            if (prop === 'border-color' && /::(before|after)\b/.test(sel)) continue;
            const m = /\.sj-([a-z0-9-]+?)(?:__([a-z0-9-]+))?(?![a-z0-9_-])/.exec(sel);
            if (!m) continue;
            out.push({
              component: m[1],
              part: m[2] ?? 'root',
              layer,
              selector: sel.trim().replace(/\s+/g, ' '),
              prop,
              token,
              theme: themeOf(sel),
            });
          }
        }
      }
    }
  };
  walk(text, '');
  return out;
}

/** @param {string | undefined} v @returns {string | undefined} token name, or 'transparent' */
function tokenOf(v) {
  if (!v) return undefined;
  if (v === 'transparent') return 'transparent';
  const m = /^var\(\s*--(color-[\w-]+)\s*\)$/.exec(v);
  if (!m)
    throw new Error(`Variant CSS color "${v}" is not var(--color-*) or transparent (tokens only)`);
  return m[1];
}

/**
 * Light reads only the unscoped rules. Dark reads both: a `[data-theme='dark']` rule overrides the light rule
 * with the same number of constraints (it also comes later in the source, as in the real cascade).
 * @param {string} css built stylesheet
 * @param {{ theme?: Theme }} [options]
 * @returns {CssPair[]} one entry per (component, variant, tone, state) that resolves a color or fill
 */
export function extractPairs(css, options = {}) {
  const theme = options.theme ?? 'light';
  const rules = rulesIn(css).filter((r) => theme === 'dark' || r.theme === 'light');
  // Dark covers only components that declare dark rules: a light-only component makes no dark claim.
  const darkComponents = new Set(rules.filter((r) => r.theme === 'dark').map((r) => r.component));
  const combos = new Set(
    rules
      .filter((r) => r.variant && r.tone && (theme === 'light' || darkComponents.has(r.component)))
      .map((r) => `${r.component}|${r.variant}|${r.tone}`),
  );
  /** @type {CssPair[]} */
  const out = [];
  for (const key of combos) {
    const [component, variant, tone] = key.split('|');
    for (const state of /** @type {CssState[]} */ (['rest', 'hover', 'active'])) {
      const hit = rules
        .filter(
          (r) =>
            r.component === component &&
            (!r.variant || r.variant === variant) &&
            (!r.tone || r.tone === tone) &&
            (!r.state || r.state === state),
        )
        .map((r) => ({ r, n: [r.variant, r.tone, r.state].filter(Boolean).length }))
        .sort(
          (a, b) =>
            a.n - b.n ||
            Number(a.r.theme === 'dark') - Number(b.r.theme === 'dark') ||
            a.r.order - b.r.order,
        );
      /** @type {Record<string, string>} */
      const d = {};
      for (const { r } of hit) Object.assign(d, r.decls);
      const fg = tokenOf(d.color);
      const bg = tokenOf(d['background-color']);
      const border = tokenOf(d['border-color']);
      if (fg || bg || border) out.push({ component, variant, tone, state, fg, bg, border });
    }
  }
  return out;
}
