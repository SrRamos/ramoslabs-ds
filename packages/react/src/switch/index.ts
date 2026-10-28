// SJSwitch for React (C03s.d). Thin: the core getters (`createSwitchParts`) produce every attribute and
// handler, the shared runtime (`useMachine`) owns the store and the post-commit corrective effect.
// The control is a real `<input type="checkbox" role="switch">`: no FACE, no hidden mirror, so form
// state is a bare input's (ADR-014). Nothing here reads `document`; refs are touched only in effects.
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
  useReducer,
  useRef,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import {
  createSwitchParts,
  initialSnapshot,
  storeReducer,
  switchBaseId,
  switchFields,
  type SwitchAction,
  type SwitchParts,
  type SwitchSnapshot,
} from '@ramoslabs/core/switch';
import type { Props } from '@ramoslabs/core/merge';
import type { SJSwitchProps as GeneratedProps } from '../generated/switch/index';
import { useMachine } from '../runtime/index';

export type {
  SJSwitchCheckedChangePayload,
  SJSwitchProps as SJSwitchContractProps,
} from '../generated/switch/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJSwitchClasses {
  root?: string;
  control?: string;
  thumb?: string;
}

type RootAttrs = Omit<ComponentPropsWithoutRef<'label'>, 'children' | 'id' | 'onChange'>;

export interface SJSwitchRootProps extends RootAttrs, Omit<GeneratedProps, 'children'> {
  classes?: SJSwitchClasses;
  /** Prop-or-slot: when given and there are no children, renders control, thumb and this label. */
  label?: ReactNode;
  /** Slot: the label, or explicit `Control`/`Thumb` parts. */
  children?: ReactNode;
}

export type SJSwitchControlProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'checked' | 'defaultChecked' | 'disabled' | 'type' | 'name' | 'value' | 'id'
>;
export type SJSwitchThumbProps = ComponentPropsWithoutRef<'span'>;

interface Ctx {
  parts: SwitchParts;
  classes: SJSwitchClasses | undefined;
  setControl: (el: HTMLInputElement | null) => void;
}
const SwitchContext = createContext<Ctx | null>(null);

function useCtx(part: string): Ctx {
  const c = useContext(SwitchContext);
  if (!c) throw new Error(`SJSwitch.${part} must be rendered inside SJSwitch.Root`);
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

type ControlEffect = { type: 'checked'; target: 'control'; value: boolean };

export const SJSwitchRoot: ForwardRefExoticComponent<
  SJSwitchRootProps & RefAttributes<HTMLLabelElement>
> = forwardRef<HTMLLabelElement, SJSwitchRootProps>(function SJSwitchRoot(props, ref) {
  const {
    checked,
    defaultChecked,
    disabled,
    name,
    value,
    id,
    onCheckedChange,
    classes,
    label,
    children,
    ...rest
  } = props;
  const reactId = useId();
  const control = useRef<HTMLInputElement | null>(null);
  const setControl = useCallback((el: HTMLInputElement | null) => void (control.current = el), []);
  const latest = useRef(onCheckedChange);
  latest.current = onCheckedChange;
  const notify = useCallback((next: boolean) => latest.current?.({ checked: next }), []);

  const bag = {
    ...(checked !== undefined && { checked }),
    ...(disabled !== undefined && { disabled }),
    ...(name !== undefined && { name }),
    ...(value !== undefined && { value }),
    ...(id !== undefined && { id }),
    // Always present: the pipeline only calls it; the consumer's callback is read at call time.
    onCheckedChange: notify,
  };
  const m = useMachine<SwitchSnapshot, SwitchAction, ControlEffect, typeof bag>({
    initial: () => initialSnapshot(defaultChecked ?? checked ?? false),
    reduce: storeReducer,
    props: bag,
    fields: switchFields,
    exists: () => control.current !== null,
    run(effect) {
      // A controlled owner rejected the change: put the native input back (ADR-014 corrective effect).
      if (effect.type === 'checked' && control.current) control.current.checked = effect.value;
    },
  });

  // A rejected controlled change leaves the store untouched, so React would not commit and
  // `reconcile()` (which runs in the commit's layout effect) would never correct the native input.
  // Forcing one commit after every native report guarantees the corrective effect runs.
  const [, commit] = useReducer((n: number) => n + 1, 0);
  const native = useCallback<typeof m.native>(
    (f, a) => {
      const r = m.native(f, a);
      commit();
      return r;
    },
    [m],
  );

  // A native `form.reset()` restores the input to its default without a `change` event, so the model
  // would keep the last state (a bare input has no model; this one must follow the DOM). Re-sync after the
  // reset ran (it runs after dispatch, hence the task). The latest `native` is read through a ref so the
  // listener subscribes once per form. Refs are touched only in effects.
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

  const parts = createSwitchParts({
    view: () => m.state,
    native,
    getProps: () => bag,
    id: switchBaseId(id, () => reactId),
  });
  const ctx: Ctx = { parts, classes, setControl };

  const body =
    label !== undefined && Children.count(children) === 0
      ? createElement(
          Fragment,
          null,
          createElement(SJSwitchControl),
          createElement(SJSwitchThumb),
          label,
        )
      : children;
  return createElement(
    SwitchContext.Provider,
    { value: ctx },
    createElement(
      'label',
      { ...fromGetter(parts.getRootProps(toGetter(rest)), classes?.root), ref },
      body,
    ),
  );
});

export const SJSwitchControl: ForwardRefExoticComponent<
  SJSwitchControlProps & RefAttributes<HTMLInputElement>
> = forwardRef<HTMLInputElement, SJSwitchControlProps>(function SJSwitchControl(props, ref) {
  const { parts, classes, setControl } = useCtx('Control');
  const merged = useCallback(
    (el: HTMLInputElement | null) => {
      setControl(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [setControl, ref],
  );
  return createElement('input', {
    ...fromGetter(parts.getControlProps(toGetter(props)), classes?.control),
    ref: merged,
  });
});

export const SJSwitchThumb: ForwardRefExoticComponent<
  SJSwitchThumbProps & RefAttributes<HTMLSpanElement>
> = forwardRef<HTMLSpanElement, SJSwitchThumbProps>(function SJSwitchThumb(props, ref) {
  const { parts, classes } = useCtx('Thumb');
  return createElement('span', {
    ...fromGetter(parts.getThumbProps(toGetter(props)), classes?.thumb),
    ref,
  });
});

/** Namespace form (`SJSwitch.Root`) plus the flat exports above (ADR-002). */
export const SJSwitch = {
  Root: SJSwitchRoot,
  Control: SJSwitchControl,
  Thumb: SJSwitchThumb,
} as const;

export type { ReactElement };
