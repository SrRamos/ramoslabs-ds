// Real hydration for SJDisclosure (W1-C06.f, ADR-003 SSR-safe ids, ADR-008 native-first, ADR-013 PR gate; audit
// SHOULD-1): the server renders the markup in node (no DOM), the browser parses it BEFORE any script runs, the
// test then toggles the `<details>` natively (it works without script), and only then React / Vue hydrate it
// in a development build (the only build that reports mismatches) and the vanilla adapter adopts it. Asserts
// per case: the markup was really toggled before hydration, the adapter reports exactly what the user did
// (once, through `openChange`), the final state (an uncontrolled member keeps the user's choice, a controlled
// owner that rejects gets the element put back), the SAME DOM nodes survive, no mismatch is logged and the
// control works afterwards. Cases: uncontrolled `defaultOpen`, controlled `open` (both ways), no prop, and no
// toggle at all (no spurious report).
import { test, expect, type Page } from '@playwright/test';
import { HYDRATE_CASES, SUMMARY, type Adapter } from './fixtures';
import { ROOT, TRIGGER } from './open';

const slug = (s: string) => s.replace(/\s+/g, '-');
const ADAPTERS_HY = ['react', 'vue', 'vanilla'] as const;
const propsOf = (name: string) => HYDRATE_CASES[name]!.props;
const settle = (page: Page, ms = 120) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

async function load(page: Page, adapter: Adapter, name: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`/hydrate/${adapter}/${slug(name)}.html`);
  await page.waitForFunction(() => window.__hyDc?.ready === true);
  return messages;
}

const hydrate = async (page: Page, adapter: Adapter, name: string) => {
  await page.evaluate(([a, p]) => window.__hyDc.hydrate(a as 'react', p as never, 'hy-'), [
    adapter,
    propsOf(name),
  ] as const);
  await settle(page);
};

const isOpen = (page: Page) => page.locator(ROOT).evaluate((d: HTMLDetailsElement) => d.open);

for (const adapter of ADAPTERS_HY) {
  for (const [name, c] of Object.entries(HYDRATE_CASES)) {
    test(`hydration | ${adapter} | ${name} | pre-hydration toggle is reported once and the final state is right`, async ({
      page,
    }) => {
      const messages = await load(page, adapter, name);
      // No script has attached anything yet: the markup is plain server HTML.
      expect(await isOpen(page), 'server markup state').toBe(c.serverOpen);
      expect(await page.locator(TRIGGER).getAttribute('aria-expanded')).toBeNull();
      if (c.toggled) {
        await page.locator(TRIGGER).click(); // native toggle, no JavaScript involved
        expect(await isOpen(page), 'the native toggle worked before hydration').toBe(!c.serverOpen);
        // Let the browser's own `toggle` event fire before any listener exists (see the notes: one that is
        // still queued when the adapter attaches is delivered to it as a second report).
        await settle(page, 100);
      }
      const before = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#root *')];
        (window as unknown as { __pre: Element[] }).__pre = nodes;
        return nodes.length;
      });
      expect(before, 'the server rendered the disclosure').toBeGreaterThanOrEqual(3);
      expect(await page.evaluate(() => window.__hyDc.events)).toEqual([]); // nothing reported yet
      await hydrate(page, adapter, name);
      // The pre-hydration report: exactly what the user did, once.
      expect(await page.evaluate(() => window.__hyDc.events)).toEqual(
        (adapter === 'vanilla' ? (c.vanillaReport ?? c.report) : c.report).map((o) => `open:${o}`),
      );
      expect(await isOpen(page), 'final state').toBe(c.final);
      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          kept: pre.every((n) => n.isConnected),
          state: document.querySelector('[data-part="root"]')!.getAttribute('data-state'),
          visible: (
            document.querySelector('[data-part="content"]') as HTMLElement
          ).checkVisibility(),
          recoverable: window.__hyDc.recoverable,
        };
      });
      expect(after.kept, 'every server node is still in the document').toBe(true);
      expect(after.state).toBe(c.final ? 'open' : 'closed');
      expect(after.visible, 'panel visibility follows the final state').toBe(c.final);
      expect(after.recoverable).toEqual([]);
      expect(messages).toEqual([]);
    });
  }

  test(`hydration | ${adapter} | an uncontrolled disclosure works after hydration`, async ({
    page,
  }) => {
    const name = 'no prop opened before hydration';
    const messages = await load(page, adapter, name);
    await hydrate(page, adapter, name);
    expect(await isOpen(page)).toBe(false);
    await page.locator(TRIGGER).click();
    await settle(page, 60);
    expect(await isOpen(page)).toBe(true);
    await page.locator(TRIGGER).focus();
    await page.keyboard.press('Enter');
    await settle(page, 60);
    expect(await isOpen(page)).toBe(false);
    expect(await page.evaluate(() => window.__hyDc.events)).toEqual(['open:true', 'open:false']);
    expect(await page.locator(TRIGGER).textContent()).toBe(SUMMARY);
    expect(messages).toEqual([]);
  });

  test(`hydration | ${adapter} | a controlled owner that rejects keeps rejecting after hydration`, async ({
    page,
  }) => {
    const name = 'controlled open rejects a pre-hydration close';
    const messages = await load(page, adapter, name);
    await page.locator(TRIGGER).click();
    await settle(page, 100);
    await hydrate(page, adapter, name);
    expect(await isOpen(page)).toBe(true);
    await page.locator(TRIGGER).click();
    await settle(page, 60);
    expect(await isOpen(page), 'still the owner`s value').toBe(true);
    expect(await page.evaluate(() => window.__hyDc.events)).toEqual(['open:false', 'open:false']);
    expect(messages).toEqual([]);
  });
}

test('hydration | server markup carries one panel-less id set and no live-region noise', async ({
  page,
}) => {
  for (const adapter of ['react', 'vue'] as const) {
    await load(page, adapter, 'no prop opened before hydration');
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('#root [id]')].map((e) => e.id),
    );
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(await page.locator('#root script, #root style').count()).toBe(0);
    const html = await page.evaluate(() => document.getElementById('root')!.innerHTML);
    for (const forbidden of ['aria-expanded', 'aria-controls', 'role='])
      expect(html).not.toContain(forbidden);
  }
});

test('vanilla | markup that exists before define() is upgraded in place', async ({ page }) => {
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  await page.evaluate(() => {
    document.getElementById('root')!.innerHTML =
      '<sj-disclosure name="faq" open summary="Shipping details">Orders ship soon.</sj-disclosure>';
  });
  expect(await page.locator('sj-disclosure details').count()).toBe(0); // not upgraded yet: inert markup
  await page.evaluate(() => window.__dc.mountElement({ summary: 'x' })); // defines the element on first use
  await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  const first = page.locator('sj-disclosure').first();
  expect(await first.locator('details').evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);
  await expect(first.locator('summary')).toHaveText('Shipping details');
  await expect(first.locator('[data-part="content"]')).toHaveText('Orders ship soon.');
});
