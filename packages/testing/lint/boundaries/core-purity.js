// @ts-check
import { DOM_GLOBALS, FRAMEWORK_SPECIFIER, SOURCE_SELECTORS, sourceOf } from './shared.js';

/**
 * Rule 1 (ADR-002): `core` imports no `vue`/`react`/framework package and reads no DOM global at
 * module scope. DOM access inside functions is allowed because it only runs after mount.
 * `typeof document` guards are allowed.
 * @type {import('eslint').Rule.RuleModule}
 */
export const corePurity = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      framework: 'core must not import "{{name}}" (ADR-002: core is framework-free).',
      domGlobal:
        'core must not read the DOM global "{{name}}" at module scope (ADR-002: side-effect free).',
    },
  },
  create(context) {
    const checkSource = (/** @type {any} */ node) => {
      const name = sourceOf(node);
      if (name && FRAMEWORK_SPECIFIER.test(name)) {
        context.report({ node, messageId: 'framework', data: { name } });
      }
    };
    /** @type {Record<string, (node: any) => void>} */
    const visitors = {};
    for (const selector of SOURCE_SELECTORS) visitors[selector] = checkSource;

    visitors['Program:exit'] = () => {
      const sourceCode = context.sourceCode;
      const globalScope = sourceCode.scopeManager?.globalScope;
      if (!globalScope) return;
      for (const ref of globalScope.through) {
        const name = ref.identifier.name;
        // typescript-eslint marks type-only references; plain ESLint scope refs have no such flag.
        if (!DOM_GLOBALS.has(name) || /** @type {any} */ (ref).isValueReference === false) continue;
        // Module scope = the reference is not inside any function.
        let scope = ref.from;
        let insideFunction = false;
        while (scope) {
          if (scope.type === 'function') {
            insideFunction = true;
            break;
          }
          scope = /** @type {any} */ (scope.upper);
        }
        if (insideFunction) continue;
        const parent = /** @type {any} */ (ref.identifier).parent;
        if (parent && parent.type === 'UnaryExpression' && parent.operator === 'typeof') continue;
        context.report({ node: ref.identifier, messageId: 'domGlobal', data: { name } });
      }
    };
    return visitors;
  },
};
