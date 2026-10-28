// ARIA layer for SJSwitch (W1-C03s.f, ADR-013 L2): one shared YAML snapshot per contract fixture, used by
// every adapter on every engine, plus the browser's own computed tree through CDP on Chromium. Playwright
// derives the tree from accessibility semantics, so an adapter that diverges in role, name or state fails
// against the same file; markup noise does not. Seeded regressions prove each check can fail.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, FIXTURES, LABEL, LONG_LABEL, type Adapter } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (state: string) =>
  readFileSync(join(here, 'snapshots', `${state}.yml`), 'utf8').replace('$LONG_LABEL', LONG_LABEL);
/** One file per contract fixture, plus `on-focused` (focus has no ARIA state; the tree must not change). */
const STATES = ['off', 'on', 'disabled', 'long-label'] as const;

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  return errors;
}

async function mount(page: Page, adapter: Adapter, fixture: string): Promise<void> {
  await page.evaluate(
    ([a, p]) => window.__sj.mount(a as 'react', p as never).then(() => undefined),
    [adapter, FIXTURES[fixture]!] as const,
  );
  await page.locator('[data-part="root"]').waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 40)));
}

for (const adapter of ADAPTERS) {
  for (const state of STATES) {
    test(`SJSwitch | ${adapter} | aria snapshot ${state}`, async ({ page }) => {
      const errors = await open(page);
      await mount(page, adapter, state);
      await expect(page.locator('[data-part="root"]')).toMatchAriaSnapshot(yaml(state));
      expect(errors).toEqual([]);
    });
  }

  test(`SJSwitch | ${adapter} | aria snapshot after a toggle equals the on snapshot`, async ({
    page,
  }) => {
    await open(page);
    await mount(page, adapter, 'off');
    await page.locator('[data-part="control"]').click();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    await expect(page.locator('[data-part="root"]')).toMatchAriaSnapshot(yaml('on'));
    await page.locator('[data-part="control"]').click();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    await expect(page.locator('[data-part="root"]')).toMatchAriaSnapshot(yaml('off'));
  });

  test(`SJSwitch | ${adapter} | exposes no aria-checked, aria-disabled or aria-labelledby (native state)`, async ({
    page,
  }) => {
    await open(page);
    await mount(page, adapter, 'on');
    const attrs = await page.evaluate(() =>
      [...(document.querySelector('[data-part="control"]') as Element).attributes].map(
        (a) => a.name,
      ),
    );
    for (const forbidden of ['aria-checked', 'aria-disabled', 'aria-labelledby'])
      expect(attrs, forbidden).not.toContain(forbidden);
  });
}

for (const adapter of ADAPTERS)
  test(`SJSwitch | ${adapter} | the label text does not change with state (evidence constraint changing-switch-label)`, async ({
    page,
  }) => {
    await open(page);
    await mount(page, adapter, 'off');
    const text = () =>
      page.evaluate(() => document.querySelector('[data-part="root"]')!.textContent?.trim());
    const off = await text();
    await page.locator('[data-part="control"]').click();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    expect(await text()).toBe(off);
    expect(off).toBe(LABEL);
  });

// The snapshot is only evidence if a regression fails it.
const SEEDED = [
  {
    why: 'role=switch removed (a plain checkbox)',
    state: 'on',
    mutate: () => document.querySelector('[data-part="control"]')!.removeAttribute('role'),
  },
  {
    why: 'checked state lost',
    state: 'on',
    mutate: () =>
      ((document.querySelector('[data-part="control"]') as HTMLInputElement).checked = false),
  },
  {
    why: 'accessible name changed (aria-label overrides the label)',
    state: 'off',
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
    await open(page);
    await mount(page, 'react', s.state);
    await page.evaluate(s.mutate);
    await expect(page.locator('[data-part="root"]')).not.toMatchAriaSnapshot(yaml(s.state), {
      timeout: 1500,
    });
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
  off: { name: LABEL, checked: 'false', disabled: false },
  on: { name: LABEL, checked: 'true', disabled: false },
  disabled: { name: LABEL, checked: 'false', disabled: true },
  'long-label': { name: LONG_LABEL, checked: 'false', disabled: false },
} as const;

for (const adapter of ADAPTERS) {
  for (const state of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    test(`SJSwitch | ${adapter} | cdp ax tree ${state}`, async ({ page, browserName }) => {
      // #49 owner: SrRamos
      test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
      const errors = await open(page);
      await mount(page, adapter, state);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Accessibility.enable');
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
      const switches = nodes.filter((n) => !n.ignored && n.role?.value === 'switch');
      expect(switches, 'exactly one switch node in the AX tree').toHaveLength(1);
      const node = switches[0]!;
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
