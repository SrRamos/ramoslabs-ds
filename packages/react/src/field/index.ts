// SJField for React (W1-C02.d, ADR-014). A visible label, an optional hint and an error around a control
// (SJInput), linked by deterministic ids `<id>-label`, `<id>-hint`, `<id>-error`. The control's
// `aria-describedby`/`aria-invalid` are derived by the core field (`getControlProps`), never typed.
// One `createField` per instance (it holds the announce de-duplication and the form registration), reading
// the latest props through a ref. The error is announced once through the shared live registry in a
// passive effect after the commit (client only; the server render emits no live markup), and a standing
// error at mount is silent. The live region is eager (`fieldLive`, derived from the contract).
// Prop-or-slot: `label` / `hint` props, or the `SJField.Label` / `SJField.Hint` parts (give one, not both;
// the hint part registers itself, no `hasHint` needed). `error` is prop-only: it is visible text and the single announcement source.
import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type Context,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { createField, type FieldParts, type FieldProps } from '@ramoslabs/core/field';
import type { FormField } from '@ramoslabs/core/form';
import { baseId } from '@ramoslabs/core/ids';
import type { Props } from '@ramoslabs/core/merge';
import { SJFormContext } from '../form/index';
import { SJIcon } from '../icon/index';
import { circleAlert } from '../generated/icons/circle-alert';
import { useRuntimeBag } from '../runtime/index';
import { fieldLive, type SJFieldProps as GeneratedProps } from '../generated/field/index';

export type { SJFieldProps as SJFieldContractProps } from '../generated/field/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJFieldClasses {
  root?: string;
  label?: string;
  hint?: string;
  error?: string;
  icon?: string;
}

type RootAttrs = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'id' | 'onChange' | 'onInvalid' | 'defaultValue'
>;

export interface SJFieldRootProps extends RootAttrs, Omit<GeneratedProps, 'label' | 'hint'> {
  classes?: SJFieldClasses;
  /** Prop-or-slot: the visible label (renders the label part). */
  label?: ReactNode;
  /** Prop-or-slot: help text (renders the hint part and references it from the control). */
  hint?: ReactNode;
  /** Slot: the control (SJInput) and, in slot form, `SJField.Label` / `SJField.Hint`. */
  children?: ReactNode;
}
export type SJFieldLabelProps = ComponentPropsWithoutRef<'label'>;
export type SJFieldHintProps = ComponentPropsWithoutRef<'div'>;

export interface FieldContextValue {
  readonly parts: FieldParts;
  readonly classes: SJFieldClasses | undefined;
  /** The Hint part calls this in a layout effect; returns its cleanup. */
  readonly registerHint: () => () => void;
  /** The control element, set by SJInput: its index in `form.elements` orders the field (DOM order). */
  readonly control: { current: Element | null };
}
export const SJFieldContext: Context<FieldContextValue | null> =
  createContext<FieldContextValue | null>(null);

/** The enclosing field's parts, or null outside one (SJInput works standalone). */
export function useSJField(): FieldParts | null {
  return useContext(SJFieldContext)?.parts ?? null;
}

/** The enclosing field's control slot (SJInput sets it so the field can read its DOM order), or null. */
export function useSJFieldControl(): { current: Element | null } | null {
  return useContext(SJFieldContext)?.control ?? null;
}

function useCtx(part: string): FieldContextValue {
  const c = useContext(SJFieldContext);
  if (!c) throw new Error(`SJField.${part} must be rendered inside SJField.Root`);
  return c;
}

const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
/** Getter vocabulary back to React: `class` -> `className`, `for` -> `htmlFor`. */
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const {
    class: cls,
    for: htmlFor,
    ...rest
  } = p as { class?: string; for?: string } & Record<string, unknown>;
  const className = [cls, extra].filter(Boolean).join(' ');
  return {
    ...rest,
    ...(className && { className }),
    ...(htmlFor !== undefined && { htmlFor }),
  };
};

const noFields: readonly FormField[] = [];
const noSubscribe = (): (() => void) => () => {};

export const SJFieldRoot: ForwardRefExoticComponent<
  SJFieldRootProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, SJFieldRootProps>(function SJFieldRoot(props, ref) {
  const {
    id,
    name,
    required,
    disabled,
    hasHint,
    error,
    errorMessage,
    label,
    hint,
    classes,
    children,
    ...rest
  } = props;
  const reactId = useId();
  const { live, requireLive } = useRuntimeBag();
  const form = useContext(SJFormContext)?.owner;
  const baseValue = baseId(id, () => reactId);
  const [slotHint, setSlotHint] = useState(false);
  const registerHint = useCallback(() => {
    setSlotHint(true);
    return () => setSlotHint(false);
  }, []);
  const hasHintNow =
    slotHint || hasHint === true || (hint !== undefined && hint !== null && hint !== false);

  const control = useRef<Element | null>(null);
  const latest = useRef<FieldProps>({});
  latest.current = {
    ...(name !== undefined && { name }),
    ...(required !== undefined && { required }),
    ...(disabled !== undefined && { disabled }),
    hasHint: hasHintNow,
    ...(error !== undefined && { error }),
    ...(errorMessage !== undefined && { errorMessage }),
  };
  const parts = useMemo(
    () => createField(() => latest.current, { id: baseValue, ...(form && { form }), live }),
    [baseValue, form, live],
  );

  // Re-render when the form's field list changes (registration after mount), so the Enter position the
  // input reads from the owner is current. The slice keeps retained values (every keystroke) out of it.
  const fieldsOf = useCallback(() => form?.store.getSnapshot().fields ?? noFields, [form]);
  useSyncExternalStore(form ? form.store.subscribe : noSubscribe, fieldsOf, () => noFields);

  // The region exists before any text (contract liveRegions, creation timing derived from the contract).
  useLayoutEffect(() => {
    if (fieldLive === 'eager') requireLive?.();
  }, [requireLive]);
  // Children (SJInput) report their kind and element first, then the field registers with its DOM index
  // in `form.elements`. After every commit the key/index is re-read: a rename or a reorder cleans up the
  // old registration and connects the new one.
  const reg = useRef<{
    name: string | undefined;
    index: number | undefined;
    off: () => void;
  } | null>(null);
  useEffect(() => {
    const el = control.current as
      (Element & { form?: { elements?: ArrayLike<Element> } | null }) | null;
    const els = el?.form?.elements;
    const at = els ? Array.prototype.indexOf.call(els, el) : -1;
    const index = at < 0 ? undefined : at;
    const r = reg.current;
    if (r && r.name === name && r.index === index) return;
    r?.off();
    reg.current = { name, index, off: parts.connect(index) };
  });
  useEffect(
    () => () => {
      reg.current?.off();
      reg.current = null;
    },
    [parts],
  );
  // After every commit: a new error text is handed to the registry once (the same text is silent).
  useEffect(() => {
    parts.announce();
  });

  const errorText = (error ?? '').trim();
  const ctx: FieldContextValue = { parts, classes, registerHint, control };
  return createElement(
    SJFieldContext.Provider,
    { value: ctx },
    createElement(
      'div',
      { ...fromGetter(parts.getRootProps(toGetter(rest)), classes?.root), ref },
      label !== undefined && label !== null && label !== false
        ? createElement(SJFieldLabel, null, label)
        : null,
      hint !== undefined && hint !== null && hint !== false
        ? createElement(SJFieldHint, null, hint)
        : null,
      children,
      errorText
        ? createElement(
            'div',
            fromGetter(parts.getErrorProps(), classes?.error),
            createElement(
              'span',
              {
                className: ['sj-field__icon', classes?.icon].filter(Boolean).join(' '),
                'data-part': 'icon',
                'aria-hidden': 'true',
              },
              createElement(SJIcon, { icon: circleAlert, size: 'sm' }),
            ),
            errorText,
          )
        : null,
    ),
  );
});

export const SJFieldLabel: ForwardRefExoticComponent<
  SJFieldLabelProps & RefAttributes<HTMLLabelElement>
> = forwardRef<HTMLLabelElement, SJFieldLabelProps>(function SJFieldLabel(props, ref) {
  const { parts, classes } = useCtx('Label');
  return createElement('label', {
    ...fromGetter(parts.getLabelProps(toGetter(props)), classes?.label),
    ref,
  });
});

export const SJFieldHint: ForwardRefExoticComponent<
  SJFieldHintProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, SJFieldHintProps>(function SJFieldHint(props, ref) {
  const { parts, classes, registerHint } = useCtx('Hint');
  // The part tells the field it exists (layout effect, one re-render before paint), so the control references it.
  useLayoutEffect(registerHint, [registerHint]);
  return createElement('div', {
    ...fromGetter(parts.getHintProps(toGetter(props)), classes?.hint),
    ref,
  });
});

/** Namespace form (`SJField.Root`) plus the flat exports above (ADR-002). */
export const SJField = {
  Root: SJFieldRoot,
  Label: SJFieldLabel,
  Hint: SJFieldHint,
} as const;
