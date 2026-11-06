// @vitest-environment jsdom
// SSR, hydration and cross-adapter markup parity for SJState (W1-C11.f, ADR-013 gates "SSR/hydration checks").
// React: renderToString, then a REAL hydrateRoot into the server markup. Vue: renderToString, then
// createSSRApp(...).mount (real hydration). Vanilla has no server renderer (ADR-002: it mounts on the client), so
// its client DOM is compared with what the other two server-render. The state is a pure function of its props
// (ADR-003): the output is byte-equal when rendered twice and when rendered under providers with a different
// `idPrefix`, it contains no `id` at all, and (ADR-006) it contains NO live markup: no role=status/alert, no
// aria-live, no aria-atomic, for every fixture, with and without a provider, interrupting or not.
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString as reactToString } from 'react-dom/server';
import { createSSRApp } from 'vue';
import { renderToString as vueToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from '@ramoslabs/core/runtime';
import { mountState } from '@ramoslabs/vanilla/state';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { FIXTURES } from './fixtures';
import { reactEl, stateProps, vanillaProps, vueRoot } from './host/ssr-tree';

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

afterEach(() => {
  document.body.replaceChildren();
});

/** Live markup in a string: a live role, `aria-live` or `aria-atomic` (ADR-006: the registry owns all of it, client only). */
const LIVE_MARKUP = /\brole="(?:status|alert)"|\baria-live=|\baria-atomic=/;

/** The vanilla client DOM for a fixture: the mount element is the root part. */
function vanillaDom(p: (typeof FIXTURES)[string]) {
  const host = createHost(createRuntime({ target: 'client', idFactory: () => 'ssr-test' }));
  const box = document.body.appendChild(document.createElement('div'));
  mountState(host, box, vanillaProps(p, host));
  return { host, box };
}

describe('SJState server markup', () => {
  for (const name of NAMES) {
    it(`${name}: react and vue server-render the same DOM; vanilla's client DOM matches`, async () => {
      const p = FIXTURES[name]!;
      const react = reactToString(reactEl(p));
      const vue = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
      expect(shapeOf(vue)).toEqual(shapeOf(react));
      const { host, box } = vanillaDom(p);
      expect([shape(box)]).toEqual(shapeOf(react));
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

    it(`${name}: no live markup in the server HTML, with or without a provider, whatever the consumer passes`, async () => {
      const p = FIXTURES[name]!;
      const hostile = {
        ...p,
        attrs: { role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true' },
      };
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        for (const q of [p, hostile]) {
          for (const bare of [false, true]) {
            const react = reactToString(reactEl(q, { bare }));
            const vue = await vueToString(createSSRApp({ render: () => vueRoot(q, { bare }) }));
            expect(react, `react bare=${bare}`).not.toMatch(LIVE_MARKUP);
            expect(vue, `vue bare=${bare}`).not.toMatch(LIVE_MARKUP);
            expect(react).toContain('data-part="root"');
          }
        }
      } finally {
        warn.mockRestore();
      }
    });
  }

  it('every variant keeps its own data-variant on the root and on every part (server markup)', () => {
    for (const name of [
      'first-use',
      'no-results',
      'cleared',
      'loading',
      'error',
      'error-interrupt',
    ]) {
      const p = FIXTURES[name]!;
      const box = document.createElement('div');
      box.innerHTML = reactToString(reactEl(p));
      const variant = p.variant ?? 'first-use';
      // The state's own parts only: the SJIcon and SJButton inside carry their own data-part / data-variant.
      const rootEl = box.firstElementChild!;
      const state = [rootEl, ...rootEl.children];
      expect(state.length).toBeGreaterThanOrEqual(2);
      for (const n of state)
        expect(n.getAttribute('data-variant'), n.getAttribute('data-part')!).toBe(variant);
    }
  });

  it('only the loading variant carries aria-busy, and the interrupt flag changes no markup', () => {
    for (const name of Object.keys(FIXTURES)) {
      const html = reactToString(reactEl(FIXTURES[name]!));
      expect(/aria-busy="true"/.test(html), name).toBe(FIXTURES[name]!.variant === 'loading');
    }
    const a = reactToString(reactEl({ ...FIXTURES['error']!, interrupt: false }));
    const b = reactToString(reactEl({ ...FIXTURES['error']!, interrupt: true }));
    expect(b).toBe(a);
  });

  it('the output is a pure function of the props: contract props and consumer attributes only', () => {
    const p = FIXTURES['loading']!;
    expect(Object.keys(stateProps(p)).sort()).toEqual(['heading', 'variant']);
    expect(reactToString(reactEl(p))).toMatch(/^<div[^>]*data-part="root"/);
  });

  it('seeded: a markup difference between adapters is reported', () => {
    const a = shapeOf('<div class="sj-state" data-part="root"><p data-part="title">x</p></div>');
    expect(
      shapeOf('<div class="sj-state" data-part="root"><div data-part="title">x</div></div>'),
    ).not.toEqual(a);
    expect(
      shapeOf('<div class="sj-state" data-part="root"><p data-part="title">y</p></div>'),
    ).not.toEqual(a);
  });

  it('seeded: an output that depends on idPrefix is reported', async () => {
    const leaking = (idPrefix?: string) =>
      `<div class="sj-state" ${idPrefix ? `id="${idPrefix}1" ` : ''}data-part="root"></div>`;
    expect(await leaks(leaking)).toEqual(['a-', 'root-two-']);
  });

  it('seeded: live markup in the server HTML is reported', () => {
    for (const bad of [
      '<div class="sj-state" role="status">x</div>',
      '<div class="sj-state" aria-live="polite">x</div>',
      '<div role="alert" aria-atomic="true">x</div>',
    ])
      expect(LIVE_MARKUP.test(bad), bad).toBe(true);
    expect(LIVE_MARKUP.test('<div class="sj-state" data-part="root">x</div>')).toBe(false);
  });
});

describe('SJState hydration', () => {
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
      expect(c.seen).toEqual([]);
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
      expect(c.seen).toEqual([]);
      expect(container.firstElementChild).toBe(before);
      expect(container.innerHTML).toBe(html);
      app.unmount();
    });
  }

  it('seeded: hydrating different markup is reported by React', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML = reactToString(reactEl(FIXTURES['first-use']!));
    const c = spyConsole();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, reactEl(FIXTURES['error']!), {
        onRecoverableError: (e) => void c.seen.push(`recoverable: ${String(e)}`),
      });
    });
    c.restore();
    expect(c.seen.length).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });
});
