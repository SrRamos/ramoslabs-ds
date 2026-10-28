// SJCheckbox for React (C03c.d). Thin: the core getters (`createCheckboxParts`) produce every attribute and
// handler, the shared runtime (`useMachine`) owns the store and the post-commit corrective effect.
// The control is a real `<input type="checkbox">`: no FACE, no hidden mirror, so form state is a bare
// input's (ADR-014). `indeterminate` is a DOM property with no attribute: the getter emits it as a prop,
// so it is stripped from the rendered props and applied through the ref after every commit (and by the
// corrective effect). Nothing here reads `document`; refs are touched only in effects.
import {
  Children,
  createContext,
  createElement,
  forwardRef,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import {
  checkboxBaseId,
  checkboxFields,
  createCheckboxParts,
  initialSnapshot,
  storeReducer,
  type CheckboxAction,
  type CheckboxParts,
  type CheckboxSnapshot,
} from '@ramoslabs/core/checkbox';
import type { Props } from '@ramoslabs/core/merge';
import type { SJCheckboxProps as GeneratedProps } from '../generated/checkbox/index';
import { useMachine } from '../runtime/index';

export type {
  SJCheckboxCheckedChangePayload,
  SJCheckboxIndeterminateChangePayload,
  SJCheckboxProps as SJCheckboxContractProps,
} from '../generated/checkbox/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJCheckboxClasses {
  root?: string;
  control?: string;
  indicator?: string;
  label?: string;
}

type RootAttrs = Omit<ComponentPropsWithoutRef<'label'>, 'children' | 'id' | 'onChange'>;

export interface SJCheckboxRootProps extends RootAttrs, Omit<GeneratedProps, 'children'> {
  classes?: SJCheckboxClasses;
  /** Prop-or-slot: when given and there are no children, renders control, indicator and this label. */
  label?: ReactNode;
  /** Slot: the label, or explicit `Control`/`Indicator` parts. */
  children?: ReactNode;
}

export type SJCheckboxControlProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'checked' | 'defaultChecked' | 'disabled' | 'type' | 'name' | 'value' | 'id'
>;
export type SJCheckboxIndicatorProps = ComponentPropsWithoutRef<'span'>;
export type SJCheckboxLabelProps = ComponentPropsWithoutRef<'span'>;

interface Ctx {
  parts: CheckboxParts;
  classes: SJCheckboxClasses | undefined;
  setControl: (el: HTMLInputElement | null) => void;
}
const CheckboxContext = createContext<Ctx | null>(null);

function useCtx(part: string): Ctx {
  const c = useContext(CheckboxContext);
  if (!c) throw new Error(`SJCheckbox.${part} must be rendered inside SJCheckbox.Root`);
  return c;
}

/** React props to the getters' vocabulary (`className` -> `class`) and back. */
const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const { class: cls, ...rest } = p as { class?: string } & Record<string, unknown>;
  const className = [cls, extra].filter(Boolean).join(' ');
  return className ? { ...rest, className } : rest;
};

type ControlEffect = {
  type: 'checked' | 'indeterminate';
  target: 'control';
  value: boolean;
};

export const SJCheckboxRoot: ForwardRefExoticComponent<
  SJCheckboxRootProps & RefAttributes<HTMLLabelElement>
> = forwardRef<HTMLLabelElement, SJCheckboxRootProps>(function SJCheckboxRoot(props, ref) {
  const {
    checked,
    defaultChecked,
    indeterminate,
    defaultIndeterminate,
    disabled,
    name,
    value,
    id,
    onCheckedChange,
    onIndeterminateChange,
    classes,
    label,
    children,
    ...rest
  } = props;
  const reactId = useId();
  const control = useRef<HTMLInputElement | null>(null);
  const setControl = useCallback((el: HTMLInputElement | null) => void (control.current = el), []);
  const latest = useRef({ onCheckedChange, onIndeterminateChange });
  latest.current = { onCheckedChange, onIndeterminateChange };
  const notifyChecked = useCallback(
    (next: boolean) => latest.current.onCheckedChange?.({ checked: next }),
    [],
  );
  const notifyIndeterminate = useCallback(
    (next: boolean) => latest.current.onIndeterminateChange?.({ indeterminate: next }),
    [],
  );

  const bag = {
    ...(checked !== undefined && { checked }),
    ...(indeterminate !== undefined && { indeterminate }),
    ...(disabled !== undefined && { disabled }),
    ...(name !== undefined && { name }),
    ...(value !== undefined && { value }),
    ...(id !== undefined && { id }),
    // Always present: the pipeline only calls them; the consumer's callbacks are read at call time.
    onCheckedChange: notifyChecked,
    onIndeterminateChange: notifyIndeterminate,
  };
  const m = useMachine<CheckboxSnapshot, CheckboxAction, ControlEffect, typeof bag>({
    initial: () =>
      initialSnapshot(
        defaultChecked ?? checked ?? false,
        defaultIndeterminate ?? indeterminate ?? false,
      ),
    reduce: storeReducer,
    props: bag,
    fields: checkboxFields,
    exists: () => control.current !== null,
    run(effect) {
      // A controlled owner rejected the change: put the native input back (ADR-014 corrective effect).
      const el = control.current;
      if (!el) return;
      if (effect.type === 'checked') el.checked = effect.value;
      else el.indeterminate = effect.value;
    },
  });

  // A rejected controlled change is re-synced by `useMachine` itself (runtime follow-up, PR #64).
  const native = m.native;

  // `indeterminate` has no attribute: set the property after every commit so it follows the view, also
  // after a native click cleared it. Layout effect so the first paint already shows the mixed state.
  const mixed = m.state.indeterminate;
  useLayoutEffect(() => {
    if (control.current) control.current.indeterminate = mixed;
  });

  // A native `form.reset()` restores `checked` to its default without a `change` event (it does not touch
  // `indeterminate`), so the model would keep the last state. Re-sync after the reset ran (it runs after
  // dispatch, hence the task). Latest values are read through refs so the listener subscribes once per form.
  const nativeRef = useRef(native);
  nativeRef.current = native;
  const stateRef = useRef(m.state);
  stateRef.current = m.state;
  useEffect(() => {
    const form = control.current?.form;
    if (!form) return;
    const abort = new AbortController();
    form.addEventListener(
      'reset',
      () =>
        setTimeout(() => {
          const input = control.current;
          if (!abort.signal.aborted && input && input.checked !== stateRef.current.checked)
            nativeRef.current('checked', input.checked);
        }, 0),
      { signal: abort.signal },
    );
    return () => abort.abort();
  }, []);

  const parts = createCheckboxParts({
    view: () => m.state,
    native,
    getProps: () => bag,
    id: checkboxBaseId(id, () => reactId),
  });
  const ctx: Ctx = { parts, classes, setControl };

  const body =
    label !== undefined && Children.count(children) === 0
      ? createElement(
          Fragment,
          null,
          createElement(SJCheckboxControl),
          createElement(SJCheckboxIndicator),
          createElement(SJCheckboxLabel, null, label),
        )
      : children;
  return createElement(
    CheckboxContext.Provider,
    { value: ctx },
    createElement(
      'label',
      { ...fromGetter(parts.getRootProps(toGetter(rest)), classes?.root), ref },
      body,
    ),
  );
});

export const SJCheckboxControl: ForwardRefExoticComponent<
  SJCheckboxControlProps & RefAttributes<HTMLInputElement>
> = forwardRef<HTMLInputElement, SJCheckboxControlProps>(function SJCheckboxControl(props, ref) {
  const { parts, classes, setControl } = useCtx('Control');
  const merged = useCallback(
    (el: HTMLInputElement | null) => {
      setControl(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [setControl, ref],
  );
  // The property is applied by Root's layout effect; it must never reach the DOM as an attribute.
  const attrs = { ...parts.getControlProps(toGetter(props)) };
  delete attrs.indeterminate;
  return createElement('input', { ...fromGetter(attrs, classes?.control), ref: merged });
});

export const SJCheckboxIndicator: ForwardRefExoticComponent<
  SJCheckboxIndicatorProps & RefAttributes<HTMLSpanElement>
> = forwardRef<HTMLSpanElement, SJCheckboxIndicatorProps>(function SJCheckboxIndicator(props, ref) {
  const { parts, classes } = useCtx('Indicator');
  return createElement('span', {
    ...fromGetter(parts.getIndicatorProps(toGetter(props)), classes?.indicator),
    ref,
  });
});

export const SJCheckboxLabel: ForwardRefExoticComponent<
  SJCheckboxLabelProps & RefAttributes<HTMLSpanElement>
> = forwardRef<HTMLSpanElement, SJCheckboxLabelProps>(function SJCheckboxLabel(props, ref) {
  const { parts, classes } = useCtx('Label');
  return createElement('span', {
    ...fromGetter(parts.getLabelProps(toGetter(props)), classes?.label),
    ref,
  });
});

/** Namespace form (`SJCheckbox.Root`) plus the flat exports above (ADR-002). */
export const SJCheckbox = {
  Root: SJCheckboxRoot,
  Control: SJCheckboxControl,
  Indicator: SJCheckboxIndicator,
  Label: SJCheckboxLabel,
} as const;

export type { ReactElement };
