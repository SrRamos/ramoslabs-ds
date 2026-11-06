// @vitest-environment jsdom
// SSR determinism for SJField, SJInput and SJForm (W1-C02.f, ADR-003, ADR-006, ADR-013 PR gate), on the SSR
// harness's own pieces (withoutDom, extractGraph, diffGraphs, crossRootIssues): a server render with the DOM
// hidden, real hydration of that markup, and cross-root checks. Here the IDREF graph is real (label `for`,
// `aria-describedby`), so the stock graph comparison has edges to compare. Also: no live-region markup on the
// server (ADR-006), the aria-hidden icon is in the server markup, and the data-first Enter position is too.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString as reactToString } from 'react-dom/server';
import { renderToString as vueToString } from 'vue/server-renderer';
import { nextTick } from 'vue';
import { crossRootIssues, diffGraphs, extractGraph } from '../../ssr/graph';
import { withoutDom } from '../../ssr/runner';
import { reactTree, vueApp } from './host/ssr-tree';
import { ERROR, HYDRATION_FIXTURES, type Scene } from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ROOTS = ['a-', 'b-', 'c-'];
// Roots of one page must not share the host form and button ids (`f`, `go`) the browser specs use.
const withError = { ...HYDRATION_FIXTURES['field-hint-error']!, fixedIds: false as const };
const dataFirst = HYDRATION_FIXTURES['form-data-first']!;

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

describe.each(['react', 'vue'] as const)('SJField SSR: %s', (adapter) => {
  const renderOf = (scene: Scene, prefix: string) =>
    withoutDom(() =>
      adapter === 'react'
        ? reactToString(reactTree(scene, prefix, 'server'), { identifierPrefix: prefix })
        : vueToString(vueApp(scene, prefix, 'server', true)),
    );
  const render = (prefix: string) => renderOf(withError, prefix);

  it('renders on a server with no DOM globals: label, hint, control, error with a hidden icon; deterministic', async () => {
    const one = await render('a-');
    expect(one).toContain('<form');
    expect(one).toContain('<label');
    expect(one).toContain('type="email"');
    expect(one).toContain('aria-invalid="true"');
    expect(one).toContain('sj-field__error');
    expect(one).toMatch(
      /data-part="icon"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-part="icon"/,
    );
    expect(one).toContain(ERROR);
    expect(one).not.toMatch(/<(script|style)\b/);
    expect(await render('a-')).toBe(one);
  });

  it('ADR-006: no live-region markup on the server, with a standing error', async () => {
    const html = await render('a-');
    expect(html).not.toMatch(/role="(status|alert)"|aria-live|data-sj-live|sj-sr-only/);
  });

  it('the data-first fields prop puts the Enter position in the server markup', async () => {
    const html = await renderOf(dataFirst, 'd-');
    // (React writes the attribute as `enterKeyHint`; HTML attribute names are case-insensitive.)
    expect(html.match(/enterkeyhint="(\w+)"/gi)?.map((m) => m.toLowerCase())).toEqual([
      'enterkeyhint="next"',
      'enterkeyhint="go"',
      'enterkeyhint="enter"',
    ]);
    expect(html).toContain('action="/echo"');
  });

  it('without a data-first list the server markup has no Enter position (it appears after mount)', async () => {
    const html = await renderOf(HYDRATION_FIXTURES['form-valued']!, 'e-');
    expect(html.toLowerCase()).not.toContain('enterkeyhint');
  });

  it('hydration adopts the server nodes without a warning', async () => {
    const html = await render('h-');
    const root = host(html);
    const before = [...root.querySelectorAll('*')];
    const { seen } = await quiet(async () => {
      if (adapter === 'react')
        await act(async () => {
          hydrateRoot(root, reactTree(withError, 'h-', 'client'), { identifierPrefix: 'h-' });
        });
      else {
        vueApp(withError, 'h-', 'client', true).mount(root);
        await nextTick();
      }
    });
    expect(seen).toEqual([]);
    expect(before.every((n) => n.isConnected)).toBe(true);
    expect(root.querySelector('input')).toBe(before.find((n) => n.localName === 'input'));
    root.remove();
  });

  it('server, hydrated graphs agree across three roots; ids are unique, IDREFs resolve; no diagnostics', async () => {
    const html = await Promise.all(ROOTS.map(render));
    const roots = html.map(host);
    const server = roots.map((r) => extractGraph(r));
    const { seen } = await quiet(async () => {
      for (const [i, prefix] of ROOTS.entries()) {
        if (adapter === 'react')
          await act(async () => {
            hydrateRoot(roots[i]!, reactTree(withError, prefix, 'client'), {
              identifierPrefix: prefix,
            });
          });
        else {
          vueApp(withError, prefix, 'client', true).mount(roots[i]!);
          await nextTick();
        }
      }
    });
    const hydrated = roots.map((r) => extractGraph(r));
    expect(seen).toEqual([]);
    for (const [i] of ROOTS.entries()) {
      // control, label, hint and error
      expect(server[i]!.ids.length).toBeGreaterThanOrEqual(4);
      expect(diffGraphs(`root ${i}`, server[i]!, hydrated[i]!)).toEqual([]);
      expect(server[i]!.dangling).toEqual([]);
    }
    const sets = (g: typeof server) => g.map((graph, i) => ({ name: ROOTS[i]!, graph }));
    expect(crossRootIssues(sets(server))).toEqual([]);
    expect(crossRootIssues(sets(hydrated))).toEqual([]);
    expect(new Set(server.flatMap((g) => g.ids)).size).toBe(
      server.reduce((n, g) => n + g.ids.length, 0),
    );
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
