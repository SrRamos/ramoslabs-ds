// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { crossRootIssues, diffGraphs, extractGraph } from './graph';
import { runSsrDeterminism, withoutDom, type RootSpec, type SsrWrapper } from './runner';
import { createReactWrapper } from './components/react';
import { createVanillaWrapper } from './components/vanilla';
import { createVueWrapper } from './components/vue';
import { randomSource, sharedCounterSource } from './components/tree';

const ROOTS: RootSpec[] = [
  { name: 'a', idPrefix: 'a-' },
  { name: 'b', idPrefix: 'b-' },
  { name: 'c', idPrefix: 'c-' },
];
const SAME_PREFIX: RootSpec[] = [
  { name: 'a', idPrefix: 'p-' },
  { name: 'b', idPrefix: 'p-' },
];

const html = (s: string) => {
  const el = document.createElement('div');
  el.innerHTML = s;
  return el;
};

describe('graph extraction (W1-114)', () => {
  it('collects ids, IDREF lists, single IDREFs and structural paths', () => {
    const g = extractGraph(
      html(
        '<span id="l">x</span><button id="b" aria-labelledby="l b" aria-controls="p"></button>' +
          '<div id="p" aria-activedescendant="l"></div><label for="b"></label>',
      ),
    );
    expect(g.ids).toEqual(['l', 'b', 'p']);
    expect(g.edges.map((e) => `${e.attr}:${e.to}`)).toEqual([
      'aria-labelledby:l',
      'aria-labelledby:b',
      'aria-controls:p',
      'aria-activedescendant:l',
      'for:b',
    ]);
    expect(g.dangling).toEqual([]);
  });

  it('reports duplicates, dangling refs and graph differences', () => {
    const dup = extractGraph(html('<i id="a"></i><i id="a" aria-controls="zz"></i>'));
    expect(dup.duplicates).toEqual(['a']);
    expect(dup.dangling.map((e) => e.to)).toEqual(['zz']);
    const x = extractGraph(html('<i id="a"></i><b aria-controls="a"></b>'));
    const y = extractGraph(html('<i id="a"></i><b aria-describedby="a"></b>'));
    expect(diffGraphs('t', x, y).length).toBe(2);
    expect(diffGraphs('t', x, x)).toEqual([]);
  });

  it('detects cross-root collisions and references that resolve into another root', () => {
    const a = extractGraph(html('<i id="same"></i>'));
    const b = extractGraph(html('<i id="same"></i>'));
    const c = extractGraph(html('<i id="own"></i><b aria-controls="other"></b>'));
    const d = extractGraph(html('<i id="other"></i>'));
    expect(
      crossRootIssues([
        { name: 'a', graph: a },
        { name: 'b', graph: b },
      ]),
    ).toHaveLength(1);
    const leak = crossRootIssues([
      { name: 'c', graph: c },
      { name: 'd', graph: d },
    ]);
    expect(leak.join()).toMatch(/cross-root reference/);
  });

  it('withoutDom hides DOM globals and restores them', async () => {
    let seen = '';
    await withoutDom(() => void (seen = typeof document + typeof window));
    expect(seen).toBe('undefinedundefined');
    expect(typeof document).toBe('object');
    await expect(
      withoutDom(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(typeof document).toBe('object');
  });
});

const adapters: { name: string; make: () => SsrWrapper }[] = [
  { name: 'react', make: () => createReactWrapper() },
  { name: 'vue', make: () => createVueWrapper() },
  { name: 'vanilla', make: () => createVanillaWrapper() },
];

describe.each(adapters)('SSR determinism: $name', ({ make }) => {
  it('server, hydrated and fresh client renders agree on ids and the IDREF graph across three roots', async () => {
    const report = await runSsrDeterminism(make(), ROOTS);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    for (const r of report.roots) {
      // Real content: labelled parts joined by IDREFs, keyed items, a prefix per root.
      expect(r.server.ids.length).toBeGreaterThan(8);
      expect(r.server.edges.length).toBeGreaterThan(8);
      expect(r.server.dangling).toEqual([]);
      expect(r.hydrated.ids).toEqual(r.server.ids);
      if (r.client) expect(r.client.ids).toEqual(r.server.ids);
    }
    // Roots differ only by their idPrefix.
    const prefixes = report.roots.map((r) => r.server.ids[0]!.slice(0, 2));
    expect(new Set(prefixes).size).toBe(ROOTS.length);
    const all = report.roots.flatMap((r) => r.server.ids);
    expect(new Set(all).size).toBe(all.length);
  });

  it('is repeatable: two runs give identical snapshots', async () => {
    const one = await runSsrDeterminism(make(), ROOTS);
    const two = await runSsrDeterminism(make(), ROOTS);
    expect(one.roots.map((r) => r.server)).toEqual(two.roots.map((r) => r.server));
  });

  it('seeded violation: roots that share an idPrefix collide', async () => {
    const report = await runSsrDeterminism(make(), SAME_PREFIX);
    expect(report.ok).toBe(false);
    expect(report.issues.join('\n')).toMatch(/collision: id/);
  });
});

describe('SSR determinism: seeded nondeterministic id sources must fail', () => {
  it('react: a counter shared by the server and client passes', async () => {
    const report = await runSsrDeterminism(
      createReactWrapper({ idSource: sharedCounterSource() }),
      ROOTS.slice(0, 1),
    );
    expect(report.ok).toBe(false);
    expect(report.issues.join('\n')).toMatch(/server vs client|hydration diagnostic/);
  });

  it('react: random ids', async () => {
    const report = await runSsrDeterminism(
      createReactWrapper({ idSource: randomSource() }),
      ROOTS.slice(0, 1),
    );
    expect(report.ok).toBe(false);
    expect(report.issues.join('\n')).toMatch(/hydration diagnostic/);
  });

  it('vue: a counter shared by the server and client passes', async () => {
    const report = await runSsrDeterminism(
      createVueWrapper({ idSource: sharedCounterSource() }),
      ROOTS.slice(0, 1),
    );
    expect(report.ok).toBe(false);
    expect(report.issues.join('\n')).toMatch(/server vs client|hydration diagnostic/);
  });

  it('vue: random ids', async () => {
    const report = await runSsrDeterminism(
      createVueWrapper({ idSource: randomSource() }),
      ROOTS.slice(0, 1),
    );
    expect(report.ok).toBe(false);
    expect(report.issues.join('\n')).toMatch(/server vs client/);
  });

  it('vanilla: one idFactory shared by every pass', async () => {
    const shared = sharedCounterSource('v');
    const report = await runSsrDeterminism(
      createVanillaWrapper({ makeIdFactory: () => shared }),
      ROOTS,
    );
    expect(report.ok).toBe(false);
    expect(report.issues.join('\n')).toMatch(/server vs hydrated/);
  });

  it('vanilla: random idFactory', async () => {
    const report = await runSsrDeterminism(
      createVanillaWrapper({ makeIdFactory: () => randomSource() }),
      ROOTS.slice(0, 1),
    );
    expect(report.ok).toBe(false);
  });

  it('vanilla: no factory at all throws a clear error instead of inventing ids', async () => {
    const w = createVanillaWrapper({
      makeIdFactory: () => undefined as unknown as () => string,
    });
    await expect(runSsrDeterminism(w, ROOTS.slice(0, 1))).rejects.toThrow(/idFactory/);
  });
});
