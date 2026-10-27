// @ts-check
import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

/** Blank out `url(...)` bodies, quoted strings and comments so literals inside them never match. */
export function scrub(/** @type {string} */ value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, (/** @type {string} */ m) => ' '.repeat(m.length))
    .replace(
      /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi,
      (/** @type {string} */ m) => 'url('.padEnd(m.length - 1, ' ') + ')',
    )
    .replace(/"[^"]*"|'[^']*'/g, (/** @type {string} */ m) => ' '.repeat(m.length));
}

/**
 * Builds a stylelint plugin rule `sj/<name>` from a per-declaration or per-at-rule checker.
 * @param {string} name rule name without the `sj/` prefix
 * @param {Record<string, string | ((...args: any[]) => string)>} messageDefs
 * @returns {any}
 * @param {(ctx: { root: any, emit: (node: any, key: string, args?: any[], index?: number, length?: number) => void }) => void} check
 */
export function defineRule(name, messageDefs, check) {
  const ruleName = `sj/${name}`;
  const messages = ruleMessages(ruleName, /** @type {any} */ (messageDefs));
  const rule =
    (/** @type {unknown} */ primary) => (/** @type {any} */ root, /** @type {any} */ result) => {
      if (!validateOptions(result, ruleName, { actual: primary, possible: [true] })) return;
      const emit = (
        /** @type {any} */ node,
        /** @type {string} */ key,
        /** @type {any[]} */ args = [],
        /** @type {number | undefined} */ index,
        /** @type {number | undefined} */ length,
      ) => {
        const msg = /** @type {any} */ (messages)[key];
        report({
          ruleName,
          result,
          node,
          message: typeof msg === 'function' ? msg(...args) : msg,
          ...(index === undefined ? {} : { index, endIndex: index + (length ?? 1) }),
        });
      };
      check({ root, emit });
    };
  rule.ruleName = ruleName;
  rule.messages = messages;
  rule.meta = { url: 'https://design.ramoslabs.com/', fixable: false };
  return createPlugin(ruleName, /** @type {any} */ (rule));
}

/** Index of a declaration value inside the declaration source (for precise reporting). */
export function valueOffset(/** @type {any} */ decl) {
  return decl.prop.length + (decl.raws.between?.length ?? 1);
}
