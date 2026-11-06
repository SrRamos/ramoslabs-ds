// Real hydration for SJState (W1-C11.f, ADR-003, ADR-006, ADR-013 PR gate): the server renders the markup in node
// (no DOM), the browser parses it BEFORE any script runs, then React / Vue hydrate it in a development build (the
// only build that reports mismatches). Asserts: no mismatch or recoverable error, the SAME DOM nodes survive
// hydration and identical markup before and after, NO live markup in the server HTML (no role=status/alert, no
// aria-live, no live node in the document before hydration), and the announcement (if the fixture has one) is
// spoken exactly once AFTER hydration, never by the server markup. Vanilla has no server render (ADR-002); it
// adopts markup another renderer made: the vanilla adapter is mounted onto the server-rendered root and must
// leave the root node in place, converge on the same part set and speak once.
import { test, expect, type Page } from '@playwright/test';
import { EXPECTED_ANNOUNCEMENT, FIXTURES } from './fixtures';

const HYDRATING = ['react', 'vue'] as const;

async function load(page: Page, adapter: string, fixture: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  const response = await page.goto(`/hydrate/${adapter}/${fixture}.html`);
  const html = (await response!.text()).replace(/<script[\s\S]*?<\/script>/g, '');
  await page.waitForFunction(() => window.__stateHy?.ready === true);
  return { messages, html };
}

/** Live markup in server HTML: any role status/alert, any aria-live / aria-atomic. */
const LIVE_MARKUP = /\brole="(?:status|alert)"|\baria-live=|\baria-atomic=/;

const liveNodes = (page: Page) =>
  page.evaluate(
    () => document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length,
  );

for (const adapter of HYDRATING) {
  for (const name of Object.keys(FIXTURES)) {
    test(`hydration | ${adapter} | ${name} | server markup is adopted, not replaced; announced once after hydration, never before`, async ({
      page,
    }) => {
      const { messages, html } = await load(page, adapter, name);
      // The server HTML has no live markup, and the document has no live node and has spoken nothing yet.
      expect(html).not.toMatch(LIVE_MARKUP);
      expect(await liveNodes(page)).toBe(0);
      expect(await page.evaluate(() => window.__stateHy.spoken)).toEqual([]);
      const before = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#root *')];
        (window as unknown as { __pre: Element[] }).__pre = nodes;
        return { html: document.getElementById('root')!.innerHTML, count: nodes.length };
      });
      expect(before.count, 'the server rendered the state').toBeGreaterThan(0);

      await page.evaluate(([a, p]) => window.__stateHy.hydrate(a as 'react', p as never), [
        adapter,
        FIXTURES[name]!,
      ] as const);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 250)));

      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          html: document.getElementById('root')!.innerHTML,
          kept: pre.every((n) => n.isConnected),
          roots: document.querySelectorAll('#root > [data-part="root"]').length,
          recoverable: window.__stateHy.recoverable,
          spoken: window.__stateHy.spoken,
          liveInsideRoot: document.querySelectorAll(
            '#root [aria-live], #root [role="status"], #root [role="alert"]',
          ).length,
        };
      });
      expect(after.kept, 'every server node is still in the document').toBe(true);
      expect(after.roots).toBe(1);
      expect(after.html).toBe(before.html);
      expect(after.recoverable).toEqual([]);
      expect(after.liveInsideRoot).toBe(0);
      const expected = EXPECTED_ANNOUNCEMENT[name] ?? null;
      expect(after.spoken).toEqual(expected ? [expected] : []);
      expect(messages).toEqual([]);
    });
  }
}

// Vanilla adopts the markup React rendered on the server: the root element survives, the parts converge on the same
// set (the adapter owns its children), and the announcement is spoken once. The SSR page is React's.
for (const name of Object.keys(FIXTURES)) {
  test(`hydration | vanilla | ${name} | adopts the server-rendered root in place; announced once after mount`, async ({
    page,
  }) => {
    const { messages, html } = await load(page, 'react', name);
    expect(html).not.toMatch(LIVE_MARKUP);
    const before = await page.evaluate(() => {
      const root = document.querySelector('#root > [data-part="root"]')!;
      (window as unknown as { __root: Element }).__root = root;
      return [...root.children].map((c) => `${c.localName}:${c.getAttribute('data-part')}`);
    });
    await page.evaluate((p) => window.__stateHy.adoptVanilla(p as never), FIXTURES[name]!);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 250)));
    const after = await page.evaluate(() => {
      const root = document.querySelector('#root > [data-part="root"]')!;
      return {
        same: root === (window as unknown as { __root: Element }).__root,
        parts: [...root.children].map((c) => `${c.localName}:${c.getAttribute('data-part')}`),
        spoken: window.__stateHy.spoken,
      };
    });
    expect(after.same, 'the root element is the server one').toBe(true);
    expect(after.parts).toEqual(before);
    const expected = EXPECTED_ANNOUNCEMENT[name] ?? null;
    expect(after.spoken).toEqual(expected ? [expected] : []);
    expect(messages).toEqual([]);
  });
}

// React under StrictMode in a development build simulates an unmount/remount of the effects: the announcement must
// still be spoken once after hydration.
test('hydration | react StrictMode (development build) | loading | still spoken exactly once', async ({
  page,
}) => {
  const { messages } = await load(page, 'react', 'loading');
  await page.evaluate(
    (p) => window.__stateHy.hydrate('react', p as never, { strict: true }),
    FIXTURES['loading']!,
  );
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  expect(await page.evaluate(() => window.__stateHy.spoken)).toEqual([
    { role: 'status', text: 'Loading projects' },
  ]);
  expect(await page.evaluate(() => window.__stateHy.recoverable)).toEqual([]);
  expect(messages).toEqual([]);
});
