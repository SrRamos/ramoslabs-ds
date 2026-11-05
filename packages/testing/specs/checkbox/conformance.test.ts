// Conformance bookkeeping for SJCheckbox (W1-C03c.f): the parity declaration leaves no empty cell, the
// evidence registry covers the checkbox contract, and the contract's
// own claims match what the suites assert. Pure, browser-free; the browser results feed `bun run parity`.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
import { contract, matrixTitle, paths, spec, checkboxExpected, checkboxScenarios } from './matrix';

const expected = checkboxExpected();

/** A passing result row for every declared cell on the three engines. */
const allPass = () =>
  ['chromium', 'firefox', 'webkit'].flatMap((browser) =>
    ADAPTERS.flatMap((adapter) =>
      paths().flatMap((p) =>
        checkboxScenarios().map((s) => ({
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
    for (const s of checkboxScenarios())
      expect(parseTitle(matrixTitle('react', s, 'native'))).not.toBeNull();
  });

  it('has no empty cell when every declared cell ran: 3 engines x 3 adapters x paths x scenarios', () => {
    const m = buildMatrix({ expected: expected as never, results: [{ rows: allPass() }] });
    expect(m.invalid).toEqual([]);
    expect(m.ok).toBe(true);
    expect(m.summary.missing).toBe(0);
    expect(m.summary.executed).toBe(3 * 3 * paths().length * checkboxScenarios().length);
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

  it('every contract step (all eight transitions) is a scenario, so no contract row goes unexercised', () => {
    const ids = checkboxScenarios()
      .filter((sc) => 'step' in sc.run)
      .map((sc) => (sc.run as { step: { id: string } }).step.id);
    expect([...new Set(ids)].sort()).toEqual(spec.steps.map((st: { id: string }) => st.id).sort());
    expect(spec.steps).toHaveLength(8);
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
  it('the checkbox contract refs resolve, are fresh and agree with its focus strategy', () => {
    const r = checkEvidence(dirs);
    expect(r.errors.filter((e: string) => /checkbox/i.test(e))).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('the repo skip rule (issue and owner on every skip) passes with these specs present', () => {
    // Exits 1 on any skip/fixme/todo without both. The only skips here are the CDP AX-tree tests on
    // Firefox and WebKit (#49, owner SrRamos), which carry both.
    execFileSync(process.execPath, [join(defaultRoot, 'scripts', 'skip-check.mjs')], {
      cwd: defaultRoot,
    });
    const skips = readdirSync(import.meta.dirname)
      .filter((f) => /\.(ts|js)$/.test(f) && f !== 'conformance.test.ts')
      .flatMap((f) =>
        readFileSync(join(import.meta.dirname, f), 'utf8')
          .split('\n')
          .filter((l) => /\btest\.(?:skip|fixme|todo)\s*\(/.test(l))
          .map((l) => `${f}: ${l.trim()}`),
      );
    for (const l of skips) expect(l).toContain('browserName !== ');
  });
});

const voContract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'));
const ROOT = join(import.meta.dirname, 'visual', 'baselines');

describe('SJCheckbox VoiceOver hook', () => {
  const pack = renderVoiceOverPack();

  it('renders every contract atAssertions id into both VoiceOver lanes', () => {
    expect(pack.assertions).toEqual(voContract.a11y.atAssertions);
    expect(pack.assertions).toContain('manual-speech-mixed-state');
    expect(pack.lanes.map((l) => l.id)).toEqual(['voiceover-macos-safari', 'voiceover-ios-safari']);
    for (const lane of pack.lanes)
      expect(lane.assertions.map((a: { id: string }) => a.id)).toEqual(
        voContract.a11y.atAssertions,
      );
  });

  it('carries every field the protocol requires, blanks for the human result fields', () => {
    for (const lane of pack.lanes) {
      expect(lane.environment).toBeTruthy();
      expect(lane.initialAnnouncement).toBe('Accept the terms, unchecked, checkbox');
      expect(lane.readingOrder).toEqual(['root', 'control', 'indicator', 'label']);
      expect(lane.stateChanges).toEqual(
        voContract.actions.map(
          (a: { from: string; to: string; emit: string }) => `${a.from} -> ${a.to} (${a.emit})`,
        ),
      );
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

  it('derives the Space steps from the contract keyboard map and actions, and tracks the contract', () => {
    const find = (id: string) =>
      pack.lanes[0].assertions.find((a: { id: string }) => a.id === id).steps as {
        from: string;
        to: string;
        expected: string;
        action: string;
      }[];
    expect(find('manual-toggle-space').map((s) => [s.from, s.to, s.expected])).toEqual([
      ['unchecked', 'checked', 'Accept the terms, checked, checkbox'],
      ['checked', 'unchecked', 'Accept the terms, unchecked, checkbox'],
      ['mixed-unchecked', 'checked', 'Accept the terms, checked, checkbox'],
      ['mixed-checked', 'unchecked', 'Accept the terms, unchecked, checkbox'],
    ]);
    expect(find('manual-toggle-space')[0]!.action).toContain('Space');
    // The mixed assertion must make VoiceOver say "mixed", then show activation leaving it.
    const mixed = find('manual-speech-mixed-state');
    expect(mixed[0]!.expected).toBe('Accept the terms, mixed, checkbox');
    expect(mixed.slice(1).map((s) => [s.from, s.to])).toEqual([
      ['mixed-unchecked', 'checked'],
      ['mixed-checked', 'unchecked'],
    ]);
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

describe('SJCheckbox visual scenes', () => {
  it('have unique names and render a real checkbox', () => {
    const names = SCENES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of SCENES) {
      expect(s.html).toContain('type="checkbox"');
      expect(s.html).not.toContain('role=');
      expect(s.html).not.toMatch(/\sindeterminate[\s=/>]/);
      expect(s.html).toContain('class="sj-checkbox__indicator"');
      expect(sceneHtml(s)).toContain('/components.css');
    }
  });

  it('cover unchecked, checked, indeterminate, disabled, focus, long label, RTL and forced colors', () => {
    const n = SCENES.map((s) => s.name).join(' ');
    for (const k of [
      'unchecked',
      'checked',
      'indeterminate',
      'disabled',
      'focus',
      'long-label',
      'rtl',
      'forced-colors',
    ])
      expect(n).toContain(k);
    for (const st of ['unchecked', 'checked', 'indeterminate'])
      expect(SCENES.filter((s) => s.forced && s.name.includes(st)).length).toBeGreaterThanOrEqual(
        1,
      );
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
    const dir = mkdtempSync(join(tmpdir(), 'sj-checkbox-baselines-'));
    try {
      mkdirSync(join(dir, 'chromium-linux-1x'), { recursive: true });
      writeFileSync(join(dir, 'chromium-linux-1x', 'checkbox-unchecked.png'), 'not reviewed');
      expect(verifyBaselines(dir).length).toBeGreaterThan(0);
      // A hash in the manifest is not a review: without a REVIEW-LOG entry it still fails.
      const sha = createHash('sha256').update('not reviewed').digest('hex');
      writeFileSync(
        join(dir, 'chromium-linux-1x', 'manifest.json'),
        JSON.stringify({ 'checkbox-unchecked': sha }),
      );
      expect(verifyBaselines(dir).join('\n')).toContain('no REVIEW-LOG entry');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
