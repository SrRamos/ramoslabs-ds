// Real hydration for SJField, SJInput and SJForm (W1-C02.f, ADR-003 SSR-safe ids, ADR-006 no live markup on the
// server, ADR-013 PR gate): the server renders the markup in node (no DOM), the browser parses it BEFORE any script
// runs, then React / Vue hydrate it in a development build (the only build that reports mismatches). Asserts: no
// mismatch or recoverable error, the SAME DOM nodes survive (nothing replaced), the IDREFs of the server markup
// resolve and are the ones the client keeps, the data-first Enter position is in the server markup, and the
// hydrated controls then behave (typing, `:user-invalid` fallback state, reset, a real submit). Vanilla has no
// server render (ADR-002: the adapter builds DOM on the client); its pre-existing-markup path is the `<sj-form>`
// upgrade test below.
import { test, expect, type Page } from '@playwright/test';
import { HYDRATION_FIXTURES, type Adapter } from './fixtures';

const HYDRATING = ['react', 'vue'] as const;
const CASES = Object.keys(HYDRATION_FIXTURES);

async function load(page: Page, adapter: Adapter, name: string) {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`/hydrate/${adapter}/${name}.html`);
  await page.waitForFunction(() => window.__hyFld?.ready === true);
  return messages;
}

const hydrate = async (page: Page, adapter: Adapter, name: string) => {
  await page.evaluate(([a, s]) => window.__hyFld.hydrate(a as 'react', s as never, 'hy-'), [
    adapter,
    HYDRATION_FIXTURES[name]!,
  ] as const);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 150)));
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
      expect(before.count, 'the server rendered the fixture').toBeGreaterThan(3);
      // ADR-006: no live markup in the server render, error or not.
      expect(before.html).not.toMatch(/role="(status|alert)"|aria-live/);
      await hydrate(page, adapter, name);
      const after = await page.evaluate(() => {
        const pre = (window as unknown as { __pre: Element[] }).__pre;
        return {
          html: document.getElementById('root')!.innerHTML,
          kept: pre.every((n) => n.isConnected),
          recoverable: window.__hyFld.recoverable,
        };
      });
      expect(after.kept, 'every server node is still in the document').toBe(true);
      expect(after.recoverable).toEqual([]);
      expect(messages).toEqual([]);
      if (name === 'form-valued') {
        // No data-first list: the Enter position is a client-side effect, so only that attribute is added.
        expect(after.html.replace(/ enterkeyhint="\w+"/g, '')).toBe(before.html);
        expect(await page.locator('#f [name="name"]').getAttribute('enterkeyhint')).toBe('next');
        expect(await page.locator('#f [name="email"]').getAttribute('enterkeyhint')).toBe('go');
      } else expect(after.html).toBe(before.html);
    });

    test(`hydration | ${adapter} | ${name} | ids resolve in the server markup and survive hydration`, async ({
      page,
    }) => {
      await load(page, adapter, name);
      const graph = () =>
        page.evaluate(() => {
          const ids = [...document.querySelectorAll('#root [id]')].map((e) => e.id);
          const refs = [
            ...document.querySelectorAll('#root [for], #root [aria-describedby]'),
          ].flatMap((e) =>
            [
              e.getAttribute('for'),
              ...(e.getAttribute('aria-describedby') ?? '').split(' '),
            ].filter((x): x is string => !!x),
          );
          return { ids, dangling: refs.filter((r) => !document.getElementById(r)), refs };
        });
      const server = await graph();
      expect(new Set(server.ids).size, 'ids are unique').toBe(server.ids.length);
      expect(server.dangling).toEqual([]);
      expect(server.refs.length).toBeGreaterThan(0);
      await hydrate(page, adapter, name);
      const client = await graph();
      expect(client.ids).toEqual(server.ids);
      expect(client.refs).toEqual(server.refs);
    });
  }

  test(`hydration | ${adapter} | the data-first Enter position is in the server markup`, async ({
    page,
  }) => {
    await load(page, adapter, 'form-data-first');
    const hints = await page.evaluate(() =>
      [...document.querySelectorAll('#f input, #f textarea')].map((e) => [
        (e as HTMLInputElement).name,
        e.getAttribute('enterkeyhint'),
      ]),
    );
    expect(hints).toEqual([
      ['name', 'next'],
      ['email', 'go'],
      ['street', 'enter'],
    ]);
    expect(await page.locator('#f').getAttribute('action')).toBe('/echo');
    expect(await page.locator('#f').getAttribute('method')).toBe('get');
  });

  test(`hydration | ${adapter} | the server render of a field with an error: words, hidden icon, derived ARIA`, async ({
    page,
  }) => {
    await load(page, adapter, 'field-hint-error');
    const dom = await page.evaluate(() => {
      const c = document.querySelector('#root [name="email"]') as HTMLInputElement;
      const err = document.querySelector('#root .sj-field__error')!;
      return {
        invalid: c.getAttribute('aria-invalid'),
        required: c.hasAttribute('required'),
        describedby: c.getAttribute('aria-describedby'),
        errorId: err.id,
        iconHidden: err.querySelector('[data-part="icon"]')?.getAttribute('aria-hidden'),
        svgHidden: err.querySelector('svg')?.getAttribute('aria-hidden'),
        text: err.textContent,
      };
    });
    expect(dom.invalid).toBe('true');
    expect(dom.required).toBe(true);
    expect(dom.describedby?.split(' ')).toHaveLength(2);
    expect(dom.describedby?.endsWith(dom.errorId)).toBe(true);
    expect(dom.iconHidden).toBe('true');
    expect(dom.svgHidden).toBe('true');
    expect(dom.text).toBe('Enter an email address like name@example.com');
  });

  test(`hydration | ${adapter} | hydrated controls behave: touched fallback, reset to the server value, real submit`, async ({
    page,
  }) => {
    const messages = await load(page, adapter, 'form-valued');
    await hydrate(page, adapter, 'form-valued');
    const email = page.locator('#f [name="email"]');
    expect(await email.inputValue()).toBe('ada@example.com');
    await email.fill('nope');
    await page.keyboard.press('Tab');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    await email.fill('grace@example.com');
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    // reset restores the SERVER default (the attribute rendered into the markup).
    expect(await email.inputValue()).toBe('ada@example.com');
    expect(await page.locator('#f [name="name"]').inputValue()).toBe('Ada Lovelace');
    await Promise.all([
      page.waitForURL(/\/echo/),
      page.evaluate(() => (document.getElementById('f') as HTMLFormElement).requestSubmit()),
    ]);
    expect(new URL(page.url()).search).toBe('?name=Ada+Lovelace&email=ada%40example.com');
    expect(messages).toEqual([]);
  });
}

test('vanilla | <sj-form> markup that exists before define() is upgraded in place: enter, action and Enter hints', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  await page.evaluate(() => {
    document.getElementById('root')!.innerHTML =
      `<sj-form action="/echo" method="get" enter="search">` +
      `<sj-field name="name" label="Name"><sj-input kind="name"></sj-input></sj-field>` +
      `<sj-field name="q" label="Search"><sj-input kind="text"></sj-input></sj-field>` +
      `<button type="submit" id="go">Go</button></sj-form>`;
  });
  expect(await page.locator('sj-form form').count(), 'inert markup before define()').toBe(0);
  await page.evaluate(() => window.__fl.defineElements());
  const form = page.locator('sj-form > form');
  expect(await form.count()).toBe(1);
  expect(await form.getAttribute('action')).toBe('/echo');
  expect(await form.getAttribute('method')).toBe('get');
  expect(await form.getAttribute('enter')).toBeNull();
  const hints = await page.evaluate(() =>
    [...document.querySelectorAll('sj-form input')].map((e) => e.getAttribute('enterkeyhint')),
  );
  expect(hints).toEqual(['next', 'search']);
  expect(await page.locator('sj-form input').count()).toBe(2);
  // The controls are real form members: a real submit carries them.
  await page.locator('sj-form input').nth(0).fill('Ada');
  await page.locator('sj-form input').nth(1).fill('lace');
  await Promise.all([page.waitForURL(/\/echo/), page.locator('#go').click()]);
  expect(new URL(page.url()).search).toBe('?name=Ada&q=lace');
  expect(errors).toEqual([]);
});
