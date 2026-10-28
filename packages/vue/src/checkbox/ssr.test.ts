import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { SJProvider } from '../runtime/index';
import { SJCheckbox } from './index';

const render = (props: Record<string, unknown>) =>
  renderToString(
    createSSRApp({ render: () => h(SJProvider, null, { default: () => h(SJCheckbox, props) }) }),
  );

describe('SJCheckbox SSR (node environment)', () => {
  it('renders the native input with state, name, value and a stable id', async () => {
    const html = await render({ name: 'n', value: 'v', defaultChecked: true, label: 'Wifi' });
    expect(html).toContain('<label class="sj-checkbox__root"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="n"');
    expect(html).toContain('value="v"');
    expect(html).toContain('checked');
    expect(html).toContain('data-state="checked"');
    expect(html).not.toContain('aria-checked');
    expect(await render({ name: 'n', value: 'v', defaultChecked: true, label: 'Wifi' })).toBe(html);
  });

  it('renders off and disabled, and honours an explicit id', async () => {
    const html = await render({ disabled: true, id: 'mine' });
    expect(html).toContain('id="mine"');
    expect(html).toContain('disabled');
    expect(html).toContain('data-state="unchecked"');
    expect(html).not.toMatch(/\schecked/);
  });
});

describe('SJCheckbox SSR indeterminate', () => {
  it('server-renders data-state but no indeterminate attribute (property set at mount)', async () => {
    const html = await render({ defaultIndeterminate: true, defaultChecked: true });
    expect(html).toContain('data-state="indeterminate"');
    expect(html).not.toContain('indeterminate=');
    expect(html).not.toMatch(/\sindeterminate[\s>]/);
  });
});
