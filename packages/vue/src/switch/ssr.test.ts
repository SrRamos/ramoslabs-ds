import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { SJProvider } from '../runtime/index';
import { SJSwitch } from './index';

const render = (props: Record<string, unknown>) =>
  renderToString(
    createSSRApp({ render: () => h(SJProvider, null, { default: () => h(SJSwitch, props) }) }),
  );

describe('SJSwitch SSR (node environment)', () => {
  it('renders the native input with state, name, value and a stable id', async () => {
    const html = await render({ name: 'n', value: 'v', defaultChecked: true, label: 'Wifi' });
    expect(html).toContain('<label class="sj-switch__root"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('name="n"');
    expect(html).toContain('value="v"');
    expect(html).toContain('checked');
    expect(html).toContain('data-state="on"');
    expect(html).not.toContain('aria-checked');
    expect(await render({ name: 'n', value: 'v', defaultChecked: true, label: 'Wifi' })).toBe(html);
  });

  it('renders off and disabled, and honours an explicit id', async () => {
    const html = await render({ disabled: true, id: 'mine' });
    expect(html).toContain('id="mine"');
    expect(html).toContain('disabled');
    expect(html).toContain('data-state="off"');
    expect(html).not.toMatch(/\schecked/);
  });
});
