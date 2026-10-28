// @vitest-environment jsdom
// SSR, hydration and cross-adapter markup parity for SJButton (W1-C01.f, ADR-013 gates "SSR/hydration checks").
// React: renderToString, then a REAL hydrateRoot into the server markup (the .d notes deferred this to .f).
// Vue: renderToString, then createSSRApp(...).mount (real hydration). Vanilla has no server renderer (ADR-002:
// it mounts on the client), so its client DOM is compared with what the other two server-render.
// Hydration is proven by: no console error or warning, the server's element node is kept (not replaced),
// and a click after hydration reaches `press` exactly once.
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString as reactToString } from 'react-dom/server';
import { createSSRApp } from 'vue';
import { renderToString as vueToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from '@ramoslabs/core/runtime';
import { mountButton } from '@ramoslabs/vanilla/button';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { FIXTURES, INERT } from './fixtures';
import { reactEl, split, vueRoot } from './host/ssr-tree';

const NAMES = Object.keys(FIXTURES);
/** Tag, sorted attributes and children, ignoring attribute order and whitespace: "same DOM" without byte equality. */
function shape(n: Node): unknown {
  if (n.nodeType === 8) return '';
  if (n.nodeType === 3) return (n.textContent ?? '').trim();
  const el = n as Element;
  return {
    tag: el.localName,
    attrs: [...el.attributes].map((a) => `${a.name}=${a.value}`).sort(),
    kids: [...el.childNodes].map(shape).filter((k) => k !== ''),
  };
}
const shapeOf = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return [...d.childNodes].map(shape);
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

afterEach(() => {
  document.body.replaceChildren();
});

describe('SJButton server markup', () => {
  for (const name of NAMES) {
    it(`${name}: react and vue server-render the same DOM; vanilla's client DOM matches`, async () => {
      const p = FIXTURES[name]!;
      const react = reactToString(reactEl(p));
      const vue = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
      expect(shapeOf(vue)).toEqual(shapeOf(react));

      const host = createHost(createRuntime({ target: 'client', idFactory: () => 'ssr-test' }));
      const box = document.body.appendChild(document.createElement('div'));
      const { text, icon, native, contract } = split(p);
      mountButton(host, box, {
        ...contract,
        ...(text !== undefined && !p.iconOnly && { text }),
        ...(icon !== undefined && { icon }),
        attrs: native,
      } as never);
      expect([...box.childNodes].map(shape)).toEqual(shapeOf(react));
      host.destroy();
    });
  }

  it('seeded: a markup difference between adapters is reported', () => {
    const a = shapeOf('<button type="button" class="x">Go</button>');
    expect(shapeOf('<button type="button" class="x" aria-label="Go">Go</button>')).not.toEqual(a);
    expect(shapeOf('<a class="x">Go</a>')).not.toEqual(a);
  });
});

describe('SJButton hydration', () => {
  for (const name of NAMES) {
    const inert = INERT.includes(name);

    it(`react hydrateRoot | ${name}: no mismatch, node kept, press ${inert ? 'never' : 'once'}`, async () => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      const p = FIXTURES[name]!;
      const container = document.body.appendChild(document.createElement('div'));
      container.innerHTML = reactToString(reactEl(p));
      const before = container.firstElementChild;
      const onPress = vi.fn();
      const c = spyConsole();
      let root!: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(container, reactEl(p, onPress), {
          onRecoverableError: (e) => void c.seen.push(`recoverable: ${String(e)}`),
        });
      });
      c.restore();
      expect(c.seen).toEqual([]);
      expect(container.firstElementChild).toBe(before);
      await act(async () => (before as HTMLElement).click());
      expect(onPress).toHaveBeenCalledTimes(inert ? 0 : 1);
      if (!inert) expect(onPress.mock.calls[0]![0].originalEvent.type).toBe('click');
      await act(async () => root.unmount());
    });

    it(`vue createSSRApp hydration | ${name}: no mismatch, node kept, press ${inert ? 'never' : 'once'}`, async () => {
      const p = FIXTURES[name]!;
      const container = document.body.appendChild(document.createElement('div'));
      container.innerHTML = await vueToString(createSSRApp({ render: () => vueRoot(p) }));
      const before = container.firstElementChild;
      const onPress = vi.fn();
      const c = spyConsole();
      const app = createSSRApp({ render: () => vueRoot(p, onPress) });
      app.config.warnHandler = (m) => void c.seen.push(m);
      app.mount(container);
      c.restore();
      expect(c.seen).toEqual([]);
      expect(container.firstElementChild).toBe(before);
      (before as HTMLElement).click();
      expect(onPress).toHaveBeenCalledTimes(inert ? 0 : 1);
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
      root = hydrateRoot(container, reactEl(FIXTURES['link']!), {
        onRecoverableError: (e) => void c.seen.push(`recoverable: ${String(e)}`),
      });
    });
    c.restore();
    expect(c.seen.length).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });
});
