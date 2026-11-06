// @ts-check
// VoiceOver script hook for SJState (W1-C11.f -> W1-505). The contract's `a11y.atAssertions` are ids only; this
// module owns the script text for each id and renders them into the protocol-pack fields of ADR-013 layer 4
// (environment, initial announcement, every key/gesture, expected vs actual speech, focus before/after, reading
// order, state changes, pass/fail). W1-505 consumes `renderVoiceOverScript`. "Expected" is what the protocol
// should hear; "actual" is always left blank here, because only a person on a device can fill it in. Nothing in
// this file records a result.
import { atWording } from '../../../contracts/scripts/at-wording.mjs';

/**
 * @typedef {{ fixture: string, gesture: string, macos: string, ios: string, focusBefore: string, focusAfter: string,
 *   readingOrder: string, stateChange: string }} AtStep
 */

/** One entry per atAssertion id. `gesture` is the key on macOS and the equivalent touch gesture on iPhone. */
/** @type {Record<string, AtStep>} */
export const AT_STEPS = {
  'manual-state-loading-polite-once': {
    fixture: 'loading',
    gesture:
      'Load the page with VoiceOver running and focus on an unrelated control; do nothing (macOS); the same on iPhone. Then reload the fixture once more and leave focus where it is.',
    macos:
      '"Loading projects", spoken once, politely: it waits for VoiceOver to finish the current utterance and does not move the cursor. Nothing is spoken for the spinner glyph (aria-hidden). It is not repeated when the page is re-rendered with the same text.',
    ios: '"Loading projects", spoken once, politely, without moving the VoiceOver cursor.',
    focusBefore: 'An unrelated control, or the body',
    focusAfter: 'Unchanged: the state never takes focus and is not a tab stop.',
    readingOrder:
      'Swiping or VO+Right Arrow reaches the heading text "Loading projects" as a paragraph; the glyph is skipped.',
    stateChange:
      'aria-busy="true" on the root while loading. Changing the text to "12 results" speaks "12 results" once (polite status); an identical re-render speaks nothing.',
  },
  'manual-state-interruption-alert-once': {
    fixture: 'error-interrupt',
    gesture:
      'With VoiceOver running and focus inside an unrelated text field, trigger the fixture (macOS); the same on iPhone.',
    macos:
      '"Connection lost", spoken once and immediately (role alert, assertive), interrupting the current speech. It is not repeated. The polite status region stays silent for this message.',
    ios: '"Connection lost", spoken once and immediately, interrupting the current speech.',
    focusBefore: 'The unrelated text field',
    focusAfter: 'Unchanged: the alert is announced without moving focus.',
    readingOrder:
      'The heading "Connection lost", the description "Your changes were not saved." and the "Reconnect" button, in that order; the glyph is skipped.',
    stateChange:
      'Only an error with interrupt uses role=alert. The same error without interrupt is spoken politely, after the current speech.',
  },
};

export const ENVIRONMENTS = [
  { id: 'vo-macos-safari', label: 'VoiceOver + Safari on macOS', column: 'macos' },
  { id: 'vo-ios-safari', label: 'VoiceOver + Safari on a physical iPhone', column: 'ios' },
];

/**
 * @param {{ name: string, a11y: { atAssertions: string[], atSupport: Array<{ at: string, platform: string, browser: string, test_status: string, tested_on?: string, log?: string }> } }} contract
 * @param {Record<string, AtStep>} [steps]
 * @returns {{ markdown: string, steps: Array<AtStep & { id: string }> }}
 */
export function renderVoiceOverScript(contract, steps = AT_STEPS) {
  const ids = contract.a11y.atAssertions;
  const missing = ids.filter((id) => !(id in steps));
  if (missing.length > 0) throw new Error(`no VoiceOver script text for: ${missing.join(', ')}`);
  const extra = Object.keys(steps).filter((id) => !ids.includes(id));
  if (extra.length > 0)
    throw new Error(`script text for ids the contract does not declare: ${extra.join(', ')}`);
  const out = [
    `# ${contract.name} VoiceOver protocol`,
    '',
    'Generated from the contract; do not edit by hand. Fill the "Actual" and "Pass/fail" cells on a device.',
    '',
    '## Status of this component in the registry',
    '',
    ...contract.a11y.atSupport
      .filter((r) => r.at === 'voiceover')
      .map((r) => `- ${r.at} / ${r.platform} / ${r.browser}: ${r.test_status}; ${atWording(r)}`),
    '',
    '## Environment (record before the run)',
    '',
    ...ENVIRONMENTS.map(
      (e) => `- ${e.label}: OS version ____, Safari version ____, date ____, tester ____`,
    ),
    '',
  ];
  const rows = ids.map((id) => ({ id, .../** @type {AtStep} */ (steps[id]) }));
  for (const r of rows) {
    out.push(
      `## ${r.id}`,
      '',
      `- Fixture: \`${r.fixture}\``,
      `- Key or gesture: ${r.gesture}`,
      `- Initial announcement / expected speech, macOS: ${r.macos}`,
      `- Initial announcement / expected speech, iPhone: ${r.ios}`,
      '- Actual speech, macOS: ____',
      '- Actual speech, iPhone: ____',
      `- Focus before: ${r.focusBefore}`,
      `- Focus after: ${r.focusAfter}`,
      `- Reading order: ${r.readingOrder}`,
      `- State changes: ${r.stateChange}`,
      '- Pass/fail (macOS, iPhone): ____ / ____',
      '',
    );
  }
  return { markdown: out.join('\n'), steps: rows };
}
