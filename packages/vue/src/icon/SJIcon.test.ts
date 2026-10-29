import { describe, expect, it, vi } from 'vitest';
import { createRenderer, createSSRApp, h, type App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createRuntime } from '@ramoslabs/core/runtime';
import { SJProvider } from '../runtime/index';
import { SJIcon } from './index';
import source from './SJIcon.ts?raw';

// DOM-free renderer (as in SJButton.test.ts): the suite runs under `node`.
interface N {
  type: string;
  props: Record<string, unknown>;
  children: N[];
  parent?: N;
}
const mk = (type: string): N => ({ type, props: {}, children: [] });
const { createApp } = createRenderer<N, N>({
  patchProp(el, key, _prev, next) {
    if (next === null || next === undefined || next === false) delete el.props[key];
    else el.props[key] = next;
  },
  insert(el, parent, anchor) {
    el.parent = parent;
    const i = anchor ? parent.children.indexOf(anchor) : -1;
    if (i < 0) parent.children.push(el);
    else parent.children.splice(i, 0, el);
  },
  remove(el) {
    const p = el.parent;
    if (p) p.children = p.children.filter((c) => c !== el);
  },
  createElement: mk,
  createText: (text) => ({ ...mk('#text'), props: { text } }),
  createComment: () => mk('#comment'),
  setText() {},
  setElementText() {},
  parentNode: (n) => n.parent ?? null,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
});

const arrow = {
  name: 'arrow-right',
  mirror: true,
  nodes: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'm12 5 7 7-7 7' }],
  ],
} as const;
const star = { name: 'star', nodes: [['path', { d: 'M12 2l3 7h7' }]] } as const;

function mount(props: Record<string, unknown>, wrap?: () => unknown) {
  const root = mk('root');
  const app = createApp({
    render: () =>
      wrap
        ? h(
            SJProvider,
            {
              runtime: createRuntime({ dir: 'rtl', target: 'server' }),
              liveHost: { create: () => ({ setText() {} }) },
            },
            () => h(SJIcon, props),
          )
        : h(SJIcon, props),
  });
  app.mount(root);
  return {
    app,
    root,
    el: () => root.children.find((c) => c.type === 'svg')!,
    unmount: () => app.unmount(),
  };
}

describe('SJIcon root', () => {
  it('is decorative without a label: aria-hidden, no role, never focusable', () => {
    const { el } = mount({ icon: star, tabindex: '0' });
    expect(el().type).toBe('svg');
    expect(el().props).toMatchObject({
      class: 'sj-icon',
      'data-part': 'root',
      'data-size': 'md',
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      'aria-hidden': 'true',
    });
    for (const k of ['role', 'aria-label', 'tabindex', 'data-mirror']) {
      expect(el().props).not.toHaveProperty(k);
    }
    expect(el().children.map((c) => [c.type, c.props])).toEqual([['path', { d: 'M12 2l3 7h7' }]]);
  });

  it('is an img with an accessible name when labelled', () => {
    const { el } = mount({ icon: star, label: 'Favourite' });
    expect(el().props).toMatchObject({ role: 'img', 'aria-label': 'Favourite' });
    expect(el().props).not.toHaveProperty('aria-hidden');
  });

  it('treats a whitespace label as decorative and warns in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el } = mount({ icon: star, label: '  ' });
    expect(el().props['aria-hidden']).toBe('true');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('maps sizes and falls back to md', () => {
    for (const s of ['sm', 'md', 'lg', 'fit']) {
      expect(mount({ icon: star, size: s }).el().props['data-size']).toBe(s);
    }
    expect(mount({ icon: star, size: 'huge' }).el().props['data-size']).toBe('md');
  });

  it('merges class and classes.root and passes unknown attributes; protected keys win', () => {
    const { el } = mount({
      icon: star,
      class: 'a',
      classes: { root: 'b' },
      'data-x': '1',
      role: 'button',
      width: '99',
    });
    expect(el().props.class).toBe('sj-icon a b');
    expect(el().props['data-x']).toBe('1');
    expect(el().props.role).toBeUndefined();
    expect(el().props.width).toBe('1em');
  });

  it('respects the node allowlist: unsafe tags and attributes never render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = {
      nodes: [
        ['script', { d: 'x' }],
        ['path', { d: 'M0 0', onclick: 'x()', style: 'x', href: 'javascript:1', id: 'i' }],
        ['foreignObject', {}],
      ],
    };
    const { el } = mount({ icon: bad });
    expect(el().children).toHaveLength(1);
    expect(el().children[0]!.type).toBe('path');
    expect(el().children[0]!.props).toEqual({ d: 'M0 0' });
    warn.mockRestore();
  });
});

describe('SJIcon direction', () => {
  it('mirrors a mirrored icon under an rtl provider and not otherwise', () => {
    expect(mount({ icon: arrow }, () => 1).el().props['data-mirror']).toBe('true');
    expect(mount({ icon: star }, () => 1).el().props).not.toHaveProperty('data-mirror');
  });

  it('the dir prop overrides the runtime', () => {
    expect(mount({ icon: arrow, dir: 'ltr' }, () => 1).el().props).not.toHaveProperty(
      'data-mirror',
    );
    expect(mount({ icon: arrow, dir: 'rtl' }).el().props['data-mirror']).toBe('true');
  });

  it('outside a provider renders ltr with no warning, mirrored or not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const icon of [arrow, star]) {
      expect(mount({ icon }).el().props).not.toHaveProperty('data-mirror');
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('SJIcon SSR', () => {
  const ssr = (props: Record<string, unknown>) =>
    renderToString(createSSRApp({ render: () => h(SJIcon, props) }));

  it('renders the same string twice, with no ids and no warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = await ssr({ icon: arrow, label: 'Next', dir: 'rtl' });
    expect(await ssr({ icon: arrow, label: 'Next', dir: 'rtl' })).toBe(a);
    expect(a).toContain('<svg');
    expect(a).toContain('data-mirror="true"');
    expect(a).toContain('<path d="M5 12h14"></path>');
    expect(a).not.toMatch(/\bid=/);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('SJIcon source', () => {
  it('creates elements only: no innerHTML or v-html, no @ramoslabs/icons import', () => {
    const src = source
      .split('\n')
      .filter((l: string) => !l.trim().startsWith('//'))
      .join('\n');
    expect(src).not.toMatch(/innerHTML|v-html|domProps/);
    expect(src).not.toContain('@ramoslabs/icons');
  });
});

describe('SJIcon lifecycle', () => {
  it('1,000 mount/unmount cycles retain nothing and never warn outside a provider', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = mk('root');
    for (let i = 0; i < 1000; i++) {
      const app: App<N> = createApp({
        render: () => h(SJIcon, { icon: i % 2 ? arrow : star }),
      });
      app.mount(root);
      const scope = (app as unknown as { _instance: { scope: { active: boolean } } })._instance
        .scope;
      expect(root.children).toHaveLength(1);
      app.unmount();
      expect(scope.active).toBe(false);
      expect(root.children).toHaveLength(0);
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
