// @ts-check
// VoiceOver script hook for SJButton (W1-C01.f -> W1-505). The contract's `a11y.atAssertions` are ids only; this
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
  'manual-speech-name-role': {
    fixture: 'default',
    gesture: 'VO+Right Arrow to the button (macOS); swipe right (iPhone)',
    macos: 'Name then role: "Save changes, button".',
    ios: '"Save changes, button".',
    focusBefore: 'Previous focusable item',
    focusAfter: 'The button',
    readingOrder: 'The button is a single stop; its decorative icon is not announced.',
    stateChange: 'None.',
  },
  'manual-activate-enter-space': {
    fixture: 'default',
    gesture: 'VO+Space or Return/Space with Full Keyboard Access (macOS); double-tap (iPhone)',
    macos: 'The action runs once. No extra announcement from the component.',
    ios: 'The action runs once.',
    focusBefore: 'The button',
    focusAfter: 'The button (focus is not moved by the component).',
    readingOrder: 'Unchanged.',
    stateChange: 'None: SJButton has one constant state (idle).',
  },
  'manual-icon-only-name': {
    fixture: 'icon-only',
    gesture: 'VO+Right Arrow to the button (macOS); swipe right (iPhone)',
    macos:
      'The accessible name from `label`, then the role: "Close dialog, button". The glyph is not read.',
    ios: '"Close dialog, button". The glyph is not read.',
    focusBefore: 'Previous focusable item',
    focusAfter: 'The button',
    readingOrder: 'Single stop; the icon is aria-hidden.',
    stateChange: 'None.',
  },
  'manual-link-role-enter': {
    fixture: 'link',
    gesture: 'VO+Right Arrow, then Return (macOS); swipe right, double-tap (iPhone)',
    macos: 'Name then role: "Read the documentation, link". Return follows the link.',
    ios: '"Read the documentation, link". Double-tap follows the link.',
    focusBefore: 'Previous focusable item',
    focusAfter: 'Link target (the page or fragment it points to).',
    readingOrder: 'Single stop.',
    stateChange: 'Navigation, not a component state.',
  },
  'manual-disabled-announced': {
    fixture: 'disabled',
    gesture: 'VO+Right Arrow across the disabled button (macOS); swipe right (iPhone)',
    macos: 'Name, role and the dimmed or unavailable state: "Save changes, dimmed, button".',
    ios: '"Save changes, dimmed, button".',
    focusBefore: 'Previous focusable item',
    focusAfter:
      'VoiceOver cursor reaches it; keyboard focus never does (a disabled button is not focusable).',
    readingOrder: 'Present in reading order, absent from the Tab order.',
    stateChange: 'None; activation does nothing.',
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
