// SJButton core (W1-C01.a). The golden component: every later `.a` copies this layout.
//   reducer.ts  pure state machine + `reducerEvents` (codegen/harness convention)
//   index.ts    prop getters per anatomy part, built on `mergeProps` (ADR-004). Pure, no module state.
// Frozen API: docs/implementation/C01-NOTES.md "Getters API (frozen)".
import { mergeProps } from '../merge/index';
import type { Props } from '../merge/index';

export { reduce, reducerEvents } from './reducer';

declare const console: { warn(message: string): void };
declare const process: { env: { NODE_ENV?: string } } | undefined;

/** The `variant x tone x size` axes (ADR-009); the vocabulary the contrast matrix proves. */
export const buttonVariants = ['solid', 'soft', 'outline', 'ghost'] as const;
export const buttonTones = ['primary', 'neutral', 'success', 'warning', 'error', 'info'] as const;
export const buttonSizes = ['sm', 'md', 'lg'] as const;
export type ButtonVariant = (typeof buttonVariants)[number];
export type ButtonTone = (typeof buttonTones)[number];
export type ButtonSize = (typeof buttonSizes)[number];

/** The slice of a DOM event the handlers touch; adapters pass the real `Event`. */
export interface ButtonEventLike {
  preventDefault?(): void;
}

export interface ButtonPressPayload {
  readonly originalEvent: ButtonEventLike;
}

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly tone?: ButtonTone;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  /** `<button type>`; default `button` (never an implicit submit). Ignored for the link element. */
  readonly type?: 'button' | 'submit' | 'reset';
  /** A non-empty `href` selects the link element (`<a>`): navigation is a link, not a button. */
  readonly href?: string;
  readonly target?: string;
  readonly rel?: string;
  /** No visible text. Requires `label` (or a consumer `aria-label` / `aria-labelledby`). */
  readonly iconOnly?: boolean;
  /** Accessible name (`aria-label`). For text buttons it must contain the visible text (2.5.3). */
  readonly label?: string;
  readonly id?: string;
  /** Injected by the adapter: Vue emits, React calls the prop, vanilla dispatches a CustomEvent. */
  readonly onPress?: (payload: ButtonPressPayload) => void;
}

export interface Button {
  /** `a` when `href` is a non-empty string, otherwise `button`. Choose the getter from this. */
  readonly element: () => 'button' | 'a';
  /** Attributes and handlers for the `root` part (`<button>`). */
  readonly getRootProps: (consumer?: Props) => Props;
  /** Attributes and handlers for the `link` part (`<a>`). */
  readonly getLinkProps: (consumer?: Props) => Props;
  /** The decorative `icon` part (`aria-hidden`). */
  readonly getIconProps: (consumer?: Props) => Props;
}

const pick = <T extends string>(list: readonly T[], value: T | undefined, fallback: T): T =>
  value !== undefined && list.includes(value) ? value : fallback;

/** Library-owned hooks and semantics a consumer spread cannot override (ADR-004, ADR-010). */
const PROTECT = [
  'disabled',
  'href',
  'type',
  'data-part',
  'data-variant',
  'data-tone',
  'data-size',
  'data-disabled',
  'data-icon-only',
];

/**
 * `getProps` is a stable accessor over the latest props, read on every call and again when an
 * event fires (ADR-003): the object holds no state, so there is nothing to destroy.
 */
export function createButton(getProps: () => ButtonProps): Button {
  const isLink = (p: ButtonProps) => typeof p.href === 'string' && p.href !== '';

  const shared = (p: ButtonProps, part: 'root' | 'link'): Props => {
    return {
      // Keys the library does not set stay absent: an owned key (`id`, `aria-*`) set to `undefined`
      // would delete the consumer's value in `mergeProps`.
      ...(p.id !== undefined && { id: p.id }),
      ...(p.label !== undefined && { 'aria-label': p.label }),
      class: `sj-button__${part}`,
      'data-part': part,
      'data-variant': pick(buttonVariants, p.variant, 'solid'),
      'data-tone': pick(buttonTones, p.tone, 'primary'),
      'data-size': pick(buttonSizes, p.size, 'md'),
      'data-disabled': p.disabled === true ? 'true' : undefined,
      'data-icon-only': p.iconOnly === true ? 'true' : undefined,
      onClick(event: ButtonEventLike) {
        const now = getProps();
        if (now.disabled === true) event.preventDefault?.();
        else now.onPress?.({ originalEvent: event });
      },
    };
  };

  const warnName = (p: ButtonProps, consumer: Props) => {
    if (
      (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') &&
      p.iconOnly === true &&
      !p.label &&
      !consumer['aria-label'] &&
      !consumer['aria-labelledby']
    )
      console.warn(
        '[ramoslabs] SJButton iconOnly has no accessible name: pass `label` (WCAG 4.1.2, contract/icon-only-name).',
      );
  };

  return {
    element: () => (isLink(getProps()) ? 'a' : 'button'),
    getRootProps(consumer = {}) {
      const p = getProps();
      warnName(p, consumer);
      return mergeProps(
        consumer,
        {
          ...shared(p, 'root'),
          type: pick(['button', 'submit', 'reset'], p.type, 'button'),
          disabled: p.disabled === true ? true : undefined,
        },
        { protect: PROTECT, part: 'root' },
      );
    },
    getLinkProps(consumer = {}) {
      const p = getProps();
      warnName(p, consumer);
      const off = p.disabled === true;
      return mergeProps(
        consumer,
        {
          ...shared(p, 'link'),
          // An enabled link keeps its native role. A disabled one drops `href` (a link without it is
          // not focusable or navigable) and states the role and the disabled state explicitly.
          ...(off && { role: 'link' }),
          'aria-disabled': off ? 'true' : undefined,
          href: off ? undefined : p.href,
          target: off ? undefined : p.target,
          rel: off
            ? undefined
            : (p.rel ?? (p.target === '_blank' ? 'noopener noreferrer' : undefined)),
        },
        { protect: PROTECT, part: 'link' },
      );
    },
    getIconProps(consumer = {}) {
      return mergeProps(
        consumer,
        { class: 'sj-button__icon', 'aria-hidden': 'true', 'data-part': 'icon' },
        { protect: PROTECT, part: 'icon' },
      );
    },
  };
}
