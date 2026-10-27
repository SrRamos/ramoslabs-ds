// @ts-check
// Shared helpers for the boundary rules (ADR-002 consequences, ADR-003, ADR-004, ADR-011).

/** Module specifiers that identify a UI framework. */
export const FRAMEWORK_SPECIFIER =
  /^(vue|react|react-dom|react\/.*|react-dom\/.*|@vue\/.*|vue\/.*|preact|svelte|@angular\/.*)$/;

/** DOM and browser globals that must not be read at module scope in core. */
export const DOM_GLOBALS = new Set([
  'document',
  'window',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'screen',
  'self',
  'CSS',
  'Node',
  'Element',
  'HTMLElement',
  'ShadowRoot',
  'Document',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'PointerEvent',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'getComputedStyle',
  'customElements',
  'visualViewport',
]);

/**
 * Normalise a file path to forward slashes.
 * @param {string} p
 */
export const norm = (p) => p.replace(/\\/g, '/');

/**
 * Collect every module specifier of a Program: static imports, re-exports, dynamic import() and
 * require() calls are handled by the individual rules through these selectors.
 */
export const SOURCE_SELECTORS = [
  'ImportDeclaration',
  'ExportAllDeclaration',
  'ExportNamedDeclaration[source]',
  'ImportExpression',
];

/**
 * Read the string value of an import source node, if it is a static string.
 * @param {any} node
 * @returns {string | null}
 */
export function sourceOf(node) {
  const src = node.source;
  if (src && src.type === 'Literal' && typeof src.value === 'string') return src.value;
  return null;
}
