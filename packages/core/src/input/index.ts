// SJInput core (W1-C02.a2, ADR-007, ADR-014). SJInput OWNS `kind`: it resolves the ADR-007 row with
// `resolveKind` into the native attributes of the control (type, inputmode, autocomplete,
// enterkeyhint, autocapitalize, autocorrect, spellcheck). `maxlength` is never emitted and a numeric
// identifier is never `type=number`. The element is an `<input>`, except the textarea kind
// (`address`) and the native select kinds (`choice`, `country`), which `tag()` reports.
// Inside an SJField the field supplies the ids, `aria-describedby`/`aria-invalid` (IDREFs come from
// the field context, never typed by hand) and `enterkeyhint` position; the input reports its kind
// with `connect()` (-> `field.setKind`) and hands entered values to `field.retain` (WCAG 3.3.7).
// `:user-invalid` is native from Chromium 119; below that (`ctx.userInvalid` false, the default so the
// server render and the forced-false run take it) a touched state (blur or an `invalid` event)
// sets `data-touched` for the CSS fallback. Getters are pure functions of props and the store.
import { mergeProps, type Props } from '../merge/index';
import { createStore, type Store } from '../store/index';
import { resolveKind, type Kind, type KindContext, type ResolvedKind } from '../kinds/index';
import type { FieldParts } from '../field/index';
import { initialSnapshot, storeReducer, type InputAction, type InputSnapshot } from './reducer';

export {
  initialSnapshot,
  reduce,
  reducerEvents,
  storeReducer,
  type InputAction,
  type InputEvent,
  type InputSnapshot,
  type InputState,
} from './reducer';

export type InputProps = {
  /** Default `text`. */
  readonly kind?: Kind;
  readonly variant?: 'text';
  readonly autocomplete?: string;
  readonly section?: string;
  readonly meaningful?: boolean;
  readonly digits?: boolean;
  readonly uppercase?: boolean;
  readonly autoSubmit?: boolean;
  /** Standalone only: inside an SJField the field's id, name, required and disabled win. */
  readonly id?: string;
  readonly name?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
};

export interface InputContext {
  /** The enclosing SJField; absent for a standalone input. */
  readonly field?: FieldParts;
  /** `runtime.supports.userInvalid`. False or absent (server, forced-false run) enables the fallback. */
  readonly userInvalid?: boolean;
}

export interface InputParts {
  readonly store: Store<InputSnapshot, InputAction>;
  /** The element the control renders as. */
  tag(): 'input' | 'textarea' | 'select';
  /** The ADR-007 row resolved for the current props and the field's Enter position. */
  resolved(): ResolvedKind;
  getRootProps(consumer?: Props): Props;
  getControlProps(consumer?: Props): Props;
  /** Client only, after mount and whenever `kind` changes: reports the kind to the field. Returns the cleanup. */
  connect(): () => void;
}

type Evt = { readonly target?: { readonly value?: unknown } };

export function createInput(getProps: () => InputProps, ctx: InputContext = {}): InputParts {
  const { field } = ctx;
  const store = createStore<InputSnapshot, InputAction>(initialSnapshot, storeReducer);
  const kind = () => getProps().kind ?? 'text';
  const resolved = () => {
    const p = getProps();
    const k: KindContext = {
      variant: p.variant,
      autocomplete: p.autocomplete,
      section: p.section,
      meaningful: p.meaningful,
      digits: p.digits,
      uppercase: p.uppercase,
      autoSubmit: p.autoSubmit,
      enter: field?.enterHint(),
    };
    return resolveKind(kind(), k);
  };
  const tag = () => {
    const t = resolved().type;
    return t === 'textarea' || t === 'select' ? t : 'input';
  };
  const fallback = () => ctx.userInvalid !== true;
  const touch = () => void (fallback() && store.dispatch({ type: 'touch' }));

  return {
    store,
    tag,
    resolved,
    getRootProps: (consumer = {}) =>
      mergeProps(
        consumer,
        { class: 'sj-input__root', 'data-part': 'root', 'data-kind': kind() },
        { part: 'root', protect: ['data-part', 'data-kind'] },
      ),
    getControlProps(consumer = {}) {
      const p = getProps();
      const r = resolved();
      const el = tag();
      const own: Props = {
        class: 'sj-input__control',
        'data-part': 'control',
        'data-touched': fallback() && store.getSnapshot().state === 'touched' ? 'true' : undefined,
        ...(el === 'input' && { type: r.type }),
        inputmode: r.inputmode,
        autocomplete: r.autocomplete,
        enterkeyhint: r.enterkeyhint,
        autocapitalize: r.autocapitalize,
        autocorrect: r.autocorrect,
        spellcheck: r.spellcheck === undefined ? undefined : String(r.spellcheck),
        onBlur: (e: Evt) => {
          touch();
          const v = e.target?.value;
          if (typeof v === 'string') field?.retain(v);
        },
        onInvalid: touch,
      };
      const bag = mergeProps(consumer, own, {
        part: 'control',
        protect: ['data-part', 'data-touched'],
      });
      if (field) return field.getControlProps(bag);
      return mergeProps(
        bag,
        {
          ...(p.id !== undefined && { id: p.id }),
          ...(p.name !== undefined && { name: p.name }),
          ...(p.required && { required: true }),
          ...(p.disabled && { disabled: true }),
        },
        { part: 'control', protect: ['name', 'required', 'disabled'] },
      );
    },
    connect() {
      field?.setKind(kind());
      return () => field?.setKind(undefined);
    },
  };
}
