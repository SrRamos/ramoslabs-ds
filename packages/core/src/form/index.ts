// SJForm core (W1-C02.a1, ADR-014). The form owner has exactly two duties plus context plumbing:
//   1. Enter position: `hint(key)` is the `enterkeyhint` of a field, computed from field order with
//      textarea kinds excluded (ADR-007, `enterKeyHints`).
//   2. WCAG 3.3.7: values the user already entered are retained (`retain`) and offered back
//      (`prior`, `offers`). Secrets (password, one-time code, card security code) are never kept.
// No validation orchestration and no submission handling: the root is a native `<form>` (ADR-014).
// Fields come from the data-first `fields` prop (SSR safe) or register after mount; the store makes
// the owner a useSyncExternalStore-style source for adapters.
import { createStore, type Store } from '../store/index';
import { enterKeyHints, type EnterHint, type Kind } from '../kinds/index';
import { mergeProps, type Props } from '../merge/index';

export interface FormField {
  /** The field `name`, or its id when it has none. */
  readonly key: string;
  /** Absent counts as text for the Enter position. */
  readonly kind?: Kind;
}

export type FormProps = {
  readonly fields?: readonly FormField[];
  readonly action?: 'go' | 'send' | 'search';
  /** Default true: Enter on the last editable field submits (`go`); false gives it `done`. */
  readonly submits?: boolean;
  readonly autoSubmit?: boolean;
};

export interface FormSnapshot {
  readonly fields: readonly FormField[];
  /** Retained values by field key, in entry order. */
  readonly values: Readonly<Record<string, string>>;
}
export type FormAction =
  | { readonly type: 'add'; readonly field: FormField }
  | { readonly type: 'remove'; readonly key: string }
  | { readonly type: 'retain'; readonly key: string; readonly value: string };

export interface FormOwner {
  readonly store: Store<FormSnapshot, FormAction>;
  getRootProps(consumer?: Props): Props;
  /** Registers a mounted field; returns an idempotent unregister. Order is registration order. */
  register(field: FormField): () => void;
  /** `enterkeyhint` for the field, or undefined when the field is unknown to the owner. */
  hint(key: string): EnterHint | undefined;
  /** Retains the latest value (empty clears it). Ignored for secret kinds. */
  retain(key: string, value: string): void;
  /** The value retained for this key (auto-populate). */
  prior(key: string): string | undefined;
  /** Distinct non-empty values retained under other keys (select list), oldest first. */
  offers(key: string): string[];
}

const secret = /^(password|otp|cc-csc)/;

function reduce(s: FormSnapshot, e: FormAction): { readonly state: FormSnapshot } {
  if (e.type === 'add') {
    const at = s.fields.findIndex((f) => f.key === e.field.key);
    if (at < 0) return { state: { ...s, fields: [...s.fields, e.field] } };
    if (s.fields[at]!.kind === e.field.kind) return { state: s };
    return { state: { ...s, fields: s.fields.map((f, i) => (i === at ? e.field : f)) } };
  }
  if (e.type === 'remove') {
    const fields = s.fields.filter((f) => f.key !== e.key);
    return { state: fields.length === s.fields.length ? s : { ...s, fields } };
  }
  const kind = s.fields.find((f) => f.key === e.key)?.kind;
  if ((kind && secret.test(kind)) || s.values[e.key] === (e.value || undefined))
    return { state: s };
  const values = { ...s.values, [e.key]: e.value };
  if (!e.value) delete values[e.key];
  return { state: { ...s, values } };
}

export function createForm(getProps: () => FormProps = () => ({})): FormOwner {
  const store = createStore<FormSnapshot, FormAction>({ fields: [], values: {} }, reduce);
  const list = () => getProps().fields ?? store.getSnapshot().fields;
  return {
    store,
    getRootProps: (consumer = {}) =>
      mergeProps(
        consumer,
        { class: 'sj-form__root', 'data-part': 'root' },
        { part: 'root', protect: ['data-part'] },
      ),
    register(field) {
      store.dispatch({ type: 'add', field });
      return () => void store.dispatch({ type: 'remove', key: field.key });
    },
    hint(key) {
      const l = list();
      const p = getProps();
      return enterKeyHints(
        l.map((f) => f.kind ?? 'text'),
        { action: p.action, submits: p.submits !== false, autoSubmit: p.autoSubmit },
      )[l.findIndex((f) => f.key === key)];
    },
    retain(key, value) {
      // The data-first list is authoritative before any field registers (SSR order, early input).
      const kind = list().find((f) => f.key === key)?.kind;
      if (!(kind && secret.test(kind))) store.dispatch({ type: 'retain', key, value });
    },
    prior: (key) => store.getSnapshot().values[key],
    offers(key) {
      const all = store.getSnapshot().values;
      return [
        ...new Set(
          Object.keys(all)
            .filter((k) => k !== key)
            .map((k) => all[k]!),
        ),
      ];
    },
  };
}
