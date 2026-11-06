import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { SJProvider } from '../runtime/index';
import { SJDisclosure } from './index';

const render = (props: Record<string, unknown>) =>
  renderToString(
    createSSRApp({
      render: () =>
        h(SJProvider, null, { default: () => h(SJDisclosure, props, { default: () => 'b' }) }),
    }),
  );

describe('SJDisclosure SSR (node environment)', () => {
  it('renders native details with state, name, open and a stable id; no aria-expanded', async () => {
    const html = await render({ summary: 'S', name: 'g', defaultOpen: true });
    expect(html).toContain('<details class="sj-disclosure__root"');
    expect(html).toMatch(/\sopen[\s>=]/);
    expect(html).toContain('name="g"');
    expect(html).toContain('data-state="open"');
    expect(html).toContain('<summary');
    expect(html).not.toContain('aria-expanded');
    expect(await render({ summary: 'S', name: 'g', defaultOpen: true })).toBe(html);
  });

  it('renders closed and disabled', async () => {
    const html = await render({ disabled: true, id: 'mine' });
    expect(html).toContain('id="mine"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-state="closed"');
    expect(html).not.toMatch(/\sopen[\s>=]/);
  });
});
