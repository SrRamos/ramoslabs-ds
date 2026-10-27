// @ts-check
import { SOURCE_SELECTORS, sourceOf } from './shared.js';

const CSS_SOURCE =
  /(\.(css|scss|sass|less|styl)(\?.*)?$)|^@ramoslabs\/css(\/|$)|^@ramoslabs\/tokens\/css$/;

/**
 * Rule 2 (ADR-002 "CSS delivery"): adapters never import CSS. Consumers import `@ramoslabs/css`.
 * @type {import('eslint').Rule.RuleModule}
 */
export const noCssImport = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      css: 'Adapters must not import CSS ("{{name}}"); consumers import @ramoslabs/css (ADR-002).',
    },
  },
  create(context) {
    const check = (/** @type {any} */ node) => {
      const name = sourceOf(node);
      if (name && CSS_SOURCE.test(name)) {
        context.report({ node, messageId: 'css', data: { name } });
      }
    };
    /** @type {Record<string, (node: any) => void>} */
    const visitors = {};
    for (const selector of SOURCE_SELECTORS) visitors[selector] = check;
    visitors['CallExpression[callee.name="require"]'] = (node) => {
      const arg = node.arguments[0];
      if (
        arg &&
        arg.type === 'Literal' &&
        typeof arg.value === 'string' &&
        CSS_SOURCE.test(arg.value)
      ) {
        context.report({ node, messageId: 'css', data: { name: arg.value } });
      }
    };
    return visitors;
  },
};
