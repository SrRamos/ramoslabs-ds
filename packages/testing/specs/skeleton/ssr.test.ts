// @vitest-environment jsdom
// SSR, hydration and cross-adapter markup parity for SJSkeleton (ADR-013 gates "SSR/hydration checks").
// React: renderToString, then a REAL hydrateRoot into the server markup. Vue: renderToString, then
// createSSRApp(...).mount (real hydration). Vanilla has no server renderer (ADR-002: it mounts on the client), so
// its client DOM is compared with what the other two server-render. The output is a pure function of the props
// (ADR-003): byte-equal when rendered twice and under providers with a different `idPrefix`, with no `id`, and
// (ADR-006) with NO live markup: no role=status/alert, no aria-live, no aria-atomic, for every fixture, with and
// without a provider. A loading group is `pending` + aria-busy on the server and starts NO timer; on the client the
// timers start at hydration and the group is shown after the delay.
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString as reactToString } from 'react-dom/server';
import { createSSRApp } from 'vue';
import { renderToString as vueToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeScheduler, createRuntime } from '@ramoslabs/core/runtime';
import { mountSkeleton } from '@ramoslabs/vanilla/skeleton';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { FIXTURES } from './fixtures';
import { reactEl, skeletonProps, vanillaProps, vueRoot } from './host/ssr-tree';

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
  mountSkeleton(host, box, vanillaProps(p, host));
  return { host, box };
}

describe('SJSkeleton server markup', () => {
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

  it('a loading group renders pending with aria-busy, the placeholder and no content', async () => {
    const p = FIXTURES['group-loading']!;
    const react = reactToString(reactEl(p));
    const vue = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
    for (const html of [react, vue]) {
      expect(html).toMatch(/data-shape="group"/);
      expect(html).toMatch(/data-state="pending"/);
      expect(html).toMatch(/aria-busy="true"/);
      expect(html).toContain('data-shape="circle"');
      expect(html).toContain('data-shape="text"');
      expect(html).not.toContain('Ramos Labs');
      expect(html).not.toMatch(LIVE_MARKUP);
      // The announce text is never in the markup; it goes to the registry after mount.
      expect(html).not.toContain('Loading activity');
    }
  });

  it('a loaded group renders idle, without aria-busy, with the content', async () => {
    const p = FIXTURES['group-loaded']!;
    for (const html of [
      reactToString(reactEl(p)),
      await vueToString(createSSRApp({ render: () => vueRoot(p) })),
    ]) {
      expect(html).toMatch(/data-state="idle"/);
      expect(html).not.toMatch(/aria-busy/);
      expect(html).toContain('Ramos Labs');
      expect(html).not.toContain('data-shape="circle"');
    }
  });

  it('the server render starts no timer and attaches nothing (react and vue)', async () => {
    const p = FIXTURES['group-loading']!;
    const sched = createFakeScheduler();
    const runtime = createRuntime({ target: 'server', scheduler: sched });
    reactToString(reactEl(p, { runtime }));
    expect(sched.pending).toBe(0);
    const sched2 = createFakeScheduler();
    await vueToString(
      createSSRApp({
        render: () =>
          vueRoot(p, { runtime: createRuntime({ target: 'server', scheduler: sched2 }) }),
      }),
    );
    expect(sched2.pending).toBe(0);
  });

  it('only a group that is not idle carries aria-busy; shapes are aria-hidden and never busy', () => {
    for (const name of NAMES) {
      const p = FIXTURES[name]!;
      const html = reactToString(reactEl(p));
      const loadingGroup = p.shape === 'group' && p.loading !== false;
      expect(/aria-busy="true"/.test(html), name).toBe(loadingGroup);
      if (p.shape !== 'group') expect(html, name).toMatch(/^<div[^>]*aria-hidden="true"/);
    }
  });

  it('the output is a pure function of the props: contract props and consumer attributes only', () => {
    const p = FIXTURES['text']!;
    expect(Object.keys(skeletonProps(p)).sort()).toEqual(['lines', 'shape']);
    expect(reactToString(reactEl(p))).toMatch(/^<div[^>]*data-part="root"/);
  });

  it('seeded: a markup difference between adapters is reported', () => {
    const a = shapeOf(
      '<div class="sj-skeleton" data-part="root"><div data-part="line"></div></div>',
    );
    expect(
      shapeOf('<div class="sj-skeleton" data-part="root"><span data-part="line"></span></div>'),
    ).not.toEqual(a);
    expect(
      shapeOf('<div class="sj-skeleton" data-part="root" aria-hidden="true"></div>'),
    ).not.toEqual(a);
  });

  it('seeded: an output that depends on idPrefix is reported', async () => {
    const leaking = (idPrefix?: string) =>
      `<div class="sj-skeleton" ${idPrefix ? `id="${idPrefix}1" ` : ''}data-part="root"></div>`;
    expect(await leaks(leaking)).toEqual(['a-', 'root-two-']);
  });

  it('seeded: live markup in the server HTML is reported', () => {
    for (const bad of [
      '<div class="sj-skeleton" role="status">x</div>',
      '<div class="sj-skeleton" aria-live="polite">x</div>',
      '<div role="alert" aria-atomic="true">x</div>',
    ])
      expect(LIVE_MARKUP.test(bad), bad).toBe(true);
    expect(LIVE_MARKUP.test('<div class="sj-skeleton" data-part="root">x</div>')).toBe(false);
  });

  it('seeded: a server render that starts a timer is reported by the pending count', () => {
    const sched = createFakeScheduler();
    sched.after(() => undefined, 300);
    expect(sched.pending).toBe(1);
  });
});

describe('SJSkeleton hydration', () => {
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
      // The unknown-shape fixture warns in development (by design); nothing else may be logged.
      expect(c.seen.filter((m) => !/unknown shape/.test(m))).toEqual([]);
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
      // The unknown-shape fixture warns in development (by design); nothing else may be logged.
      expect(c.seen.filter((m) => !/unknown shape/.test(m))).toEqual([]);
      expect(container.firstElementChild).toBe(before);
      expect(container.innerHTML).toBe(html);
      app.unmount();
    });
  }

  it('react: after hydration the client timers start and the group is shown once the delay has passed', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const p = { ...FIXTURES['group-loading']!, delay: 60, minDuration: 100 };
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML = reactToString(reactEl(p));
    const sched = createFakeScheduler();
    const runtime = createRuntime({ target: 'client', scheduler: sched });
    const state = () => container.querySelector('[data-shape="group"]')!.getAttribute('data-state');
    expect(state()).toBe('pending');
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, reactEl(p, { runtime }));
    });
    expect(state()).toBe('pending');
    expect(sched.pending, 'the delay timer runs after hydration').toBeGreaterThan(0);
    await act(async () => sched.advance(59));
    expect(state()).toBe('pending');
    await act(async () => sched.advance(1));
    expect(state()).toBe('visible');
    await act(async () => root.unmount());
    expect(sched.pending, 'unmount cancels the minimum-duration timer').toBe(0);
  });

  it('vue: after hydration the client timers start and the group is shown once the delay has passed', async () => {
    const p = { ...FIXTURES['group-loading']!, delay: 60, minDuration: 100 };
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
    const sched = createFakeScheduler();
    const runtime = createRuntime({ target: 'client', scheduler: sched });
    const state = () => container.querySelector('[data-shape="group"]')!.getAttribute('data-state');
    const app = createSSRApp({ render: () => vueRoot(p, { runtime }) });
    app.mount(container);
    expect(state()).toBe('pending');
    expect(sched.pending).toBeGreaterThan(0);
    sched.advance(59);
    await Promise.resolve();
    expect(state()).toBe('pending');
    sched.advance(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(state()).toBe('visible');
    app.unmount();
    expect(() => sched.advance(5000)).not.toThrow();
  });

  it('seeded: hydrating different markup is reported by React', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML = reactToString(reactEl(FIXTURES['text']!));
    const c = spyConsole();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, reactEl(FIXTURES['circle']!), {
        onRecoverableError: (e) => void c.seen.push(`recoverable: ${String(e)}`),
      });
    });
    c.restore();
    expect(c.seen.length).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });
});
