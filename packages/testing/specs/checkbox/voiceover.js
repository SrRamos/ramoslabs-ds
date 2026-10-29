// @ts-check
// VoiceOver script hook for SJCheckbox (W1-C03c.f -> W1-505, ADR-013 layer 4). W1-505 generates the per-component
// protocol pack from `a11y.atAssertions` and `actions`; this module is the Checkbox's input to it: it renders
// each contract `atAssertions` id (and every keyboard binding of the contract) into the protocol's required
// fields: environment, initial announcement, every key/gesture, expected vs actual speech, focus before/after,
// reading order, state changes, pass/fail. Expected speech is derived from the contract, never invented;
// `actual`, `result` and focus-after are left blank for the human running the lane. An atAssertions id with no
// template here fails the test (an assertion nobody can run is not evidence), and so does a missing field.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CONTRACT_FILE = join(
  here,
  '..',
  '..',
  '..',
  'contracts',
  'contracts',
  'checkbox.contract.json',
);

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

const LABEL = 'Accept the terms';
/** Speech for a machine position (`state.machine`): mixed positions announce "mixed" whatever `checked` is. @param {string} position */
const speech = (position) =>
  `${LABEL}, ${position.startsWith('mixed') ? 'mixed' : position === 'checked' ? 'checked' : 'unchecked'}, checkbox`;

/** @param {string} lane */
const reach = (lane) =>
  lane === 'keyboard'
    ? 'Tab to the checkbox (VO+Right to reach it if skipped)'
    : 'Swipe right to the checkbox';

/**
 * Per-assertion procedures. `steps` use the contract's own keys and actions.
 * @type {Record<string, (c: any, lane: typeof LANES[number]) => { title: string, steps: any[] }>}
 */
const TEMPLATES = {
  'manual-speech-name-role-state': (_c, lane) => ({
    title: 'Name, role and state are announced when the checkbox receives focus',
    steps: ['unchecked', 'checked', 'mixed-unchecked', 'disabled'].map((state) => ({
      action: reach(lane.gestures),
      fixture: state === 'mixed-unchecked' ? 'indeterminate' : state,
      expected: state === 'disabled' ? `${LABEL}, dimmed, checkbox, unchecked` : speech(state),
      expectedFocusAfter: 'the checkbox input',
      actual: '',
      focusAfter: '',
      result: '',
    })),
  }),
  'manual-toggle-space': (c, lane) => ({
    title: 'Space toggles the checkbox and the new state is announced; the label does not change',
    steps: Object.entries(c.keyboard.control).flatMap(([key, action]) =>
      c.actions
        .filter((/** @type {any} */ a) => a.id === action)
        .map((/** @type {any} */ a) => ({
          action:
            lane.gestures === 'keyboard'
              ? `Press ${key} on the focused checkbox (starting ${a.from})`
              : `Double-tap the checkbox (starting ${a.from})`,
          from: a.from,
          to: a.to,
          expected: speech(a.to),
          expectedFocusAfter: 'unchanged: the checkbox input keeps focus',
          emits: a.emit,
          actual: '',
          focusAfter: '',
          result: '',
        })),
    ),
  }),
  'manual-speech-mixed-state': (c, lane) => ({
    title:
      'An indeterminate checkbox is announced as mixed (after hydration on a server-rendered page); activating it leaves mixed',
    steps: [
      {
        action: `${reach(lane.gestures)}; on a server-rendered page wait for hydration first`,
        fixture: 'indeterminate',
        from: 'mixed-unchecked',
        to: 'mixed-unchecked',
        expected: speech('mixed-unchecked'),
        expectedFocusAfter: 'the checkbox input',
        emits: null,
        actual: '',
        focusAfter: '',
        result: '',
      },
      ...Object.entries(c.keyboard.control).flatMap(([key, action]) =>
        c.actions
          .filter((/** @type {any} */ a) => a.id === action && a.from.startsWith('mixed'))
          .map((/** @type {any} */ a) => ({
            action:
              lane.gestures === 'keyboard'
                ? `Press ${key} on the focused checkbox (starting ${a.from})`
                : `Double-tap the checkbox (starting ${a.from})`,
            from: a.from,
            to: a.to,
            expected: speech(a.to),
            expectedFocusAfter: 'unchanged: the checkbox input keeps focus',
            emits: a.emit,
            actual: '',
            focusAfter: '',
            result: '',
          })),
      ),
    ],
  }),
};

/**
 * @param {any} [contract]
 * @returns {{ component: string, lanes: any[], assertions: string[] }}
 */
export function renderVoiceOverPack(contract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'))) {
  const ids = /** @type {string[]} */ (contract.a11y.atAssertions);
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
    // Reading order of the rendered anatomy: the label wraps the input, so the control is read once, with its name.
    readingOrder: contract.anatomy.map((/** @type {any} */ p) => p.part),
    initialAnnouncement: speech('unchecked'),
    stateChanges: contract.actions.map(
      (/** @type {any} */ a) => `${a.from} -> ${a.to} (${a.emit})`,
    ),
    assertions: ids.map((id) => ({ id, ...TEMPLATES[id](contract, lane) })),
    tested_on: null,
    result: '',
  }));
  return { component: contract.name, lanes, assertions: ids };
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
