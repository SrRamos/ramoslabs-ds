import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEvidence } from './index.js';

const entry = (over = {}) => ({
  id: 'nvda-chrome-x',
  at: 'NVDA',
  platform: 'windows',
  browser: 'Chrome',
  next_review: '2027-01-27',
  ...over,
});
const row = (over = {}) => ({
  at: 'nvda',
  platform: 'windows',
  browser: 'chrome',
  test_status: 'evidence-only',
  evidence: ['at-support/button.json#nvda-chrome-x'],
  ...over,
});

/** @param {object[]} entries
 * @param {object[]} rows */
function setup(entries, rows) {
  const base = mkdtempSync(join(tmpdir(), 'evidence-'));
  const contractsDir = join(base, 'contracts');
  const registryDir = join(base, 'at-support');
  mkdirSync(contractsDir);
  mkdirSync(registryDir);
  writeFileSync(join(registryDir, 'button.json'), JSON.stringify({ pattern: 'button', entries }));
  writeFileSync(
    join(contractsDir, 'button.contract.json'),
    JSON.stringify({ a11y: { atSupport: rows } }),
  );
  return { contractsDir, registryDir, today: '2026-10-27' };
}

describe('evidence:check (W1-317 ref resolution and staleness)', () => {
  it('passes a resolving, fresh, matching ref', () => {
    const r = checkEvidence(setup([entry()], [row()]));
    expect(r.errors).toEqual([]);
    expect(r.checkedRefs).toBe(1);
  });

  it('fails a seeded stale entry', () => {
    const r = checkEvidence(setup([entry({ next_review: '2026-10-26' })], [row()]));
    expect(r.errors.join('\n')).toMatch(/stale/);
  });

  it('fails a dangling entry id and a missing registry file', () => {
    expect(
      checkEvidence(setup([entry()], [row({ evidence: ['at-support/button.json#nope'] })])).errors,
    ).toHaveLength(1);
    expect(
      checkEvidence(
        setup([entry()], [row({ evidence: ['at-support/ghost.json#x'] })]),
      ).errors.join(),
    ).toMatch(/does not exist/);
  });

  it('fails a malformed ref and an AT mismatch', () => {
    expect(
      checkEvidence(
        setup([entry()], [row({ evidence: ['button.json#nvda-chrome-x'] })]),
      ).errors.join(),
    ).toMatch(/malformed/);
    expect(checkEvidence(setup([entry()], [row({ at: 'jaws' })])).errors.join()).toMatch(
      /does not match/,
    );
  });
});
