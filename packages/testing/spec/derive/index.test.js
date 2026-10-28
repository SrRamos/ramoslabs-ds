import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { deriveSpec } from './index.js';

/** @param {string} n @returns {any} */
const load = (n) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../contracts/contracts/${n}.contract.json`, import.meta.url)),
      'utf8',
    ),
  );

describe('deriveSpec probes (W1-308a)', () => {
  it('button: one press step bound to Enter and Space on root', () => {
    expect(deriveSpec(load('button'))).toMatchInlineSnapshot(`
      {
        "component": "SJButton",
        "focus": {
          "owner": "root",
          "strategy": "native",
        },
        "initial": "idle",
        "movements": [],
        "scenarios": [
          {
            "fixture": "default",
            "interactive": true,
          },
          {
            "fixture": "disabled",
            "interactive": false,
          },
          {
            "fixture": "long-label",
            "interactive": true,
          },
          {
            "fixture": "icon-only",
            "interactive": true,
          },
          {
            "fixture": "link",
            "interactive": true,
          },
        ],
        "sequences": [
          [
            "press:idle>idle",
          ],
        ],
        "states": [
          "idle",
        ],
        "steps": [
          {
            "action": "press",
            "emit": "press",
            "expect": {
              "aria": {},
              "dom": {},
              "focus": null,
            },
            "from": "idle",
            "id": "press:idle>idle",
            "to": "idle",
            "triggers": [
              {
                "key": "Enter",
                "kind": "keyboard",
                "part": "link",
              },
              {
                "key": "Enter",
                "kind": "keyboard",
                "part": "root",
              },
              {
                "key": "Space",
                "kind": "keyboard",
                "part": "root",
              },
            ],
          },
        ],
        "unreachable": [],
      }
    `);
  });

  it('switch: toggle in both directions, Space on control, on-state reached via off', () => {
    const s = deriveSpec(load('switch'));
    expect(s.initial).toBe('off');
    expect(s.steps.map((x) => x.id)).toEqual(['toggle:off>on', 'toggle:on>off']);
    for (const st of s.steps) {
      expect(st.triggers).toEqual([{ kind: 'keyboard', part: 'control', key: 'Space' }]);
    }
    expect(s.steps[0].expect.dom).toEqual({ control: { checked: 'true' } });
    expect(s.sequences).toEqual([['toggle:off>on'], ['toggle:off>on', 'toggle:on>off']]);
    expect(s.scenarios.filter((x) => !x.interactive).map((x) => x.fixture)).toEqual(['disabled']);
  });
});

describe('deriveSpec determinism', () => {
  it.each(['button', 'switch'])(
    '%s: repeated derivation is deep-equal and serializes identically',
    (n) => {
      const c = load(n);
      const a = JSON.stringify(deriveSpec(c));
      expect(JSON.stringify(deriveSpec(c))).toBe(a);
      expect(JSON.stringify(deriveSpec(structuredClone(c)))).toBe(a);
    },
  );

  it('does not mutate its input', () => {
    const c = load('switch');
    const before = JSON.stringify(c);
    deriveSpec(c);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('property: independent of keyboard key/part authoring order', () => {
    /** Reorders keys by a permutation derived from `order`. @param {Record<string, any>} o @param {number[]} order */
    const shuffleObj = (o, order) => {
      const ks = Object.keys(o);
      const idx = ks.map((_, i) => i).sort((x, y) => (order[x] ?? 0) - (order[y] ?? 0) || x - y);
      return Object.fromEntries(idx.map((i) => [ks[i], o[ks[i]]]));
    };
    const base = {
      name: 'SJX',
      state: { machine: ['a', 'b'] },
      actions: [
        { id: 'go', from: 'a', to: 'b' },
        { id: 'back', from: 'b', to: 'a' },
      ],
      keyboard: {
        root: { Enter: 'go', Space: 'go', Escape: 'back', ArrowDown: 'next' },
        item: { Home: 'first', Enter: 'go' },
      },
      focus: { strategy: 'roving', owner: 'item' },
      fixtures: ['default', 'disabled'],
    };
    const expected = JSON.stringify(deriveSpec(base));
    fc.assert(
      fc.property(fc.array(fc.nat(5), { maxLength: 8 }), (order) => {
        const c = {
          ...base,
          keyboard: Object.fromEntries(
            Object.entries(shuffleObj(base.keyboard, order)).map(([p, m]) => [
              p,
              shuffleObj(m, order),
            ]),
          ),
        };
        expect(JSON.stringify(deriveSpec(c))).toBe(expected);
      }),
    );
  });

  it('non-action keyboard targets become movements', () => {
    const s = deriveSpec({
      actions: [{ id: 'go', from: 'a', to: 'b' }],
      keyboard: { root: { ArrowDown: 'next', Enter: 'go' } },
      focus: { strategy: 'roving', owner: 'root' },
      fixtures: ['default'],
    });
    expect(s.movements).toEqual([{ part: 'root', key: 'ArrowDown', movement: 'next' }]);
  });

  it('flags unreachable steps and rejects duplicate step ids', () => {
    const base = { keyboard: {}, focus: { strategy: 'native' }, fixtures: ['default'] };
    const s = deriveSpec({
      ...base,
      state: { machine: ['a'] },
      actions: [{ id: 'x', from: 'z', to: 'a' }],
    });
    expect(s.unreachable).toEqual(['x:z>a']);
    expect(() =>
      deriveSpec({
        ...base,
        actions: [
          { id: 'x', from: 'a', to: 'b' },
          { id: 'x', from: 'a', to: 'b' },
        ],
      }),
    ).toThrow(/ambiguous/);
  });
});
