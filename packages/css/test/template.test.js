// W1-205: the generator emits lint-clean, buildable CSS whose names match the contract anatomy.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { buildCss } from '../scripts/build.mjs';
import { checkAnatomy, cssParts, generate, toSlug } from '../src/_template/generate.mjs';

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
    const s = setup();
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
    expect(warnings[0]).toMatch(/anatomy-name check skipped/);
  });

  it('generated output passes the sj stylelint rules and the layer-checked build', async () => {
    const s = setup();
    const { file } = generate({ component: 'select', parts: ['root', 'trigger', 'item'], ...s });
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

  it('rejects bad names, duplicates, missing parts and silent overwrites', () => {
    const s = setup();
    expect(() => generate({ component: 'Bad_Name', parts: ['root'], ...s })).toThrow(
      /Invalid component name/,
    );
    expect(() => generate({ component: 'x', parts: ['Root'], ...s })).toThrow(/Invalid part name/);
    expect(() => generate({ component: 'x', parts: ['a', 'a'], ...s })).toThrow(/Duplicate/);
    expect(() => generate({ component: 'x', ...s })).toThrow(/No --parts/);
    generate({ component: 'x', parts: ['root'], ...s });
    expect(() => generate({ component: 'x', parts: ['root'], ...s })).toThrow(/exists/);
    expect(() => generate({ component: 'x', parts: ['root'], force: true, ...s })).not.toThrow();
  });

  it('checkAnatomy reports both directions', () => {
    expect(checkAnatomy(['a', 'b'], ['b', 'c'])).toHaveLength(2);
    expect(checkAnatomy(['a'], ['a'])).toEqual([]);
  });
});
