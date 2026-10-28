// Real hydration for SJSwitch (W1-C03s.f, ADR-003 SSR-safe ids, ADR-013 PR gate): the server renders the
// markup in node (no DOM), the browser parses it BEFORE any script runs, then React / Vue hydrate it in a
// development build (the only build that reports mismatches). Asserts: no mismatch or recoverable error,
// the SAME DOM nodes survive hydration (nothing was replaced), identical markup before and after, the
// control then works and a real form submit equals a bare input. Vanilla has no server render (ADR-002:
// the adapter builds DOM on the client); its pre-existing-markup path is the `<sj-switch>` upgrade test.
import { test, expect, type Page } from '@playwright/test';
import { FIXTURES, FORM_FIXTURES, type Adapter } from './fixtures';

const slug = (s: string) => s.replace(/\s+/g, '-');
const HYDRATING = ['react', 'vue'] as const;
const CASES = [...Object.keys(FIXTURES), 'on named', 'off custom value', 'disabled on'] as const;
const propsOf = (name: string) => ({ ...FIXTURES, ...FORM_FIXTURES })[name]!;

async function load(page: Page, adapter: Adapter, name: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`/hydrate/${adapter}/${slug(name)}.html`);
  await page.waitForFunction(() => window.__hy?.ready === true);
  return messages;
}

for (const adapter of HYDRATING) {
  for (const name of CASES) {
    test(`hydration | ${adapter} | ${name} | server markup is adopted, not replaced`, async ({
      page,
    }) => {
      const messages = await load(page, adapter, name);
      const before = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#root *')];
        (window as unknown as { __pre: Element[] }).__pre = nodes;
        return { html: document.getElementById('root')!.innerHTML, count: nodes.length };
      });
      expect(before.count, 'the server rendered the switch').toBeGreaterThan(2);
      await page.evaluate(([a, p]) => window.__hy.hydrate(a as 'react', p as never, 'hy-'), [
        adapter,
        propsOf(name),
      ] as const);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 120)));
      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          html: document.getElementById('root')!.innerHTML,
          kept: pre.every((n) => n.isConnected),
          recoverable: window.__hy.recoverable,
        };
      });
      expect(after.kept, 'every server node is still in the document').toBe(true);
      expect(after.html).toBe(before.html);
      expect(after.recoverable).toEqual([]);
      expect(messages).toEqual([]);
    });
  }

  test(`hydration | ${adapter} | the hydrated control works and submits like a bare input`, async ({
    page,
  }) => {
    const messages = await load(page, adapter, 'on custom value');
    await page.evaluate(([a, p]) => window.__hy.hydrate(a as 'react', p as never, 'hy-'), [
      adapter,
      propsOf('on custom value'),
    ] as const);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 120)));
    const control = page.locator('input[role=switch]');
    expect(await control.getAttribute('data-state')).toBe('on');
    await control.click();
    expect(await control.getAttribute('data-state')).toBe('off');
    // reset restores the SERVER default (the attribute rendered into the markup), and the model follows.
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    expect(await control.isChecked()).toBe(true);
    expect(await control.getAttribute('data-state')).toBe('on');
    await Promise.all([
      page.waitForURL(/\/echo/),
      page.evaluate(() => (document.getElementById('f') as HTMLFormElement).requestSubmit()),
    ]);
    expect(new URL(page.url()).search).toBe('?alerts=yes');
    expect(messages).toEqual([]);
  });
}

test('hydration | server markup carries the same id on both sides and no live-region noise', async ({
  page,
}) => {
  for (const adapter of HYDRATING) {
    await load(page, adapter, 'off');
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('#root [id]')].map((e) => e.id),
    );
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBeTruthy();
    expect(await page.locator('#root script, #root style').count()).toBe(0);
  }
});

test('vanilla | markup that exists before define() is upgraded in place (element path)', async ({
  page,
}) => {
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  await page.evaluate(() => {
    document.getElementById('root')!.innerHTML =
      '<form id="f"><sj-switch name="alerts" value="yes" checked label="Notifications"></sj-switch></form>';
  });
  expect(await page.locator('#f input').count()).toBe(0); // not upgraded yet: inert markup
  await page.evaluate(() => window.__sw.mountElement({ name: 'x' })); // defines the element on first use
  await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  const upgraded = page.locator('sj-switch').first();
  await expect(upgraded.locator('input[role=switch]')).toBeChecked();
});
