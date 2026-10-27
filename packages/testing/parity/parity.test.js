// @ts-check
// Tests for the parity matrix generator (W1-313). Every gate has a seeded violation that must fail.
import { describe, expect, it } from 'vitest';
import {
  buildMatrix,
  collectResults,
  parseTitle,
  renderMarkdown,
  validateExpected,
} from './index.js';

const title = (
  /** @type {string} */ ad,
  /** @type {string} */ sc,
  /** @type {string} */ ac,
  /** @type {string} */ p,
) => `Probe | ${ad} | ${sc} | ${ac} | path=${p}`;

/** @param {{ title: string, browser: string, status?: string, results?: any[], annotations?: any[] }[]} tests */
const report = (tests) => ({
  suites: [
    {
      title: 'file',
      specs: [],
      suites: tests.map((t) => ({
        title: 'describe',
        suites: [],
        specs: [
          {
            title: t.title,
            tests: [
              {
                projectName: t.browser,
                status: t.status ?? 'expected',
                annotations: t.annotations ?? [],
                results: t.results ?? [{ status: 'passed', retry: 0 }],
              },
            ],
          },
        ],
      })),
    },
  ],
});

/** @type {any} */
const expected = {
  version: 1,
  component: 'Probe',
  browsers: [{ id: 'chromium' }, { id: 'ios-17', status: 'not-run', reason: 'no device' }],
  adapters: ['react', 'vue'],
  paths: [{ id: 'native' }, { id: 'fallback:popover' }],
  scenarios: [{ scenario: 's', action: 'pointer' }],
  exemptions: [],
};
const full = () =>
  /** @type {any[]} */ (
    ['react', 'vue'].flatMap((a) =>
      ['native', 'fallback:popover'].map((p) => ({
        title: title(a, 's', 'pointer', p),
        browser: 'chromium',
      })),
    )
  );
const run = (/** @type {any[]} */ tests, /** @type {any} */ e = expected) =>
  buildMatrix({ expected: e, results: [collectResults(report(tests), 'r.json')] });

describe('parseTitle', () => {
  it('parses a matrix title and ignores everything else', () => {
    expect(parseTitle(title('react', 'a , b', 'Space', 'fallback:popover'))).toEqual({
      component: 'Probe',
      adapter: 'react',
      scenario: 'a , b',
      action: 'Space',
      path: 'fallback:popover',
    });
    expect(parseTitle('Probe | react | s | pointer')).toBeNull();
    expect(parseTitle('seeded defect | react | d | pointer is reported')).toBeNull();
    expect(parseTitle('Probe | react | s | pointer | path=')).toBeNull();
    expect(parseTitle('plan')).toBeNull();
  });
});

describe('buildMatrix', () => {
  it('a complete passing run is ok, forced-false paths are distinct rows', () => {
    const m = run(full());
    expect(m.ok).toBe(true);
    expect(m.summary).toMatchObject({
      cells: 8,
      executed: 4,
      passed: 4,
      failed: 0,
      notRun: 4,
      missing: 0,
    });
    expect(new Set(m.cells.map((c) => c.path))).toEqual(new Set(['native', 'fallback:popover']));
    const dev = m.cells.filter((c) => c.browser === 'ios-17');
    expect(
      dev.every((c) => c.status === 'not-run' && c.reason === 'no device' && !c.executed),
    ).toBe(true);
  });
  it('SEEDED: a missing cell fails and is named', () => {
    const m = run(full().slice(1));
    expect(m.ok).toBe(false);
    expect(m.summary.missing).toBe(1);
    expect(m.missing[0]).toMatchObject({ adapter: 'react', path: 'native', browser: 'chromium' });
    expect(m.missing[0].reason).toMatch(/MISSING/);
  });
  it('SEEDED: a failed cell fails the gate', () => {
    const t = full();
    t[1] = {
      ...t[1],
      status: 'unexpected',
      results: [{ status: 'failed', error: { message: 'boom\nstack' } }],
    };
    const m = run(t);
    expect(m.ok).toBe(false);
    expect(m.summary).toMatchObject({ failed: 1, executed: 4 });
    expect(m.cells.find((c) => c.status === 'failed')?.reason).toBe('boom');
  });
  it('SEEDED: a retried (flaky) cell is invalid, never a pass', () => {
    const t = full();
    t[0] = { ...t[0], status: 'flaky', results: [{ status: 'failed' }, { status: 'passed' }] };
    const m = run(t);
    expect(m.ok).toBe(false);
    expect(m.invalid.join()).toMatch(/retried/);
  });
  it('SEEDED: a skip without a reason is invalid; with a reason it is a not-run cell', () => {
    const skipped = { status: 'skipped', results: [{ status: 'skipped' }] };
    let t = full();
    t[0] = { ...t[0], ...skipped };
    expect(run(t).ok).toBe(false);
    t = full();
    t[0] = {
      ...t[0],
      ...skipped,
      annotations: [{ type: 'skip', description: 'issue #1 owner @x' }],
    };
    const m = run(t);
    expect(m.cells.find((c) => c.reason === 'issue #1 owner @x')?.status).toBe('not-run');
    expect(m.invalid).toEqual([]);
    expect(m.ok).toBe(true);
  });
  it('SEEDED: a duplicate result, an undeclared result and a result for an exempt cell fail', () => {
    expect(run([...full(), full()[0]]).invalid.join()).toMatch(/duplicate/);
    const extra = run([
      ...full(),
      { title: title('react', 's', 'pointer', 'fallback:nope'), browser: 'chromium' },
    ]);
    expect(extra.ok).toBe(false);
    expect(extra.summary.extra).toBe(1);
    const m = run([
      ...full(),
      { title: title('react', 's', 'pointer', 'native'), browser: 'ios-17' },
    ]);
    expect(m.invalid.join()).toMatch(/declared not-run but has a result/);
  });
  it('exemptions turn a missing cell into an explicit not-applicable with a reason', () => {
    const e = {
      ...expected,
      exemptions: [
        {
          match: { path: 'fallback:popover', adapter: 'vue' },
          status: 'not-applicable',
          reason: 'vue never reads popover',
        },
      ],
    };
    const t = full().filter(
      (x) => !(x.title.includes('| vue |') && x.title.includes('fallback:popover')),
    );
    const m = run(t, e);
    expect(m.ok).toBe(true);
    expect(m.summary.notApplicable).toBe(1);
    expect(m.cells.find((c) => c.status === 'not-applicable')?.reason).toBe(
      'vue never reads popover',
    );
  });
  it('SEEDED: a malformed declaration cannot certify', () => {
    expect(
      validateExpected({ ...expected, exemptions: [{ match: {}, status: 'not-run', reason: '' }] }),
    ).toHaveLength(1);
    expect(
      validateExpected({ ...expected, browsers: [{ id: 'x', status: 'not-run' }] })[0],
    ).toMatch(/without a reason/);
    expect(validateExpected({ ...expected, paths: [] })[0]).toMatch(/no paths/);
    expect(run(full(), { ...expected, adapters: [] }).ok).toBe(false);
  });
  it('is deterministic and counts non-matrix tests as ignored', () => {
    const t = [...full(), { title: 'harness check', browser: 'chromium' }];
    const a = run(t);
    expect(a.summary.ignoredNonMatrixTests).toBe(1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(run(t)));
  });
});

describe('renderMarkdown', () => {
  it('states the gate, shows not-run reasons and lists missing cells', () => {
    const md = renderMarkdown(run(full().slice(1)));
    expect(md).toMatch(/Gate: \*\*FAIL\*\*/);
    expect(md).toMatch(/ios-17: not-run: no device/);
    expect(md).toMatch(/## Missing cells/);
    expect(renderMarkdown(run(full()))).toMatch(/Gate: \*\*PASS\*\*/);
  });
  it('shows a forced-false run that equals native on that engine', () => {
    const t = full();
    t[1] = {
      ...t[1],
      annotations: [{ type: 'noop', description: 'engine already lacks popover' }],
    };
    expect(renderMarkdown(run(t))).toMatch(/identical to native/);
  });
});
