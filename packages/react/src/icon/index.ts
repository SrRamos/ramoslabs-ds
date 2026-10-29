// SJIcon for React (W1-C12.d). Stateless like SJButton: a fresh `createIcon` per render closes over THIS
// render's props, no useMachine, no store, no listener. Works outside SJProvider.
//   SJIcon.Root + flat SJIconRoot (ADR-002); `SJIcon` is the preset built only from the primitive.
// The adapter never imports `@ramoslabs/icons` (ADR-016 boundary): consumers pass IconData via `icon`.
// The `<svg>` and its children are created elements (never innerHTML); child nodes carry no ids.
import { createElement, forwardRef, useEffect, useRef } from 'react';
import type {
  ForwardRefExoticComponent,
  ReactElement,
  Ref,
  RefAttributes,
  SVGAttributes,
} from 'react';
import { createIcon } from '@ramoslabs/core/icon';
import type { Props } from '@ramoslabs/core/merge';
import { useOptionalRuntime } from '../runtime/index';
import type { SJIconProps as GeneratedProps } from '../generated/icon/types';

declare const console: { warn(message: string): void };
declare const process: { env: { NODE_ENV?: string } } | undefined;

/** Per-part class overrides, appended after the library class (ADR-004 `classes`). */
export interface SJIconClasses {
  root?: string;
}

/** Props of `SJIcon`: contract props plus any native SVG attribute, spread onto the `<svg>`. */
export type SJIconRootProps = GeneratedProps &
  Omit<SVGAttributes<SVGSVGElement>, 'children' | 'className' | 'dangerouslySetInnerHTML'> & {
    className?: string;
    classes?: SJIconClasses;
  };
export type SJIconProps = SJIconRootProps;

const CONTRACT_KEYS = ['icon', 'size', 'label', 'dir', 'classes', 'className'];

/** `stroke-width` -> `strokeWidth`, `class` -> `className`; `aria-*` and `data-*` keep their spelling. */
function reactName(name: string): string {
  return name === 'class'
    ? 'className'
    : /^(aria|data)-/.test(name)
      ? name
      : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export const SJIconRoot: ForwardRefExoticComponent<SJIconRootProps & RefAttributes<SVGSVGElement>> =
  forwardRef(function SJIconRoot(props: SJIconRootProps, ref: Ref<SVGSVGElement>): ReactElement {
    const { icon, classes, className } = props;
    // Hooks run unconditionally; the runtime is read only for a mirrored icon without a `dir` prop.
    const runtime = useOptionalRuntime();
    const needsDir = !!icon?.mirror && props.dir === undefined;
    const dir = props.dir ?? (needsDir ? runtime?.dir : undefined);
    const warned = useRef(false);
    const orphan = needsDir && !runtime;
    useEffect(() => {
      if (
        orphan &&
        !warned.current &&
        (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
      ) {
        warned.current = true;
        console.warn('[ramoslabs] SJIcon mirrored icon outside SJProvider renders ltr; pass `dir`');
      }
    }, [orphan]);

    const rest: Props = {};
    for (const key of Object.keys(props))
      if (!CONTRACT_KEYS.includes(key))
        rest[key] = (props as unknown as Record<string, unknown>)[key];
    const own = [classes?.root, className].filter(Boolean).join(' ');
    if (own) rest.class = own;

    const model = createIcon(() => ({ icon, size: props.size, label: props.label, dir }));
    const bag: Record<string, unknown> = { ref };
    const root = model.getRootProps(rest);
    for (const key of Object.keys(root)) bag[reactName(key)] = root[key];

    const children = model.getNodes().map(([tag, attrs], i) => {
      const el: Record<string, unknown> = { key: i };
      for (const key of Object.keys(attrs)) el[reactName(key)] = attrs[key];
      return createElement(tag, el);
    });
    return createElement('svg', bag, ...children);
  });

const SJIconPreset = forwardRef(function SJIcon(
  props: SJIconProps,
  ref: Ref<SVGSVGElement>,
): ReactElement {
  return createElement(SJIconRoot, { ...props, ref });
});

/** `SJIcon` is the preset; `SJIcon.Root` is the primitive (ADR-002). */
export const SJIcon: typeof SJIconPreset & { Root: typeof SJIconRoot } = Object.assign(
  SJIconPreset,
  { Root: SJIconRoot },
);
