import { describe, expect, it } from 'vitest';
import { scanEntry, scanFiles, scanJsonData, scanWording } from './index.js';

/** @param {{ rule: string }[]} v */
const rules = (v) => v.map((x) => x.rule);

describe('wording: evidence-only ATs', () => {
  it.each([
    'NVDA support is tested.',
    'Verified with JAWS on Chrome.',
    'TalkBack: certified.',
    'We manually tested NVDA and TalkBack.',
    '| NVDA | evidence-only | tested |',
    'Every evidence-only entry is verified.',
  ])('fails: %s', (text) => {
    expect(rules(scanWording('x.md', text))).toContain('evidence-only-claimed-tested');
  });

  it.each([
    'NVDA, JAWS and TalkBack are implemented to documented evidence, not hands-on tested.',
    'NVDA is never labelled tested.',
    'JAWS remains evidence-only until a licence exists.',
    'NVDA entry is `tested-real` after the optional lane runs.',
    'NVDA is pending-real-test.',
    'Meaning of certification: evidence-conformant for NVDA, JAWS and TalkBack.',
  ])('passes: %s', (text) => {
    expect(scanWording('x.md', text)).toEqual([]);
  });

  it('reports 1-based line numbers', () => {
    const v = scanWording('x.md', 'ok\nNVDA is verified.');
    expect(v[0].line).toBe(2);
  });
});

describe('wording: VoiceOver', () => {
  it('fails a tested claim with no tested-real entry', () => {
    expect(rules(scanWording('x.md', 'VoiceOver is tested on Safari.'))).toEqual([
      'voiceover-claimed-tested-without-entry',
    ]);
  });
  it('passes when a real entry exists', () => {
    expect(
      scanWording('x.md', 'VoiceOver is tested on Safari.', { hasRealVoiceOver: true }),
    ).toEqual([]);
  });
  it('passes a deferred claim', () => {
    expect(scanWording('x.md', 'VoiceOver will be tested in the lane.')).toEqual([]);
  });
});

describe('data', () => {
  const vo = {
    at: 'voiceover',
    test_status: 'tested-real',
    tested_on: '2026-11-01',
    log: 'logs/vo.md',
  };
  it('accepts a complete VoiceOver tested-real entry', () => {
    expect(scanEntry('c.json', '$', vo)).toEqual([]);
  });
  it('rejects missing date, missing log', () => {
    expect(
      rules(scanEntry('c.json', '$', { ...vo, tested_on: undefined, log: undefined })),
    ).toEqual(['tested-real-missing-date', 'tested-real-missing-log']);
  });
  it.each(['nvda', 'jaws', 'talkback'])('rejects %s tested-real', (at) => {
    expect(rules(scanEntry('c.json', '$', { ...vo, at }))).toEqual(['non-voiceover-tested-real']);
  });
  it('rejects a date on an evidence-only entry', () => {
    expect(
      rules(
        scanEntry('c.json', '$', {
          at: 'nvda',
          test_status: 'evidence-only',
          tested_on: '2026-11-01',
        }),
      ),
    ).toEqual(['tested-fields-without-tested-real']);
  });
  it('ignores schema objects whose test_status is not a string', () => {
    expect(
      scanJsonData('s.json', { properties: { test_status: { enum: ['tested-real'] } } }).violations,
    ).toEqual([]);
  });
  it('finds nested entries and flags a real VoiceOver entry', () => {
    const r = scanJsonData('c.json', { a11y: { atSupport: [vo] } });
    expect(r.realVoiceOver).toBe(true);
    expect(r.violations).toEqual([]);
  });
});

describe('scanFiles', () => {
  it('a real VoiceOver entry in data legitimises VoiceOver wording', () => {
    const vo = { at: 'voiceover', test_status: 'tested-real', tested_on: '2026-11-01', log: 'l' };
    const files = [
      { file: 'c.json', content: JSON.stringify({ atSupport: [vo] }) },
      { file: 'd.md', content: 'VoiceOver is tested on Safari.' },
    ];
    expect(scanFiles(files).violations).toEqual([]);
  });
  it('seeded false label on an NVDA entry fails', () => {
    const files = [
      {
        file: 'r.json',
        content: JSON.stringify({
          atSupport: [{ at: 'nvda', test_status: 'tested-real' }],
          note: 'NVDA verified',
        }),
      },
    ];
    const r = rules(scanFiles(files).violations);
    expect(r).toContain('non-voiceover-tested-real');
    expect(r).toContain('evidence-only-claimed-tested');
  });
});
