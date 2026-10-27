import { describe, expect, it } from 'vitest';
import { lintCssContract, selectorsOf } from './index.js';

const components = [
  { slug: 'button', anatomy: [{ part: 'root' }], state: { machine: ['idle'] } },
  {
    slug: 'switch',
    anatomy: [{ part: 'root' }, { part: 'control' }, { part: 'thumb' }],
    state: { machine: ['off', 'on'] },
  },
];
const rules = (/** @type {string} */ css) => lintCssContract(css, components).map((f) => f.rule);

describe('contract css lint', () => {
  it('passes real hooks', () => {
    expect(rules('.sj-switch__thumb[data-state="on"] { color: red }')).toEqual([]);
    expect(rules(".sj-switch__control[data-part='control'], .sj-button__root { x: y }")).toEqual(
      [],
    );
    expect(rules('@media (min-width: 40rem) { .sj-button__root--wide { x: y } }')).toEqual([]);
  });
  it('fails an unknown part', () => {
    expect(rules('.sj-switch__knob { x: y }')).toEqual(['contract/unknown-part']);
  });
  it('fails a component with no contract, without guessing', () => {
    expect(rules('.sj-select__trigger { x: y }')).toEqual(['contract/unknown-component']);
  });
  it('fails an unknown data-part for the named component', () => {
    expect(rules('.sj-switch [data-part="trigger"] { x: y }')).toEqual([
      'contract/unknown-data-part',
    ]);
  });
  it('fails a state outside the machine of the named component', () => {
    expect(rules('.sj-switch[data-state="open"] { x: y }')).toEqual([
      'contract/unknown-data-state',
    ]);
    expect(rules('.sj-button__root[data-state="on"] { x: y }')).toEqual([
      'contract/unknown-data-state',
    ]);
  });
  it('makes no claim about selectors that name no known component', () => {
    expect(rules('[data-state="open"] { x: y }')).toEqual([]);
    expect(rules('.card[data-part="zzz"] { x: y }')).toEqual([]);
  });
  it('ignores comments and declarations without a rule block', () => {
    expect(rules('/* .sj-switch__knob { } */ color: red;')).toEqual([]);
    expect(selectorsOf('a, b { x: y } @layer sj.base { c { } }')).toEqual(['a, b', 'c']);
  });
});
