// @ts-check
import { SOURCE_SELECTORS, norm, sourceOf } from './shared.js';

/**
 * Rule 3 (ADR-002 / ADR-004): files under a `presets/` directory may import only public
 * primitives: a sibling preset, the `primitives` barrel or one primitive entry
 * (`../primitives` or `../primitives/<name>`), or a bare package specifier that is not a deep
 * `src`/`internal` path. Anything that reaches into `runtime`, `internal`, `src` or deeper
 * primitive files is an internal import.
 * @type {import('eslint').Rule.RuleModule}
 */
export const presetsPublicOnly = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      internal:
        'Presets may import only public primitives, not "{{name}}" (ADR-002: presets compose primitives).',
    },
  },
  create(context) {
    const isAllowed = (/** @type {string} */ name) => {
      if (!name.startsWith('.')) {
        // Bare specifiers: no deep paths into another package's source or internals.
        return !/(^|\/)(src|internal|runtime)(\/|$)/.test(name);
      }
      const spec = norm(name);
      if (/(^|\/)(internal|runtime|src)(\/|$)/.test(spec) && !/primitives\//.test(spec))
        return false;
      const afterPrimitives = spec.split(/(?:^|\/)primitives(?:\/|$)/);
      if (afterPrimitives.length === 2) {
        const rest = afterPrimitives[1];
        // `primitives` itself or exactly one segment below it.
        return rest === '' || /^[^/]+$/.test(rest) ? !/^(_|internal)/.test(rest) : false;
      }
      // Sibling preset (./foo) is fine; other relative paths are not.
      return /^\.\/[^/]+$/.test(spec);
    };
    const check = (/** @type {any} */ node) => {
      const name = sourceOf(node);
      if (name && !isAllowed(name)) {
        context.report({ node, messageId: 'internal', data: { name } });
      }
    };
    /** @type {Record<string, (node: any) => void>} */
    const visitors = {};
    for (const selector of SOURCE_SELECTORS) visitors[selector] = check;
    return visitors;
  },
};
