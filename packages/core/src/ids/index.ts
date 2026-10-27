// Deterministic ids (ADR-003 "SSR-safe ids"). Pure functions: no counters, random, time,
// mount order or array indexes. The same inputs always give the same ids.

const SAFE_KEY = /[^A-Za-z0-9_-]/g;
const hex = (ch: string) => ch.codePointAt(0)!.toString(16);

/**
 * Injective, whitespace-free encoding of a consumer item key. Every character outside
 * `[A-Za-z0-9_-]` becomes `~<hex code point>~`, so distinct keys never collide and the
 * result is a valid raw IDREF token.
 */
export function encodeKey(key: string | number): string {
  return String(key).replace(SAFE_KEY, (c) => `~${hex(c)}~`);
}

/**
 * The base id of one component instance. An explicit consumer id wins; otherwise the
 * adapter's acquirer (`useId`, Vue 3.5 `useId`, or the runtime `idFactory`) is called once
 * and the root `idPrefix` is prepended. Pass `prefix: ''` when the framework already
 * applies it (React `identifierPrefix`).
 */
export function baseId(
  explicit: string | undefined,
  acquire: () => string,
  prefix: string = '',
): string {
  return explicit || prefix + acquire();
}

/** Anatomy id: `<base>-label`, `<base>-hint`, `<base>-error`, `<base>-trigger`, `<base>-panel`. */
export function partId(base: string, part: string): string {
  return `${base}-${part}`;
}

/**
 * Item id derived from the stable consumer key, never from a filtered/sorted position.
 * Keys are compared as strings: `itemId(b, 1)` and `itemId(b, '1')` are the same id, so a
 * collection must not hold both the number and its string form.
 */
export function itemId(base: string, key: string | number): string {
  return `${base}-item-${encodeKey(key)}`;
}

/**
 * Name safe for `anchor-name` / `view-transition-name`: a `<dashed-ident>` built from an id.
 * Raw ids (useId yields `:r1:`) stay raw for IDREF attributes; only this map is sanitized.
 * Injective: `_` and every non `[A-Za-z0-9-]` character become `_<hex>_`.
 */
export function safeName(id: string): string {
  return `--${id.replace(/[^A-Za-z0-9-]/g, (c) => `_${hex(c)}_`)}`;
}

/** Raw id -> sanitized name for a set of ids; order of `ids` does not affect any entry. */
export function sanitizedMap(ids: Iterable<string>): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const id of ids) map.set(id, safeName(id));
  return map;
}

/** Pure implementation of `CSS.escape` (CSSOM), usable without a DOM (SSR, tests). */
export function cssEscape(value: string): string {
  let out = '';
  const n = value.length;
  for (let i = 0; i < n; i++) {
    const c = value.charCodeAt(i);
    if (c === 0) out += '�';
    else if (
      (c >= 0x1 && c <= 0x1f) ||
      c === 0x7f ||
      (i === 0 && c >= 0x30 && c <= 0x39) ||
      (i === 1 && c >= 0x30 && c <= 0x39 && value.charCodeAt(0) === 0x2d)
    )
      out += `\\${c.toString(16)} `;
    else if (i === 0 && n === 1 && c === 0x2d) out += `\\${value[i]}`;
    else if (
      c >= 0x80 ||
      c === 0x2d ||
      c === 0x5f ||
      (c >= 0x30 && c <= 0x39) ||
      (c >= 0x41 && c <= 0x5a) ||
      (c >= 0x61 && c <= 0x7a)
    )
      out += value[i];
    else out += `\\${value[i]}`;
  }
  return out;
}

/** `#id` selector for a raw id. */
export function idSelector(id: string): string {
  return `#${cssEscape(id)}`;
}
