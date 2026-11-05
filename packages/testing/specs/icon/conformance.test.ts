// Conformance bookkeeping for SJIcon (W1-C12.f): fixtures vs contract, the parity-matrix declaration and its
// seeded failures, the VoiceOver script hook, bundle ceilings, visual-baseline review state, and the skip rule.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMatrix, collectResults, parseTitle } from '../../parity/index.js';
import { execFileSync } from 'node:child_process';
import { verifyBaselines } from '../../visual/baselines.js';
import { checkEvidence } from '../../evidence/index.js';
import { EXTRA_FIXTURES, FIXTURES, LABELLED } from './fixtures';
import { COMPOSITIONS, EXPECTED_NAME } from './composition/fixtures';
import {
  ADAPTERS,
  ENGINES,
  EXECUTED_PATHS,
  iconExpected,
  iconScenarios,
  contract,
  matrixTitle,
  DECLARED_ACTIONS,
  spec,
} from './matrix';
import { AT_STEPS, renderVoiceOverScript } from './voiceover.js';
import { SCENES } from './visual/scenes.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');

describe('fixtures', () => {
  it('cover every fixture the contract names; extras are declared', () => {
    for (const f of contract.fixtures) expect(FIXTURES).toHaveProperty(f);
    expect(Object.keys(FIXTURES).filter((f) => !contract.fixtures.includes(f))).toEqual(
      EXTRA_FIXTURES,
    );
  });
  it('every fixture has an ARIA snapshot file', () => {
    for (const f of Object.keys(FIXTURES))
      expect(existsSync(join(here, 'aria', `${f}.yml`))).toBe(true);
  });
  it('exactly the `labelled` fixture carries a label; every other fixture is decorative', () => {
    for (const [name, p] of Object.entries(FIXTURES))
      expect(!!p.label, name).toBe(LABELLED.includes(name));
  });
  it('compositions: every one has an expected name; icon-only buttons carry the button label (contract/icon-only-name)', () => {
    expect(Object.keys(EXPECTED_NAME).sort()).toEqual(Object.keys(COMPOSITIONS).sort());
    for (const [name, c] of Object.entries(COMPOSITIONS)) {
      if (c.iconOnly) expect(c.label, name).toBe(EXPECTED_NAME[name]);
      else expect(EXPECTED_NAME[name], name).toBe(c.text);
    }
  });
});

/** Playwright-JSON-shaped results where every executed cell passed. */
function report(titles: Array<{ title: string; browser: string }>, status = 'expected') {
  return {
    suites: [
      {
        specs: titles.map((t) => ({
          title: t.title,
          tests: [
            {
              projectName: t.browser,
              status,
              annotations: [],
              results: [{ status: status === 'expected' ? 'passed' : 'failed' }],
            },
          ],
        })),
      },
    ],
  };
}
const allTitles = () =>
  ENGINES.flatMap((browser) =>
    ADAPTERS.flatMap((a) =>
      EXECUTED_PATHS.flatMap((p) =>
        iconScenarios().map((s) => ({ title: matrixTitle(a, s, p), browser })),
      ),
    ),
  );

describe('parity matrix declaration (ADR-013 L6)', () => {
  const expected = iconExpected() as Parameters<typeof buildMatrix>[0]['expected'];
  it('titles parse as matrix rows', () => {
    expect(parseTitle(matrixTitle('react', iconScenarios()[0]!, 'native'))).not.toBeNull();
  });
  it('SJIcon has no actions: the contract derives no steps, so each fixture declares one `render` scenario with outcome none (NICE-5)', () => {
    expect(contract.actions).toEqual([]);
    expect(spec.steps).toEqual([]);
    expect(DECLARED_ACTIONS).toEqual([]);
    const scenarios = iconScenarios();
    expect(scenarios.map((s) => s.fixture)).toEqual(Object.keys(FIXTURES));
    for (const s of scenarios) expect([s.action, s.outcome]).toEqual(['render', 'none']);
    expect(expected.scenarios).toHaveLength(Object.keys(FIXTURES).length);
  });
  it('is complete when every executed cell has a passing result: no empty cell', () => {
    const m = buildMatrix({ expected, results: [collectResults(report(allTitles()))] });
    expect(m.missing).toEqual([]);
    expect(m.invalid).toEqual([]);
    expect(m.ok).toBe(true);
    // Every cell is executed, or explained with a reason.
    for (const c of m.cells) expect(c.executed || !!c.reason).toBe(true);
  });
  it('seeded: a missing result is a MISSING cell and fails', () => {
    const m = buildMatrix({ expected, results: [collectResults(report(allTitles().slice(1)))] });
    expect(m.missing).toHaveLength(1);
    expect(m.ok).toBe(false);
  });
  it('seeded: a failed result fails', () => {
    const m = buildMatrix({
      expected,
      results: [collectResults(report(allTitles().slice(0, 1), 'unexpected'))],
    });
    expect(m.summary.failed).toBe(1);
    expect(m.ok).toBe(false);
  });
  it('every non-executed path is exempt with a reason that names why', () => {
    for (const x of expected.exemptions ?? []) expect(x.reason).toMatch(/no support\[\] entry/);
  });
});

describe('VoiceOver script hook (W1-505)', () => {
  it('renders every contract atAssertion with the ADR-013 protocol fields', () => {
    const { markdown, steps } = renderVoiceOverScript(contract);
    expect(steps.map((s) => s.id)).toEqual(contract.a11y.atAssertions);
    for (const id of contract.a11y.atAssertions) expect(markdown).toContain(`## ${id}`);
    for (const field of [
      'Environment',
      'expected speech',
      'Actual speech',
      'Focus before',
      'Focus after',
      'Reading order',
      'State changes',
      'Pass/fail',
    ])
      expect(markdown).toContain(field);
    // The status printed is the contract's own wording, never stronger.
    expect(markdown).toContain('hands-on test pending and not yet logged');
  });
  it('seeded: an assertion with no script text, or script text with no assertion, fails', () => {
    const c = structuredClone(contract);
    c.a11y.atAssertions.push('manual-new');
    expect(() => renderVoiceOverScript(c)).toThrow(/manual-new/);
    const { 'manual-icon-label-announced': _drop, ...rest } = AT_STEPS;
    void _drop;
    expect(() => renderVoiceOverScript(contract, rest)).toThrow(/no VoiceOver script text/);
  });
  it('each step names a fixture that exists', () => {
    for (const s of Object.values(AT_STEPS)) expect(FIXTURES).toHaveProperty(s.fixture);
  });
});

describe('visual baselines (ADR-013 L5): reviewed-only, human review is mandatory', () => {
  const root = join(here, 'visual', 'baselines');
  it('no baseline exists without a manifest hash and a review-log entry', () => {
    expect(verifyBaselines(root)).toEqual([]);
  });
  it('seeded: an unreviewed PNG (no manifest hash, no review-log entry) fails the integrity check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sj-icon-baselines-'));
    try {
      mkdirSync(join(dir, 'chromium-linux-1x'), { recursive: true });
      writeFileSync(join(dir, 'chromium-linux-1x', 'icon-default.png'), 'not reviewed');
      expect(verifyBaselines(dir).length).toBeGreaterThan(0);
      // A hash in the manifest is not a review: without a REVIEW-LOG entry it still fails.
      const sha = createHash('sha256').update('not reviewed').digest('hex');
      writeFileSync(
        join(dir, 'chromium-linux-1x', 'manifest.json'),
        JSON.stringify({ 'icon-default': sha }),
      );
      expect(verifyBaselines(dir).join('\n')).toContain('no REVIEW-LOG entry');
      expect(SCENES.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('scene names are unique and filesystem-safe', () => {
    const names = SCENES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^icon-[a-z0-9-]+$/);
  });
});

describe('evidence and skips', () => {
  it('evidence registry: icon refs resolve, are fresh and cover every primary pair', () => {
    const { errors } = checkEvidence({
      contractsDir: join(repo, 'packages', 'contracts', 'contracts'),
      registryDir: join(repo, 'docs', 'architecture', 'evidence', 'at-support'),
    });
    expect(errors.filter((e: string) => /icon|img-role/i.test(e))).toEqual([]);
  });
  it('the repo skip rule (issue and owner on every skip) passes with these specs present', () => {
    // Exits 1 on any skip/fixme/todo without both; specs/icon must contain none.
    execFileSync(process.execPath, [join(repo, 'scripts', 'skip-check.mjs')], { cwd: repo });
    for (const f of readdirSync(here).filter(
      (f) => /\.(ts|js)$/.test(f) && f !== 'conformance.test.ts',
    ))
      expect(readFileSync(join(here, f), 'utf8'), f).not.toMatch(
        /\b(?:test|it|describe)\.(?:skip|fixme|todo)\s*\(/,
      );
  });
});
