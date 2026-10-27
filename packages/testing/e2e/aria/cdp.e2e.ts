// CDP `Accessibility.getFullAXTree` on Chromium (W1-309c, ADR-013 L2). Complements the ARIA
// snapshot with the browser's own computed tree: the switch node must exist exactly once, with the
// computed name, `checked` and `disabled` state of the contract, on every adapter. Chromium only
// (CDP); the other engines report skipped with the reason, which the parity matrix reads as
// not-applicable rather than as a missing cell.
import { test, expect } from '@playwright/test';
import { ADAPTERS, mountProbe, openHost } from './open';

interface AXValue {
  value?: unknown;
}
interface AXNode {
  nodeId: string;
  ignored?: boolean;
  role?: AXValue;
  name?: AXValue;
  properties?: { name: string; value: AXValue }[];
  childIds?: string[];
}

/** What the browser computes for the probe root, per contract state. */
const EXPECTED = {
  off: { name: 'Label', checked: 'false', disabled: false },
  on: { name: 'Label', checked: 'true', disabled: false },
  disabled: { name: 'Label', checked: 'false', disabled: true },
} as const;

for (const adapter of ADAPTERS) {
  for (const state of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    test(`SJProbe | ${adapter} | cdp ax tree ${state}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
      const errors = await openHost(page);
      await mountProbe(page, adapter, state);
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

test('SJProbe | vue | cdp ax tree rejects the seeded aria-checked regression', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
  await openHost(page);
  await mountProbe(page, 'vue', 'off', 'vue-wrong-aria');
  await page.locator('[data-part="root"]').click();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
  const node = nodes.find((n) => !n.ignored && n.role?.value === 'switch');
  const checked = node?.properties?.find((p) => p.name === 'checked')?.value.value;
  expect(checked, 'defect went undetected by the AX tree').not.toBe(EXPECTED.on.checked);
});
