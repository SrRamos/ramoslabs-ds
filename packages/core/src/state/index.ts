// SJState core (W1-C11.a, ADR-006 "Live regions"). Pure getters over props; no DOM, no registry.
//   getRootProps / getIconProps / getTitleProps / getDescriptionProps / getActionsProps(consumer?)
//   getAnnouncement()   { text, urgent } the adapter passes to the live registry AFTER mount, or
//                       undefined. Nothing here renders live markup, so SSR output has none.
// The three empty kinds are distinct variants (first-use, no-results, cleared); loading and error
// complete the set. Polite `status` carries loading and counts; `alert` is reserved for an error
// that interrupts the current task (`interrupt`). Meaning is never carried by color or the icon alone.
import { mergeProps } from '../merge/index';
import type { Props } from '../merge/index';

declare const console: { warn(message: string): void };
declare const process: { env: { NODE_ENV?: string } } | undefined;

export type StateVariant = 'first-use' | 'no-results' | 'cleared' | 'loading' | 'error';

export interface StateProps {
  readonly variant?: StateVariant;
  readonly heading?: string;
  readonly description?: string;
  /** Text for the live registry. Defaults to `heading` for loading, no-results and error. */
  readonly announce?: string;
  /** Only an error may interrupt (`alert`); every other message is a polite `status`. */
  readonly interrupt?: boolean;
}

export interface StateAnnouncement {
  readonly text: string;
  /** Pass as `AnnounceOptions.urgent`: true selects `role="alert"`. */
  readonly urgent: boolean;
}

export interface State {
  readonly getRootProps: (consumer?: Props) => Props;
  readonly getIconProps: (consumer?: Props) => Props;
  readonly getTitleProps: (consumer?: Props) => Props;
  readonly getDescriptionProps: (consumer?: Props) => Props;
  readonly getActionsProps: (consumer?: Props) => Props;
  readonly getAnnouncement: () => StateAnnouncement | undefined;
}

// Unknown variants fall back to first-use (onboarding), never to a "done" or "no results" message
// for a resource that may never have had data.
const variantOf = (v: unknown): StateVariant =>
  /^(no-results|cleared|loading|error)$/.test(v as string) ? (v as StateVariant) : 'first-use';

export function createState(getProps: () => StateProps): State {
  const w = (bad: unknown, m: string) =>
    bad &&
    (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') &&
    console.warn(`[ramoslabs] SJState ${m}`);

  const part = (name: string, extra: Props = {}) => {
    return (consumer: Props = {}): Props => {
      const own: Props = {
        'data-part': name,
        'data-variant': variantOf(getProps().variant),
        ...extra,
      };
      return mergeProps(
        consumer,
        { class: `sj-state__${name}`, ...own },
        { protect: Object.keys(own) },
      );
    };
  };

  return {
    getRootProps(consumer = {}) {
      const p = getProps();
      const variant = variantOf(p.variant);
      w(p.variant !== undefined && variant !== p.variant, `unknown variant "${p.variant}"`);
      w(
        ['role', 'aria-live', 'aria-atomic'].some((k) => k in consumer),
        'live markup belongs to the live registry, not the root',
      );
      const own: Props = {
        'data-part': 'root',
        'data-variant': variant,
        'aria-busy': variant === 'loading' ? 'true' : undefined,
        // No live markup at render time (SSR-safe); a consumer role or aria-live is deleted.
        role: undefined,
        'aria-live': undefined,
        'aria-atomic': undefined,
      };
      return mergeProps(consumer, { class: 'sj-state', ...own }, { protect: Object.keys(own) });
    },
    getIconProps: (consumer) => part('icon', { 'aria-hidden': 'true' })(consumer),
    getTitleProps: (consumer) => part('title')(consumer),
    getDescriptionProps: (consumer) => part('description')(consumer),
    getActionsProps: (consumer) => part('actions')(consumer),
    getAnnouncement() {
      const p = getProps();
      const variant = variantOf(p.variant);
      const text =
        `${p.announce ?? (/^(no-results|loading|error)$/.test(variant) ? (p.heading ?? '') : '')}`.trim();
      return text ? { text, urgent: variant === 'error' && p.interrupt === true } : undefined;
    },
  };
}
