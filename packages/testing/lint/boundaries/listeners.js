// @ts-check

const POINTER_LIKE = /^(wheel|touch(start|move|end|cancel)|pointer[a-z]*)$/;

/**
 * @param {any} options
 * @param {string} key
 * @returns {any | null} the property value node, or null
 */
function optionValue(options, key) {
  if (!options || options.type !== 'ObjectExpression') return null;
  for (const prop of options.properties) {
    if (
      prop.type === 'Property' &&
      !prop.computed &&
      ((prop.key.type === 'Identifier' && prop.key.name === key) ||
        (prop.key.type === 'Literal' && prop.key.value === key))
    ) {
      return prop.value;
    }
  }
  return null;
}

/** @param {any} node */
function isAddEventListener(node) {
  const callee = node.callee;
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'addEventListener'
  );
}

/**
 * Rule 5 (ADR-003 vanilla runtime, ADR-011 observers disconnected): every `addEventListener` in
 * an adapter carries the instance AbortController signal in its options.
 * @type {import('eslint').Rule.RuleModule}
 */
export const listenerSignal = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      signal: 'addEventListener must pass the instance AbortController `signal` in its options.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isAddEventListener(node)) return;
        const options = node.arguments[2];
        if (!optionValue(options, 'signal')) context.report({ node, messageId: 'signal' });
      },
    };
  },
};

/**
 * Rule 6 (ADR-011 Rules: passive listeners): `wheel`, `touch*` and `pointer*` listeners must be
 * `passive: true`, or the inline handler must call `preventDefault()`. Applies to any package.
 * @type {import('eslint').Rule.RuleModule}
 */
export const passiveListeners = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      passive:
        '"{{type}}" listeners must be `passive: true` or call preventDefault() (ADR-011: passive non-canceling listeners).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isAddEventListener(node)) return;
        const [typeArg, handler, options] = node.arguments;
        if (!typeArg || typeArg.type !== 'Literal' || typeof typeArg.value !== 'string') return;
        const type = typeArg.value;
        if (!POINTER_LIKE.test(type)) return;
        const passive = optionValue(options, 'passive');
        if (passive && passive.type === 'Literal' && passive.value === true) return;
        const inline =
          handler &&
          (handler.type === 'ArrowFunctionExpression' || handler.type === 'FunctionExpression');
        if (inline && /\bpreventDefault\s*\(/.test(context.sourceCode.getText(handler))) return;
        context.report({ node, messageId: 'passive', data: { type } });
      },
    };
  },
};
