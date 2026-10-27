import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  plusSixMonths,
  REGISTRY_DIR,
  registryFiles,
  validateAtFile,
  validateAtSupport,
} from '../scripts/at-validate.mjs';

const entry = (over = {}) => ({
  id: 'nvda-chrome-x',
  kind: 'observation',
  pattern: 'button',
  at: 'NVDA',
  at_version: null,
  browser: 'Chrome',
  browser_version: null,
  platform: 'windows',
  platform_version: null,
  behavior: 'b',
  impact: 'none',
  source_url: 'https://example.org/a',
  source_date: 'living',
  retrieved: '2026-10-27',
  source_tier: 'T1',
  decision: 'd',
  constraints: { focusStrategy: 'native' },
  test_status: 'evidence-only',
  next_review: '2027-01-27',
  ...over,
});
const contractEntry = (over = {}) =>
  entry({
    id: 'apg',
    kind: 'contract',
    impact: undefined,
    at: 'cross-AT',
    platform: 'cross',
    ...over,
  });
const file = (over = {}) => ({
  pattern: 'button',
  recommended: {
    variant: 'v',
    constraints: { focusStrategy: 'native' },
    supportedBy: ['apg'],
    atEvidence: {
      nvda: ['nvda-chrome-x'],
      jaws: 'no-measured-evidence',
      talkback: 'no-measured-evidence',
      'voiceover-macos': 'no-measured-evidence',
      'voiceover-ios': 'no-measured-evidence',
    },
  },
  entries: [contractEntry(), entry()],
  ...over,
});
const messages = (data) =>
  validateAtSupport(data, { fileName: 'button.json' })
    .map((e) => `${e.path}: ${e.message}`)
    .join('\n');
/** @param {(f: any) => void} mutate */
const bad = (mutate) => {
  const f = file();
  mutate(f);
  return messages(f);
};

describe('at-support schema and rules (W1-315)', () => {
  it('passes a valid file', () => {
    expect(messages(file())).toBe('');
  });

  it('fails a missing required field', () => {
    expect(bad((f) => delete f.entries[1].source_tier)).toMatch(/source_tier/);
    expect(bad((f) => delete f.recommended.atEvidence)).toMatch(/atEvidence/);
  });

  it('requires impact on observations and forbids it on contract entries', () => {
    expect(bad((f) => delete f.entries[1].impact)).toMatch(/impact/);
    expect(bad((f) => (f.entries[0].impact = 'none'))).toMatch(/must NOT|not/);
  });

  it('fails a focusStrategy outside the ADR-006 enum', () => {
    expect(bad((f) => (f.entries[1].constraints.focusStrategy = 'tab-order'))).toMatch(
      /allowed values/,
    );
    expect(bad((f) => (f.recommended.constraints.focusStrategy = 'tab-order'))).toMatch(
      /allowed values/,
    );
  });

  it('fails a T3-only decision and accepts one T1 or two independent T2', () => {
    expect(bad((f) => (f.entries[0].source_tier = 'T3'))).toMatch(
      /at least one T1 source or two independent T2/,
    );
    const two = (a, b) => (f) => {
      f.entries[0].source_tier = 'T2';
      f.entries.push(contractEntry({ id: 'second', source_tier: 'T2', source_url: b }));
      f.entries[0].source_url = a;
      f.recommended.supportedBy = ['apg', 'second'];
    };
    expect(bad(two('https://a.example.org/x', 'https://www.example.org/y'))).toMatch(
      /two independent T2/,
    );
    expect(bad(two('https://a.example.org/x', 'https://other.example.com/y'))).toBe('');
  });

  it('fails a T3-only per-AT claim, a contract entry as a per-AT claim and the wrong AT', () => {
    expect(bad((f) => (f.entries[1].source_tier = 'T3'))).toMatch(
      /T3 evidence alone never decides/,
    );
    expect(bad((f) => (f.recommended.atEvidence.nvda = ['apg']))).toMatch(/needs an observation/);
    // radio-group shape: voiceover-ios declared no-measured-evidence while a VoiceOver iOS observation exists
    expect(
      bad((f) =>
        f.entries.push(
          entry({
            id: 'vo-ios-safari-a11ysupport-radio',
            at: 'VoiceOver',
            browser: 'Safari',
            platform: 'iOS',
          }),
        ),
      ),
    ).toMatch(
      /atEvidence\/voiceover-ios: declared no-measured-evidence but observation "vo-ios-safari-a11ysupport-radio"/,
    );
    expect(bad((f) => (f.recommended.atEvidence.jaws = ['nvda-chrome-x']))).toMatch(
      /not jaws\/windows/,
    );
  });

  it('fails a 7-month review window and accepts exactly 6 months', () => {
    expect(bad((f) => (f.entries[1].next_review = '2027-05-27'))).toMatch(/more than 6 months/);
    expect(bad((f) => (f.entries[1].next_review = '2027-04-27'))).toBe('');
    expect(bad((f) => (f.entries[1].next_review = '2026-10-26'))).toMatch(/before retrieved/);
    expect(plusSixMonths('2026-08-31')).toBe('2027-02-28');
  });

  it('fails tested-real without a date or log, and tested_on on evidence-only', () => {
    expect(bad((f) => (f.entries[1].test_status = 'tested-real'))).toMatch(/tested_on/);
    expect(bad((f) => (f.entries[1].tested_on = '2026-10-27'))).toMatch(/must NOT|not/);
    expect(
      bad((f) =>
        Object.assign(f.entries[1], {
          test_status: 'tested-real',
          tested_on: '2026-10-27',
          log: 'logs/x.md',
        }),
      ),
    ).toBe('');
  });

  it('rejects no-measured-evidence as a test_status, duplicate ids and a pattern/file mismatch', () => {
    expect(bad((f) => (f.entries[1].test_status = 'no-measured-evidence'))).toMatch(
      /allowed values/,
    );
    expect(bad((f) => (f.entries[1].id = 'apg'))).toMatch(/duplicate id/);
    expect(bad((f) => (f.pattern = 'switch'))).toMatch(/does not match file name/);
  });
});

describe('shipped registry', () => {
  it('every file in docs/architecture/evidence/at-support validates', () => {
    expect(existsSync(REGISTRY_DIR)).toBe(true);
    const files = registryFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(validateAtFile(f), f).toEqual([]);
  });
});
