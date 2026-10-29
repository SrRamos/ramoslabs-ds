// W1-205: the generator emits lint-clean, buildable CSS whose names match the contract anatomy.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { buildCss } from '../scripts/build.mjs';
import {
  checkAnatomy,
  checkStylesheets,
  cssParts,
  generate,
  toSlug,
} from '../src/_template/generate.mjs';

const configFile = new URL('../.stylelintrc.json', import.meta.url).pathname;

function setup(contract) {
  const dir = mkdtempSync(join(tmpdir(), 'sj-gen-'));
  const srcDir = join(dir, 'src');
  const contractsDir = join(dir, 'contracts');
  mkdirSync(srcDir);
  mkdirSync(contractsDir);
  if (contract) writeFileSync(join(contractsDir, 'select.contract.json'), JSON.stringify(contract));
  return { dir, srcDir, contractsDir };
}

const realContracts = new URL('../../contracts/contracts', import.meta.url).pathname;
const SELECT = {
  name: 'SJSelect',
  anatomy: [{ part: 'root' }, { part: 'trigger' }, { part: 'content' }, { part: 'item' }],
};

describe('generator', () => {
  it('maps SJ names to slugs', () => {
    expect(toSlug('SJSelect')).toBe('select');
    expect(toSlug('SJDatePicker')).toBe('date-picker');
    expect(toSlug('switch')).toBe('switch');
  });

  it('writes sj-<c>__<part> classes for every part, with data-state/active/disabled/invalid hooks', () => {
    const s = setup(SELECT);
    const { content, warnings } = generate({
      component: 'SJSelect',
      parts: ['root', 'trigger', 'content', 'item'],
      ...s,
    });
    for (const p of ['root', 'trigger', 'content', 'item'])
      expect(content).toContain(`.sj-select__${p} `);
    expect(content).toMatch(/\[data-state\]/);
    expect(content).toMatch(/\[data-disabled\]/);
    expect(content).toMatch(/\[data-invalid\]/);
    expect(content).toMatch(/sj\.variant/);
    expect(warnings).toEqual([]);
  });

  it('generated output passes the sj stylelint rules and the layer-checked build', async () => {
    const s = setup(SELECT);
    const { file } = generate({
      component: 'select',
      parts: ['root', 'trigger', 'content', 'item'],
      ...s,
    });
    const { results } = await stylelint.lint({ files: file, configFile });
    expect(results[0].warnings).toEqual([]);
    const out = mkdtempSync(join(tmpdir(), 'sj-out-'));
    buildCss({ srcDir: s.srcDir, outDir: out });
    expect(readFileSync(join(out, 'index.css'), 'utf8')).toContain('.sj-select__trigger');
  });

  it('reads parts from the contract when --parts is omitted', () => {
    const s = setup(SELECT);
    const { content, warnings } = generate({ component: 'select', ...s });
    expect(cssParts('select', content).sort()).toEqual(['content', 'item', 'root', 'trigger']);
    expect(warnings).toEqual([]);
  });

  it('fails when the parts do not match the contract anatomy', () => {
    const s = setup(SELECT);
    expect(() =>
      generate({ component: 'select', parts: ['root', 'trigger', 'popup'], ...s }),
    ).toThrow(
      /part "popup" is not in the contract anatomy[\s\S]*contract part "content" has no CSS rule/,
    );
  });

  it('accepts matching parts regardless of order', () => {
    const s = setup(SELECT);
    expect(() =>
      generate({ component: 'select', parts: ['item', 'content', 'trigger', 'root'], ...s }),
    ).not.toThrow();
  });

  it('fails when no contract exists', () => {
    const s = setup();
    expect(() => generate({ component: 'select', parts: ['root'], ...s })).toThrow(/No contract/);
    expect(() => generate({ component: 'select', ...s })).toThrow(/No contract/);
  });

  describe('against the real contracts (button, switch, checkbox, icon)', () => {
    const partsOf = (n) =>
      JSON.parse(readFileSync(join(realContracts, `${n}.contract.json`), 'utf8')).anatomy.map(
        (a) => a.part,
      );
    it.each(['button', 'switch', 'checkbox', 'icon'])(
      '%s: generated CSS names equal anatomy[].part',
      (n) => {
        const s = setup();
        const { content } = generate({
          component: n,
          contractsDir: realContracts,
          srcDir: s.srcDir,
        });
        expect(cssParts(n, content).sort()).toEqual([...partsOf(n)].sort());
        expect(checkStylesheets(s.srcDir, realContracts)).toEqual([]);
      },
    );
    it.each(['button', 'switch', 'checkbox', 'icon'])(
      '%s: a seeded extra or missing part fails',
      (n) => {
        const s = setup();
        expect(() =>
          generate({
            component: n,
            parts: [...partsOf(n), 'bogus'],
            contractsDir: realContracts,
            srcDir: s.srcDir,
          }),
        ).toThrow(/bogus/);
        expect(() =>
          generate({
            component: n,
            parts: ['renamed'],
            contractsDir: realContracts,
            srcDir: s.srcDir,
          }),
        ).toThrow(/has no CSS rule/);
      },
    );
    it('checkStylesheets flags a drifted stylesheet and a stylesheet with no contract', () => {
      const s = setup();
      writeFileSync(
        join(s.srcDir, 'button.css'),
        '@layer sj.component { .sj-button__root { color: red } .sj-button__oops { color: red } }',
      );
      writeFileSync(
        join(s.srcDir, 'ghost.css'),
        '@layer sj.component { .sj-ghost__root { color: red } }',
      );
      const problems = checkStylesheets(s.srcDir, realContracts);
      expect(problems.join('\n')).toMatch(/button\.css: part "oops" is not in the contract/);
      expect(problems.join('\n')).toMatch(/ghost\.css: no contract/);
    });
    it('every shipped src/*.css matches its contract', () => {
      expect(checkStylesheets(new URL('../src', import.meta.url).pathname, realContracts)).toEqual(
        [],
      );
    });
  });

  it('rejects bad names, duplicates, missing parts and silent overwrites', () => {
    const s = setup();
    for (const n of ['x'])
      writeFileSync(
        join(s.contractsDir, `${n}.contract.json`),
        JSON.stringify({ anatomy: [{ part: 'root' }] }),
      );
    expect(() => generate({ component: 'Bad_Name', parts: ['root'], ...s })).toThrow(
      /Invalid component name/,
    );
    expect(() => generate({ component: 'x', parts: ['Root'], ...s })).toThrow(/Invalid part name/);
    expect(() => generate({ component: 'x', parts: ['a', 'a'], ...s })).toThrow(/Duplicate/);
    expect(() => generate({ component: 'y', ...s })).toThrow(/No contract/);
    generate({ component: 'x', parts: ['root'], ...s });
    expect(() => generate({ component: 'x', parts: ['root'], ...s })).toThrow(/exists/);
    expect(() => generate({ component: 'x', parts: ['root'], force: true, ...s })).not.toThrow();
  });

  it('checkAnatomy reports both directions', () => {
    expect(checkAnatomy(['a', 'b'], ['b', 'c'])).toHaveLength(2);
    expect(checkAnatomy(['a'], ['a'])).toEqual([]);
  });
});
