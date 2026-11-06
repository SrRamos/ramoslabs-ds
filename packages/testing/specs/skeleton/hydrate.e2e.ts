// Real hydration for SJSkeleton (ADR-003, ADR-006, ADR-013 PR gate): the server renders the markup in node (no DOM,
// a server runtime whose scheduler never fires), the browser parses it BEFORE any script runs, then React / Vue
// hydrate it in a development build (the only build that reports mismatches). Asserts: no mismatch or recoverable
// error, the SAME DOM nodes survive and the markup is identical right after hydration, the server HTML of a loading
// group is `pending` + aria-busy and has NO live markup (no role=status/alert, no aria-live, no live node in
// the document before hydration, nothing spoken), and after hydration the group becomes visible once the delay has
// passed and announces exactly once. Vanilla has no server render (ADR-002): it adopts the root another renderer made.
import { test, expect, type Page } from '@playwright/test';
import { EXPECTED_ANNOUNCEMENT, FIXTURES, type FixtureProps } from './fixtures';

const HYDRATING = ['react', 'vue'] as const;
/** The client uses a short delay so the test is fast; the server markup does not depend on it. */
const clientProps = (name: string): FixtureProps => ({
  ...FIXTURES[name]!,
  ...(FIXTURES[name]!.shape === 'group' && FIXTURES[name]!.loading !== false
    ? { delay: 60, minDuration: 5000 }
    : {}),
});

async function load(page: Page, adapter: string, fixture: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  const response = await page.goto(`/hydrate/${adapter}/${fixture}.html`);
  const html = (await response!.text()).replace(/<script[\s\S]*?<\/script>/g, '');
  await page.waitForFunction(() => window.__skeletonHy?.ready === true);
  return { messages, html };
}

/** Live markup in server HTML: any role status/alert, any aria-live / aria-atomic. */
const LIVE_MARKUP = /\brole="(?:status|alert)"|\baria-live=|\baria-atomic=/;

const liveNodes = (page: Page) =>
  page.evaluate(
    () => document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length,
  );

const isLoadingGroup = (name: string) =>
  FIXTURES[name]!.shape === 'group' && FIXTURES[name]!.loading !== false;

for (const adapter of HYDRATING) {
  for (const name of Object.keys(FIXTURES)) {
    test(`hydration | ${adapter} | ${name} | server markup is adopted, not replaced; announced once after the delay, never before`, async ({
      page,
    }) => {
      const { messages, html } = await load(page, adapter, name);
      expect(html).not.toMatch(LIVE_MARKUP);
      if (isLoadingGroup(name)) {
        // The server render of a loading group: pending (laid out, not shown) and busy, no timer has run.
        expect(html).toMatch(/data-state="pending"/);
        expect(html).toMatch(/aria-busy="true"/);
      } else {
        expect(html).not.toMatch(/aria-busy/);
      }
      expect(await liveNodes(page)).toBe(0);
      expect(await page.evaluate(() => window.__skeletonHy.spoken)).toEqual([]);
      // Nothing happens to a server-rendered loading group with no script running: it stays pending.
      if (isLoadingGroup(name)) {
        await page.waitForTimeout(150);
        expect(await page.locator('#root [data-shape="group"]').getAttribute('data-state')).toBe(
          'pending',
        );
      }
      const before = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#root *')];
        (window as unknown as { __pre: Element[] }).__pre = nodes;
        return { html: document.getElementById('root')!.innerHTML, count: nodes.length };
      });
      expect(before.count, 'the server rendered the component').toBeGreaterThan(0);

      // Hydrate and read the markup in the same task: no timer can have fired yet.
      const right = await page.evaluate(
        ([a, p]) => {
          window.__skeletonHy.hydrate(a as 'react', p as never);
          return document.getElementById('root')!.innerHTML;
        },
        [adapter, clientProps(name)] as const,
      );
      expect(right).toBe(before.html);
      expect(await page.evaluate(() => window.__skeletonHy.spoken)).toEqual([]);

      if (isLoadingGroup(name)) {
        // Then the client timers take over: shown after the delay, announced once.
        await page.waitForFunction(
          () =>
            document.querySelector('#root [data-shape="group"]')?.getAttribute('data-state') ===
            'visible',
        );
        await expect
          .poll(() => page.evaluate(() => window.__skeletonHy.spoken))
          .toEqual([EXPECTED_ANNOUNCEMENT[name]]);
        await page.waitForTimeout(250);
      } else {
        await page.waitForTimeout(250);
      }
      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          kept: pre.every((n) => n.isConnected),
          roots: document.querySelectorAll('#root > [data-part="root"]').length,
          recoverable: window.__skeletonHy.recoverable,
          spoken: window.__skeletonHy.spoken,
          liveInsideRoot: document.querySelectorAll(
            '#root [aria-live], #root [role="status"], #root [role="alert"]',
          ).length,
          html: document.getElementById('root')!.innerHTML,
        };
      });
      expect(after.kept, 'every server node is still in the document').toBe(true);
      expect(after.roots).toBe(1);
      expect(after.recoverable).toEqual([]);
      expect(after.liveInsideRoot).toBe(0);
      const expected = EXPECTED_ANNOUNCEMENT[name] ?? null;
      expect(after.spoken).toEqual(expected ? [expected] : []);
      if (!isLoadingGroup(name)) expect(after.html).toBe(before.html);
      else expect(after.html).toContain('data-state="visible"');
      expect(messages).toEqual([]);
    });
  }
}

// Vanilla adopts the markup React rendered on the server: the root element survives, the children converge on the
// same set (the adapter owns its children), the group is shown after the delay and announced once.
for (const name of Object.keys(FIXTURES)) {
  test(`hydration | vanilla | ${name} | adopts the server-rendered root in place; announced once after the delay`, async ({
    page,
  }) => {
    const { messages, html } = await load(page, 'react', name);
    expect(html).not.toMatch(LIVE_MARKUP);
    const sig = (root: Element) =>
      [...root.querySelectorAll('*')].map((c) => `${c.localName}.${c.getAttribute('class')}`);
    const before = await page.evaluate(() => {
      const root = document.querySelector('#root > [data-part="root"]')!;
      (window as unknown as { __root: Element }).__root = root;
      return [...root.querySelectorAll('*')].map(
        (c) => `${c.localName}.${c.getAttribute('class')}`,
      );
    });
    await page.evaluate((p) => window.__skeletonHy.adoptVanilla(p as never), clientProps(name));
    if (isLoadingGroup(name)) {
      await page.waitForFunction(
        () =>
          document.querySelector('#root [data-shape="group"]')?.getAttribute('data-state') ===
          'visible',
      );
      await expect
        .poll(() => page.evaluate(() => window.__skeletonHy.spoken))
        .toEqual([EXPECTED_ANNOUNCEMENT[name]]);
    }
    await page.waitForTimeout(250);
    const after = await page.evaluate((fn) => {
      const root = document.querySelector('#root > [data-part="root"]')!;
      return {
        same: root === (window as unknown as { __root: Element }).__root,
        sig: (new Function(`return ${fn}`)() as (r: Element) => string[])(root),
        spoken: window.__skeletonHy.spoken,
      };
    }, sig.toString());
    expect(after.same, 'the root element is the server one').toBe(true);
    expect(after.sig).toEqual(before);
    const expected = EXPECTED_ANNOUNCEMENT[name] ?? null;
    expect(after.spoken).toEqual(expected ? [expected] : []);
    expect(messages).toEqual([]);
  });
}

// React under StrictMode in a development build simulates an unmount/remount of the effects: the announcement must
// still be spoken once after hydration.
test('hydration | react StrictMode (development build) | group-loading | still spoken exactly once', async ({
  page,
}) => {
  const { messages } = await load(page, 'react', 'group-loading');
  await page.evaluate(
    (p) => window.__skeletonHy.hydrate('react', p as never, { strict: true }),
    clientProps('group-loading'),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('#root [data-shape="group"]')?.getAttribute('data-state') ===
      'visible',
  );
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__skeletonHy.spoken)).toEqual([
    { role: 'status', text: 'Loading activity' },
  ]);
  expect(await page.evaluate(() => window.__skeletonHy.recoverable)).toEqual([]);
  expect(messages).toEqual([]);
});
