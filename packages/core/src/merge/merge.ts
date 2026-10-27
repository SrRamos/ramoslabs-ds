// Dev flag convention (see K2-NOTES.md): the guard is written inline at each use site. It cannot throw
// without a `process` global and folds away under a `process.env.NODE_ENV` define. A shared constant or
// helper does NOT fold in esbuild (the dead block survives), so do not extract it.
declare const process: { env: { NODE_ENV?: string } } | undefined;

/**
 * Prop merge (ADR-004 "One merge utility"). Pure, framework-agnostic, no module state.
 *
 * Precedence, per rule:
 * - Library-owned attributes win: `role`, `id`, every `aria-*` key the library sets (state-derived
 *   values and IDREFs), the IDREF attributes in `IDREF_KEYS`, plus any key in `options.protect`.
 *   A key the library sets to `undefined` still wins and removes the consumer value.
 * - `class`/`className` concatenate (library first, consumer last); `style` merges
 *   (objects: consumer wins per property; strings: joined with `;`).
 * - `on[A-Z]*` handlers run consumer first, then library; the library handler is skipped when the
 *   consumer left `event.defaultPrevented` true.
 * - Every other key: consumer wins over the library default.
 * Development builds warn when a consumer value for a library-owned key is discarded.
 */

export type Props = Record<string, unknown>;

export interface MergeOptions {
  /** Extra library-owned keys (for example `tabIndex`, `data-state`). */
  readonly protect?: readonly string[];
  /** Part name used in dev warnings. */
  readonly part?: string;
  /** Dev-warning sink; defaults to `console.warn`. */
  readonly warn?: (message: string) => void;
}

/** Non-`aria-*` attributes whose value is an element id reference (library-owned when set). */
export const IDREF_KEYS: readonly string[] = [
  'for',
  'htmlFor',
  'form',
  'list',
  'headers',
  'popovertarget',
  'popoverTarget',
  'anchor',
];

declare const console: { warn(message: string): void };

const isHandlerKey = (key: string): boolean => {
  const c = key.charCodeAt(2);
  return key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && c >= 65 && c <= 90;
};

const isOwned = (key: string, protect: readonly string[] | undefined): boolean =>
  key === 'role' ||
  key === 'id' ||
  key.startsWith('aria-') ||
  IDREF_KEYS.includes(key) ||
  (protect !== undefined && protect.includes(key));

const joinClass = (library: unknown, consumer: unknown): unknown => {
  const parts = [library, consumer].filter((v) => typeof v === 'string' && v !== '');
  return parts.length === 0 ? (consumer ?? library) : parts.join(' ');
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const mergeStyle = (library: unknown, consumer: unknown): unknown => {
  if (library === undefined || library === null || library === '') return consumer;
  if (consumer === undefined || consumer === null || consumer === '') return library;
  if (isObject(library) && isObject(consumer)) return { ...library, ...consumer };
  if (typeof library === 'string' && typeof consumer === 'string') {
    return `${library.replace(/;\s*$/, '')};${consumer}`;
  }
  return consumer; // mixed string/object cannot be combined without a CSS parser
};

type Handler = (event: { defaultPrevented?: boolean }, ...rest: unknown[]) => unknown;

const chain =
  (consumer: Handler, library: Handler): Handler =>
  (event, ...rest) => {
    consumer(event, ...rest);
    if (event?.defaultPrevented === true) return undefined;
    return library(event, ...rest);
  };

export function mergeProps(consumer: Props, library: Props, options?: MergeOptions): Props {
  const out: Props = {};
  const protect = options?.protect;
  const dropped: string[] = [];

  for (const key of Object.keys(consumer)) {
    if (key === '__proto__') continue;
    const value = consumer[key];
    if (isOwned(key, protect) && Object.hasOwn(library, key)) {
      if (
        (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') &&
        value !== undefined &&
        value !== library[key]
      ) {
        dropped.push(key);
      }
      continue;
    }
    out[key] = value;
  }

  for (const key of Object.keys(library)) {
    if (key === '__proto__') continue;
    const lib = library[key];
    if (isOwned(key, protect)) {
      out[key] = lib;
    } else if (key === 'class' || key === 'className') {
      out[key] = joinClass(lib, consumer[key]);
    } else if (key === 'style') {
      out[key] = mergeStyle(lib, consumer[key]);
    } else if (isHandlerKey(key) && typeof lib === 'function') {
      const own = consumer[key];
      // Vue allows `onClick: [a, b]`: run every consumer function in order, then the library one.
      const fns = (Array.isArray(own) ? own : [own]).filter(
        (f): f is Handler => typeof f === 'function',
      );
      out[key] =
        fns.length === 0
          ? lib
          : chain(
              fns.length === 1 ? fns[0]! : (e, ...rest) => void fns.forEach((f) => f(e, ...rest)),
              lib as Handler,
            );
    } else if (!Object.hasOwn(consumer, key) || consumer[key] === undefined) {
      out[key] = lib;
    }
  }

  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];

  if (
    (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') &&
    dropped.length > 0
  ) {
    const where = options?.part === undefined ? '' : ` on part "${options.part}"`;
    const message = `[ramoslabs] Ignored consumer props${where}: ${dropped.join(', ')}. role, id, IDREFs and state-derived aria-* are owned by the library (ADR-004).`;
    (options?.warn ?? ((m: string) => console.warn(m)))(message);
  }
  return out;
}
