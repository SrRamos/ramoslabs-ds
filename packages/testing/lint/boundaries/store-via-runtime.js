// @ts-check
import { SOURCE_SELECTORS, sourceOf } from './shared.js';

const STORE_SOURCE = /^@ramoslabs\/core\/(store|src\/store)(\/|$)|(^|\/)core\/src\/store(\/|$)/;

/**
 * Rule 4 (ADR-003 bridge): inside an adapter, only `src/runtime/**` may import the core store.
 * The ESLint config applies this rule to adapter files outside `src/runtime/`.
 * @type {import('eslint').Rule.RuleModule}
 */
export const storeViaRuntime = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      store:
        'Adapters touch the store only through <pkg>/src/runtime, not via "{{name}}" (ADR-003).',
    },
  },
  create(context) {
    const check = (/** @type {any} */ node) => {
      const name = sourceOf(node);
      if (name && STORE_SOURCE.test(name)) {
        context.report({ node, messageId: 'store', data: { name } });
      }
    };
    /** @type {Record<string, (node: any) => void>} */
    const visitors = {};
    for (const selector of SOURCE_SELECTORS) visitors[selector] = check;
    return visitors;
  },
};
