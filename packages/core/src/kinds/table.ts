// Typed kind table, hand-written to mirror packages/contracts/contracts/kinds.contract.json (ADR-007).
// W1-304 replaces THIS FILE with generated output of the same shape (exports `KINDS`, `Kind`, `Row`).
// Row = [type(s), inputmode, autocomplete, enter, autocapitalize, autocorrect, spellcheck, gate?]
//  autocomplete: null = attribute omitted | 'on' | 'off' | 'ctx' (consumer-supplied, else omitted)
//                | string[] tokens (first = default; 'x-*' = prefix family)
//                | ['?', ...tokens] emitted only when the context makes it meaningful.
//  enter: 'position' (form owner computes) | fixed hint | 'done/go' (OTP, by auto-submit).
//  autocapitalize 'characters?' = only when the canonical form is uppercase.
//  gate: 1 = inputmode only unless ctx.digits === false; 2 = inputmode only when ctx.digits === true.
export type Row = readonly [
  type: string | readonly string[],
  inputmode: string | null,
  autocomplete: string | null | readonly string[],
  enter: string,
  autocapitalize: string | null,
  autocorrect: 'on' | 'off' | null,
  spellcheck: boolean | null,
  gate?: 1 | 2,
];

const AMOUNT = [
  'text',
  'decimal',
  ['?', 'transaction-amount'],
  'position',
  null,
  'off',
  false,
] as const;
const CC = (t: string): Row => ['text', 'numeric', [t], 'position', null, null, null];
const PRA = (a: string | readonly string[]): Row => [
  'text',
  'numeric',
  a,
  'position',
  null,
  null,
  null,
  1,
];
const PW = (t: string): Row => ['password', 'text', [t], 'position', 'none', 'off', false];

export const KINDS = {
  text: ['text', 'text', 'on', 'position', 'sentences', 'on', true],
  name: ['text', 'text', ['name', 'given-name', 'family-name'], 'position', 'words', 'off', false],
  username: ['text', 'text', ['username'], 'position', 'none', 'off', false],
  email: ['email', 'email', ['email'], 'position', 'none', 'off', false],
  url: ['url', 'url', ['?', 'url'], 'go', 'none', 'off', false],
  phone: ['tel', 'tel', ['tel', 'tel-*'], 'position', 'none', 'off', false],
  otp: ['text', 'numeric', ['one-time-code'], 'done/go', 'none', 'off', false],
  'otp-alnum': ['text', 'text', ['one-time-code'], 'done/go', 'characters?', 'off', false],
  amount: AMOUNT,
  'amount-signed': AMOUNT,
  quantity: [['number', 'text'], 'numeric', 'off', 'position', null, null, null],
  postal: PRA(['postal-code']),
  reference: PRA('ctx'),
  account: PRA('ctx'),
  'tax-id': ['text', 'numeric', null, 'position', null, null, null, 2],
  search: ['search', 'search', 'off', 'search', null, null, null],
  password: PW('current-password'),
  'password-new': PW('new-password'),
  date: ['date', null, ['?', 'bday'], 'position', null, null, null],
  time: ['time', null, 'off', 'position', null, null, null],
  choice: ['select', null, 'ctx', 'position', null, null, null],
  'cc-number': CC('cc-number'),
  'cc-exp': CC('cc-exp'),
  'cc-exp-month': CC('cc-exp-month'),
  'cc-exp-year': CC('cc-exp-year'),
  'cc-csc': ['text', 'numeric', ['cc-csc'], 'done', null, 'off', false],
  'cc-name': ['text', 'text', ['cc-name'], 'position', 'words', 'off', false],
  address: ['textarea', 'text', ['street-address'], 'enter', null, null, null],
  'address-line': [
    'text',
    'text',
    ['address-line1', 'address-line2', 'address-line3'],
    'position',
    null,
    null,
    null,
  ],
  country: [['select', 'text'], null, ['country', 'country-name'], 'position', null, null, null],
  organization: ['text', 'text', ['organization'], 'position', 'words', null, null],
} as const satisfies Record<string, Row>;

export type Kind = keyof typeof KINDS;
