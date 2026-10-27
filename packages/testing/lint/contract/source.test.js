import { describe, expect, it } from 'vitest';
import { buildIndex, lintContractData, lintSource, lintContracts, loadContracts } from './index.js';

const index = buildIndex({
  contracts: [
    { name: 'SJButton', anatomy: [{ part: 'root', element: 'button', role: 'button' }] },
    { name: 'SJCard', anatomy: [{ part: 'root', element: 'div' }] },
  ],
  kinds: [{ kind: 'email' }, { kind: 'tel' }],
});
const rules = (/** @type {string} */ src, file = 'app/page.vue') =>
  lintSource(src, index, { file }).map((f) => f.rule);

describe('unknown-kind', () => {
  it('passes a known kind and ignores dynamic values', () => {
    expect(rules('<SJInput kind="email" />')).toEqual([]);
    expect(rules('<SJInput :kind="k" />')).toEqual([]);
    expect(rules(`<SJInput :kind="'tel'" />`)).toEqual([]);
    expect(rules('<SJInput kind={"email"} />')).toEqual([]);
  });
  it('fails an unknown kind in every attribute form', () => {
    const bad = [
      '<SJInput kind="emial" />',
      `<SJInput :kind="'emial'" />`,
      '<SJInput kind={"emial"} />',
    ];
    for (const src of bad) expect(rules(src)).toEqual(['contract/unknown-kind']);
  });
  it('reports the line', () => {
    const f = lintSource('<div/>\n<SJInput kind="x" />', index);
    expect(f[0]?.line).toBe(2);
  });
  it('contract data: a declared kind must exist in the kinds contract', () => {
    const ok = { name: 'SJInput', kinds: ['email'], anatomy: [] };
    const bad = { name: 'SJInput', kinds: ['email', 'nope'], anatomy: [] };
    expect(lintContractData(ok, index)).toEqual([]);
    expect(lintContractData(bad, index).map((f) => f.rule)).toEqual(['contract/unknown-kind']);
  });
  it('the shipped contracts pass', () => {
    expect(lintContracts()).toEqual([]);
    expect(loadContracts().contracts.length).toBeGreaterThan(0);
  });
});

describe('missing-label', () => {
  it('passes content, label, aria-label, aria-labelledby, spread', () => {
    for (const src of [
      '<SJButton>Save</SJButton>',
      '<SJButton label="Save" />',
      '<SJButton aria-label="Save" />',
      '<SJButton :aria-label="t" />',
      '<SJButton aria-labelledby="x" />',
      '<SJButton v-bind="$attrs" />',
      '<SJButton {...props} />',
      '<SJButton @click="a > b">Go</SJButton>',
    ])
      expect(rules(src), src).toEqual([]);
  });
  it('fails an empty or self-closing control', () => {
    for (const src of [
      '<SJButton />',
      '<SJButton></SJButton>',
      '<SJButton>  </SJButton>',
      '<SJButton disabled/>',
    ])
      expect(rules(src), src).toEqual(['contract/missing-label']);
  });
  it('does not judge components whose anatomy needs no name', () => {
    expect(rules('<SJCard />')).toEqual([]);
  });
  it('does not judge components without a contract', () => {
    expect(rules('<SJUnknown />')).toEqual([]);
  });
});

describe('preset-internals', () => {
  const preset = 'packages/vue/src/presets/select.ts';
  it('passes public primitive imports', () => {
    expect(rules(`import { SelectRoot } from '../primitives/select'`, preset)).toEqual([]);
    expect(rules(`import { x } from './other'; import vue from 'vue'`, preset)).toEqual([]);
  });
  it('fails internal and deep imports', () => {
    expect(rules(`import { x } from '@ramoslabs/core/internal/store'`, preset)).toEqual([
      'contract/preset-internals',
    ]);
    expect(rules(`import { x } from '../primitives/select/parts/trigger'`, preset)).toEqual([
      'contract/preset-internals',
    ]);
    expect(rules(`const m = await import('../runtime/ids')`, preset)).toEqual([
      'contract/preset-internals',
    ]);
  });
  it('fails a preset that sets an adapter-owned hook by hand', () => {
    expect(rules('<div data-part="trigger"></div>', preset)).toEqual(['contract/preset-internals']);
    expect(rules('<div data-state="open"></div>', preset)).toEqual(['contract/preset-internals']);
  });
  it('applies only under presets/', () => {
    expect(rules(`import { x } from '../runtime/ids'`, 'packages/vue/src/primitives/a.ts')).toEqual(
      [],
    );
  });
});
