import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import contract from '../../../contracts/contracts/icon.contract.json';
import { iconMachine } from '../generated/icon/index';
import { createIcon } from './index';
import { reduce, reducerEvents } from './reducer';
import type { IconData, IconProps } from './index';

const iconSizes = ['sm', 'md', 'lg', 'fit'] as const;
const iconTags = /^(path|circle|ellipse|rect|line|poly(line|gon))$/;
const iconAttrs = /^(d|cx|cy|r[xy]?|[xy][12]?|width|height|points)$/;
declare const console: { warn(m: string): void };
const star: IconData = { name: 'star', nodes: [['path', { d: 'M1 1' }]] };
const arrow: IconData = { name: 'arrow-right', mirror: true, nodes: [['path', { d: 'M2 2' }]] };
const mk = (props: IconProps = { icon: star }) => createIcon(() => props);

afterEach(() => vi.restoreAllMocks());
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('contract', () => {
  it('has no actions, no events, one idle state; reducer is a no-op', () => {
    expect(contract.actions).toEqual([]);
    expect(contract.events).toEqual([]);
    expect(iconMachine.states).toEqual(['idle']);
    expect([...reducerEvents]).toEqual([]);
    expect((reduce as (s: 'idle', e: object) => 'idle')('idle', { type: 'anything' })).toBe('idle');
  });
  it('size prop type equals the core vocabulary; pattern refs are img-role', () => {
    const union = (
      contract.props.find((p) => p.name === 'size')!.type.match(/'([^']+)'/g) ?? []
    ).map((s) => s.slice(1, -1));
    expect(union).toEqual([...iconSizes]);
    expect(contract.pattern).toEqual({ apg: 'img-role', evidence: 'img-role' });
    expect(contract.status).toBe('draft');
  });
});

describe('getRootProps', () => {
  it('decorative by default: aria-hidden, no role, no label, not focusable', () => {
    const bag = mk().getRootProps();
    expect(bag).toEqual({
      class: 'sj-icon',
      'data-part': 'root',
      'data-size': 'md',
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    });
  });
  it('a label gives role=img and aria-label, no aria-hidden', () => {
    const bag = mk({ icon: star, label: 'Search' }).getRootProps();
    expect(bag.role).toBe('img');
    expect(bag['aria-label']).toBe('Search');
    expect('aria-hidden' in bag).toBe(false);
  });
  it('empty or whitespace label is no label and warns in dev', () => {
    for (const label of ['', '   ', '\n\t']) {
      const warn = spyWarn();
      const bag = mk({ icon: star, label }).getRootProps();
      expect(bag['aria-hidden']).toBe('true');
      expect('role' in bag || 'aria-label' in bag).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    }
  });
  it('data-size: known values pass, unknown falls back to md', () => {
    for (const s of iconSizes)
      expect(mk({ icon: star, size: s }).getRootProps()['data-size']).toBe(s);
    expect(mk({ icon: star, size: 'xl' as never }).getRootProps()['data-size']).toBe('md');
  });
  it('data-mirror only when icon.mirror and dir is rtl', () => {
    const has = (icon: IconData, dir?: 'ltr' | 'rtl') =>
      'data-mirror' in mk({ icon, dir }).getRootProps();
    expect(has(arrow, 'rtl')).toBe(true);
    expect(has(arrow, 'ltr')).toBe(false);
    expect(has(arrow)).toBe(false);
    expect(has(star, 'rtl')).toBe(false);
    expect(mk({ icon: arrow, dir: 'rtl' }).getRootProps()['data-mirror']).toBe('true');
  });
  it('protected keys cannot be overridden by a spread; tabindex is deleted with a warning', () => {
    const warn = spyWarn();
    const bag = mk({ icon: star, label: 'A' }).getRootProps({
      role: 'button',
      'aria-label': 'x',
      'aria-hidden': 'true',
      viewBox: '0 0 1 1',
      width: '9',
      height: '9',
      stroke: 'red',
      fill: 'red',
      'data-size': 'lg',
      'data-mirror': 'true',
      tabindex: '0',
      tabIndex: 0,
      class: 'mine',
      'data-test': 'kept',
    });
    expect(bag).toMatchObject({
      role: 'img',
      'aria-label': 'A',
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      stroke: 'currentColor',
      fill: 'none',
      'data-size': 'md',
      class: 'sj-icon mine',
      'data-test': 'kept',
    });
    for (const k of ['aria-hidden', 'tabindex', 'tabIndex', 'data-mirror'])
      expect(k in bag).toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain('tabindex');
  });
  it('decorative: a consumer role or aria-label cannot make it meaningful', () => {
    spyWarn();
    const bag = mk().getRootProps({ role: 'img', 'aria-label': 'x', tabindex: '0' });
    expect(bag['aria-hidden']).toBe('true');
    for (const k of ['role', 'aria-label', 'tabindex']) expect(k in bag).toBe(false);
  });
  it('an on* handler warns in dev (the fix is SJButton) and is not dropped silently', () => {
    const warn = spyWarn();
    mk().getRootProps({ onClick: () => {} });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('SJButton');
  });
  it('no dev warning in production', () => {
    const warn = spyWarn();
    vi.stubEnv('NODE_ENV', 'production');
    mk({ icon: star, label: ' ' }).getRootProps({ onClick: () => {} });
    mk({}).getNodes();
    vi.unstubAllEnvs();
    expect(warn).not.toHaveBeenCalled();
  });
  it('is pure: same props give equal bags and getProps is read on each call', () => {
    let props: IconProps = { icon: star };
    const icon = createIcon(() => props);
    expect(icon.getRootProps()).toEqual(icon.getRootProps());
    props = { icon: star, size: 'lg' };
    expect(icon.getRootProps()['data-size']).toBe('lg');
  });
});

describe('getNodes', () => {
  it('passes allowlisted nodes through unchanged', () => {
    expect(mk().getNodes()).toEqual([['path', { d: 'M1 1' }]]);
  });
  it('drops unknown tags and attributes with a dev warning', () => {
    const warn = spyWarn();
    const icon: IconData = {
      nodes: [
        ['script', { d: 'x' }],
        [
          'path',
          {
            d: 'M1',
            onload: 'x()',
            href: 'javascript:1',
            style: 'a',
            id: 'i',
            class: 'c',
            tabindex: 0,
          },
        ],
        ['circle', { cx: 1, cy: 2, r: 3 }],
      ],
    };
    expect(mk({ icon }).getNodes()).toEqual([
      ['path', { d: 'M1' }],
      ['circle', { cx: 1, cy: 2, r: 3 }],
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('missing icon gives empty nodes and a dev warning; malformed nodes are tolerated', () => {
    const warn = spyWarn();
    expect(mk({}).getNodes()).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const bad = { nodes: [null, 3, ['path'], ['path', null], ['rect', { x: {} }]] } as never;
    expect(mk({ icon: bad }).getNodes()).toEqual([
      ['path', {}],
      ['path', {}],
      ['rect', {}],
    ]);
  });
  it('invariant: output holds only allowed tags and attributes, with string or number values', () => {
    const name = fc.oneof(
      fc.constantFrom(
        ...'path circle ellipse rect line polyline polygon'.split(' '),
        ...'d cx cy r rx ry x y x1 y1 x2 y2 width height points'.split(' '),
        'onclick',
        'href',
        'style',
        'id',
        'class',
        'tabindex',
        '__proto__',
        'script',
        'svg',
      ),
      fc.string(),
    );
    const value = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.object());
    const node = fc.tuple(name, fc.dictionary(name, value));
    fc.assert(
      fc.property(fc.array(node), (nodes) => {
        spyWarn();
        for (const [tag, attrs] of mk({ icon: { nodes: nodes as never } }).getNodes()) {
          expect(tag).toMatch(iconTags);
          for (const [k, v] of Object.entries(attrs)) {
            expect(k).toMatch(iconAttrs);
            expect(['string', 'number']).toContain(typeof v);
          }
          expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype);
        }
      }),
    );
  });
  it('seeded violation: every forbidden tag and attribute name is dropped', () => {
    spyWarn();
    const bad = ['onclick', 'onload', 'href', 'xlink:href', 'style', 'id', 'class', 'tabindex'];
    const attrs = Object.fromEntries([...bad.map((k) => [k, 'x']), ['d', 'M0 0']]);
    const nodes = [
      ['path', attrs],
      ['script', {}],
      ['foreignObject', {}],
      ['svg', {}],
      ['a', {}],
    ];
    expect(mk({ icon: { nodes: nodes as never } }).getNodes()).toEqual([['path', { d: 'M0 0' }]]);
  });
});
