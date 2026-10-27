// Real capability detection for the ten `supports` keys (W1-309b). Core never reads the
// environment (ADR-003); detection lives with the adapters, after mount. This module is the
// harness's detector: it takes the global object as a parameter so every branch is unit-testable
// with a fake, and so a throwing probe degrades to `false` instead of breaking the page.
import { SUPPORT_KEYS, type SupportKey, type SupportsMap } from './paths';

/** The slice of `window` the detector reads. All optional: a missing API means "not supported". */
export interface DetectEnv {
  CSS?: { supports(condition: string): boolean };
  HTMLElement?: { prototype: object };
  HTMLDialogElement?: { prototype: object };
  HTMLButtonElement?: { prototype: object };
  HTMLDetailsElement?: { prototype: object };
  document?: object;
  scheduler?: object;
  Intl?: { Locale?: { prototype: object } };
}

const has = (ctor: { prototype: object } | undefined, prop: string): boolean =>
  ctor !== undefined && prop in ctor.prototype;

const css = (env: DetectEnv, condition: string): boolean =>
  typeof env.CSS?.supports === 'function' && env.CSS.supports(condition);

const DETECTORS: Record<SupportKey, (env: DetectEnv) => boolean> = {
  anchorPositioning: (e) => css(e, 'anchor-name: --a') && css(e, 'position-anchor: --a'),
  popover: (e) => has(e.HTMLElement, 'popover'),
  dialogRequestClose: (e) => has(e.HTMLDialogElement, 'requestClose'),
  invokerCommands: (e) => has(e.HTMLButtonElement, 'commandForElement'),
  detailsName: (e) => has(e.HTMLDetailsElement, 'name'),
  userInvalid: (e) => css(e, 'selector(:user-invalid)'),
  viewTransitions: (e) =>
    typeof (e.document as { startViewTransition?: unknown } | undefined)?.startViewTransition ===
    'function',
  schedulerYield: (e) =>
    typeof (e.scheduler as { yield?: unknown } | undefined)?.yield === 'function',
  weekInfo: (e) => has(e.Intl?.Locale, 'getWeekInfo') || has(e.Intl?.Locale, 'weekInfo'),
  focusVisible: (e) => css(e, 'selector(:focus-visible)'),
};

/** Real detection of all ten keys. Never throws; a probe that throws counts as unsupported. */
export function detectSupports(env: DetectEnv): SupportsMap {
  const out = {} as Record<SupportKey, boolean>;
  for (const k of SUPPORT_KEYS) {
    try {
      out[k] = DETECTORS[k](env);
    } catch {
      out[k] = false;
    }
  }
  return Object.freeze(out);
}
