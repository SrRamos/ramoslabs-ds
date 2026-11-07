// Conformance bookkeeping for SJSkeleton: fixtures vs contract, the parity-matrix declaration and its seeded failures,
// the token/fallback agreement, the VoiceOver script hook, visual-baseline review state, and the skip rule.
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
import { loadTokens } from '../../contrast/index.js';
import {
  SKELETON_DELAY_MS,
  SKELETON_MIN_DURATION_MS,
  parseDuration,
} from '@ramoslabs/core/skeleton';
import {
  EXPECTED_ANNOUNCEMENT,
  EXTRA_FIXTURES,
  FIXTURES,
  PART_ELEMENT,
  SHAPE_FIXTURES,
} from './fixtures';
import { COMPOSITIONS } from './composition/fixtures';
import {
  ADAPTERS,
  ENGINES,
  EXECUTED_PATHS,
  skeletonExpected,
  skeletonScenarios,
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
  it('two group fixtures (loading, loaded) and the rest are drawn shapes', () => {
    expect(Object.keys(FIXTURES).filter((f) => FIXTURES[f]!.shape === 'group')).toEqual([
      'group-loading',
      'group-loaded',
    ]);
    expect(SHAPE_FIXTURES).toHaveLength(Object.keys(FIXTURES).length - 2);
    expect(FIXTURES['group-loaded']!.loading).toBe(false);
  });
  it('every fixture declares an expected announcement (or silence) and only the loading group speaks', () => {
    expect(Object.keys(EXPECTED_ANNOUNCEMENT).sort()).toEqual(Object.keys(FIXTURES).sort());
    expect(
      Object.entries(EXPECTED_ANNOUNCEMENT)
        .filter(([, a]) => a)
        .map(([n]) => n),
    ).toEqual(['group-loading']);
    expect(EXPECTED_ANNOUNCEMENT['group-loading']).toEqual({
      role: 'status',
      text: FIXTURES['group-loading']!.announce,
    });
  });
  it('the part elements are the contract anatomy', () => {
    for (const a of contract.anatomy)
      expect(PART_ELEMENT[a.part as keyof typeof PART_ELEMENT], a.part).toBe(a.element);
  });
  it('declares one status live region and no alert, polite, as the specs assume', () => {
    expect(contract.a11y.liveRegions).toEqual([{ id: 'status', politeness: 'polite' }]);
  });
  it('compositions: each is a loading state; the spoken lists start with the heading', () => {
    for (const [name, c] of Object.entries(COMPOSITIONS)) {
      expect(c.spoken[0]?.text, name).toBe(c.props.heading);
    }
  });
});

describe('timing defaults', () => {
  it('the core fallbacks equal the motion.skeleton tokens', () => {
    const t = loadTokens();
    expect(parseDuration(t['motion-skeleton-delay'], -1)).toBe(SKELETON_DELAY_MS);
    expect(parseDuration(t['motion-skeleton-min-duration'], -1)).toBe(SKELETON_MIN_DURATION_MS);
    expect([SKELETON_DELAY_MS, SKELETON_MIN_DURATION_MS]).toEqual([300, 500]);
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
        skeletonScenarios().map((s) => ({ title: matrixTitle(a, s, p), browser })),
      ),
    ),
  );

describe('parity matrix declaration (ADR-013 L6)', () => {
  const expected = skeletonExpected() as Parameters<typeof buildMatrix>[0]['expected'];
  it('titles parse as matrix rows', () => {
    expect(parseTitle(matrixTitle('react', skeletonScenarios()[0]!, 'native'))).not.toBeNull();
  });
  it('SJSkeleton has no actions: the contract derives no steps, so each fixture declares one `render` scenario with outcome none (NICE-5)', () => {
    expect(contract.actions).toEqual([]);
    expect(spec.steps).toEqual([]);
    expect(DECLARED_ACTIONS).toEqual([]);
    const scenarios = skeletonScenarios();
    expect(scenarios.map((s) => s.fixture)).toEqual(Object.keys(FIXTURES));
    for (const s of scenarios) expect([s.action, s.outcome]).toEqual(['render', 'none']);
    expect(expected.scenarios).toHaveLength(Object.keys(FIXTURES).length);
  });
  it('is complete when every executed cell has a passing result: no empty cell', () => {
    const m = buildMatrix({ expected, results: [collectResults(report(allTitles()))] });
    expect(m.missing).toEqual([]);
    expect(m.invalid).toEqual([]);
    expect(m.ok).toBe(true);
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
  it('SJSkeleton reads no capability, so native and fallback:all run the same code (the single-path justification)', () => {
    // The contract declares no `support` entry and no adapter source mentions `supports`: there is no branch for
    // a forced-false path to take. Both paths still execute, to prove the injected map arrives and changes nothing.
    // The only runtime facility it reads is the scheduler (`runtime: ["scheduler"]`), which both paths share.
    expect(contract.support).toEqual([]);
    expect(contract.runtime).toEqual(['scheduler']);
    const sources = [
      ['core', 'skeleton', 'index.ts'],
      ['react', 'skeleton', 'index.ts'],
      ['vue', 'skeleton', 'SJSkeleton.ts'],
      ['vanilla', 'skeleton', 'index.ts'],
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
    const { 'manual-skeleton-busy-polite-once': _drop, ...rest } = AT_STEPS;
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
    const dir = mkdtempSync(join(tmpdir(), 'sj-skeleton-baselines-'));
    try {
      mkdirSync(join(dir, 'chromium-linux-1x'), { recursive: true });
      writeFileSync(join(dir, 'chromium-linux-1x', 'skeleton-text.png'), 'not reviewed');
      expect(verifyBaselines(dir).length).toBeGreaterThan(0);
      // A hash in the manifest is not a review: without a REVIEW-LOG entry it still fails.
      const sha = createHash('sha256').update('not reviewed').digest('hex');
      writeFileSync(
        join(dir, 'chromium-linux-1x', 'manifest.json'),
        JSON.stringify({ 'skeleton-text': sha }),
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
    for (const n of names) expect(n).toMatch(/^skeleton-[a-z0-9-]+$/);
  });
});

describe('evidence and skips', () => {
  it('evidence registry: skeleton refs resolve, are fresh and cover every primary pair', () => {
    const { errors } = checkEvidence({
      contractsDir: join(repo, 'packages', 'contracts', 'contracts'),
      registryDir: join(repo, 'docs', 'architecture', 'evidence', 'at-support'),
    });
    expect(errors.filter((e: string) => /skeleton|live-region/i.test(e))).toEqual([]);
  });
  it('the repo skip rule (issue and owner on every skip) passes with these specs present', () => {
    // Exits 1 on any skip/fixme/todo without both; specs/skeleton must contain none.
    execFileSync(process.execPath, [join(repo, 'scripts', 'skip-check.mjs')], { cwd: repo });
    const files = [
      ...readdirSync(here).map((f) => join(here, f)),
      ...readdirSync(join(here, 'composition')).map((f) => join(here, 'composition', f)),
    ].filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('conformance.test.ts'));
    for (const f of files)
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /\b(?:test|it|describe)\.(?:skip|fixme|todo)\s*\(/,
      );
  });
});
