// @ts-check
import { SOURCE_SELECTORS, norm, sourceOf } from './shared.js';

/** `@ramoslabs/icons` and any subpath, or a relative path reaching into the icons package. */
const ICONS_SOURCE =
  /^@ramoslabs\/icons(\/|$)|(^|\/)packages\/icons(\/|$)|^(\.\.\/)+icons\/(src|dist)(\/|$)/;

/**
 * ADR-016: `@ramoslabs/core` and the framework adapters never import `@ramoslabs/icons`. Icon data
 * is passed in by the consumer, so there is no coupling and a team can bring its own icons.
 * @type {import('eslint').Rule.RuleModule}
 */
export const noIconsImport = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      icons:
        'Core and adapters must not import @ramoslabs/icons ("{{name}}"); consumers pass icon data in (ADR-016).',
    },
  },
  create(context) {
    const check = (/** @type {any} */ node) => {
      const name = sourceOf(node);
      if (name && ICONS_SOURCE.test(norm(name))) {
        context.report({ node, messageId: 'icons', data: { name } });
      }
    };
    /** @type {Record<string, (node: any) => void>} */
    const visitors = {};
    for (const selector of SOURCE_SELECTORS) visitors[selector] = check;
    visitors['CallExpression[callee.name="require"]'] = (node) => {
      const arg = node.arguments[0];
      if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
        if (ICONS_SOURCE.test(norm(arg.value))) {
          context.report({ node, messageId: 'icons', data: { name: arg.value } });
        }
      }
    };
    return visitors;
  },
};

/**
 * Manifest half of the boundary: none of the four packages lists `@ramoslabs/icons` as a
 * dependency of any runtime kind. Returns the offending field names.
 * @param {Record<string, any>} manifest parsed package.json
 * @returns {string[]}
 */
export function iconsManifestViolations(manifest) {
  return ['dependencies', 'peerDependencies', 'optionalDependencies']
    .filter((field) => manifest?.[field] && '@ramoslabs/icons' in manifest[field])
    .map((field) => `${manifest.name} lists @ramoslabs/icons under ${field}`);
}
