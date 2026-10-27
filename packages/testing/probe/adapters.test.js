/* eslint-disable @typescript-eslint/ban-ts-comment -- test files drive untyped .mjs tools and adapters dynamically */
// @ts-nocheck -- test files: the sibling tools are untyped .mjs and the adapters are driven dynamically.
// @vitest-environment jsdom
/* global document */
// W1-316: the three wrappers run on the merged runtimes and render the same DOM (L3 parity input).
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createApp, h, nextTick } from 'vue';
import { renderToString as vueRender } from 'vue/server-renderer';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReactProbe, VueProbe, mountProbe } from './index';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Normalised root markup: attribute order and framework comments removed. */
function shape(root) {
  const btn = root.querySelector('button');
  const attrs = Object.fromEntries(
    [...btn.attributes].filter((a) => a.name !== 'id').map((a) => [a.name, a.value]),
  );
  return {
    attrs: Object.fromEntries(Object.entries(attrs).sort()),
    indicator: btn.querySelector('[data-part="indicator"]')?.className,
    text: btn.textContent,
  };
}

const mounted = [];
afterEach(() => {
  while (mounted.length) mounted.pop()();
  document.body.replaceChildren();
});

async function mountReact(props) {
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  const render = (p) => act(() => root.render(createElement(ReactProbe, p, 'Label')));
  await render(props);
  mounted.push(() => act(() => root.unmount()));
  return { host, update: render };
}

async function mountVue(props) {
  const host = document.body.appendChild(document.createElement('div'));
  let current = { ...props };
  const app = createApp({ render: () => h(VueProbe, current, { default: () => 'Label' }) });
  app.mount(host);
  mounted.push(() => app.unmount());
  const update = async (p) => {
    current = { ...p };
    app._instance.update();
    await nextTick();
  };
  return { host, update };
}

async function mountVanilla(props) {
  const host = document.body.appendChild(document.createElement('div'));
  const el = host.appendChild(document.createElement('button'));
  let n = 0;
  const h2 = createHost(createRuntime({ target: 'client', idFactory: () => `p${n++}` }));
  const inst = mountProbe(h2, el, { ...props, label: 'Label' });
  mounted.push(() => h2.destroy());
  return { host, update: (p) => inst.update({ ...p, label: 'Label' }) };
}

const adapters = { react: mountReact, vue: mountVue, vanilla: mountVanilla };
const click = (host) => host.querySelector('button').click();

describe.each(Object.entries(adapters))('%s wrapper', (_name, mount) => {
  it('off fixture: switch role, aria-checked false, data-state off', async () => {
    const { host } = await mount({});
    expect(shape(host).attrs).toMatchObject({
      role: 'switch',
      'aria-checked': 'false',
      'data-state': 'off',
      'data-part': 'root',
      type: 'button',
    });
  });

  it('uncontrolled: a click toggles and calls onPressedChange once', async () => {
    const onPressedChange = vi.fn();
    const { host } = await mount({ onPressedChange, pressed: undefined });
    await act(async () => click(host));
    await nextTick();
    expect(shape(host).attrs['aria-checked']).toBe('true');
    expect(host.querySelector('button').dataset.state).toBe('on');
    expect(onPressedChange.mock.calls).toEqual([[true]]);
  });

  it('controlled: a click only reports; the owner decides', async () => {
    const calls = [];
    const props = { pressed: false, onPressedChange: (v) => calls.push(v) };
    const { host, update } = await mount(props);
    await act(async () => click(host));
    await nextTick();
    expect(shape(host).attrs['aria-checked']).toBe('false');
    expect(calls).toEqual([true]);
    await act(async () => update({ ...props, pressed: true }));
    await nextTick();
    expect(shape(host).attrs['aria-checked']).toBe('true');
  });

  it('disabled fixture: the native button is disabled and data-disabled is set', async () => {
    const { host } = await mount({ disabled: true });
    const attrs = shape(host).attrs;
    expect(attrs).toHaveProperty('disabled');
    expect(attrs['data-disabled']).toBe('true');
  });
});

describe('parity', () => {
  it('react, vue and vanilla render the same normalised DOM in every fixture', async () => {
    const fixtures = { off: {}, on: { defaultPressed: true }, disabled: { disabled: true } };
    for (const props of Object.values(fixtures)) {
      const out = [];
      for (const mount of Object.values(adapters)) {
        const { host } = await mount(props);
        out.push(shape(host));
        while (mounted.length) mounted.pop()();
        document.body.replaceChildren();
      }
      expect(out[1]).toEqual(out[0]);
      expect(out[2]).toEqual(out[0]);
    }
  });

  it('SSR (react and vue) emits the same attributes as the client render', async () => {
    const r = renderToString(createElement(ReactProbe, { defaultPressed: true }, 'Label'));
    const v = await vueRender(
      createApp({
        render: () => h(VueProbe, { defaultPressed: true }, { default: () => 'Label' }),
      }),
    );
    for (const html of [r, v]) {
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('data-state="on"');
      expect(html).toContain('sj-probe__indicator');
    }
  });

  it('vanilla destroy leaves no live listener: a click after destroy changes nothing', async () => {
    const { host } = await mountVanilla({});
    mounted.pop()();
    click(host);
    expect(shape(host).attrs['aria-checked']).toBe('false');
  });
});
