// SJField / SJInput / SJForm conformance fixtures (W1-C02.f). One combined `field` directory covers the
// three contracts: they are one unit at run time (the form owner computes the Enter position that the input
// renders, the field owns ids, ARIA and the announcement), every real scenario mounts all three together, and
// the template's `specs:check` ties a directory to one slug with one expected-matrix file. A scene is
// the adapter-neutral description every adapter mounts: an optional SJForm (or a plain native `<form>`),
// then a list of fields, each an SJField around an SJInput (or a bare SJInput, `standalone`). No Node
// imports: the browser bundle imports this file too.
export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

export interface FieldSpec {
  /** The control's `name` and the registry key (3.3.7). */
  name: string;
  /** ADR-007 kind; default `text`. */
  kind?: string;
  label: string;
  hint?: string;
  error?: string;
  errorMessage?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Default value, written as the `value` attribute (so `form.reset()` returns to it). */
  value?: string;
  variant?: 'text';
  autocomplete?: string;
  section?: string;
  meaningful?: boolean;
  digits?: boolean;
  uppercase?: boolean;
  /** The input's own `autoSubmit` (applies standalone only; inside a form the owner decides). */
  autoSubmit?: boolean;
  /** An SJInput with no SJField around it. */
  standalone?: boolean;
}

export interface FormSpec {
  enter?: 'go' | 'send' | 'search';
  submits?: boolean;
  autoSubmit?: boolean;
  /** Data-first field order (SSR safe); wins over registration order. */
  fields?: { key: string; kind?: string }[];
  /** Native attributes that must reach the `<form>`. Default `/echo` and `get`. */
  action?: string;
  method?: string;
}

export interface Scene {
  /** `false` leaves off the fixed host ids (`f` on the form, `go` on the submit button): several roots on one page. */
  fixedIds?: false;
  /** An SJForm, or `false` for a plain native `<form>` with no SJForm (the control's form is still real). */
  form: FormSpec | false;
  fields: FieldSpec[];
}

export const LABEL = 'Email address';
export const LONG_LABEL =
  'Email address where we send your receipts, security notices and the occasional update about your account, ' +
  'kept private and never shared with anyone outside the company';
export const ERROR = 'Enter an email address like name@example.com';
export const HINT = 'We only use it to send receipts';

const email = (over: Partial<FieldSpec> = {}): FieldSpec => ({
  name: 'email',
  kind: 'email',
  label: LABEL,
  ...over,
});
const one = (f: FieldSpec): Scene => ({ form: false, fields: [f] });

/** SJField contract fixtures (`field.contract.json` `fixtures`), in order. */
export const FIELD_FIXTURES: Record<string, Scene> = {
  default: one(email()),
  'with-hint': one(email({ hint: HINT })),
  invalid: one(email({ error: ERROR })),
  required: one(email({ required: true })),
  'long-label': one(email({ label: LONG_LABEL })),
  disabled: one(email({ disabled: true })),
};

/** SJInput contract fixtures (`input.contract.json` `fixtures`), in order. */
export const INPUT_FIXTURES: Record<string, Scene> = {
  default: one({ name: 'note', label: 'Note' }),
  email: one(email()),
  phone: one({ name: 'phone', kind: 'phone', label: 'Phone' }),
  otp: one({ name: 'code', kind: 'otp', label: 'Verification code' }),
  amount: one({ name: 'amount', kind: 'amount', label: 'Amount' }),
  address: one({ name: 'street', kind: 'address', label: 'Street address' }),
  password: one({ name: 'pw', kind: 'password', label: 'Password' }),
  disabled: one({ name: 'note', label: 'Note', disabled: true }),
};

/** SJForm contract fixtures (`form.contract.json` `fixtures`), in order. */
export const FORM_FIXTURES: Record<string, Scene> = {
  default: {
    form: {},
    fields: [email(), { name: 'name', kind: 'name', label: 'Full name' }],
  },
  'field-order': {
    form: {},
    fields: [
      { name: 'name', kind: 'name', label: 'Full name' },
      email(),
      { name: 'phone', kind: 'phone', label: 'Phone' },
    ],
  },
  'textarea-last': {
    form: {},
    fields: [
      { name: 'name', kind: 'name', label: 'Full name' },
      email(),
      { name: 'street', kind: 'address', label: 'Street address' },
    ],
  },
  'prior-values': {
    form: {},
    fields: [
      { name: 'email', kind: 'email', label: 'Email address' },
      { name: 'billing', kind: 'email', label: 'Billing email' },
      { name: 'pw', kind: 'password', label: 'Password' },
    ],
  },
};

/** Fixtures that must round-trip through SSR and hydration (React and Vue). */
export const HYDRATION_FIXTURES: Record<string, Scene> = {
  'field-default': FIELD_FIXTURES['default']!,
  'field-hint-error': one(email({ hint: HINT, error: ERROR, required: true })),
  'input-address': INPUT_FIXTURES['address']!,
  'input-otp': INPUT_FIXTURES['otp']!,
  'form-data-first': {
    form: {
      fields: [
        { key: 'name', kind: 'name' },
        { key: 'email', kind: 'email' },
        { key: 'street', kind: 'address' },
      ],
      action: '/echo',
      method: 'get',
    },
    fields: [
      { name: 'name', kind: 'name', label: 'Full name' },
      email(),
      { name: 'street', kind: 'address', label: 'Street address' },
    ],
  },
  'form-valued': {
    form: {},
    fields: [
      { name: 'name', kind: 'name', label: 'Full name', value: 'Ada Lovelace' },
      email({ value: 'ada@example.com' }),
    ],
  },
};

/** Every scene by its `<contract>/<fixture>` id, for the ARIA, axe and visual layers. */
export const ALL_FIXTURES: Record<string, Scene> = {
  ...Object.fromEntries(Object.entries(FIELD_FIXTURES).map(([k, v]) => [`field/${k}`, v])),
  ...Object.fromEntries(Object.entries(INPUT_FIXTURES).map(([k, v]) => [`input/${k}`, v])),
  ...Object.fromEntries(Object.entries(FORM_FIXTURES).map(([k, v]) => [`form/${k}`, v])),
};

/**
 * The supports paths the field set runs. SJInput declares one capability fallback (`user-invalid`):
 * `native` is real detection (the native `:user-invalid` path where the engine has it), `fallback:all`
 * forces every capability false at once, which is the Chromium 114-118 / Firefox 125-127 / Safari 17.0-17.3
 * floor for this feature (the touched-state fallback).
 */
export const FIELD_PATHS = ['native', 'fallback:all'] as const;
