// `supports` paths (W1-309b, ADR-013 L6). Engine feature detection is an injected `supports` map
// (core runtime, ADR-003), so each fallback-bearing component runs once with REAL detection (path
// `native`) and once per capability forced false (path `fallback:<key>`), on every adapter. The
// path is recorded in the test title, so forced-false runs are distinct rows of the parity matrix.
import { SUPPORT_KEYS, type SupportKey, type SupportsMap } from '../../../core/src/runtime/index';

export { SUPPORT_KEYS };
export type { SupportKey, SupportsMap };

export const NATIVE = 'native';
export const FALLBACK_PREFIX = 'fallback:';
/** The floor path: every capability forced false at once (ADR-013 floor-like combination). */
export const ALL = 'all';

/** `native` or `fallback:<key>`. */
export type PathId =
  typeof NATIVE | `fallback:${SupportKey}` | `${typeof FALLBACK_PREFIX}${typeof ALL}`;

export interface SupportsPath {
  readonly id: PathId;
  /** Capabilities forced to false on this path (empty for `native`). */
  readonly forced: readonly SupportKey[];
}

/** The path list: real detection, one forced-false path per capability key, then `fallback:all`. */
export function supportsPaths(keys: readonly SupportKey[] = SUPPORT_KEYS): SupportsPath[] {
  return [
    { id: NATIVE, forced: [] },
    ...keys.map((k): SupportsPath => ({ id: `${FALLBACK_PREFIX}${k}`, forced: [k] })),
    { id: `${FALLBACK_PREFIX}${ALL}`, forced: [...keys] },
  ];
}

/** Parses a path id back to a path; unknown ids and unknown keys are an error, never a guess. */
export function parsePath(id: string): SupportsPath {
  if (id === NATIVE) return { id: NATIVE, forced: [] };
  if (id === `${FALLBACK_PREFIX}${ALL}`) return { id: id as PathId, forced: [...SUPPORT_KEYS] };
  if (id.startsWith(FALLBACK_PREFIX)) {
    const key = id.slice(FALLBACK_PREFIX.length);
    if ((SUPPORT_KEYS as readonly string[]).includes(key))
      return { id: id as PathId, forced: [key as SupportKey] };
  }
  throw new Error(`unknown supports path "${id}"`);
}

/** The effective map for a path: real detection with the path's capabilities forced to false. */
export function applyPath(real: SupportsMap, path: SupportsPath): SupportsMap {
  const forced = Object.fromEntries(path.forced.map((k) => [k, false]));
  return Object.freeze({ ...real, ...forced }) as SupportsMap;
}

/**
 * A forced-false path whose capability the engine already lacks is identical to `native` on that
 * engine. It still runs (the row stays distinct and the injection is still proven) but is flagged,
 * so nobody reads it as extra coverage.
 */
export function isNoop(real: SupportsMap, path: SupportsPath): boolean {
  return path.forced.every((k) => real[k] === false);
}
