// @ts-check
// VoiceOver script hook for SJIcon (W1-C12.f -> W1-505). The contract's `a11y.atAssertions` are ids only; this
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
  'manual-icon-decorative-skipped': {
    fixture: 'default',
    gesture: 'VO+Right Arrow across the text next to the icon (macOS); swipe right (iPhone)',
    macos:
      'Only the surrounding text is spoken: "Inline text". The decorative icon (aria-hidden) is skipped.',
    ios: '"Inline text". The decorative icon is skipped.',
    focusBefore: 'Previous focusable item',
    focusAfter: 'Next focusable item (the icon is never a stop; VoiceOver cursor passes over it)',
    readingOrder: 'One stop for the text; no stop for the icon.',
    stateChange: 'None: SJIcon has one constant state (idle) and no events.',
  },
  'manual-icon-label-announced': {
    fixture: 'labelled',
    gesture: 'VO+Right Arrow to the icon (macOS); swipe right (iPhone)',
    macos: 'Name then role: "Search, image". The label comes from aria-label on role=img.',
    ios: '"Search, image".',
    focusBefore: 'Previous focusable item',
    focusAfter:
      'VoiceOver cursor on the icon; keyboard focus is unchanged (the icon is not focusable).',
    readingOrder: 'The icon is one stop, before the text "Inline text".',
    stateChange: 'None.',
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
