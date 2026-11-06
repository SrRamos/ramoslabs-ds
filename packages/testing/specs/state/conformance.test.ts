// Conformance bookkeeping for SJState (W1-C11.f): fixtures vs contract, the parity-matrix declaration and its
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
import {
  EXPECTED_ANNOUNCEMENT,
  EXTRA_FIXTURES,
  FIXTURES,
  PART_ELEMENT,
  VARIANT_FIXTURES,
  headingOf,
} from './fixtures';
import { COMPOSITIONS } from './composition/fixtures';
import {
  ADAPTERS,
  ENGINES,
  EXECUTED_PATHS,
  stateExpected,
  stateScenarios,
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
  it('the three empty kinds are distinct fixtures with distinct variants, and loading and error complete the five', () => {
    const variants = VARIANT_FIXTURES.map((f) => FIXTURES[f]!.variant);
    expect(new Set(variants).size).toBe(5);
    expect(variants).toEqual(['first-use', 'no-results', 'cleared', 'loading', 'error']);
  });
  it('the error is covered with and without interrupt; only the interrupting one expects an alert', () => {
    expect(FIXTURES['error']!.interrupt).toBeUndefined();
    expect(FIXTURES['error-interrupt']!.interrupt).toBe(true);
    const roles = Object.entries(EXPECTED_ANNOUNCEMENT)
      .filter(([, a]) => a?.role === 'alert')
      .map(([n]) => n);
    expect(roles).toEqual(['error-interrupt']);
  });
  it('first-use and cleared are silent; loading, no-results and error announce politely', () => {
    expect(EXPECTED_ANNOUNCEMENT['first-use']).toBeNull();
    expect(EXPECTED_ANNOUNCEMENT['cleared']).toBeNull();
    for (const f of ['loading', 'no-results', 'error'])
      expect(EXPECTED_ANNOUNCEMENT[f]?.role, f).toBe('status');
  });
  it('every fixture declares an expected announcement (or silence) and every expectation has a fixture', () => {
    expect(Object.keys(EXPECTED_ANNOUNCEMENT).sort()).toEqual(Object.keys(FIXTURES).sort());
  });
  it('every non-silent expectation is the heading (or the explicit announce text), never the description', () => {
    for (const [name, a] of Object.entries(EXPECTED_ANNOUNCEMENT)) {
      if (!a) continue;
      const p = FIXTURES[name]!;
      expect(a.text, name).toBe(p.announce ?? headingOf(p));
    }
  });
  it('the part elements are the contract anatomy', () => {
    for (const a of contract.anatomy)
      expect(PART_ELEMENT[a.part as keyof typeof PART_ELEMENT], a.part).toBe(a.element);
  });
  it('compositions: each names an existing base fixture and keeps the icon part decorative', () => {
    for (const [name, c] of Object.entries(COMPOSITIONS)) {
      expect(FIXTURES, name).toHaveProperty(c.base);
      expect(c.props.icon, name).toBeTruthy();
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
        stateScenarios().map((s) => ({ title: matrixTitle(a, s, p), browser })),
      ),
    ),
  );

describe('parity matrix declaration (ADR-013 L6)', () => {
  const expected = stateExpected() as Parameters<typeof buildMatrix>[0]['expected'];
  it('titles parse as matrix rows', () => {
    expect(parseTitle(matrixTitle('react', stateScenarios()[0]!, 'native'))).not.toBeNull();
  });
  it('SJState has no actions: the contract derives no steps, so each fixture declares one `render` scenario with outcome none (NICE-5)', () => {
    expect(contract.actions).toEqual([]);
    expect(spec.steps).toEqual([]);
    expect(DECLARED_ACTIONS).toEqual([]);
    const scenarios = stateScenarios();
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
  it('SJState reads no capability, so native and fallback:all run the same code (the single-path justification)', () => {
    // The contract declares no `support` entry and no adapter source mentions `supports`: there is no branch for
    // a forced-false path to take. Both paths still execute, to prove the injected map arrives and changes nothing.
    expect(contract.support).toEqual([]);
    const sources = [
      ['core', 'state', 'index.ts'],
      ['react', 'state', 'index.ts'],
      ['vue', 'state', 'SJState.ts'],
      ['vanilla', 'state', 'index.ts'],
    ];
    for (const s of sources) {
      const file = join(repo, 'packages', s[0]!, 'src', s[1]!, s[2]!);
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bsupports\b|detectSupports/);
    }
    expect(EXECUTED_PATHS).toEqual(['native', 'fallback:all']);
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
    const { 'manual-state-interruption-alert-once': _drop, ...rest } = AT_STEPS;
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
    const dir = mkdtempSync(join(tmpdir(), 'sj-state-baselines-'));
    try {
      mkdirSync(join(dir, 'chromium-linux-1x'), { recursive: true });
      writeFileSync(join(dir, 'chromium-linux-1x', 'state-first-use.png'), 'not reviewed');
      expect(verifyBaselines(dir).length).toBeGreaterThan(0);
      // A hash in the manifest is not a review: without a REVIEW-LOG entry it still fails.
      const sha = createHash('sha256').update('not reviewed').digest('hex');
      writeFileSync(
        join(dir, 'chromium-linux-1x', 'manifest.json'),
        JSON.stringify({ 'state-first-use': sha }),
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
    for (const n of names) expect(n).toMatch(/^state-[a-z0-9-]+$/);
  });
});

describe('evidence and skips', () => {
  it('evidence registry: state refs resolve, are fresh and cover every primary pair', () => {
    const { errors } = checkEvidence({
      contractsDir: join(repo, 'packages', 'contracts', 'contracts'),
      registryDir: join(repo, 'docs', 'architecture', 'evidence', 'at-support'),
    });
    expect(errors.filter((e: string) => /state|live-region/i.test(e))).toEqual([]);
  });
  it('the repo skip rule (issue and owner on every skip) passes with these specs present', () => {
    // Exits 1 on any skip/fixme/todo without both; specs/state must contain none.
    execFileSync(process.execPath, [join(repo, 'scripts', 'skip-check.mjs')], { cwd: repo });
    for (const f of readdirSync(here).filter(
      (f) => /\.(ts|js)$/.test(f) && f !== 'conformance.test.ts',
    ))
      expect(readFileSync(join(here, f), 'utf8'), f).not.toMatch(
        /\b(?:test|it|describe)\.(?:skip|fixme|todo)\s*\(/,
      );
  });
});
