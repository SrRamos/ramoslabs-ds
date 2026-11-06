import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { SJProvider } from '../runtime/index';
import { SJForm } from '../form/index';
import { SJInput } from '../input/index';
import { SJField } from './index';

const render = (error?: string) =>
  renderToString(
    createSSRApp({
      render: () =>
        h(SJProvider, null, {
          default: () =>
            h(
              SJForm,
              {
                fields: [
                  { key: 'e', kind: 'email' },
                  { key: 'm', kind: 'address' },
                ],
              },
              {
                default: () => [
                  h(
                    SJField,
                    { id: 'e', name: 'e', label: 'Email', hint: 'Hint', error },
                    { default: () => h(SJInput, { kind: 'email' }) },
                  ),
                  h(
                    SJField,
                    { name: 'm', label: 'Note' },
                    { default: () => h(SJInput, { kind: 'address' }) },
                  ),
                ],
              },
            ),
        }),
    }),
  );

describe('SJField, SJInput and SJForm SSR (node environment)', () => {
  it('renders ids, derived ARIA, the Enter hint from the data-first fields and the error text', async () => {
    const html = await render('Enter an email');
    expect(html).toContain('<form class="sj-form__root" data-part="root">');
    expect(html).toContain('id="e-label"');
    expect(html).toContain('for="e"');
    expect(html).toContain('id="e-hint"');
    expect(html).toContain('id="e-error"');
    expect(html).toContain('aria-describedby="e-hint e-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('enterkeyhint="go"');
    expect(html).toContain('<textarea');
    expect(html).toContain('enterkeyhint="enter"');
    expect(html).toContain('Enter an email');
    expect(html).toContain('data-part="icon"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('has no live markup on the server and is deterministic (derived ids match)', async () => {
    const html = await render('Bad');
    expect(html).not.toMatch(/role=|aria-live|data-sj-live/);
    expect(html).not.toContain('maxlength');
    expect(await render('Bad')).toBe(html);
    expect(html).toContain('id="sj-field-v-0"');
  });

  it('a valid field renders no error and no aria-invalid', async () => {
    const html = await render();
    expect(html).not.toContain('data-part="error"');
    expect(html).not.toContain('aria-invalid');
    expect(html).toContain('aria-describedby="e-hint"');
  });
});
