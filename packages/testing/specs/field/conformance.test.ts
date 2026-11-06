// Conformance bookkeeping for SJField, SJInput and SJForm (W1-C02.f): fixtures vs the three contracts, the parity
// declaration and its seeded failures, scenario coverage of the plan 6.2 C02 duties, the ADR-007 kinds, the
// capability paths, the evidence registry, the skip rule, the VoiceOver hook, visual scenes and the known limit.
// Pure, browser-free; the browser results feed `bun run parity:field`.
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
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
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyBaselines } from '../../visual/baselines.js';
import { sceneHtml } from '../../visual/site.mjs';
import { SCENES } from './visual/scenes.js';
import {
  CONTRACT_FILES,
  REQUIRED_FIELDS,
  renderMarkdown,
  renderVoiceOverPack,
} from './voiceover.js';
import { buildMatrix, collectResults, parseTitle } from '../../parity/index.js';
import { checkEvidence } from '../../evidence/index.js';
import { defaultRoot } from '../../size/index.js';
import { KINDS } from '../../../core/src/kinds/table';
import {
  ADAPTERS,
  ALL_FIXTURES,
  ENGINES,
  FIELD_FIXTURES,
  FORM_FIXTURES,
  INPUT_FIXTURES,
} from './fixtures';
import {
  INPUT_KINDS,
  KIND_ROWS,
  SECRET_KINDS,
  contracts,
  expectedAttrs,
  expectedHints,
  fieldExpected,
  fieldScenarios,
  matrixTitle,
  paths,
  specs,
} from './matrix';

const here = dirname(fileURLToPath(import.meta.url));
const expected = fieldExpected() as Parameters<typeof buildMatrix>[0]['expected'];

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
      paths().flatMap((p) =>
        fieldScenarios().map((s) => ({ title: matrixTitle(a, s, p.id), browser })),
      ),
    ),
  );

describe('fixtures <-> contracts', () => {
  it('every fixture each contract names has a scene, and no scene lacks a contract fixture', () => {
    expect(Object.keys(FIELD_FIXTURES)).toEqual(contracts.field.fixtures);
    expect(Object.keys(INPUT_FIXTURES)).toEqual(contracts.input.fixtures);
    expect(Object.keys(FORM_FIXTURES)).toEqual(contracts.form.fixtures);
    expect(Object.keys(ALL_FIXTURES)).toHaveLength(
      contracts.field.fixtures.length +
        contracts.input.fixtures.length +
        contracts.form.fixtures.length,
    );
  });
  it('every fixture has an ARIA snapshot file, and there is no orphan snapshot', () => {
    const files = readdirSync(join(here, 'aria'))
      .filter((f) => f.endsWith('.yml'))
      .sort();
    expect(files).toEqual(
      Object.keys(ALL_FIXTURES)
        .map((id) => `${id.replace('/', '-')}.yml`)
        .sort(),
    );
  });
  it('field and form have no actions or events (ADR-010 G-ICON); input has the two touched-fallback steps, both exercised', () => {
    for (const k of ['field', 'form'] as const) {
      expect(contracts[k].actions, k).toEqual([]);
      expect(contracts[k].events, k).toEqual([]);
      expect(specs[k].steps, k).toEqual([]);
    }
    // SJInput's machine is the `:user-invalid` fallback: pristine -> touched (a change or a failed submit) and
    // touched -> pristine (the form reset). Neither has a key trigger, so each is driven through the real
    // scenarios that cause it, and every step must have one.
    expect(specs.input.steps.map((s: { id: string }) => s.id).sort()).toEqual([
      'reset:touched>pristine',
      'touch:pristine>touched',
    ]);
    const ids = fieldScenarios().map((s) => s.id);
    for (const want of ['uv-change', 'uv-submit']) expect(ids, `touch <- ${want}`).toContain(want);
    expect(ids).toContain('uv-reset');
  });
});

describe('parity matrix declaration (ADR-013 L6)', () => {
  it('every title the spec emits parses as a matrix row', () => {
    for (const s of fieldScenarios())
      expect(parseTitle(matrixTitle('react', s, 'native'))).not.toBeNull();
    expect(new Set(fieldScenarios().map((s) => `${s.scenario}|${s.action}`)).size).toBe(
      fieldScenarios().length,
    );
  });
  it('is complete when every executed cell has a passing result: 3 engines x 3 adapters x 2 paths x scenarios', () => {
    const m = buildMatrix({ expected, results: [collectResults(report(allTitles()))] });
    expect(m.missing).toEqual([]);
    expect(m.invalid).toEqual([]);
    expect(m.ok).toBe(true);
    expect(m.summary.executed).toBe(3 * 3 * paths().length * fieldScenarios().length);
    expect(m.summary.failed).toBe(0);
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
  it('floor and device rows are declared not-run with the ADR-013 reason, never blank', () => {
    const m = buildMatrix({ expected, results: [collectResults(report(allTitles()))] });
    expect(m.summary.notRun).toBeGreaterThan(0);
    for (const c of m.cells.filter((c) => c.status === 'not-run')) expect(c.reason).toBeTruthy();
  });
});

describe('capability paths (ADR-001, ADR-013 forced-false)', () => {
  const support = contracts.input.support;
  it('SJInput declares exactly the `user-invalid` fallback; field and form declare none', () => {
    expect(support).toHaveLength(1);
    expect(support[0].feature).toBe('user-invalid');
    expect(support[0].fallbackUntil.chromium).toBe(118);
    expect(support[0].nativeFrom.chromium).toBe(119);
    expect(contracts.field.support).toEqual([]);
    expect(contracts.form.support).toEqual([]);
  });
  it('runs `native` (real detection) and `fallback:all` (every capability forced false); the other keys are exempt with a reason', () => {
    expect(paths().map((p) => p.id)).toEqual(['native', 'fallback:all']);
    const keys = (expected.exemptions ?? []).map((x) => (x.match as { path: string }).path);
    expect(keys).toHaveLength(10);
    for (const x of expected.exemptions ?? []) expect(x.reason).toMatch(/fallback:all|native/);
    expect(
      (expected.exemptions ?? []).find(
        (x) => (x.match as { path: string }).path === 'fallback:userInvalid',
      )?.reason,
    ).toMatch(/only capability SJInput reads/);
  });
  it('the forced-false run is the Chromium 114-118 stand-in: the l2 spec asserts the two paths run different code', () => {
    const spec = readFileSync(join(here, 'l2.e2e.ts'), 'utf8');
    expect(spec).toContain('uv-code-path');
    expect(spec).toContain('fallback path sets data-touched');
    expect(spec).toContain('native path sets no data-touched');
  });
});

describe('plan 6.2 C02 duties are all scenarios', () => {
  const ids = fieldScenarios().map((s) => s.id);
  it.each([
    ['ADR-007 kind rows on a rendered input', ['kinds', 'kind-flags']],
    [
      'owner enterkeyhint, late-mounted and reordered',
      [
        'hints',
        'hints-send-search',
        'hints-textarea',
        'hints-late',
        'hints-reorder',
        'hints-data-first',
      ],
    ],
    ['owner autoSubmit final for OTP, own autoSubmit standalone', ['otp-owner', 'otp-standalone']],
    [
      'enter prop vs native action/method, and a real submit',
      ['form-native', 'form-enter-submits'],
    ],
    ['form state identical to bare inputs, after reset', ['form-state', 'form-reset']],
    [
      ':user-invalid fallback: tab-through, change, submit, reset, two code paths',
      ['uv-tab-through', 'uv-change', 'uv-submit', 'uv-reset', 'uv-code-path'],
    ],
    [
      '3.3.7 retained, never secrets, tab-through keeps it',
      ['retain-offered', 'retain-secrets', 'retain-tab-through'],
    ],
    [
      'error announced once, silent at mount, icon never read, known limit',
      ['announce-once', 'announce-repeat', 'announce-icon', 'announce-limit'],
    ],
    [
      'derived ARIA, aria-errormessage only where asked',
      ['field-ids', 'field-invalid', 'field-errormessage', 'field-native'],
    ],
  ])('%s', (_why, want) => {
    for (const w of want) expect(ids, w).toContain(w);
  });
  it('the browser suites carry 2.5.8, 2.4.13, forced-colors, RTL and contrast titles', () => {
    const a11y = readFileSync(join(here, 'a11y.e2e.ts'), 'utf8');
    for (const k of ['2.5.8', '2.4.13', 'forced-colors', 'rtl', 'contrast |'])
      expect(a11y, k).toContain(k);
    expect(a11y).toContain('the invalid border >= 3:1');
    expect(a11y).toContain('the disabled control is visibly distinct');
  });
});

describe('ADR-007 kind expectations come from the kinds contract, independently of the core table', () => {
  it("covers every kind row: the core table has no kind the contract lacks, and `choice` is SJSelect's", () => {
    expect(Object.keys(KINDS).sort()).toEqual(KIND_ROWS.map((r) => r.kind).sort());
    expect(INPUT_KINDS).toHaveLength(KIND_ROWS.length - 1);
    expect(INPUT_KINDS).not.toContain('choice');
  });
  it('no kind carries a maxlength row and type=number is only ever quantity', () => {
    for (const k of INPUT_KINDS) {
      const e = expectedAttrs(k);
      if (e.type === 'number') expect(k).toBe('quantity');
    }
    expect(expectedAttrs('quantity').type).toBe('number');
    expect(expectedAttrs('quantity', { variant: 'text' }).type).toBe('text');
    for (const k of ['otp', 'amount', 'postal', 'reference', 'account', 'tax-id', 'cc-number'])
      expect(KIND_ROWS.find((r) => r.kind === k)!.forbiddenTypes ?? [], k).toContain('number');
  });
  it('the Enter hints follow ADR-007: textarea excluded, fixed kinds keep theirs, the last editable submits', () => {
    expect(expectedHints(['name', 'email', 'phone'])).toEqual(['next', 'next', 'go']);
    expect(expectedHints(['name', 'address', 'email'])).toEqual(['next', 'enter', 'go']);
    expect(expectedHints(['name', 'email', 'address'])).toEqual(['next', 'go', 'enter']);
    expect(expectedHints(['name', 'search', 'otp'])).toEqual(['next', 'search', 'done']);
    expect(expectedHints(['name', 'otp'], { autoSubmit: true })).toEqual(['next', 'go']);
    expect(expectedHints(['name', 'email'], { submits: false })).toEqual(['next', 'done']);
    expect(expectedHints(['name', 'email'], { enter: 'send' })).toEqual(['next', 'send']);
  });
  it('secret kinds are the ones 3.3.7 must not retain', () => {
    expect(SECRET_KINDS).toEqual(['password', 'password-new', 'otp', 'otp-alnum', 'cc-csc']);
  });
});

describe('evidence (ADR-013 4b, ADR-015)', () => {
  const dirs = {
    contractsDir: join(defaultRoot, 'packages', 'contracts', 'contracts'),
    registryDir: join(defaultRoot, 'docs', 'architecture', 'evidence', 'at-support'),
  };
  it('the field, input and form contract refs resolve, are fresh and agree with their focus strategy', () => {
    const r = checkEvidence(dirs);
    expect(r.errors.filter((e: string) => /field|input|form/i.test(e))).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('the repo skip rule (issue and owner on every skip) passes with these specs present', () => {
    // Exits 1 on any skip/fixme/todo without both. The only skips here are the CDP AX-tree tests on
    // Firefox and WebKit (#49, owner SrRamos), which carry both.
    execFileSync(process.execPath, [join(defaultRoot, 'scripts', 'skip-check.mjs')], {
      cwd: defaultRoot,
    });
    const skips = readdirSync(here)
      .filter((f) => /\.(ts|js)$/.test(f) && f !== 'conformance.test.ts')
      .flatMap((f) =>
        readFileSync(join(here, f), 'utf8')
          .split('\n')
          .filter((l) => /\btest\.(?:skip|fixme|todo)\s*\(/.test(l))
          .map((l) => `${f}: ${l.trim()}`),
      );
    expect(skips.length).toBeGreaterThan(0);
    for (const l of skips) expect(l).toContain('browserName !== ');
  });
});

describe('known limit: two fields announcing in one commit (C02 a1 SHOULD-2)', () => {
  it('is a scenario that pins the behaviour and is written down in the notes', () => {
    expect(fieldScenarios().some((s) => s.id === 'announce-limit')).toBe(true);
    const notes = readFileSync(join(defaultRoot, 'docs', 'implementation', 'C02-NOTES.md'), 'utf8');
    expect(notes).toMatch(/Known limit[^\n]*two fields[^\n]*one commit/i);
  });
});

const voContracts = Object.fromEntries(
  Object.entries(CONTRACT_FILES).map(([k, f]) => [k, JSON.parse(readFileSync(f, 'utf8'))]),
);
type AtContract = { a11y: { atAssertions: string[] } };
const ALL_AT = Object.values(voContracts).flatMap((c) => (c as AtContract).a11y.atAssertions);
const ROOT = join(here, 'visual', 'baselines');

describe('SJField, SJInput and SJForm VoiceOver hook', () => {
  const pack = renderVoiceOverPack();

  it('renders every contract atAssertions id of the three contracts into both VoiceOver lanes', () => {
    expect(pack.assertions).toEqual(ALL_AT);
    expect(ALL_AT).toHaveLength(6);
    expect(pack.lanes.map((l) => l.id)).toEqual(['voiceover-macos-safari', 'voiceover-ios-safari']);
    for (const lane of pack.lanes)
      expect(lane.assertions.map((a: { id: string }) => a.id)).toEqual(ALL_AT);
  });

  it('carries every field the protocol requires, blanks for the human result fields', () => {
    for (const lane of pack.lanes) {
      expect(lane.environment).toBeTruthy();
      expect(lane.initialAnnouncement).toBe('Email address, edit text');
      expect(lane.readingOrder).toEqual(['label', 'hint', 'control', 'error']);
      expect(lane.stateChanges.length).toBeGreaterThan(0);
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

  it('derives the Enter-key steps from the kinds contract and speaks the fixtures', () => {
    const a = pack.lanes[1].assertions.find(
      (x: { id: string }) => x.id === 'manual-form-enter-key-label',
    );
    expect(a.steps.map((s: { hint: string }) => s.hint)).toEqual(
      expectedHints(['name', 'email', 'phone']),
    );
    const e = pack.lanes[0].assertions.find(
      (x: { id: string }) => x.id === 'manual-field-label-hint-error',
    );
    expect(e.steps[2].expected).toBe(
      'Email address, invalid data, edit text, Enter an email address like name@example.com',
    );
    expect(e.steps[2].note).toContain('no "exclamation mark"');
  });

  it('fails on an atAssertions id nobody wrote a procedure for (seeded)', () => {
    const seeded = structuredClone(voContracts) as Record<string, AtContract>;
    seeded['field']!.a11y.atAssertions.push('manual-something-new');
    expect(() => renderVoiceOverPack(seeded as never)).toThrow(/manual-something-new/);
  });

  it('renders markdown mentioning each assertion', () => {
    const md = renderMarkdown(pack);
    for (const id of ALL_AT) expect(md).toContain(id);
  });
});

describe('SJField visual scenes', () => {
  it('have unique names and render a real field around a native control', () => {
    const names = SCENES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of SCENES) {
      expect(s.html).toMatch(/<(input|textarea) class="sj-input__control"/);
      expect(s.html).toContain('class="sj-field__label"');
      expect(s.html).not.toContain('role=');
      expect(sceneHtml(s)).toContain('/components.css');
    }
  });

  it('cover rest, hint, required, invalid, disabled, focus, long label, textarea, the fallback, RTL and forced colors', () => {
    const n = SCENES.map((s) => s.name).join(' ');
    for (const k of [
      'default',
      'hint',
      'required',
      'invalid',
      'disabled',
      'focus',
      'long-label',
      'textarea',
      'touched-fallback',
      'rtl',
      'forced-colors',
    ])
      expect(n).toContain(k);
    for (const st of ['default', 'invalid', 'disabled'])
      expect(SCENES.filter((s) => s.forced && s.name.includes(st)).length).toBeGreaterThanOrEqual(
        1,
      );
    expect(SCENES.some((s) => s.focus)).toBe(true);
    expect(
      SCENES.some((s) => s.html.includes('data-touched="true"') && s.html.includes('required')),
    ).toBe(true);
  });

  it('draw the error icon aria-hidden and give the error no live-region markup', () => {
    for (const s of SCENES.filter((x) => x.html.includes('sj-field__error'))) {
      expect(s.html).toContain('data-part="icon" aria-hidden="true"');
      expect(s.html).not.toMatch(/aria-live|role="(alert|status)"/);
    }
  });

  it('use no raw colour or pixel values (tokens only)', () => {
    for (const s of SCENES) {
      expect(s.html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(s.html).not.toMatch(/\d\s*px/);
      expect(s.html).not.toContain('style=');
    }
  });

  it('every baseline image has a manifest hash and a review-log entry (reviewed-only, MUST-2)', () => {
    expect(existsSync(ROOT)).toBe(true);
    expect(verifyBaselines(ROOT)).toEqual([]);
  });

  it('seeded: an unreviewed PNG, or one edited after review, fails the integrity check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sj-field-baselines-'));
    try {
      mkdirSync(join(dir, 'chromium-linux-1x'), { recursive: true });
      writeFileSync(join(dir, 'chromium-linux-1x', 'field-default.png'), 'not reviewed');
      expect(verifyBaselines(dir).length).toBeGreaterThan(0);
      // A hash in the manifest is not a review: without a REVIEW-LOG entry it still fails.
      const sha = createHash('sha256').update('not reviewed').digest('hex');
      writeFileSync(
        join(dir, 'chromium-linux-1x', 'manifest.json'),
        JSON.stringify({ 'field-default': sha }),
      );
      expect(verifyBaselines(dir).join('\n')).toContain('no REVIEW-LOG entry');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
