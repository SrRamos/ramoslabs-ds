// @ts-check
// The VoiceOver hook (W1-C03s.f): every contract atAssertions id is rendered into both lanes with every
// field ADR-013 4 requires; an assertion without a template fails; the evidence contract's keys are used.
import { describe, expect, it } from 'vitest';
import { REQUIRED_FIELDS, renderMarkdown, renderVoiceOverPack } from './voiceover.js';
import { readFileSync } from 'node:fs';
import { CONTRACT_FILE } from './voiceover.js';

const contract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'));

describe('SJSwitch VoiceOver hook', () => {
  const pack = renderVoiceOverPack();

  it('renders every contract atAssertions id into both VoiceOver lanes', () => {
    expect(pack.assertions).toEqual(contract.a11y.atAssertions);
    expect(pack.lanes.map((l) => l.id)).toEqual(['voiceover-macos-safari', 'voiceover-ios-safari']);
    for (const lane of pack.lanes)
      expect(lane.assertions.map((a) => a.id)).toEqual(contract.a11y.atAssertions);
  });

  it('carries every field the protocol requires, blanks for the human result fields', () => {
    for (const lane of pack.lanes) {
      expect(lane.environment).toBeTruthy();
      expect(lane.initialAnnouncement).toBe('Notifications, off, switch');
      expect(lane.readingOrder).toEqual(['root', 'control', 'thumb']);
      expect(lane.stateChanges).toEqual(['off -> on (checkedChange)', 'on -> off (checkedChange)']);
      expect(lane.result).toBe('');
      for (const a of lane.assertions)
        for (const s of a.steps) {
          expect(s.expected).toBeTruthy();
          expect(s.expectedFocusAfter).toBeTruthy();
          expect(s.actual).toBe('');
          expect(s.result).toBe('');
        }
    }
    expect(REQUIRED_FIELDS).toHaveLength(8);
  });

  it('derives the Space step from the contract keyboard map and actions, and tracks the contract', () => {
    const keys = pack.lanes[0].assertions.find((a) => a.id === 'manual-toggle-space').steps;
    expect(keys.map((s) => [s.from, s.to, s.expected])).toEqual([
      ['off', 'on', 'Notifications, on, switch'],
      ['on', 'off', 'Notifications, off, switch'],
    ]);
    expect(keys[0].action).toContain('Space');
    const changed = structuredClone(contract);
    changed.keyboard.control = { Enter: 'toggle' };
    const p2 = renderVoiceOverPack(changed);
    expect(p2.lanes[0].assertions[1].steps[0].action).toContain('Enter');
  });

  it('fails on an atAssertions id nobody wrote a procedure for (seeded)', () => {
    const seeded = structuredClone(contract);
    seeded.a11y.atAssertions.push('manual-something-new');
    expect(() => renderVoiceOverPack(seeded)).toThrow(/manual-something-new/);
  });

  it('renders markdown mentioning each assertion', () => {
    const md = renderMarkdown(pack);
    for (const id of contract.a11y.atAssertions) expect(md).toContain(id);
  });
});
