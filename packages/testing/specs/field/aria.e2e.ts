// ARIA layer for SJField, SJInput and SJForm (W1-C02.f, ADR-013 L2): one shared YAML snapshot per contract
// fixture (`aria/<contract>-<fixture>.yml`), used by every adapter on every engine, plus the browser's own
// computed tree through CDP on Chromium. Playwright derives the tree from accessibility semantics, so an adapter
// that diverges in role, name or state fails against the same file; markup noise does not. The description a
// screen reader reads is asserted separately (the snapshot does not carry it). Seeded regressions prove each
// check can fail.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTERS,
  ALL_FIXTURES,
  ERROR,
  HINT,
  LABEL,
  LONG_LABEL,
  type Adapter,
  type Scene,
} from './fixtures';
import { control, mountScene, openHost, updateScene } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (id: string) =>
  readFileSync(join(here, 'aria', `${id.replace('/', '-')}.yml`), 'utf8').replaceAll(
    '$LONG_LABEL',
    LONG_LABEL,
  );

for (const adapter of ADAPTERS) {
  for (const id of Object.keys(ALL_FIXTURES)) {
    test(`SJField | ${adapter} | aria snapshot ${id}`, async ({ page }) => {
      const errors = await openHost(page);
      await mountScene(page, adapter, ALL_FIXTURES[id]!);
      await expect(page.locator('#f')).toMatchAriaSnapshot(yaml(id));
      expect(errors).toEqual([]);
    });
  }

  test(`SJField | ${adapter} | the description is the hint and the error, in that order, and nothing else`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, {
      form: false,
      fields: [
        { name: 'a', kind: 'email', label: LABEL, hint: HINT },
        { name: 'b', kind: 'email', label: LABEL, error: ERROR },
        { name: 'c', kind: 'email', label: LABEL, hint: HINT, error: ERROR },
        { name: 'd', kind: 'email', label: LABEL },
      ],
    });
    await expect(control(page, 'a')).toHaveAccessibleDescription(HINT);
    await expect(control(page, 'b')).toHaveAccessibleDescription(ERROR);
    await expect(control(page, 'c')).toHaveAccessibleDescription(`${HINT} ${ERROR}`);
    await expect(control(page, 'd')).toHaveAccessibleDescription('');
    for (const n of ['a', 'b', 'c', 'd'])
      await expect(control(page, n)).toHaveAccessibleName(LABEL);
  });

  test(`SJField | ${adapter} | the tree follows an error appearing and clearing`, async ({
    page,
  }) => {
    await openHost(page);
    const quiet: Scene = ALL_FIXTURES['field/default']!;
    await mountScene(page, adapter, quiet);
    await expect(page.locator('#f')).toMatchAriaSnapshot(yaml('field/default'));
    await updateScene(page, ALL_FIXTURES['field/invalid']!);
    await expect(page.locator('#f')).toMatchAriaSnapshot(yaml('field/invalid'));
    await expect(control(page, 'email')).toHaveAccessibleDescription(ERROR);
    await updateScene(page, quiet);
    await expect(page.locator('#f')).toMatchAriaSnapshot(yaml('field/default'));
    await expect(page.locator('#f')).not.toMatchAriaSnapshot(yaml('field/invalid'), {
      timeout: 500,
    });
  });

  test(`SJField | ${adapter} | the textarea kind is a multi-line textbox, every other kind a single-line one`, async ({
    page,
  }) => {
    await openHost(page);
    await mountScene(page, adapter, ALL_FIXTURES['form/textarea-last']!);
    const roles = await page.evaluate(() =>
      [...document.querySelectorAll('#f input, #f textarea')].map((e) => [
        e.localName,
        e.getAttribute('role'),
        (e as HTMLInputElement).type,
      ]),
    );
    expect(roles).toEqual([
      ['input', null, 'text'],
      ['input', null, 'email'],
      ['textarea', null, 'textarea'],
    ]);
  });

  test(`SJField | ${adapter} | exposes no role, aria-required or aria-labelledby on the control (native semantics)`, async ({
    page,
  }) => {
    await openHost(page);
    for (const id of ['field/required', 'field/disabled', 'field/invalid', 'input/password']) {
      await mountScene(page, adapter, ALL_FIXTURES[id]!);
      const attrs = await page.evaluate(() =>
        [...document.querySelectorAll('#f input, #f textarea')].flatMap((c) =>
          c.getAttributeNames(),
        ),
      );
      for (const forbidden of ['role', 'aria-required', 'aria-labelledby', 'aria-disabled'])
        expect(attrs, `${id}: ${forbidden}`).not.toContain(forbidden);
    }
  });
}

// The snapshot is only evidence if a regression fails it.
const SEEDED = [
  {
    why: 'aria-invalid lost',
    id: 'field/invalid',
    mutate: () => document.querySelector('[name="email"]')!.removeAttribute('aria-invalid'),
  },
  {
    why: 'role overridden (a combobox, not a textbox)',
    id: 'field/default',
    mutate: () => document.querySelector('[name="email"]')!.setAttribute('role', 'combobox'),
  },
  {
    why: 'accessible name changed (aria-label overrides the label)',
    id: 'input/phone',
    mutate: () => document.querySelector('[name="phone"]')!.setAttribute('aria-label', 'Other'),
  },
  {
    why: 'disabled state lost',
    id: 'field/disabled',
    mutate: () => ((document.querySelector('[name="email"]') as HTMLInputElement).disabled = false),
  },
  {
    why: 'the error text is missing',
    id: 'field/invalid',
    mutate: () => document.querySelector('.sj-field__error')!.remove(),
  },
] as const;

for (const s of SEEDED)
  test(`seeded aria regression | react | ${s.why} fails the ${s.id} snapshot`, async ({ page }) => {
    await openHost(page);
    await mountScene(page, 'react', ALL_FIXTURES[s.id]!);
    await page.evaluate(s.mutate as () => void);
    await expect(page.locator('#f')).not.toMatchAriaSnapshot(yaml(s.id), { timeout: 1500 });
  });

test('seeded aria regression | the description check fails when the error is not referenced', async ({
  page,
}) => {
  await openHost(page);
  await mountScene(page, 'react', ALL_FIXTURES['field/invalid']!);
  await page.evaluate(() =>
    document.querySelector('[name="email"]')!.removeAttribute('aria-describedby'),
  );
  await expect(control(page, 'email')).not.toHaveAccessibleDescription(ERROR, { timeout: 1500 });
});

// ---- CDP: the browser's computed AX tree, Chromium only ------------------------------------------------
interface AXValue {
  value?: unknown;
}
interface AXNode {
  ignored?: boolean;
  role?: AXValue;
  name?: AXValue;
  description?: AXValue;
  properties?: { name: string; value: AXValue }[];
}

const AX_EXPECTED: Record<
  string,
  { name: string; description: string; invalid: boolean; disabled: boolean; required: boolean }
> = {
  'field/default': {
    name: LABEL,
    description: '',
    invalid: false,
    disabled: false,
    required: false,
  },
  'field/with-hint': {
    name: LABEL,
    description: HINT,
    invalid: false,
    disabled: false,
    required: false,
  },
  'field/invalid': {
    name: LABEL,
    description: ERROR,
    invalid: true,
    disabled: false,
    required: false,
  },
  'field/required': {
    name: LABEL,
    description: '',
    invalid: false,
    disabled: false,
    required: true,
  },
  'field/disabled': {
    name: LABEL,
    description: '',
    invalid: false,
    disabled: true,
    required: false,
  },
};

async function axTextboxes(page: Page): Promise<AXNode[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
  return nodes.filter((n) => !n.ignored && n.role?.value === 'textbox');
}

for (const adapter of ADAPTERS as readonly Adapter[]) {
  for (const id of Object.keys(AX_EXPECTED)) {
    test(`SJField | ${adapter} | cdp ax tree ${id}`, async ({ page, browserName }) => {
      // #49 owner: SrRamos
      test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
      const errors = await openHost(page);
      await mountScene(page, adapter, ALL_FIXTURES[id]!);
      const boxes = await axTextboxes(page);
      expect(boxes, 'exactly one textbox node in the AX tree').toHaveLength(1);
      const node = boxes[0]!;
      const prop = (name: string) => node.properties?.find((p) => p.name === name)?.value.value;
      const want = AX_EXPECTED[id]!;
      expect(node.name?.value).toBe(want.name);
      // The description is the words only: the aria-hidden "!" icon never reaches it.
      expect(node.description?.value ?? '').toBe(want.description);
      expect(String(node.description?.value ?? '')).not.toContain('!');
      expect(prop('invalid') ?? 'false').toBe(want.invalid ? 'true' : 'false');
      expect((prop('disabled') ?? false) === true).toBe(want.disabled);
      expect((prop('required') ?? false) === true).toBe(want.required);
      expect(errors).toEqual([]);
    });
  }

  test(`SJField | ${adapter} | cdp: the aria-hidden icon is not in the AX tree`, async ({
    page,
    browserName,
  }) => {
    // #49 owner: SrRamos
    test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
    await openHost(page);
    await mountScene(page, adapter, ALL_FIXTURES['field/invalid']!);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
    const visible = nodes.filter((n) => !n.ignored);
    const roles = visible.map((n) => String(n.role?.value));
    expect(roles).not.toContain('image');
    expect(roles).not.toContain('graphics-symbol');
    expect(roles).not.toContain('SvgRoot');
    const names = visible.map((n) => String(n.name?.value ?? ''));
    expect(names.some((x) => x.includes('!'))).toBe(false);
    expect(names.some((x) => /alert|circle|error icon/i.test(x))).toBe(false);
  });

  test(`SJField | ${adapter} | cdp: the textarea kind is a multi-line textbox`, async ({
    page,
    browserName,
  }) => {
    // #49 owner: SrRamos
    test.skip(browserName !== 'chromium', 'CDP getFullAXTree exists on Chromium only');
    await openHost(page);
    await mountScene(page, adapter, ALL_FIXTURES['input/address']!);
    const [node] = await axTextboxes(page);
    expect(node?.properties?.find((p) => p.name === 'multiline')?.value.value).toBe(true);
    await mountScene(page, adapter, ALL_FIXTURES['input/email']!);
    const [single] = await axTextboxes(page);
    expect(single?.properties?.find((p) => p.name === 'multiline')?.value.value ?? false).toBe(
      false,
    );
  });
}
