// SJForm for React (W1-C02.d). Context plumbing on a native `<form>` (ADR-014): the form owner
// (`createForm`) supplies the Enter position (`enterkeyhint`, from field order) and the retained values
// (WCAG 3.3.7) to the SJField/SJInput below it. No validation orchestration, no submission handling, no
// handlers on the element. The owner is created once per instance; it is a pure store, so StrictMode's
// double render creates at worst one discarded owner and the mount/unmount cycle leaves nothing behind
// (fields unregister in their own effect cleanup). Nothing here reads `document`.
import {
  createContext,
  createElement,
  forwardRef,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type Context,
  type ReactNode,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';
import { createForm, type FormOwner, type FormProps } from '@ramoslabs/core/form';
import type { Props } from '@ramoslabs/core/merge';
import type { SJFormProps as GeneratedProps } from '../generated/form/index';

export type { SJFormProps as SJFormContractProps } from '../generated/form/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJFormClasses {
  root?: string;
}

/**
 * Native `<form>` attributes, except `action`: the contract owns that name (Enter label of the last
 * field), so the native submission URL/function is not a prop of SJForm. Use `onSubmit`.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'form'>, 'children' | 'action'>;

export interface SJFormRootProps extends RootAttrs, Omit<GeneratedProps, 'children'> {
  classes?: SJFormClasses;
  /** Slot: the fields and the submit control. */
  children?: ReactNode;
}

/** What a field below reads: the stable owner plus a signature that changes when the form props do. */
export interface FormContextValue {
  readonly owner: FormOwner;
  readonly signature: string;
}
export const SJFormContext: Context<FormContextValue | null> =
  createContext<FormContextValue | null>(null);

const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const { class: cls, ...rest } = p as { class?: string } & Record<string, unknown>;
  const className = [cls, extra].filter(Boolean).join(' ');
  return className ? { ...rest, className } : rest;
};

export const SJFormRoot: ForwardRefExoticComponent<
  SJFormRootProps & RefAttributes<HTMLFormElement>
> = forwardRef<HTMLFormElement, SJFormRootProps>(function SJFormRoot(props, ref) {
  const { fields, action, submits, autoSubmit, classes, children, ...rest } = props;
  const latest = useRef<FormProps>({});
  latest.current = {
    ...(fields !== undefined && { fields }),
    ...(action !== undefined && { action }),
    ...(submits !== undefined && { submits }),
    ...(autoSubmit !== undefined && { autoSubmit }),
  };
  const owner = useRef<FormOwner | null>(null);
  owner.current ??= createForm(() => latest.current);
  const current = owner.current;
  // Fields below must re-render when the order or the kinds change; the owner itself is stable.
  const signature = JSON.stringify([
    fields ?? null,
    action ?? null,
    submits ?? null,
    autoSubmit ?? null,
  ]);
  const value = useMemo<FormContextValue>(
    () => ({ owner: current, signature }),
    [current, signature],
  );
  return createElement(
    SJFormContext.Provider,
    { value },
    createElement(
      'form',
      { ...fromGetter(current.getRootProps(toGetter(rest)), classes?.root), ref },
      children,
    ),
  );
});

/** `SJForm` is the component; `SJForm.Root` is the same primitive (ADR-002). */
export const SJForm: typeof SJFormRoot & { Root: typeof SJFormRoot } = Object.assign(
  forwardRef<HTMLFormElement, SJFormRootProps>(function SJForm(props, ref) {
    return createElement(SJFormRoot, { ...props, ref });
  }),
  { Root: SJFormRoot },
);
