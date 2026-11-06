// @vitest-environment jsdom
// SSR determinism for SJDisclosure (W1-C06.f, ADR-003, ADR-013 PR gate), on the SSR harness's own pieces
// (withoutDom, extractGraph, diffGraphs, crossRootIssues). The runner's stock `runSsrDeterminism` demands
// IDREF edges, which a native <details> does not have by design (no aria-controls, no aria-labelledby: the
// summary and the panel are related by structure), so the same three passes are run here: server render with the DOM hidden, real hydration of that markup,
// and (Vue) a fresh client render. Ids and graphs must agree across passes; roots must not collide.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString as reactToString } from 'react-dom/server';
import { renderToString as vueToString } from 'vue/server-renderer';
import { nextTick } from 'vue';
import { crossRootIssues, diffGraphs, extractGraph } from '../../ssr/graph';
import { withoutDom } from '../../ssr/runner';
import { reactTree, vueApp } from './host/ssr-tree';
import { FIXTURES, type DisclosureFixtureProps } from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ROOTS = ['a-', 'b-', 'c-'];
const closed = FIXTURES['closed'] as DisclosureFixtureProps;
const props = FIXTURES['open'] as DisclosureFixtureProps;

const host = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
};
const quiet = async <T>(fn: () => Promise<T>) => {
  const seen: string[] = [];
  const orig = [console.error, console.warn];
  console.error = console.warn = (...a: unknown[]) => void seen.push(a.map(String).join(' '));
  try {
    return { value: await fn(), seen };
  } finally {
    [console.error, console.warn] = orig;
  }
};

describe.each(['react', 'vue'] as const)('SJDisclosure SSR: %s', (adapter) => {
  const html = (p: DisclosureFixtureProps, prefix: string) =>
    withoutDom(() =>
      adapter === 'react'
        ? reactToString(reactTree(p, prefix, 'server'), { identifierPrefix: prefix })
        : vueToString(vueApp(p, prefix, 'server', true)),
    );
  const render = (prefix: string) => html(props, prefix);

  it('renders on a server with no DOM globals: details, summary and panel, open, deterministic', async () => {
    const one = await render('a-');
    expect(one).toMatch(/<details[^>]*\sopen/);
    expect(one).toContain('<summary');
    expect(one).toContain('data-state="open"');
    expect(one).toContain('Shipping details');
    expect(one).toContain('Orders ship within two business days.');
    for (const forbidden of ['aria-expanded', 'aria-controls', 'role='])
      expect(one, forbidden).not.toContain(forbidden);
    expect(one).not.toMatch(/<(script|style)\b/);
    expect(await render('a-')).toBe(one);
  });

  it('a closed disclosure renders without the open attribute', async () => {
    const out = await html(closed, 'c-');
    expect(out).not.toMatch(/<details[^>]*\sopen/);
    expect(out).toContain('data-state="closed"');
  });

  it('a disabled disclosure renders aria-disabled on the summary only, and stays out of the DOM-less path', async () => {
    const out = await html(FIXTURES['disabled'] as DisclosureFixtureProps, 'd-');
    expect(out).toMatch(/<summary[^>]*aria-disabled="true"/);
    expect(out).not.toMatch(/<details[^>]*aria-disabled/);
  });

  it('an exclusive-group member renders its name for the native grouping', async () => {
    const [first] = FIXTURES['exclusive-group'] as DisclosureFixtureProps[];
    expect(await html(first!, 'g-')).toMatch(/<details[^>]*\sname="faq"/);
  });

  it('hydration adopts a server-opened disclosure that the user closed before hydrating, without warnings', async () => {
    const root = host(await render('h-'));
    const details = root.querySelector('details')!;
    details.open = false; // the user toggled it before any script ran
    const { seen } = await quiet(async () => {
      if (adapter === 'react')
        await act(async () => {
          hydrateRoot(root, reactTree(props, 'h-', 'client'), { identifierPrefix: 'h-' });
        });
      else {
        vueApp(props, 'h-', 'client', true).mount(root);
        await nextTick();
      }
    });
    expect(seen).toEqual([]);
    expect(root.querySelector('details')).toBe(details);
    root.remove();
  });

  it('server, hydrated and (vue) fresh-client graphs agree across three roots; no diagnostics', async () => {
    const out = await Promise.all(ROOTS.map(render));
    const roots = out.map(host);
    const server = roots.map((r) => extractGraph(r));
    const { seen } = await quiet(async () => {
      for (const [i, prefix] of ROOTS.entries()) {
        if (adapter === 'react')
          await act(async () => {
            hydrateRoot(roots[i]!, reactTree(props, prefix, 'client'), {
              identifierPrefix: prefix,
            });
          });
        else {
          vueApp(props, prefix, 'client', true).mount(roots[i]!);
          await nextTick();
        }
      }
    });
    const hydrated = roots.map((r) => extractGraph(r));
    expect(seen).toEqual([]);
    for (const [i] of ROOTS.entries()) {
      expect(server[i]!.ids.length).toBeGreaterThanOrEqual(1);
      expect(diffGraphs(`root ${i}`, server[i]!, hydrated[i]!)).toEqual([]);
      expect(server[i]!.dangling).toEqual([]);
    }
    const sets = (g: typeof server) => g.map((graph, i) => ({ name: ROOTS[i]!, graph }));
    expect(crossRootIssues(sets(server))).toEqual([]);
    expect(crossRootIssues(sets(hydrated))).toEqual([]);
    expect(new Set(server.flatMap((g) => g.ids)).size).toBe(
      server.reduce((n, g) => n + g.ids.length, 0),
    );
    expect(roots.map((r) => r.querySelector('details')!.open)).toEqual([true, true, true]);
    roots.forEach((r) => r.remove());
  });

  it('seeded: roots that share a prefix collide', async () => {
    const out = await Promise.all(['p-', 'p-'].map(render));
    const roots = out.map(host);
    const issues = crossRootIssues(
      roots.map((r, i) => ({ name: `r${i}`, graph: extractGraph(r) })),
    );
    expect(issues.join()).toMatch(/collision: id/);
    roots.forEach((r) => r.remove());
  });
});
