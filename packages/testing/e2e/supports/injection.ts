// Injection check (W1-309b): what the adapter's runtime exposes must equal real detection with
// the path's capabilities forced false. Pure, so it is unit-tested with seeded wrong maps.
import { SUPPORT_KEYS, applyPath, type SupportsMap, type SupportsPath } from './paths';

export function injectionProblems(
  real: SupportsMap,
  seen: SupportsMap | null,
  path: SupportsPath,
): string[] {
  if (seen === null) return ['adapter runtime was never read back'];
  const want = applyPath(real, path);
  const out: string[] = [];
  const extra = Object.keys(seen).filter((k) => !(SUPPORT_KEYS as readonly string[]).includes(k));
  if (extra.length > 0) out.push(`unexpected keys: ${extra.join(', ')}`);
  for (const k of SUPPORT_KEYS)
    if (seen[k] !== want[k])
      out.push(
        `${k}: runtime has ${String(seen[k])}, path "${path.id}" requires ${String(want[k])} (real ${String(real[k])})`,
      );
  return out;
}
