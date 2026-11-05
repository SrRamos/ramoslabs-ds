// SJInput for React (W1-C02.d, ADR-007, ADR-014). Thin: `createInput` resolves the `kind` row into the
// native attributes (type, inputmode, autocomplete, enterkeyhint, autocapitalize, autocorrect, spellcheck;
// never `maxlength`, never `type=number` for an identifier) and, inside an SJField, the field supplies the
// ids, `aria-describedby`, `aria-invalid`, name/required/disabled and the owner-computed Enter position.
// The control is a bare native `<input>` (or `<textarea>` for `address`): no FACE, no hidden mirror.
// `:user-invalid` fallback: a touched state (user change or `invalid`, never blur alone) sets
// `data-touched`; the owning form's `reset` event clears it. Nothing here reads `document`; the form is
// reached through the control ref in an effect.
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';
import { createInput, type InputProps } from '@ramoslabs/core/input';
import type { Props } from '@ramoslabs/core/merge';
import { useSJField } from '../field/index';
import { useOptionalRuntime } from '../runtime/index';
import type { SJInputProps as GeneratedProps } from '../generated/input/index';

export type { SJInputProps as SJInputContractProps } from '../generated/input/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJInputClasses {
  root?: string;
  control?: string;
}

/**
 * Native attributes of the control. The kind owns type, inputMode, autoComplete (use the `autocomplete`
 * contract prop), enterKeyHint, autoCapitalize, autoCorrect and spellCheck; `maxLength` is never allowed
 * (ADR-007); id, name, required and disabled are contract props.
 */
type ControlAttrs = Omit<
  ComponentPropsWithoutRef<'input'>,
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'enterKeyHint'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'spellCheck'
  | 'maxLength'
  | 'id'
  | 'name'
  | 'required'
  | 'disabled'
  | 'children'
>;

export interface SJInputRootProps extends ControlAttrs, GeneratedProps {
  classes?: SJInputClasses;
  /** Textarea kinds (`address`) only. */
  rows?: number;
}

export type SJInputElement = HTMLInputElement | HTMLTextAreaElement;

const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
/** Getter vocabulary (lowercase HTML names) back to React props. */
const REACT_NAMES: Readonly<Record<string, string>> = {
  class: 'className',
  for: 'htmlFor',
  inputmode: 'inputMode',
  autocomplete: 'autoComplete',
  enterkeyhint: 'enterKeyHint',
  autocapitalize: 'autoCapitalize',
  autocorrect: 'autoCorrect',
  spellcheck: 'spellCheck',
};
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(p)) out[REACT_NAMES[key] ?? key] = p[key];
  if (extra) out.className = [out.className, extra].filter(Boolean).join(' ');
  return out;
};

/** Attributes the kind owns: a spread (untyped JS) can never override them, so no identifier becomes type=number. */
const KIND_OWNED = [
  'type',
  'inputMode',
  'autoComplete',
  'enterKeyHint',
  'autoCapitalize',
  'autoCorrect',
  'spellCheck',
  'maxLength',
] as const;

export const SJInputRoot: ForwardRefExoticComponent<
  SJInputRootProps & RefAttributes<SJInputElement>
> = forwardRef<SJInputElement, SJInputRootProps>(function SJInputRoot(props, ref) {
  const {
    kind,
    variant,
    autocomplete,
    section,
    meaningful,
    digits,
    uppercase,
    autoSubmit,
    id,
    name,
    required,
    disabled,
    classes,
    ...rest
  } = props;
  for (const owned of KIND_OWNED) delete (rest as Record<string, unknown>)[owned];
  const field = useSJField();
  const userInvalid = useOptionalRuntime()?.supports.userInvalid === true;

  const latest = useRef<InputProps>({});
  latest.current = {
    ...(kind !== undefined && { kind }),
    ...(variant !== undefined && { variant }),
    ...(autocomplete !== undefined && { autocomplete }),
    ...(section !== undefined && { section }),
    ...(meaningful !== undefined && { meaningful }),
    ...(digits !== undefined && { digits }),
    ...(uppercase !== undefined && { uppercase }),
    ...(autoSubmit !== undefined && { autoSubmit }),
    ...(id !== undefined && { id }),
    ...(name !== undefined && { name }),
    ...(required !== undefined && { required }),
    ...(disabled !== undefined && { disabled }),
  };
  const input = useMemo(
    () => createInput(() => latest.current, { ...(field && { field }), userInvalid }),
    [field, userInvalid],
  );
  // The touched state drives `data-touched`; subscribe so a user change or `invalid` re-renders.
  useSyncExternalStore(
    input.store.subscribe,
    input.store.getSnapshot,
    input.store.getServerSnapshot,
  );
  // Report the kind to the field (re-registers it so the Enter order is right); again when it changes.
  useEffect(() => {
    void kind;
    return input.connect();
  }, [input, kind]);

  const control = useRef<SJInputElement | null>(null);
  const merged = useCallback(
    (el: SJInputElement | null) => {
      control.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  // The owning form's `reset` clears the touched fallback (no `change` event fires on reset).
  useEffect(() => {
    const form = control.current?.form;
    if (!form) return;
    const abort = new AbortController();
    form.addEventListener('reset', () => input.reset(), { signal: abort.signal });
    return () => abort.abort();
  }, [input]);

  return createElement(
    'span',
    fromGetter(input.getRootProps(), classes?.root),
    createElement(input.tag(), {
      ...fromGetter(input.getControlProps(toGetter(rest)), classes?.control),
      ref: merged,
    }),
  );
});

/** `SJInput` is the component; `SJInput.Root` is the same primitive (ADR-002). */
export const SJInput: typeof SJInputRoot & { Root: typeof SJInputRoot } = Object.assign(
  forwardRef<SJInputElement, SJInputRootProps>(function SJInput(props, ref) {
    return createElement(SJInputRoot, { ...props, ref });
  }),
  { Root: SJInputRoot },
);
