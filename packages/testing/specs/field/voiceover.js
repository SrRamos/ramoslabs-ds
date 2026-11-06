// @ts-check
// VoiceOver script hook for SJField, SJInput and SJForm (W1-C02.f -> W1-505, ADR-013 layer 4). W1-505 generates
// the per-component protocol pack from `a11y.atAssertions`; this module is the field set's input to it: it renders
// each contract `atAssertions` id of the three contracts into the protocol's required fields: environment,
// initial announcement, every key/gesture, expected vs actual speech, focus before/after, reading order, state
// changes, pass/fail. Expected speech is derived from the contract and the conformance fixtures, never invented;
// `actual`, `result` and focus-after are left blank for the human running the lane. An atAssertions id with no
// template here fails the test (an assertion nobody can run is not evidence), and so does a missing field.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', '..', 'contracts', 'contracts');
/** The three contracts this directory covers, plus the kinds table that drives the Enter hints. */
export const CONTRACT_FILES = {
  field: join(dir, 'field.contract.json'),
  input: join(dir, 'input.contract.json'),
  form: join(dir, 'form.contract.json'),
};
const KINDS_FILE = join(dir, 'kinds.contract.json');
export const CONTRACT_FILE = CONTRACT_FILES.field;

/** The fields ADR-013 layer 4 requires of every recorded component run. */
export const REQUIRED_FIELDS = [
  'environment',
  'initialAnnouncement',
  'keys',
  'expectedVsActualSpeech',
  'focusBeforeAfter',
  'readingOrder',
  'stateChanges',
  'result',
];

/** The two lanes ADR-013 4 / ADR-015 run for real. */
export const LANES = [
  {
    id: 'voiceover-macos-safari',
    device: 'macOS',
    at: 'VoiceOver',
    browser: 'Safari',
    gestures: 'keyboard',
  },
  {
    id: 'voiceover-ios-safari',
    device: 'iPhone',
    at: 'VoiceOver',
    browser: 'Safari',
    gestures: 'touch',
  },
];

// The strings of the conformance fixtures (fixtures.ts), so the procedure speaks the page the suites test.
const LABEL = 'Email address';
const HINT = 'We only use it to send receipts';
const ERROR = 'Enter an email address like name@example.com';

/** Speech for a text control: name, then state, then the role; the description follows. @param {string} name @param {{ invalid?: boolean, disabled?: boolean, description?: string }} [o] */
const speech = (name, o = {}) =>
  [
    name,
    o.disabled ? 'dimmed' : null,
    o.invalid ? 'invalid data' : null,
    'edit text',
    o.description ?? null,
  ]
    .filter(Boolean)
    .join(', ');

/** @param {string} lane */
const reach = (lane) =>
  lane === 'keyboard'
    ? 'Tab to the field (VO+Right to reach it if skipped)'
    : 'Swipe right to the field';

/** @param {string} lane @param {string} what */
const type = (lane, what) =>
  lane === 'keyboard'
    ? `Type ${what}, then Tab away`
    : `Type ${what} on the keyboard, then swipe to the next item`;

/** Owner Enter hints per field, from the kinds contract (ADR-007), in order. @param {string[]} kinds */
function hints(kinds) {
  const rows = JSON.parse(readFileSync(KINDS_FILE, 'utf8')).kinds;
  const row = (/** @type {string} */ k) => rows.find((/** @type {any} */ r) => r.kind === k);
  const editable = kinds.map((k) => !row(k).excludeFromEnterPosition);
  const last = editable.lastIndexOf(true);
  return kinds.map((k, i) => {
    const r = row(k);
    if (r.excludeFromEnterPosition) return 'enter';
    if (r.enter !== 'position') return r.enter;
    return i < last ? 'next' : 'go';
  });
}

/** @typedef {{ field: any, input: any, form: any }} Contracts */
/** @param {string} action @param {string} expected @param {Record<string, unknown>} [more] */
const step = (action, expected, more = {}) => ({
  action,
  expected,
  expectedFocusAfter: 'unchanged: the field control keeps focus',
  actual: '',
  focusAfter: '',
  result: '',
  ...more,
});

/**
 * Per-assertion procedures. `steps` use the fixtures and the contract's own wording.
 * @type {Record<string, (c: Contracts, lane: typeof LANES[number]) => { title: string, steps: any[] }>}
 */
const TEMPLATES = {
  'manual-field-label-hint-error': (_c, lane) => ({
    title:
      'Label, hint and error are read as the name and description of the control; the icon is never read',
    steps: [
      step(reach(lane.gestures), speech(LABEL), { fixture: 'field/default' }),
      step(reach(lane.gestures), speech(LABEL, { description: HINT }), {
        fixture: 'field/with-hint',
      }),
      step(reach(lane.gestures), speech(LABEL, { invalid: true, description: ERROR }), {
        fixture: 'field/invalid',
        note: 'The error is read once as the description; no "exclamation mark" or icon name is spoken.',
      }),
      step(reach(lane.gestures), speech(LABEL, { disabled: true }), { fixture: 'field/disabled' }),
    ],
  }),
  'manual-field-error-announced-once': (_c, lane) => ({
    title:
      'An error is announced exactly once when it appears, never at mount, and not again while it stays',
    steps: [
      step(
        `Load the page with ${LABEL} empty and valid; ${reach(lane.gestures)}`,
        'No error announced',
        {
          fixture: 'field/default',
        },
      ),
      step(
        type(lane.gestures, 'an invalid address (not-an-email)'),
        `${ERROR} (announced once, polite)`,
        {
          expectedFocusAfter: 'the next control, not the error',
        },
      ),
      step(
        'Stay on the page for 10 seconds; focus the field again',
        'The error is not announced a second time',
        {
          fixture: 'field/invalid',
        },
      ),
      step(
        'Correct the value and Tab away',
        'No announcement; the invalid state is gone from the field',
      ),
      step('A page that loads with the error already shown', 'No announcement at load', {
        fixture: 'field/invalid',
      }),
    ],
  }),
  'manual-input-invalid-described-announced': (_c, lane) => ({
    title:
      'An invalid input is announced as invalid and described by its error, after a change or a submit attempt',
    steps: [
      step(reach(lane.gestures), speech(LABEL), { fixture: 'input/email' }),
      step(
        type(lane.gestures, 'not-an-email'),
        `${ERROR}, then on return to the field: ${speech(LABEL, { invalid: true, description: ERROR })}`,
      ),
      step(
        'Submit the form with an empty required field',
        `The browser moves focus to the first invalid field: ${speech(LABEL, { invalid: true })}`,
        {
          expectedFocusAfter: 'the first invalid control',
        },
      ),
    ],
  }),
  'manual-input-textarea-role-address': (_c, lane) => ({
    title: 'The address kind is a multi-line text field; Return adds a line and does not submit',
    steps: [
      step(reach(lane.gestures), speech('Street address'), { fixture: 'input/address' }),
      step(
        lane.gestures === 'keyboard'
          ? 'Press Return'
          : 'Tap Return on the keyboard (labelled "return")',
        'A new line is inserted; the form is not submitted; no field change is announced',
      ),
    ],
  }),
  'manual-form-enter-key-label': (_c, lane) => {
    const kinds = ['name', 'email', 'phone'];
    const want = hints(kinds);
    return {
      title:
        'The Enter key label follows the field order: next on every field but the last, go on the last',
      steps: kinds.map((k, i) => ({
        ...step(
          lane.gestures === 'touch'
            ? `Focus the ${k} field and read the on-screen keyboard's return key`
            : `Focus the ${k} field (the return-key label is a touch-keyboard feature; confirm it on the iOS lane)`,
          `Return key label "${want[i]}"`,
          { fixture: 'form/field-order', hint: want[i] },
        ),
      })),
    };
  },
  'manual-form-prior-values-offered': (_c, lane) => ({
    title:
      'Values already entered are offered again (3.3.7), reachable by keyboard and read; secrets are never offered',
    steps: [
      step(`${type(lane.gestures, 'ada@example.com in Email address')}`, 'No announcement', {
        fixture: 'form/prior-values',
      }),
      step(
        `${reach(lane.gestures)} to Billing email and open the consumer's offer list built from the retained values`,
        'ada@example.com is offered and read',
        {
          expectedFocusAfter: 'the offer, then the field',
        },
      ),
      step(
        `Type a value in Password, then ${reach(lane.gestures).toLowerCase()} to Billing email`,
        'The password is not offered',
        {
          fixture: 'form/prior-values',
        },
      ),
    ],
  }),
};

/**
 * @param {Contracts} [contracts]
 * @returns {{ component: string, lanes: any[], assertions: string[] }}
 */
export function renderVoiceOverPack(
  contracts = /** @type {Contracts} */ (
    Object.fromEntries(
      Object.entries(CONTRACT_FILES).map(([k, f]) => [k, JSON.parse(readFileSync(f, 'utf8'))]),
    )
  ),
) {
  const ids = /** @type {string[]} */ (
    Object.values(contracts).flatMap((/** @type {any} */ c) => c.a11y.atAssertions)
  );
  const unknown = ids.filter((id) => !(id in TEMPLATES));
  if (unknown.length)
    throw new Error(`atAssertions with no VoiceOver template: ${unknown.join(', ')}`);
  const lanes = LANES.map((lane) => ({
    ...lane,
    environment: {
      os: '',
      osVersion: '',
      safariVersion: '',
      voiceOverVersion: '',
      date: '',
      tester: '',
    },
    // Reading order of the rendered anatomy of one field: label, hint, control, error (icon hidden, never read).
    readingOrder: ['label', 'hint', 'control', 'error'],
    initialAnnouncement: speech(LABEL),
    // The set has no machine; the changes a reader hears are the error appearing and clearing.
    stateChanges: ['valid -> invalid (error announced once)', 'invalid -> valid (no announcement)'],
    assertions: ids.map((id) => ({ id, ...TEMPLATES[id](contracts, lane) })),
    tested_on: null,
    result: '',
  }));
  return { component: 'SJField, SJInput and SJForm', lanes, assertions: ids };
}

/** Markdown for the lane protocol, ready for W1-505 to embed. @param {ReturnType<typeof renderVoiceOverPack>} pack */
export function renderMarkdown(pack) {
  const out = [`# ${pack.component} VoiceOver protocol`, ''];
  for (const lane of pack.lanes) {
    out.push(
      `## ${lane.device} + ${lane.at} + ${lane.browser}`,
      '',
      'Environment: ' + Object.keys(lane.environment).join(', '),
      '',
    );
    out.push(
      `Initial announcement: ${lane.initialAnnouncement}`,
      `Reading order: ${lane.readingOrder.join(' > ')}`,
      '',
    );
    for (const a of lane.assertions) {
      out.push(
        `### ${a.id}: ${a.title}`,
        '',
        '| Action | Expected speech | Actual speech | Focus before/after | Pass/fail |',
        '|---|---|---|---|---|',
      );
      for (const s of a.steps)
        out.push(`| ${s.action} | ${s.expected} | | ${s.expectedFocusAfter} / | |`);
      out.push('');
    }
  }
  return out.join('\n') + '\n';
}
