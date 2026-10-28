// Conformance bookkeeping for SJSwitch (W1-C03s.f): the parity declaration leaves no empty cell, the
// evidence registry covers the switch contract, and the contract's
// own claims match what the suites assert. Pure, browser-free; the browser results feed `bun run parity`.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { verifyBaselines } from '../../visual/baselines.js';
import { sceneHtml } from '../../visual/site.mjs';
import { SCENES } from './visual/scenes.js';
import {
  REQUIRED_FIELDS,
  renderMarkdown,
  renderVoiceOverPack,
  CONTRACT_FILE,
} from './voiceover.js';
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

const voContract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'));
const ROOT = join(import.meta.dirname, 'visual', 'baselines');

describe('SJSwitch VoiceOver hook', () => {
  const pack = renderVoiceOverPack();

  it('renders every contract atAssertions id into both VoiceOver lanes', () => {
    expect(pack.assertions).toEqual(voContract.a11y.atAssertions);
    expect(pack.lanes.map((l) => l.id)).toEqual(['voiceover-macos-safari', 'voiceover-ios-safari']);
    for (const lane of pack.lanes)
      expect(lane.assertions.map((a: { id: string }) => a.id)).toEqual(
        voContract.a11y.atAssertions,
      );
  });

  it('carries every field the protocol requires, blanks for the human result fields', () => {
    for (const lane of pack.lanes) {
      expect(lane.environment).toBeTruthy();
      expect(lane.initialAnnouncement).toBe('Notifications, off, switch');
      expect(lane.readingOrder).toEqual(['root', 'control', 'thumb', 'label']);
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
    const keys = pack.lanes[0].assertions.find(
      (a: { id: string }) => a.id === 'manual-toggle-space',
    ).steps;
    expect(
      keys.map((s: { from: string; to: string; expected: string }) => [s.from, s.to, s.expected]),
    ).toEqual([
      ['off', 'on', 'Notifications, on, switch'],
      ['on', 'off', 'Notifications, off, switch'],
    ]);
    expect(keys[0].action).toContain('Space');
    const changed = structuredClone(voContract);
    changed.keyboard.control = { Enter: 'toggle' };
    const p2 = renderVoiceOverPack(changed);
    expect(p2.lanes[0].assertions[1].steps[0].action).toContain('Enter');
  });

  it('fails on an atAssertions id nobody wrote a procedure for (seeded)', () => {
    const seeded = structuredClone(voContract);
    seeded.a11y.atAssertions.push('manual-something-new');
    expect(() => renderVoiceOverPack(seeded)).toThrow(/manual-something-new/);
  });

  it('renders markdown mentioning each assertion', () => {
    const md = renderMarkdown(pack);
    for (const id of voContract.a11y.atAssertions) expect(md).toContain(id);
  });
});

describe('SJSwitch visual scenes', () => {
  it('have unique names and render a real switch', () => {
    const names = SCENES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of SCENES) {
      expect(s.html).toContain('type="checkbox"');
      expect(s.html).toContain('role="switch"');
      expect(s.html).toContain('class="sj-switch__thumb"');
      expect(sceneHtml(s)).toContain('/components.css');
    }
  });

  it('cover off, on, disabled, focus, long label, RTL and forced colors', () => {
    const n = SCENES.map((s) => s.name).join(' ');
    for (const k of ['off', 'on', 'disabled', 'focus', 'long-label', 'rtl', 'forced-colors'])
      expect(n).toContain(k);
    expect(SCENES.filter((s) => s.forced).length).toBeGreaterThanOrEqual(2);
    expect(SCENES.some((s) => s.focus)).toBe(true);
  });

  it('use no raw colour or pixel values (tokens only)', () => {
    for (const s of SCENES) {
      expect(s.html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(s.html).not.toMatch(/\d\s*px/);
      expect(s.html).not.toContain('style=');
    }
  });

  it('every baseline image has a manifest hash and a review-log entry (reviewed-only, MUST-2)', () => {
    expect(verifyBaselines(ROOT)).toEqual([]);
  });

  it('seeded: an unreviewed PNG, or one edited after review, fails the integrity check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sj-switch-baselines-'));
    try {
      mkdirSync(join(dir, 'chromium-linux-1x'), { recursive: true });
      writeFileSync(join(dir, 'chromium-linux-1x', 'switch-off.png'), 'not reviewed');
      expect(verifyBaselines(dir).length).toBeGreaterThan(0);
      // A hash in the manifest is not a review: without a REVIEW-LOG entry it still fails.
      const sha = createHash('sha256').update('not reviewed').digest('hex');
      writeFileSync(
        join(dir, 'chromium-linux-1x', 'manifest.json'),
        JSON.stringify({ 'switch-off': sha }),
      );
      expect(verifyBaselines(dir).join('\n')).toContain('no REVIEW-LOG entry');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
