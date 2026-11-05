// ARIA layer for SJCheckbox (W1-C03c.f, ADR-013 L2): one shared YAML snapshot per contract fixture, used by
// every adapter on every engine, plus the browser's own computed tree through CDP on Chromium. Playwright
// derives the tree from accessibility semantics, so an adapter that diverges in role, name or state fails
// against the same file; markup noise does not. `[checked=mixed]` is what the native `indeterminate`
// property produces. Seeded regressions prove each check can fail.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, FIXTURES, LABEL, LONG_LABEL, type Adapter } from './fixtures';
import { openHost } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (state: string) =>
  readFileSync(join(here, 'aria', `${state}.yml`), 'utf8').replace('$LONG_LABEL', LONG_LABEL);
/** One file per contract fixture. Focus has no ARIA state; the tree must not change with it. */
const STATES = ['unchecked', 'checked', 'indeterminate', 'disabled', 'long-label'] as const;

async function mount(page: Page, adapter: Adapter, fixture: string): Promise<void> {
  await page.evaluate(
    ([a, p]) => window.__sj.mount(a as 'react', p as never).then(() => undefined),
    [adapter, FIXTURES[fixture]!] as const,
  );
  await page.locator('[data-part="root"]').waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 40)));
}
const settle = (page: Page) => page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
const ROOT = '[data-part="root"]';
const CONTROL = '[data-part="control"]';

for (const adapter of ADAPTERS) {
  for (const state of STATES) {
    test(`SJCheckbox | ${adapter} | aria snapshot ${state}`, async ({ page }) => {
      const errors = await openHost(page);
      await mount(page, adapter, state);
      await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml(state));
      expect(errors).toEqual([]);
    });
  }

  test(`SJCheckbox | ${adapter} | aria snapshots follow a toggle: unchecked, checked, unchecked`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, adapter, 'unchecked');
    await page.locator(CONTROL).click();
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('checked'));
    await page.locator(CONTROL).click();
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('unchecked'));
  });

  test(`SJCheckbox | ${adapter} | activating an indeterminate checkbox leaves mixed and reports checked`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, adapter, 'indeterminate');
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('indeterminate'));
    await page.locator(CONTROL).click();
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('checked'));
    await expect(page.locator(ROOT)).not.toMatchAriaSnapshot(yaml('indeterminate'), {
      timeout: 500,
    });
  });

  test(`SJCheckbox | ${adapter} | a controlled indeterminate prop is exposed as mixed and released back`, async ({
    page,
  }) => {
    await openHost(page);
    await page.evaluate(
      ([a, l]) =>
        window.__sj
          .mount(a as 'react', { checked: false, indeterminate: true, label: l } as never)
          .then(() => undefined),
      [adapter, LABEL] as const,
    );
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('indeterminate'));
    await page.evaluate(
      (l) => window.__sj.update({ checked: false, indeterminate: false, label: l } as never),
      LABEL,
    );
    await settle(page);
    await expect(page.locator(ROOT)).toMatchAriaSnapshot(yaml('unchecked'));
  });

  test(`SJCheckbox | ${adapter} | the visible label is the anatomy part "label" (same markup on every adapter)`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, adapter, 'checked');
    const label = page.locator('[data-part="label"]');
    await expect(label).toHaveCount(1);
    expect(await label.evaluate((n) => n.localName)).toBe('span');
    expect(await label.getAttribute('class')).toBe('sj-checkbox__label');
    expect(await label.getAttribute('data-state')).toBe('checked');
    await expect(label).toHaveText(LABEL);
    // It sits inside the wrapping root <label>, which is what names the input.
    expect(await label.evaluate((n) => n.parentElement?.getAttribute('data-part'))).toBe('root');
  });

  test(`SJCheckbox | ${adapter} | exposes no role, aria-checked, aria-disabled, aria-labelledby or indeterminate attribute (native state)`, async ({
    page,
  }) => {
    await openHost(page);
    for (const fixture of ['checked', 'indeterminate', 'disabled']) {
      await mount(page, adapter, fixture);
      const attrs = await page.evaluate(() =>
        [...(document.querySelector('[data-part="control"]') as Element).attributes].map(
          (a) => a.name,
        ),
      );
      for (const forbidden of [
        'role',
        'aria-checked',
        'aria-disabled',
        'aria-labelledby',
        'indeterminate',
      ])
        expect(attrs, `${fixture}: ${forbidden}`).not.toContain(forbidden);
    }
  });

  test(`SJCheckbox | ${adapter} | the label text does not change with state`, async ({ page }) => {
    await openHost(page);
    await mount(page, adapter, 'unchecked');
    const text = () =>
      page.evaluate(() => document.querySelector('[data-part="root"]')!.textContent?.trim());
    expect(await text()).toBe(LABEL);
    await page.locator(CONTROL).click();
    await settle(page);
    expect(await text()).toBe(LABEL);
  });
}

// The snapshot is only evidence if a regression fails it.
const SEEDED = [
  {
    why: 'role overridden (a switch, not a checkbox)',
    state: 'checked',
    mutate: () => document.querySelector('[data-part="control"]')!.setAttribute('role', 'switch'),
  },
  {
    why: 'checked state lost',
    state: 'checked',
    mutate: () =>
      ((document.querySelector('[data-part="control"]') as HTMLInputElement).checked = false),
  },
  {
    why: 'indeterminate property lost (announced as plain unchecked, not mixed)',
    state: 'indeterminate',
    mutate: () =>
      ((document.querySelector('[data-part="control"]') as HTMLInputElement).indeterminate = false),
  },
  {
    why: 'accessible name changed (aria-label overrides the label)',
    state: 'unchecked',
    mutate: () =>
      document.querySelector('[data-part="control"]')!.setAttribute('aria-label', 'Other'),
  },
  {
    why: 'disabled state lost',
    state: 'disabled',
    mutate: () =>
      ((document.querySelector('[data-part="control"]') as HTMLInputElement).disabled = false),
  },
] as const;

for (const s of SEEDED)
  test(`seeded aria regression | react | ${s.why} fails the ${s.state} snapshot`, async ({
    page,
  }) => {
    await openHost(page);
    await mount(page, 'react', s.state);
    await page.evaluate(s.mutate as () => void);
    await expect(page.locator(ROOT)).not.toMatchAriaSnapshot(yaml(s.state), { timeout: 1500 });
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
  unchecked: { name: LABEL, checked: 'false', disabled: false },
  checked: { name: LABEL, checked: 'true', disabled: false },
  indeterminate: { name: LABEL, checked: 'mixed', disabled: false },
  disabled: { name: LABEL, checked: 'false', disabled: true },
  'long-label': { name: LONG_LABEL, checked: 'false', disabled: false },
} as const;

for (const adapter of ADAPTERS) {
  for (const state of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    test(`SJCheckbox | ${adapter} | cdp ax tree ${state}`, async ({ page, browserName }) => {
      // #49 owner: SrRamos
      test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
      const errors = await openHost(page);
      await mount(page, adapter, state);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Accessibility.enable');
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
      const boxes = nodes.filter((n) => !n.ignored && n.role?.value === 'checkbox');
      expect(boxes, 'exactly one checkbox node in the AX tree').toHaveLength(1);
      const node = boxes[0]!;
      const prop = (name: string) => node.properties?.find((p) => p.name === name)?.value.value;
      const want = EXPECTED[state];
      expect(node.name?.value).toBe(want.name);
      expect(prop('checked')).toBe(want.checked);
      expect(prop('disabled') ?? false).toBe(want.disabled);
      expect(prop('focusable') ?? false).toBe(!want.disabled);
      expect(errors).toEqual([]);
    });
  }
}
