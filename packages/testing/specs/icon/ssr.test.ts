// @vitest-environment jsdom
// SSR, hydration and cross-adapter markup parity for SJIcon (W1-C12.f, ADR-013 gates "SSR/hydration checks").
// React: renderToString, then a REAL hydrateRoot into the server markup. Vue: renderToString, then
// createSSRApp(...).mount (real hydration). Vanilla has no server renderer (ADR-002: it mounts on the client), so
// its client DOM is compared with what the other two server-render. The icon is a pure function of its props
// (ADR-003): the output is byte-equal when rendered twice and when rendered under providers with a different
// `idPrefix`, and it contains no `id` at all.
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString as reactToString } from 'react-dom/server';
import { createSSRApp } from 'vue';
import { renderToString as vueToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from '@ramoslabs/core/runtime';
import { mountIcon } from '@ramoslabs/vanilla/icon';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { FIXTURES } from './fixtures';
import { iconProps, reactEl, vueRoot } from './host/ssr-tree';

const NAMES = Object.keys(FIXTURES);
/** Tag, sorted attributes and children, ignoring attribute order and whitespace: "same DOM" without byte equality. */
function shape(n: Node): unknown {
  if (n.nodeType === 8) return '';
  if (n.nodeType === 3) return (n.textContent ?? '').trim();
  const el = n as Element;
  return {
    tag: el.localName,
    ns: el.namespaceURI,
    attrs: [...el.attributes].map((a) => `${a.name}=${a.value}`).sort(),
    kids: [...el.childNodes].map(shape).filter((k) => k !== ''),
  };
}
const shapeOf = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return [...d.childNodes].map(shape).filter((k) => k !== '');
};

function spyConsole() {
  const seen: string[] = [];
  const spies = (['error', 'warn'] as const).map((m) =>
    vi
      .spyOn(console, m)
      .mockImplementation((...a: unknown[]) => void seen.push(a.map(String).join(' '))),
  );
  return { seen, restore: () => spies.forEach((s) => s.mockRestore()) };
}

/** Prefixes for which `render` differs from the unprefixed render (empty means equal across roots). */
async function leaks(render: (idPrefix?: string) => string | Promise<string>): Promise<string[]> {
  const base = await render('');
  const bad: string[] = [];
  for (const idPrefix of ['a-', 'root-two-'])
    if ((await render(idPrefix)) !== base) bad.push(idPrefix);
  return bad;
}

/**
 * Dev-mode warnings are part of the contract for hostile data: `unknown-node` is expected to report the nodes core
 * dropped (a count, never a name). Anything else logged during hydration is a defect.
 */
const unexpected = (name: string, seen: string[]) =>
  seen.filter((m) => !(name === 'unknown-node' && /^\[ramoslabs\] SJIcon dropped \d+$/.test(m)));

afterEach(() => {
  document.body.replaceChildren();
});

describe('SJIcon server markup', () => {
  for (const name of NAMES) {
    it(`${name}: react and vue server-render the same DOM; vanilla's client DOM matches`, async () => {
      const p = FIXTURES[name]!;
      const react = reactToString(reactEl(p));
      const vue = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
      expect(shapeOf(vue)).toEqual(shapeOf(react));

      const host = createHost(
        createRuntime({
          target: 'client',
          idFactory: () => 'ssr-test',
          ...(p.runtimeDir && { dir: p.runtimeDir }),
        }),
      );
      const box = document.body.appendChild(document.createElement('div'));
      const { runtimeDir: _r, attrs, ...contract } = p;
      void _r;
      mountIcon(host, box, { ...contract, ...(attrs && { attrs }) });
      expect([...box.childNodes].map(shape).filter((k) => k !== '')).toEqual(shapeOf(react));
      host.destroy();
    });

    it(`${name}: equal output rendered twice, and under different idPrefix roots; no id anywhere`, async () => {
      const p = FIXTURES[name]!;
      const react = reactToString(reactEl(p));
      const vue = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
      expect(reactToString(reactEl(p))).toBe(react);
      expect(await vueToString(createSSRApp({ render: () => vueRoot(p) }))).toBe(vue);
      expect(await leaks((idPrefix) => reactToString(reactEl(p, { idPrefix })))).toEqual([]);
      expect(
        await leaks((idPrefix) =>
          vueToString(createSSRApp({ render: () => vueRoot(p, { idPrefix }) })),
        ),
      ).toEqual([]);
      expect(react).not.toMatch(/\sid=/);
      expect(vue).not.toMatch(/\sid=/);
    });
  }

  it('the output is a pure function of the props: contract props and consumer attributes only', () => {
    const p = FIXTURES['labelled']!;
    expect(Object.keys(iconProps(p)).sort()).toEqual(['icon', 'label']);
    expect(reactToString(reactEl(p))).toMatch(/^<svg[^>]*role="img"[^>]*aria-label="Search"/);
  });

  it('seeded: a markup difference between adapters is reported', () => {
    const a = shapeOf('<svg class="sj-icon" aria-hidden="true"></svg>');
    expect(shapeOf('<svg class="sj-icon" role="img" aria-label="x"></svg>')).not.toEqual(a);
    expect(shapeOf('<span class="sj-icon" aria-hidden="true"></span>')).not.toEqual(a);
  });

  it('seeded: an output that depends on idPrefix is reported', async () => {
    const leaking = (idPrefix?: string) =>
      `<svg class="sj-icon" ${idPrefix ? `id="${idPrefix}1" ` : ''}aria-hidden="true"></svg>`;
    expect(await leaks(leaking)).toEqual(['a-', 'root-two-']);
  });
});

describe('SJIcon hydration', () => {
  for (const name of NAMES) {
    it(`react hydrateRoot | ${name}: no mismatch, node kept`, async () => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      const p = FIXTURES[name]!;
      const container = document.body.appendChild(document.createElement('div'));
      container.innerHTML = reactToString(reactEl(p));
      const before = container.firstElementChild;
      const html = container.innerHTML;
      const c = spyConsole();
      let root!: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(container, reactEl(p), {
          onRecoverableError: (e) => void c.seen.push(`recoverable: ${String(e)}`),
        });
      });
      c.restore();
      expect(unexpected(name, c.seen)).toEqual([]);
      expect(container.firstElementChild).toBe(before);
      expect(container.innerHTML).toBe(html);
      await act(async () => root.unmount());
    });

    it(`vue createSSRApp hydration | ${name}: no mismatch, node kept`, async () => {
      const p = FIXTURES[name]!;
      const container = document.body.appendChild(document.createElement('div'));
      container.innerHTML = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
      const before = container.firstElementChild;
      const html = container.innerHTML;
      const c = spyConsole();
      const app = createSSRApp({ render: () => vueRoot(p) });
      app.config.warnHandler = (m) => void c.seen.push(m);
      app.mount(container);
      c.restore();
      expect(unexpected(name, c.seen)).toEqual([]);
      expect(container.firstElementChild).toBe(before);
      expect(container.innerHTML).toBe(html);
      app.unmount();
    });
  }

  it('seeded: hydrating different markup is reported by React', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML = reactToString(reactEl(FIXTURES['default']!));
    const c = spyConsole();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, reactEl(FIXTURES['labelled']!), {
        onRecoverableError: (e) => void c.seen.push(`recoverable: ${String(e)}`),
      });
    });
    c.restore();
    expect(c.seen.length).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });
});
