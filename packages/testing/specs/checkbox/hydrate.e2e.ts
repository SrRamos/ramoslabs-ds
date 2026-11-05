// Real hydration for SJCheckbox (W1-C03c.f, ADR-003 SSR-safe ids, ADR-014, ADR-013 PR gate): the server renders the
// markup in node (no DOM), the browser parses it BEFORE any script runs, then React / Vue hydrate it in a
// development build (the only build that reports mismatches). Asserts: no mismatch or recoverable error,
// the SAME DOM nodes survive hydration (nothing was replaced), identical markup before and after, the
// control then works and a real form submit equals a bare input. Indeterminate is the special case: it has
// no attribute, so the server markup carries `data-state="indeterminate"` only (CSS paints the dash), AT sees
// no mixed state before hydration, and the property is set when the adapter hydrates; the AX tree then
// reports `mixed`. Vanilla has no server render (ADR-002: the adapter builds DOM on the client); its
// pre-existing-markup path is the `<sj-checkbox>` upgrade test.
import { test, expect, type Page } from '@playwright/test';
import { FIXTURES, FORM_FIXTURES, LABEL, type Adapter } from './fixtures';

const slug = (s: string) => s.replace(/\s+/g, '-');
const HYDRATING = ['react', 'vue'] as const;
const CASES = [
  ...Object.keys(FIXTURES),
  'on named',
  'off custom value',
  'disabled on',
  'mixed unchecked',
  'mixed checked',
  'mixed disabled',
] as const;
const propsOf = (name: string) => ({ ...FIXTURES, ...FORM_FIXTURES })[name]!;
const INPUT = 'input[type=checkbox]';

async function load(page: Page, adapter: Adapter, name: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`/hydrate/${adapter}/${slug(name)}.html`);
  await page.waitForFunction(() => window.__hyCb?.ready === true);
  return messages;
}

const hydrate = async (page: Page, adapter: Adapter, name: string) => {
  await page.evaluate(([a, p]) => window.__hyCb.hydrate(a as 'react', p as never, 'hy-'), [
    adapter,
    propsOf(name),
  ] as const);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 120)));
};

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
      expect(before.count, 'the server rendered the checkbox').toBeGreaterThan(2);
      await hydrate(page, adapter, name);
      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          html: document.getElementById('root')!.innerHTML,
          kept: pre.every((n) => n.isConnected),
          recoverable: window.__hyCb.recoverable,
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
    await hydrate(page, adapter, 'on custom value');
    const control = page.locator(INPUT);
    expect(await control.getAttribute('data-state')).toBe('checked');
    await control.click();
    expect(await control.getAttribute('data-state')).toBe('unchecked');
    // reset restores the SERVER default (the attribute rendered into the markup), and the model follows.
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    expect(await control.isChecked()).toBe(true);
    expect(await control.getAttribute('data-state')).toBe('checked');
    await Promise.all([
      page.waitForURL(/\/echo/),
      page.evaluate(() => (document.getElementById('f') as HTMLFormElement).requestSubmit()),
    ]);
    expect(new URL(page.url()).search).toBe('?terms=yes');
    expect(messages).toEqual([]);
  });

  // ---- indeterminate: SSR cannot render the property -------------------------------------------------
  test(`hydration | ${adapter} | indeterminate: SSR markup has data-state and no attribute; the property is set at hydration`, async ({
    page,
  }) => {
    const messages = await load(page, adapter, 'indeterminate');
    const html = await page.evaluate(() => document.getElementById('root')!.innerHTML);
    expect(html).toContain('data-state="indeterminate"');
    expect(html).not.toMatch(/\bindeterminate(?!")(?=[\s=>])/); // no `indeterminate` attribute
    expect(html).not.toContain('aria-checked');
    expect(html).not.toContain('role=');
    const input = page.locator(INPUT);
    expect(await input.getAttribute('indeterminate')).toBeNull();
    expect(await input.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(false);
    // Before hydration the browser exposes a plain unchecked checkbox, NOT mixed: this is the SSR gap.
    await expect(page.locator('#root')).toMatchAriaSnapshot(`- checkbox "${LABEL}"`);
    await expect(page.locator('#root')).not.toMatchAriaSnapshot(
      `- checkbox "${LABEL}" [checked=mixed]`,
      { timeout: 500 },
    );
    await hydrate(page, adapter, 'indeterminate');
    expect(await input.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
    expect(await input.getAttribute('indeterminate'), 'still no attribute').toBeNull();
    await expect(page.locator('#root')).toMatchAriaSnapshot(
      `- checkbox "${LABEL}" [checked=mixed]`,
    );
    expect(messages).toEqual([]);
  });

  test(`hydration | ${adapter} | indeterminate: the AX tree reports mixed after hydration (CDP, Chromium)`, async ({
    page,
    browserName,
  }) => {
    // #49 owner: SrRamos
    test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
    await load(page, adapter, 'indeterminate');
    const mixed = async () => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Accessibility.enable');
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
        nodes: {
          ignored?: boolean;
          role?: { value?: unknown };
          properties?: { name: string; value: { value?: unknown } }[];
        }[];
      };
      const box = nodes.filter((n) => !n.ignored && n.role?.value === 'checkbox');
      expect(box).toHaveLength(1);
      return box[0]!.properties?.find((p) => p.name === 'checked')?.value.value;
    };
    expect(await mixed(), 'server markup alone is not mixed').toBe('false');
    await hydrate(page, adapter, 'indeterminate');
    expect(await mixed(), 'mixed after hydration').toBe('mixed');
  });

  test(`hydration | ${adapter} | indeterminate: click clears it, reset restores checked and leaves it alone, submit equals a bare input`, async ({
    page,
  }) => {
    const messages = await load(page, adapter, 'mixed checked');
    await hydrate(page, adapter, 'mixed checked');
    const control = page.locator(INPUT);
    const read = () =>
      control.evaluate((el: HTMLInputElement) => ({
        checked: el.checked,
        indeterminate: el.indeterminate,
        state: el.getAttribute('data-state'),
      }));
    expect(await read()).toEqual({ checked: true, indeterminate: true, state: 'indeterminate' });
    await control.click();
    expect(await read()).toEqual({ checked: false, indeterminate: false, state: 'unchecked' });
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    expect(await read()).toEqual({ checked: true, indeterminate: false, state: 'checked' });
    await Promise.all([
      page.waitForURL(/\/echo/),
      page.evaluate(() => (document.getElementById('f') as HTMLFormElement).requestSubmit()),
    ]);
    expect(new URL(page.url()).search).toBe('?terms=yes');
    expect(messages).toEqual([]);
  });
}

test('hydration | server markup carries one id and no live-region noise', async ({ page }) => {
  for (const adapter of HYDRATING) {
    await load(page, adapter, 'unchecked');
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('#root [id]')].map((e) => e.id),
    );
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBeTruthy();
    expect(await page.locator('#root script, #root style').count()).toBe(0);
  }
});

test('vanilla | markup that exists before define() is upgraded in place, indeterminate as a property', async ({
  page,
}) => {
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  await page.evaluate((label) => {
    document.getElementById('root')!.innerHTML =
      `<form id="f"><sj-checkbox name="terms" value="yes" checked indeterminate label="${label}"></sj-checkbox></form>`;
  }, LABEL);
  expect(await page.locator('#f input').count()).toBe(0); // not upgraded yet: inert markup
  await page.evaluate(() => window.__cb.mountElement({ name: 'x' })); // defines the element on first use
  await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  const input = page.locator('sj-checkbox').first().locator(INPUT);
  await expect(input).toBeChecked();
  expect(await input.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
  expect(await input.getAttribute('indeterminate')).toBeNull();
  await expect(page.locator('sj-checkbox').first()).toMatchAriaSnapshot(
    `- checkbox "${LABEL}" [checked=mixed]`,
  );
});
