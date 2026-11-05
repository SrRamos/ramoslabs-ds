// @vitest-environment jsdom
// SSR determinism for SJCheckbox (W1-C03c.f, ADR-003, ADR-013 PR gate), on the SSR harness's own pieces
// (withoutDom, extractGraph, diffGraphs, crossRootIssues). The runner's stock `runSsrDeterminism` demands
// IDREF edges, which a native <label>-wrapped input does not have by design (no aria-labelledby, no `for`),
// so the same three passes are run here: server render with the DOM hidden, real hydration of that markup,
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
import { FIXTURES } from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ROOTS = ['a-', 'b-', 'c-'];
const props = FIXTURES['checked']!;
const mixed = FIXTURES['indeterminate']!;

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

describe.each(['react', 'vue'] as const)('SJCheckbox SSR: %s', (adapter) => {
  const render = (prefix: string) =>
    withoutDom(() =>
      adapter === 'react'
        ? reactToString(reactTree(props, prefix, 'server'), { identifierPrefix: prefix })
        : vueToString(vueApp(props, prefix, 'server', true)),
    );

  it('renders on a server with no DOM globals: real input, checked, deterministic', async () => {
    const one = await render('a-');
    expect(one).toContain('<input');
    expect(one).toContain('type="checkbox"');
    expect(one).not.toContain('role=');
    expect(one).toContain('checked');
    expect(one).toContain('data-state="checked"');
    expect(one).not.toContain('aria-checked');
    expect(one).not.toMatch(/<(script|style)\b/);
    expect(await render('a-')).toBe(one);
  });

  it('server markup of an indeterminate checkbox: data-state yes, indeterminate attribute no (SSR cannot render the property)', async () => {
    const html = await withoutDom(() =>
      adapter === 'react'
        ? reactToString(reactTree(mixed, 'm-', 'server'), { identifierPrefix: 'm-' })
        : vueToString(vueApp(mixed, 'm-', 'server', true)),
    );
    expect(html).toContain('data-state="indeterminate"');
    expect(html).not.toMatch(/\sindeterminate(?=[\s=>/])/);
    expect(html).not.toContain('aria-checked');
    expect(html).not.toContain('role=');
  });

  it('hydration sets the indeterminate property on the adopted input; the markup gains no attribute', async () => {
    const html = await withoutDom(() =>
      adapter === 'react'
        ? reactToString(reactTree(mixed, 'h-', 'server'), { identifierPrefix: 'h-' })
        : vueToString(vueApp(mixed, 'h-', 'server', true)),
    );
    const root = host(html);
    const input = root.querySelector('input')!;
    expect(input.indeterminate, 'not set by the server markup').toBe(false);
    const { seen } = await quiet(async () => {
      if (adapter === 'react')
        await act(async () => {
          hydrateRoot(root, reactTree(mixed, 'h-', 'client'), { identifierPrefix: 'h-' });
        });
      else {
        vueApp(mixed, 'h-', 'client', true).mount(root);
        await nextTick();
      }
    });
    expect(seen).toEqual([]);
    expect(root.querySelector('input')).toBe(input);
    expect(input.indeterminate).toBe(true);
    expect(input.hasAttribute('indeterminate')).toBe(false);
    root.remove();
  });

  it('server, hydrated and (vue) fresh-client graphs agree across three roots; no diagnostics', async () => {
    const html = await Promise.all(ROOTS.map(render));
    const roots = html.map(host);
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
      expect(server[i]!.ids).toHaveLength(1);
      expect(diffGraphs(`root ${i}`, server[i]!, hydrated[i]!)).toEqual([]);
      expect(server[i]!.dangling).toEqual([]);
    }
    const sets = (g: typeof server) => g.map((graph, i) => ({ name: ROOTS[i]!, graph }));
    expect(crossRootIssues(sets(server))).toEqual([]);
    expect(crossRootIssues(sets(hydrated))).toEqual([]);
    expect(new Set(server.flatMap((g) => g.ids)).size).toBe(ROOTS.length);
    expect(roots.map((r) => r.querySelector('input')!.checked)).toEqual([true, true, true]);
    roots.forEach((r) => r.remove());
  });

  it('seeded: roots that share a prefix collide', async () => {
    const html = await Promise.all(['p-', 'p-'].map(render));
    const roots = html.map(host);
    const issues = crossRootIssues(
      roots.map((r, i) => ({ name: `r${i}`, graph: extractGraph(r) })),
    );
    expect(issues.join()).toMatch(/collision: id/);
    roots.forEach((r) => r.remove());
  });
});
