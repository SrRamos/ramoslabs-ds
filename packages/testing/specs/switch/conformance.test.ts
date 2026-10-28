// Conformance bookkeeping for SJSwitch (W1-C03s.f): the parity declaration leaves no empty cell, the
// evidence registry covers the switch contract, and the contract's
// own claims match what the suites assert. Pure, browser-free; the browser results feed `bun run parity`.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { buildMatrix, parseTitle } from '../../parity/index.js';
import { checkEvidence } from '../../evidence/index.js';
import { defaultRoot } from '../../size/index.js';
import { ADAPTERS, FIXTURES } from './fixtures';
import { contract, matrixTitle, paths, spec, switchExpected, switchScenarios } from './matrix';

const expected = switchExpected();

/** A passing result row for every declared cell on the three engines. */
const allPass = () =>
  ['chromium', 'firefox', 'webkit'].flatMap((browser) =>
    ADAPTERS.flatMap((adapter) =>
      paths().flatMap((p) =>
        switchScenarios().map((s) => ({
          title: parseTitle(matrixTitle(adapter, s, p.id))!,
          browser,
          outcome: 'passed' as const,
          notes: [] as string[],
          source: 'test',
        })),
      ),
    ),
  );

describe('parity matrix (ADR-013 L6)', () => {
  it('every title the spec emits parses as a matrix row', () => {
    for (const s of switchScenarios())
      expect(parseTitle(matrixTitle('react', s, 'native'))).not.toBeNull();
  });

  it('has no empty cell when every declared cell ran: 3 engines x 3 adapters x paths x scenarios', () => {
    const m = buildMatrix({ expected: expected as never, results: [{ rows: allPass() }] });
    expect(m.invalid).toEqual([]);
    expect(m.ok).toBe(true);
    expect(m.summary.missing).toBe(0);
    expect(m.summary.executed).toBe(3 * 3 * paths().length * switchScenarios().length);
    expect(m.summary.failed).toBe(0);
  });

  it('seeded: a missing result is a missing cell and fails', () => {
    const rows = allPass().slice(1);
    const m = buildMatrix({ expected: expected as never, results: [{ rows }] });
    expect(m.ok).toBe(false);
    expect(m.summary.missing).toBe(1);
  });

  it('seeded: a failed cell fails the matrix', () => {
    const rows = allPass();
    rows[5] = { ...rows[5]!, outcome: 'failed' as never };
    expect(buildMatrix({ expected: expected as never, results: [{ rows }] }).ok).toBe(false);
  });

  it('floor and device rows are declared not-run with the ADR-013 reason, never blank', () => {
    const m = buildMatrix({ expected: expected as never, results: [{ rows: allPass() }] });
    expect(m.summary.notRun).toBeGreaterThan(0);
    for (const c of m.cells.filter((c) => c.status === 'not-run')) expect(c.reason).toBeTruthy();
  });
});

describe('contract <-> suites', () => {
  it('every contract fixture has props and a scenario', () => {
    for (const f of contract.fixtures) expect(FIXTURES).toHaveProperty(f);
    expect(spec.scenarios.map((s: { fixture: string }) => s.fixture).sort()).toEqual(
      [...contract.fixtures].sort(),
    );
  });

  it('the contract has no capability fallback, which is why only native and fallback:all run', () => {
    expect(contract.support).toEqual([]);
    expect(paths().map((p) => p.id)).toEqual(['native', 'fallback:all']);
  });
});

describe('evidence (ADR-013 4b, ADR-015)', () => {
  const dirs = {
    contractsDir: join(defaultRoot, 'packages', 'contracts', 'contracts'),
    registryDir: join(defaultRoot, 'docs', 'architecture', 'evidence', 'at-support'),
  };
  it('the switch contract refs resolve, are fresh and agree with its focus strategy', () => {
    const r = checkEvidence(dirs);
    expect(r.errors.filter((e: string) => /switch/i.test(e))).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});
