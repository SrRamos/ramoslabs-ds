// Real hydration for SJButton (W1-C01.f, ADR-003, ADR-013 PR gate): the server renders the markup in node (no DOM),
// the browser parses it BEFORE any script runs, then React / Vue hydrate it in a development build (the only build
// that reports mismatches). Asserts: no mismatch or recoverable error, the SAME DOM nodes survive hydration
// (nothing was replaced), identical markup before and after, and a real click reaches `press` exactly once
// (never for the disabled fixture). Vanilla has no server render (ADR-002); its client DOM is compared with the
// server markup of the other two in ssr.test.ts.
import { test, expect, type Page } from '@playwright/test';
import { FIXTURES, INERT } from './fixtures';

const HYDRATING = ['react', 'vue'] as const;

async function load(page: Page, adapter: string, fixture: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`/hydrate/${adapter}/${fixture}.html`);
  await page.waitForFunction(() => window.__btnHy?.ready === true);
  return messages;
}

for (const adapter of HYDRATING) {
  for (const name of Object.keys(FIXTURES)) {
    const inert = INERT.includes(name);
    test(`hydration | ${adapter} | ${name} | server markup is adopted, not replaced`, async ({
      page,
    }) => {
      const messages = await load(page, adapter, name);
      const before = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#root *')];
        (window as unknown as { __pre: Element[] }).__pre = nodes;
        return { html: document.getElementById('root')!.innerHTML, count: nodes.length };
      });
      expect(before.count, 'the server rendered the button').toBeGreaterThan(0);
      await page.evaluate(([a, p]) => window.__btnHy.hydrate(a as 'react', p as never), [
        adapter,
        FIXTURES[name]!,
      ] as const);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 120)));
      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          html: document.getElementById('root')!.innerHTML,
          kept: pre.every((n) => n.isConnected),
          recoverable: window.__btnHy.recoverable,
        };
      });
      expect(after.kept, 'every server node is still in the document').toBe(true);
      expect(after.html).toBe(before.html);
      expect(after.recoverable).toEqual([]);

      // A real click after hydration reaches `press` once (a disabled button swallows it).
      const control = page.locator('#root > :is(button, a)');
      if (name === 'link')
        await page.evaluate(() => history.replaceState(null, '', location.pathname));
      await control.click({ force: inert });
      await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
      expect(await page.evaluate(() => window.__btnHy.presses)).toBe(inert ? 0 : 1);
      expect(messages).toEqual([]);
    });
  }
}
