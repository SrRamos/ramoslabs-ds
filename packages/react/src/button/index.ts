// SJButton for React (W1-C01.d). The golden React adapter: later components copy this layout.
//   SJButton.Root / SJButton.Icon (ADR-002 namespace) + flat SJButtonRoot / SJButtonIcon.
//   `SJButton` is the prop-driven preset and is built ONLY from the two public primitives (ADR-004).
// Stateless (docs/implementation/C01-NOTES.md): no useMachine, no store, no effect, no listener of our own.
// A fresh `createButton` per render closes over THIS render's props; the click handler React attached in
// the commit reads those same props, so there is no ref and no stale read. Nothing to dispose.
import { createElement, forwardRef } from 'react';
import type {
  ForwardRefExoticComponent,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  SyntheticEvent,
} from 'react';
import { createButton } from '@ramoslabs/core/button';
import type { Props } from '@ramoslabs/core/merge';
import type { SJButtonProps as GeneratedProps } from '../generated/button/types';

export type { SJButtonPressPayload } from '../generated/button/types';

/** Per-part class overrides, appended after the library class (ADR-004 `classes`). */
export interface SJButtonClasses {
  root?: string;
  link?: string;
  icon?: string;
}

type Native = Omit<HTMLAttributes<HTMLElement>, 'children' | 'id' | 'onClick'> & {
  onClick?: (event: SyntheticEvent) => void;
};

/** Props of `SJButton.Root`: contract props plus any native attribute, spread onto the real element. */
export type SJButtonRootProps = Omit<GeneratedProps, 'children' | 'icon'> &
  Native & {
    /** Root renders `<a>` for a non-empty `href`, so `classes.link` applies then. */
    classes?: Pick<SJButtonClasses, 'root' | 'link'>;
    children?: ReactNode;
  };

export type SJButtonIconProps = HTMLAttributes<HTMLSpanElement>;

/** Props of the `SJButton` preset: Root props plus the `icon` prop-or-slot (ADR-004). */
export type SJButtonProps = Omit<SJButtonRootProps, 'classes'> & {
  classes?: SJButtonClasses;
  /** Decorative icon (aria-hidden). Also accepted as the only child of an `iconOnly` button. */
  icon?: ReactNode;
};

const CONTRACT_KEYS = [
  'variant',
  'tone',
  'size',
  'disabled',
  'type',
  'href',
  'target',
  'rel',
  'iconOnly',
  'label',
  'id',
  'onPress',
  'classes',
  'className',
  'children',
] as const;

/** Convert a getter bag (`class`) to React props (`className`). */
function toReact(bag: Props): Record<string, unknown> {
  const { class: cls, ...rest } = bag;
  return cls === undefined ? rest : { ...rest, className: cls };
}

export const SJButtonRoot: ForwardRefExoticComponent<
  SJButtonRootProps & RefAttributes<HTMLElement>
> = forwardRef(function SJButtonRoot(
  props: SJButtonRootProps,
  ref: Ref<HTMLElement>,
): ReactElement {
  const { classes, className, children, onPress } = props;
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(props))
    if (!(CONTRACT_KEYS as readonly string[]).includes(key))
      rest[key] = (props as Record<string, unknown>)[key];

  const button = createButton(() => ({
    ...props,
    // The contract promises the native DOM event; React hands out a SyntheticEvent.
    onPress: onPress
      ? ({ originalEvent }) =>
          onPress({
            originalEvent:
              (originalEvent as SyntheticEvent).nativeEvent ?? (originalEvent as Event),
          })
      : undefined,
  }));
  const isLink = button.element() === 'a';
  const own = isLink ? classes?.link : classes?.root;
  const consumer: Props = {
    ...rest,
    ...((own || className) && { class: [own, className].filter(Boolean).join(' ') }),
  };
  const bag = toReact(isLink ? button.getLinkProps(consumer) : button.getRootProps(consumer));
  return createElement(isLink ? 'a' : 'button', { ...bag, ref }, children);
});

export const SJButtonIcon: ForwardRefExoticComponent<
  SJButtonIconProps & RefAttributes<HTMLSpanElement>
> = forwardRef(function SJButtonIcon(
  props: SJButtonIconProps,
  ref: Ref<HTMLSpanElement>,
): ReactElement {
  const { className, children, ...rest } = props;
  const bag = createButton(() => ({})).getIconProps({
    ...rest,
    ...(className && { class: className }),
  });
  return createElement('span', { ...toReact(bag), ref }, children);
});

const SJButtonPreset = forwardRef(function SJButton(
  props: SJButtonProps,
  ref: Ref<HTMLElement>,
): ReactElement {
  const { icon, classes, children, iconOnly, ...rest } = props;
  // Prop-or-slot: `icon` prop, or (iconOnly) the single child is the icon.
  const iconNode = icon ?? (iconOnly ? children : undefined);
  const text = iconOnly ? undefined : children;
  return createElement(
    SJButtonRoot,
    { ...rest, iconOnly, classes, ref },
    iconNode !== undefined && iconNode !== null && iconNode !== false
      ? createElement(SJButtonIcon, { className: classes?.icon }, iconNode)
      : null,
    text,
  );
});

/** `SJButton` is the preset; `SJButton.Root` and `SJButton.Icon` are the primitives (ADR-002). */
export const SJButton: typeof SJButtonPreset & {
  Root: typeof SJButtonRoot;
  Icon: typeof SJButtonIcon;
} = Object.assign(SJButtonPreset, { Root: SJButtonRoot, Icon: SJButtonIcon });
