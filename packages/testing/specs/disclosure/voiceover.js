// @ts-check
// VoiceOver script hook for SJDisclosure (W1-C06.f -> W1-505, ADR-013 layer 4). W1-505 generates the per-component
// protocol pack from `a11y.atAssertions` and `actions`; this module is the Disclosure's input to it: it renders
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
  'disclosure.contract.json',
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

const TITLE = 'Shipping details';
const PANEL = 'Orders ship within two business days.';
/**
 * Speech for a machine position (`state.machine`). The role word is the one VoiceOver uses for a native
 * `<summary>` ("disclosure triangle"); VoiceOver versions word the state slightly differently ("expanded" /
 * "collapsed"), so the human records the actual speech and the result field decides. @param {string} position
 */
const speech = (position) =>
  `${TITLE}, ${position === 'open' ? 'expanded' : 'collapsed'}, disclosure triangle`;

/** @param {string} lane */
const reach = (lane) =>
  lane === 'keyboard'
    ? 'Tab to the disclosure title (VO+Right to reach it if skipped)'
    : 'Swipe right to the disclosure title';

/** @param {string} lane @param {string} key @param {string} from */
const activate = (lane, key, from) =>
  lane === 'keyboard'
    ? `Press ${key} on the focused title (starting ${from})`
    : `Double-tap the title (starting ${from})`;

/** The steps of one trigger key, derived from the contract's keyboard map and actions.
 * @param {any} c @param {string} lane @param {(a: any) => any} [extra] */
const keySteps = (c, lane, extra = () => ({})) =>
  Object.entries(c.keyboard.trigger).flatMap(([key, action]) =>
    c.actions
      .filter((/** @type {any} */ a) => a.id === action)
      .map((/** @type {any} */ a) => ({
        action: activate(lane, key, a.from),
        from: a.from,
        to: a.to,
        expected: speech(a.to),
        expectedFocusAfter: 'unchanged: the title keeps focus',
        emits: a.emit,
        actual: '',
        focusAfter: '',
        result: '',
        ...extra(a),
      })),
  );

/**
 * Per-assertion procedures. `steps` use the contract's own keys and actions.
 * @type {Record<string, (c: any, lane: typeof LANES[number]) => { title: string, steps: any[] }>}
 */
const TEMPLATES = {
  'manual-speech-name-role-state': (_c, lane) => ({
    title: 'Name, role and expanded state are announced when the title receives focus',
    steps: ['closed', 'open', 'disabled'].map((state) => ({
      action: reach(lane.gestures),
      fixture: state,
      expected:
        state === 'disabled' ? `${TITLE}, dimmed, disclosure triangle, collapsed` : speech(state),
      expectedFocusAfter: 'the disclosure title (summary)',
      actual: '',
      focusAfter: '',
      result: '',
    })),
  }),
  'manual-toggle-enter-space': (c, lane) => ({
    title: 'Enter and Space toggle the disclosure; the title does not change',
    steps: keySteps(c, lane.gestures),
  }),
  'manual-speech-expanded-state-change': (c, lane) => ({
    title:
      'The new expanded state is announced after activation, and the panel is read in order when open',
    steps: [
      ...keySteps(c, lane.gestures),
      {
        action:
          lane.gestures === 'keyboard'
            ? 'With the disclosure open, press VO+Right from the title'
            : 'With the disclosure open, swipe right from the title',
        from: 'open',
        to: 'open',
        expected: PANEL,
        expectedFocusAfter:
          'the panel content (reading cursor); focus does not jump to the page setup',
        emits: null,
        actual: '',
        focusAfter: '',
        result: '',
      },
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
    // Reading order of the rendered anatomy: details (group), summary (title), then the panel.
    readingOrder: contract.anatomy.map((/** @type {any} */ p) => p.part),
    initialAnnouncement: speech('closed'),
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
