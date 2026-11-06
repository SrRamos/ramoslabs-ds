// ARIA layer for SJDisclosure (W1-C06.f, ADR-013 L2): one shared YAML snapshot per contract fixture, used by
// every adapter on every engine, plus the browser's own computed tree through CDP on Chromium. Playwright
// derives the tree from accessibility semantics, so an adapter that diverges in role, name or content fails
// against the same file; markup noise does not. The snapshot shows the panel text only while open (a closed
// `<details>` does not expose it), which is how the state reaches this layer on every engine; the exposed
// `expanded` itself is asserted through CDP on Chromium (the registry decision: native `<summary>`, no
// `aria-expanded`). Seeded regressions prove each check can fail.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, FIXTURES, LONG_SUMMARY, SUMMARY, type Adapter } from './fixtures';
import { ROOT, TRIGGER, openHost } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (state: string) =>
  readFileSync(join(here, 'aria', `${state}.yml`), 'utf8').replace('$LONG_SUMMARY', LONG_SUMMARY);
/** One file per contract fixture. Focus has no ARIA state; the tree must not change with it. */
const STATES = ['closed', 'open', 'disabled', 'long-title', 'exclusive-group'] as const;
const STAGE = '#stage';

async function mount(page: Page, adapter: Adapter, fixture: string): Promise<void> {
  await page.evaluate(
    ([a, p]) => window.__sj.mount(a as 'react', p as never).then(() => undefined),
    [adapter, FIXTURES[fixture]!] as const,
  );
  await page.locator(ROOT).first().waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 40)));
}
const settle = (page: Page) => page.evaluate(() => new Promise((r) => setTimeout(r, 60)));

/** Attributes the native `<details>` model must not carry: the browser exposes the state itself. */
const FORBIDDEN = ['aria-expanded', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'role'];
const attrsOf = (page: Page) =>
  page.evaluate(
    ([root, trigger]) => ({
      root: (document.querySelector(root!) as Element).getAttributeNames(),
      trigger: (document.querySelector(trigger!) as Element).getAttributeNames(),
      content: (
        (document.querySelector(root!) as Element).querySelector('[data-part="content"]') as Element
      ).getAttributeNames(),
    }),
    [ROOT, TRIGGER] as const,
  );

for (const adapter of ADAPTERS) {
  for (const state of STATES) {
    test(`SJDisclosure | ${adapter} | aria snapshot ${state}`, async ({ page }) => {
      const errors = await openHost(page);
      await mount(page, adapter, state);
      await expect(page.locator(state === 'exclusive-group' ? STAGE : ROOT)).toMatchAriaSnapshot(
        yaml(state),
      );
      expect(errors).toEqual([]);
    });
  }

  test(`SJDisclosure | ${adapter} | aria snapshots follow a toggle: closed, open, closed`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, adapter, 'closed');
    await expect(page.locator(ROOT)).not.toMatchAriaSnapshot(yaml('open'), { timeout: 500 });
    await page.locator(TRIGGER).click();
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('open'));
    await page.locator(TRIGGER).click();
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('closed'));
    await expect(page.locator(ROOT)).not.toMatchAriaSnapshot(yaml('open'), { timeout: 500 });
  });

  test(`SJDisclosure | ${adapter} | a controlled open prop is exposed and released back`, async ({
    page,
  }) => {
    await openHost(page);
    await page.evaluate(
      ([a]) =>
        window.__sj
          .mount(
            a as 'react',
            {
              open: true,
              summary: 'Shipping details',
              content: 'Orders ship within two business days.',
            } as never,
          )
          .then(() => undefined),
      [adapter] as const,
    );
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('open'));
    await page.evaluate(() =>
      window.__sj.update({
        open: false,
        summary: 'Shipping details',
        content: 'Orders ship within two business days.',
      } as never),
    );
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('closed'));
    await expect(page.locator(ROOT)).not.toMatchAriaSnapshot(yaml('open'), { timeout: 500 });
  });

  test(`SJDisclosure | ${adapter} | the parts are a details, a summary and a div (same markup on every adapter)`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, adapter, 'open');
    const parts = await page.evaluate(() => {
      const root = document.querySelector('[data-part="root"]')!;
      return {
        root: [root.localName, root.getAttribute('class'), root.getAttribute('data-state')],
        kids: [...root.children].map((c) => [
          c.localName,
          c.getAttribute('data-part'),
          c.getAttribute('class'),
        ]),
      };
    });
    expect(parts.root).toEqual(['details', 'sj-disclosure__root', 'open']);
    expect(parts.kids).toEqual([
      ['summary', 'trigger', 'sj-disclosure__trigger'],
      ['div', 'content', 'sj-disclosure__content'],
    ]);
  });

  test(`SJDisclosure | ${adapter} | exposes no aria-expanded, aria-controls, aria-labelledby or role (native state)`, async ({
    page,
  }) => {
    await openHost(page);
    for (const fixture of ['closed', 'open', 'disabled']) {
      await mount(page, adapter, fixture);
      const a = await attrsOf(page);
      for (const part of ['root', 'trigger', 'content'] as const)
        for (const forbidden of FORBIDDEN)
          expect(a[part], `${fixture} ${part}: ${forbidden}`).not.toContain(forbidden);
      // Toggling must not add one either.
      if (fixture !== 'disabled') {
        await page.locator(TRIGGER).click();
        await settle(page);
        const b = await attrsOf(page);
        for (const forbidden of FORBIDDEN) expect(b.trigger).not.toContain(forbidden);
      }
    }
    // aria-disabled is the one ARIA attribute, and only on the disabled trigger.
    await mount(page, adapter, 'closed');
    expect((await attrsOf(page)).trigger).not.toContain('aria-disabled');
    await mount(page, adapter, 'disabled');
    expect((await attrsOf(page)).trigger).toContain('aria-disabled');
  });

  test(`SJDisclosure | ${adapter} | the title text does not change with state`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, adapter, 'closed');
    const title = () => page.locator(TRIGGER).textContent();
    expect(await title()).toBe(SUMMARY);
    await page.locator(TRIGGER).click();
    await settle(page);
    expect(await title()).toBe(SUMMARY);
  });
}

// The snapshot is only evidence if a regression fails it.
const SEEDED = [
  {
    why: 'open state lost (the panel is hidden again)',
    state: 'open',
    mutate: () =>
      ((document.querySelector('[data-part="root"]') as HTMLDetailsElement).open = false),
  },
  {
    why: 'open state forced (a closed disclosure with its panel shown)',
    state: 'closed',
    mutate: () =>
      ((document.querySelector('[data-part="root"]') as HTMLDetailsElement).open = true),
  },
  {
    why: 'title text changed (the visible title no longer matches)',
    state: 'closed',
    mutate: () => (document.querySelector('[data-part="trigger"]')!.textContent = 'Other'),
  },
  {
    why: 'role overridden on the root (a region, not a group)',
    state: 'closed',
    mutate: () => document.querySelector('[data-part="root"]')!.setAttribute('role', 'region'),
  },
] as const;

for (const s of SEEDED)
  test(`seeded aria regression | react | ${s.why} fails the ${s.state} snapshot`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, 'react', s.state);
    await page.evaluate(s.mutate as () => void);
    await expect(page.locator(ROOT)).not.toMatchAriaSnapshot(yaml(s.state), {
      timeout: 1500,
    });
  });

test('seeded aria regression | the forbidden-attribute check sees an aria-expanded on the summary', async ({
  page,
}) => {
  await openHost(page);
  await mount(page, 'react', 'closed');
  await page.evaluate(() =>
    document.querySelector('[data-part="trigger"]')!.setAttribute('aria-expanded', 'false'),
  );
  expect((await attrsOf(page)).trigger).toContain('aria-expanded');
});

// ---- CDP: the browser's computed AX tree, Chromium only ------------------------------------------------
interface AXValue {
  value?: unknown;
}
interface AXNode {
  ignored?: boolean;
  role?: AXValue;
  name?: AXValue;
  properties?: { name: string; value: AXValue }[];
}
const EXPECTED = {
  closed: { name: SUMMARY, expanded: false, disabled: false },
  open: { name: SUMMARY, expanded: true, disabled: false },
  disabled: { name: SUMMARY, expanded: false, disabled: true },
  'long-title': { name: LONG_SUMMARY, expanded: false, disabled: false },
} as const;

for (const adapter of ADAPTERS) {
  for (const state of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    test(`SJDisclosure | ${adapter} | cdp ax tree ${state}`, async ({ page, browserName }) => {
      // #49 owner: SrRamos
      test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
      const errors = await openHost(page);
      await mount(page, adapter, state);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Accessibility.enable');
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
      const triggers = nodes.filter((n) => !n.ignored && n.role?.value === 'DisclosureTriangle');
      expect(triggers, 'exactly one disclosure trigger in the AX tree').toHaveLength(1);
      const node = triggers[0]!;
      const prop = (name: string) => node.properties?.find((p) => p.name === name)?.value.value;
      const want = EXPECTED[state];
      expect(node.name?.value).toBe(want.name);
      expect(prop('expanded'), 'expanded comes from the native <details> state').toBe(
        want.expanded,
      );
      expect(prop('disabled') ?? false).toBe(want.disabled);
      // The disabled trigger stays focusable on purpose (aria-disabled, not removed from the tab order).
      expect(prop('focusable')).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
