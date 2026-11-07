// @ts-check
// Token-only CSS rules (W1-202, ADR-009). Each rule is a stylelint plugin named `sj/<rule>`.
import { defineRule, scrub, valueOffset } from './shared.js';

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/gi;
const COLOR_FN =
  /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;

/** Raw hex and literal color functions. A color function whose arguments read a token is fine. */
export const noRawColor = defineRule(
  'no-raw-color',
  {
    hex: (/** @type {string} */ hex) =>
      `Raw color "${hex}". Use a color token: var(--color-...). AGENTS.md "the one hard rule".`,
    fn: (/** @type {string} */ fn) =>
      `Literal color function "${fn}(...)". Use a color token: var(--color-...), or color-mix() over tokens.`,
  },
  ({ root, emit }) => {
    root.walkDecls((/** @type {any} */ decl) => {
      const value = scrub(decl.value);
      const base = valueOffset(decl);
      for (const m of value.matchAll(HEX))
        emit(decl, 'hex', [m[0]], base + (m.index ?? 0), m[0].length);
      for (const m of value.matchAll(COLOR_FN)) {
        if (/var\(/.test(m[2] ?? '')) continue;
        emit(decl, 'fn', [m[1]], base + (m.index ?? 0), m[0].length);
      }
    });
  },
);

const PX = /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)px(?![\w-])/gi;

/**
 * Raw px in a declaration. The documented 1px hairline is the token `--border-width-hairline`, and
 * zero is a unitless 0. Media/container query params are exempt: CSS cannot read a variable there.
 */
export const noRawPx = defineRule(
  'no-raw-px',
  {
    px: (/** @type {string} */ px) =>
      `Raw "${px}". Use a spacing, size or radius token (var(--space-*), var(--radius-*), var(--border-width-hairline), ...); use a unitless 0 for zero.`,
  },
  ({ root, emit }) => {
    root.walkDecls((/** @type {any} */ decl) => {
      const value = scrub(decl.value);
      const base = valueOffset(decl);
      for (const m of value.matchAll(PX))
        emit(decl, 'px', [m[0]], base + (m.index ?? 0), m[0].length);
    });
  },
);

const TIME = /(?<![\w.-])(?:\d+\.?\d*|\.\d+)(?:ms|s)(?![\w-])/gi;
const TIME_PROP =
  /^(?:-webkit-)?(?:transition|animation)(?:-duration|-delay)?$|^--.*(?:duration|delay)/i;

/** Non-zero time literals in transition/animation declarations (and duration/delay custom props). */
export const noRawDuration = defineRule(
  'no-raw-duration',
  {
    time: (/** @type {string} */ t) =>
      `Raw duration "${t}". Use a motion token: var(--duration-fast|normal|slow), or var(--sj-duration-*).`,
  },
  ({ root, emit }) => {
    root.walkDecls((/** @type {any} */ decl) => {
      if (!TIME_PROP.test(decl.prop)) return;
      const value = scrub(decl.value);
      const base = valueOffset(decl);
      for (const m of value.matchAll(TIME)) {
        if (Number.parseFloat(m[0]) === 0) continue;
        emit(decl, 'time', [m[0]], base + (m.index ?? 0), m[0].length);
      }
    });
  },
);

/** `outline: none|0` (or outline-style: none) in a rule that draws no replacement box-shadow. */
export const noOutlineNone = defineRule(
  'no-outline-none',
  {
    none: () =>
      'Focus outline removed without a replacement. Draw one in the same rule (box-shadow: var(--shadow-focus)) or keep the outline. WCAG 2.4.7, AGENTS.md.',
  },
  ({ root, emit }) => {
    root.walkDecls(/^outline(?:-style|-width)?$/i, (/** @type {any} */ decl) => {
      const v = decl.value.trim().toLowerCase();
      const removed =
        /^(?:none|0|0px)$/.test(v) ||
        (decl.prop.toLowerCase() === 'outline' && /^(?:none|0)(?:\s|$)/.test(v)) ||
        (decl.prop.toLowerCase() === 'outline-style' && v === 'none') ||
        (decl.prop.toLowerCase() === 'outline-width' && /^0(?:px|rem|em)?$/.test(v));
      if (!removed) return;
      const parent = decl.parent;
      let replaced = false;
      parent?.each((/** @type {any} */ sibling) => {
        if (sibling.type !== 'decl' || sibling.prop.toLowerCase() !== 'box-shadow') return;
        if (!/^(?:none|initial|unset)$/i.test(sibling.value.trim())) replaced = true;
      });
      if (!replaced) emit(decl, 'none');
    });
  },
);

const REMOTE = /(?:url\(\s*['"]?\s*|@import\s+['"]?\s*)(?:https?:)?\/\/|https?:\/\//i;

/** Remote `@import`, `@font-face` sources and `url()` values (no remote assets in packages, ADR-009). */
export const noRemoteUrl = defineRule(
  'no-remote-url',
  {
    remote: (/** @type {string} */ where) =>
      `Remote URL in ${where}. No remote fonts or imports: consumers load fonts and bundle CSS (ADR-009).`,
  },
  ({ root, emit }) => {
    root.walkAtRules((/** @type {any} */ rule) => {
      if (rule.name.toLowerCase() === 'import' && REMOTE.test(`@import ${rule.params}`))
        emit(rule, 'remote', ['@import']);
    });
    root.walkDecls((/** @type {any} */ decl) => {
      const raw = decl.value.replace(/\/\*[\s\S]*?\*\//g, '');
      if (!REMOTE.test(raw)) return;
      const inFontFace =
        decl.parent?.type === 'atrule' &&
        /** @type {any} */ (decl.parent).name.toLowerCase() === 'font-face';
      emit(decl, 'remote', [inFontFace ? '@font-face' : `"${decl.prop}"`]);
    });
  },
);

const PHYSICAL_PROP =
  /^(?:(?:margin|padding|scroll-margin|scroll-padding)-(?:left|right|top|bottom)|border-(?:left|right|top|bottom)(?:-(?:width|style|color))?|border-(?:top|bottom)-(?:left|right)-radius|left|right|top|bottom)$/i;
const PHYSICAL_VALUE = {
  float: /^(?:left|right)$/i,
  clear: /^(?:left|right)$/i,
  'text-align': /^(?:left|right)$/i,
};

/** Physical directional properties; logical properties and RTL are the default (ADR-009). */
export const logicalProperties = defineRule(
  'logical-properties',
  {
    prop: (/** @type {string} */ p) =>
      `Physical property "${p}". Use the logical equivalent (margin-inline-start, inset-block-start, border-start-start-radius, ...) so RTL works.`,
    value: (/** @type {string} */ p, /** @type {string} */ v) =>
      `Physical value "${p}: ${v}". Use start/end so RTL works.`,
  },
  ({ root, emit }) => {
    root.walkDecls((/** @type {any} */ decl) => {
      const prop = decl.prop.toLowerCase();
      if (PHYSICAL_PROP.test(prop)) emit(decl, 'prop', [decl.prop]);
      const re = /** @type {Record<string, RegExp>} */ (PHYSICAL_VALUE)[prop];
      if (re?.test(decl.value.trim())) emit(decl, 'value', [decl.prop, decl.value]);
    });
  },
);

const SPACE_TOKEN = /var\(\s*(--space-[\w-]+)\s*[,)]/g;

/**
 * Gestalt proximity (pattern decision 6): the space INSIDE a group must be smaller than the space AROUND it. In one
 * rule, `gap` is the inner spacing (between the group's items) and `margin*` is the outer spacing (between this
 * group and the next). The same spacing token on both makes the group blur into its neighbour, so the first `gap`
 * that reuses a margin token is flagged. A container's own `padding` is not compared: edge padding equal to the
 * gap is normal. This sees one rule at a time, so it cannot compare a parent's gap with a child's margin declared
 * in another selector, nor a literal value reached through a custom property; those cases are left to review and
 * to the docs (Spacing, "Related, group, section").
 */
export const spacingProximity = defineRule(
  'spacing-proximity',
  {
    same: (/** @type {string} */ token) =>
      `The gap and the margin of this rule both use ${token}. Inner and outer spacing must differ (Gestalt proximity): use a smaller token for the gap (var(--space-related)) or a larger one for the margin (var(--space-group), var(--space-section)).`,
  },
  ({ root, emit }) => {
    root.walkRules((/** @type {any} */ rule) => {
      /** @type {Set<string>} */
      const outer = new Set();
      /** @type {any[]} */
      const gaps = [];
      rule.each((/** @type {any} */ node) => {
        if (node.type !== 'decl') return;
        const prop = node.prop.toLowerCase();
        if (/^margin(?:-(?:block|inline)(?:-(?:start|end))?)?$/.test(prop))
          for (const m of node.value.matchAll(SPACE_TOKEN)) outer.add(m[1]);
        else if (/^(?:gap|row-gap|column-gap)$/.test(prop)) gaps.push(node);
      });
      for (const g of gaps) {
        for (const m of g.value.matchAll(SPACE_TOKEN)) {
          if (outer.has(m[1])) {
            emit(g, 'same', [m[1]]);
            return;
          }
        }
      }
    });
  },
);

export const plugins = [
  noRawColor,
  noRawPx,
  noRawDuration,
  noOutlineNone,
  noRemoteUrl,
  logicalProperties,
  spacingProximity,
];
