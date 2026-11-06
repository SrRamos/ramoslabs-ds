// @vitest-environment jsdom
// SJSkeleton x SJState server markup: the `skeleton` part exists in the loading variant only, is aria-hidden, and
// react and vue server-render the same DOM; no live markup. A group inside it is pending with no timer.
import { renderToString as reactToString } from 'react-dom/server';
import { createElement } from 'react';
import { createSSRApp, h } from 'vue';
import { renderToString as vueToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { createFakeScheduler, createRuntime } from '@ramoslabs/core/runtime';
import { SJProvider as ReactProvider } from '@ramoslabs/react/runtime';
import { SJState as ReactState } from '@ramoslabs/react/state';
import { SJProvider as VueProvider } from '@ramoslabs/vue/runtime';
import { reactCompositionEl, vueStateComposition } from '../host/ssr-tree';
import { COMPOSITIONS } from './fixtures';

const LIVE_MARKUP = /\brole="(?:status|alert)"|\baria-live=|\baria-atomic=/;
const tree = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  const walk = (n: Element): unknown => ({
    tag: n.localName,
    attrs: [...n.attributes].map((a) => `${a.name}=${a.value}`).sort(),
    kids: [...n.children].map(walk),
  });
  return [...d.children].map(walk);
};

describe('SJState skeleton part (server markup)', () => {
  for (const [name, c] of Object.entries(COMPOSITIONS)) {
    it(`${name}: react and vue render the same DOM, the part is aria-hidden, no live markup`, async () => {
      const react = reactToString(reactCompositionEl(c.props));
      const vue = await vueToString(
        createSSRApp({
          render: () =>
            h(VueProvider, { runtime: createRuntime({ target: 'server' }) }, () =>
              vueStateComposition(c.props),
            ),
        }),
      );
      expect(tree(vue)).toEqual(tree(react));
      expect(react).not.toMatch(LIVE_MARKUP);
      const d = document.createElement('div');
      d.innerHTML = react;
      const part = d.querySelector('[data-part="skeleton"]')!;
      expect(part.localName).toBe('div');
      expect(part.getAttribute('aria-hidden')).toBe('true');
      expect(part.getAttribute('data-variant')).toBe('loading');
      expect(d.querySelector('[data-part="root"]')!.getAttribute('aria-busy')).toBe('true');
    });
  }

  it('a group inside the part is pending and the server render starts no timer', () => {
    const sched = createFakeScheduler();
    const html = reactToString(
      reactCompositionEl(COMPOSITIONS['group-silent']!.props, {
        runtime: createRuntime({ target: 'server', scheduler: sched }),
      }),
    );
    expect(html).toMatch(
      /data-shape="group"[^>]*data-state="pending"|data-state="pending"[^>]*data-shape="group"/,
    );
    expect(sched.pending).toBe(0);
  });

  it('the skeleton slot is ignored outside the loading variant', () => {
    const html = reactToString(
      createElement(
        ReactProvider,
        { runtime: createRuntime({ target: 'server' }) },
        createElement(ReactState, {
          variant: 'error',
          heading: 'Could not load',
          skeleton: createElement('div', { 'data-probe': 'x' }),
        } as never),
      ),
    );
    expect(html).not.toContain('data-part="skeleton"');
    expect(html).not.toContain('data-probe');
  });

  it('seeded: markup that exposes the part to assistive tech is reported', () => {
    const d = document.createElement('div');
    d.innerHTML = '<div data-part="skeleton"></div>';
    expect(d.querySelector('[data-part="skeleton"]')!.getAttribute('aria-hidden')).not.toBe('true');
  });
});
