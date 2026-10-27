/* eslint-disable @typescript-eslint/ban-ts-comment -- test files drive untyped .mjs tools and adapters dynamically */
// @ts-nocheck -- test files: the sibling tools are untyped .mjs and the adapters are driven dynamically.
// W1-316: the probe passes every existing tool BY PATH (nothing scans testing/probe by default, so
// the probe never reaches the public registry). Seeded violations prove each tool really looks.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { checkEvidence } from '../evidence/index.js';
import { deriveSpec } from '../spec/derive/index.js';
import { contract, contractPath, contractsDir, cssPath, reduce, reducerEvents } from './index';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const registryDir = join(repo, 'docs', 'architecture', 'evidence', 'at-support');
const stylelintConfig = join(repo, 'packages', 'css', '.stylelintrc.json');
// The sibling tools are plain .mjs outside this package's typecheck scope, so they are loaded
// through a computed specifier: the call is by path, and their implicit-any internals stay theirs.
const tool = (rel) => import(join(repo, rel));
const { validateFile } = await tool('packages/contracts/scripts/validate.mjs');
const { checkReducerEquivalence, generate } = await tool('packages/contracts/scripts/codegen.mjs');
const { buildCss } = await tool('packages/css/scripts/build.mjs');
const { checkAnatomy, checkStylesheets, cssParts } = await tool(
  'packages/css/src/_template/generate.mjs',
);
const scratch = () => mkdtempSync(join(tmpdir(), 'sj-probe-'));
const clone = () => JSON.parse(JSON.stringify(contract));

describe('contracts:check by path', () => {
  it('validates probe.contract.json', () => {
    expect(validateFile(contractPath)).toEqual({ valid: true, errors: [] });
  });

  it('the CLI accepts the explicit path and rejects a seeded break', () => {
    const run = (file) =>
      execFileSync('node', [join(repo, 'packages/contracts/scripts/validate.mjs'), file], {
        encoding: 'utf8',
      });
    expect(run(contractPath)).toContain('1 contract file(s) valid');
    const bad = clone();
    bad.actions[0].to = 'missing';
    const dir = scratch();
    writeFileSync(join(dir, 'probe.contract.json'), JSON.stringify(bad));
    expect(() => run(join(dir, 'probe.contract.json'))).toThrow();
  });

  it('is not in the shipped contracts directory', () => {
    expect(contractsDir).not.toContain(join('packages', 'contracts', 'contracts'));
  });
});

describe('codegen by path', () => {
  it('generates the probe machine, keyboard and ARIA tables in memory', async () => {
    const files = await generate({ contractsDir });
    const machine = files['packages/core/src/generated/probe/machine.ts'];
    expect(machine).toContain('probeMachine');
    expect(machine).toMatch(/initial: 'off'/);
    expect(files['packages/react/src/generated/probe/types.ts']).toContain('SJProbeProps');
    expect(files['packages/vue/src/generated/probe/types.ts']).toContain('SJProbeEmits');
    expect(files['packages/vanilla/src/generated/probe/types.ts']).toContain('SJProbeOptions');
  });

  it('the reducer is equivalent to the contract (ADR-010)', () => {
    expect(checkReducerEquivalence(contract, { reducerEvents, reduce })).toEqual([]);
  });

  it('seeded: an extra event, a missing event and a wrong target each fail', () => {
    expect(
      checkReducerEquivalence(contract, { reducerEvents: [...reducerEvents, 'reset'], reduce }),
    ).toHaveLength(1);
    expect(checkReducerEquivalence(contract, { reducerEvents: [], reduce })).toHaveLength(1);
    const stuck = (s) => s;
    expect(checkReducerEquivalence(contract, { reducerEvents, reduce: stuck }).length).toBe(2);
    expect(checkReducerEquivalence(contract, {})[0]).toContain('reducerEvents');
  });
});

describe('evidence:check by path', () => {
  it('the honesty rules pass: refs resolve, are fresh and cover every primary pair', () => {
    const r = checkEvidence({ contractsDir, registryDir });
    expect(r.errors).toEqual([]);
    expect(r.contracts).toBe(1);
    expect(r.checkedRefs).toBe(5);
  });

  it('seeded: a stale entry, a dangling ref and a missing AT row each fail', () => {
    expect(checkEvidence({ contractsDir, registryDir, today: '2099-01-01' }).errors.length).toBe(5);
    const dir = scratch();
    const dangling = clone();
    dangling.a11y.atSupport[0].evidence = ['at-support/switch.json#nope'];
    writeFileSync(join(dir, 'probe.contract.json'), JSON.stringify(dangling));
    expect(checkEvidence({ contractsDir: dir, registryDir }).errors.join('\n')).toContain(
      'no entry',
    );
    const missing = clone();
    missing.a11y.atSupport = missing.a11y.atSupport.filter((r) => r.at !== 'nvda');
    writeFileSync(join(dir, 'probe.contract.json'), JSON.stringify(missing));
    expect(checkEvidence({ contractsDir: dir, registryDir }).errors.join('\n')).toContain(
      'pattern coverage',
    );
  });
});

describe('probe.css', () => {
  const css = readFileSync(cssPath, 'utf8');

  it('passes the W1-202 stylelint rules', async () => {
    const { results } = await stylelint.lint({ files: cssPath, configFile: stylelintConfig });
    expect(results[0].warnings).toEqual([]);
  });

  it('seeded: a raw hex, a raw px and outline none each fail', async () => {
    const bad = `${css}\n@layer sj.state { .sj-probe__root { color: #fff; padding-left: 4px; outline: none; } }\n`;
    const { results } = await stylelint.lint({
      code: bad,
      configFile: stylelintConfig,
      codeFilename: cssPath,
    });
    const rules = results[0].warnings.map((w) => w.rule);
    expect(rules).toEqual(
      expect.arrayContaining(['color-no-hex', 'sj/no-raw-px', 'sj/no-outline-none']),
    );
  });

  it('uses sj-probe__<part> for exactly the contract anatomy (W1-205 check)', () => {
    const parts = contract.anatomy.map((a) => a.part);
    expect(cssParts('probe', css).sort()).toEqual([...parts].sort());
    expect(checkAnatomy(cssParts('probe', css), parts)).toEqual([]);
    const src = scratch();
    cpSync(cssPath, join(src, 'probe.css'));
    expect(checkStylesheets(src, contractsDir)).toEqual([]);
    writeFileSync(
      join(src, 'probe.css'),
      `${css}\n@layer sj.state { .sj-probe__ghost { gap: 0; } }\n`,
    );
    expect(checkStylesheets(src, contractsDir).join('\n')).toContain('ghost');
  });

  it('builds inside the sj layers', () => {
    const src = scratch();
    const out = scratch();
    mkdirSync(join(src, 'x'), { recursive: true });
    cpSync(cssPath, join(src, 'probe.css'));
    buildCss({ srcDir: src, outDir: out });
    expect(readFileSync(join(out, 'index.css'), 'utf8')).toContain('.sj-probe__root');
    writeFileSync(join(src, 'probe.css'), '.sj-probe__root { color: red; }\n');
    expect(() => buildCss({ srcDir: src, outDir: scratch() })).toThrow();
  });
});

describe('L1 machine', () => {
  it('toggle is an involution and the derived spec has both rows', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('off', 'on'),
        (s) => reduce(reduce(s, { type: 'toggle' }), { type: 'toggle' }) === s,
      ),
    );
    fc.assert(
      fc.property(fc.string(), (t) => t === 'toggle' || reduce('on', { type: t }) === 'on'),
    );
    const spec = deriveSpec(contract);
    expect(spec.initial).toBe('off');
    expect(spec.steps.map((s) => s.id).sort()).toEqual(['toggle:off>on', 'toggle:on>off']);
  });
});
