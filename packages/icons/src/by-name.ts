import { aliases, icons } from './generated/all.js';
import type { IconData } from './types.js';

declare const process: { env: { NODE_ENV?: string } } | undefined;
declare const console: { warn(message: string): void };

export type { IconData } from './types.js';
export { aliases, icons };

/**
 * Resolve an icon by name, canonical or legacy alias. Pure lookup over the WHOLE set, so importing
 * this module is not tree-shakeable (use the per-icon imports for production bundles). Returns
 * `undefined` for an unknown name. A legacy alias warns in development, naming the canonical form.
 */
export function getIcon(name: string): IconData | undefined {
  if (Object.hasOwn(icons, name)) return icons[name];
  if (Object.hasOwn(aliases, name)) {
    const canonical = aliases[name] as string;
    if (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') {
      console.warn(`[ramoslabs/icons] "${name}" is a legacy alias, use "${canonical}".`);
    }
    return icons[canonical];
  }
  return undefined;
}
