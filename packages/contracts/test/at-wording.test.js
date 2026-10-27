import { describe, expect, it } from 'vitest';
import { atWording, atSupportMarkdown, EVIDENCE_ONLY_WORDING } from '../scripts/at-wording.mjs';
import { scanWording } from '../../testing/honesty/index.js';

describe('atWording (W1-318, ADR-015 honesty)', () => {
  it('prints the permitted wording for evidence-only', () => {
    expect(atWording({ test_status: 'evidence-only' })).toBe(
      'implemented to documented evidence, not hands-on tested',
    );
  });
  it('renders tested-real only from its own date and log', () => {
    expect(
      atWording({ test_status: 'tested-real', tested_on: '2026-11-01', log: 'l.md' }),
    ).toContain('2026-11-01');
    expect(() => atWording({ test_status: 'tested-real' })).toThrow();
    expect(() => atWording({ test_status: 'bogus' })).toThrow();
  });
  it('generated text for NVDA/JAWS/TalkBack passes the honesty scan', () => {
    const md = atSupportMarkdown(
      ['nvda', 'jaws', 'talkback'].map((at) => ({
        at,
        platform: 'p',
        browser: 'b',
        test_status: 'evidence-only',
      })),
    );
    expect(md).toContain(EVIDENCE_ONLY_WORDING);
    expect(scanWording('gen.md', md)).toEqual([]);
  });
});
