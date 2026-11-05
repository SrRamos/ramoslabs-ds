// L2 + L6 for SJCheckbox (W1-C03c.f, ADR-013): every contract step on 3 engines x 3 adapters x the supports
// paths. Drives the REAL adapters. The stock sequence executor is not reused: it assumes `on`/`off`
// data-state values and a boolean event log, while a checkbox has four machine positions
// (unchecked, checked, mixed-unchecked, mixed-checked), data-state `indeterminate`, and two events. The
// scenarios come from the same derived plan, so a contract step that is not driven here fails the matrix.
// Title format, parsed by the parity matrix: `<component> | <adapter> | <scenario> | <action> | path=<path>`.
// Titles without `path=` are harness checks and are ignored by the matrix.
import { test, expect, type Page } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { SUPPORT_KEYS, isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import {
  ADAPTERS,
  FIXTURES,
  checkboxScenarios,
  checkedOf,
  contract,
  dataStateOf,
  matrixTitle,
  mixedOf,
  paths,
  plan,
  spec,
  type Step,
} from './matrix';
import { LABEL, POSITIONS, type Adapter } from './fixtures';
import { CONTROL, openHost, settle } from './open';

async function open(page: Page): Promise<{ errors: string[]; real: SupportsMap }> {
  const errors = await openHost(page);
  const real = await page.evaluate(() => ({ ...window.__sj.real }) as SupportsMap);
  return { errors, real };
}

const seenMap = (page: Page) => page.evaluate(() => window.__sj.seen as SupportsMap | null);

const mount = (page: Page, adapter: Adapter, props: object, path: string) =>
  page.evaluate(
    ([a, p, path]) =>
      window.__sj.mount(a as 'react', p as never, 'none', path).then(() => undefined),
    [adapter, props, path] as const,
  );

interface View {
  state: string | null;
  partStates: (string | null)[];
  checked: boolean;
  indeterminate: boolean;
  indeterminateAttr: boolean;
  focused: boolean;
  events: string[];
}

const view = (page: Page): Promise<View> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLInputElement;
    return {
      state: el.getAttribute('data-state'),
      partStates: ['root', 'indicator', 'label'].map(
        (p) => document.querySelector(`[data-part="${p}"]`)?.getAttribute('data-state') ?? null,
      ),
      checked: el.checked,
      indeterminate: el.indeterminate,
      indeterminateAttr: el.hasAttribute('indeterminate'),
      focused: document.activeElement === el,
      events: (window.__sj.events as unknown as string[]).slice(),
    };
  }, CONTROL);

function expectPosition(out: string[], where: string, position: string, v: View): void {
  const state = dataStateOf(position);
  if (v.state !== state) out.push(`${where}: control data-state "${v.state}", expected "${state}"`);
  for (const s of v.partStates)
    if (s !== state) out.push(`${where}: a part has data-state "${s}", expected "${state}"`);
  if (v.checked !== checkedOf(position))
    out.push(`${where}: input.checked ${v.checked}, expected ${checkedOf(position)}`);
  if (v.indeterminate !== mixedOf(position))
    out.push(`${where}: input.indeterminate ${v.indeterminate}, expected ${mixedOf(position)}`);
  if (v.indeterminateAttr) out.push(`${where}: indeterminate leaked into an attribute`);
}

/** Run one `toggle` step: mount at `from`, activate by pointer or key, assert `to` and the events. */
export async function runToggle(
  page: Page,
  adapter: Adapter,
  path: string,
  step: Step,
  action: string,
): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, POSITIONS[step.from]!, path);
  const control = page.locator(CONTROL);
  await control.waitFor({ timeout: 5000 });
  await settle(page);
  expectPosition(out, `${step.id} initial`, step.from, await view(page));
  if (action === 'pointer') await control.click();
  else {
    await control.focus();
    await page.keyboard.press(action);
  }
  await settle(page);
  const v = await view(page);
  expectPosition(out, `${step.id} [${action}]`, step.to, v);
  // checkedChange always; indeterminateChange(false) only when the activation left a mixed position.
  const want = [
    `checked:${checkedOf(step.to)}`,
    ...(mixedOf(step.from) ? ['indeterminate:false'] : []),
  ];
  if (JSON.stringify([...v.events].sort()) !== JSON.stringify([...want].sort()))
    out.push(`${step.id}: events ${JSON.stringify(v.events)}, expected ${JSON.stringify(want)}`);
  if (action !== 'pointer' && !v.focused) out.push(`${step.id}: focus left the control`);
  return out;
}

/** `setIndeterminate` / `clearIndeterminate`: the owner drives them as a controlled prop; nothing is emitted. */
export async function runProp(
  page: Page,
  adapter: Adapter,
  path: string,
  step: Step,
): Promise<string[]> {
  const out: string[] = [];
  const props = (position: string) => ({
    checked: checkedOf(position),
    indeterminate: mixedOf(position),
    label: LABEL,
  });
  await mount(page, adapter, props(step.from), path);
  await page.locator(CONTROL).waitFor({ timeout: 5000 });
  await settle(page);
  expectPosition(out, `${step.id} initial`, step.from, await view(page));
  await page.evaluate((p) => window.__sj.update(p as never), props(step.to));
  await settle(page);
  const v = await view(page);
  expectPosition(out, `${step.id} [prop]`, step.to, v);
  if (v.events.length > 0)
    out.push(`${step.id}: a prop change emitted ${JSON.stringify(v.events)}`);
  return out;
}

/** The `disabled` fixture: no trigger may change state or emit. */
async function runInert(
  page: Page,
  adapter: Adapter,
  path: string,
  fixture: string,
): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, FIXTURES[fixture]!, path);
  const control = page.locator(CONTROL);
  await control.waitFor({ timeout: 5000 });
  const before = await view(page);
  if (!(await control.isDisabled())) out.push('inert fixture is not disabled');
  await control.click({ force: true, timeout: 2000 }).catch(() => undefined);
  await control.focus().catch(() => undefined);
  await page.keyboard.press('Space');
  await settle(page);
  const after = await view(page);
  if (after.state !== before.state) out.push(`state changed ${before.state} -> ${after.state}`);
  if (after.checked !== before.checked) out.push('input.checked changed while inert');
  if (after.events.length > 0) out.push(`${after.events.length} events emitted while inert`);
  return out;
}

/** Controlled `checked`: a request is reported, the owner decides, the view follows only the prop. */
async function runControlledChecked(page: Page, adapter: Adapter, path: string): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, { checked: false, label: 'Wifi' }, path);
  const control = page.locator(CONTROL);
  await control.waitFor({ timeout: 5000 });
  await control.click();
  await settle(page);
  let v = await view(page);
  if (JSON.stringify(v.events) !== '["checked:true"]')
    out.push(`events ${JSON.stringify(v.events)}, expected ["checked:true"]`);
  expectPosition(out, 'rejected request', 'unchecked', v);
  await page.evaluate((p) => window.__sj.update(p as never), { checked: true, label: 'Wifi' });
  await settle(page);
  v = await view(page);
  expectPosition(out, 'prop true', 'checked', v);
  if (v.events.length !== 1) out.push(`prop change emitted: ${JSON.stringify(v.events)}`);
  await control.click();
  await settle(page);
  v = await view(page);
  if (JSON.stringify(v.events) !== '["checked:true","checked:false"]')
    out.push(`events ${JSON.stringify(v.events)}`);
  expectPosition(out, 'second rejected request', 'checked', v);
  return out;
}

/**
 * Controlled `indeterminate` (select-all owner): the user's click clears indeterminate like a native input, the
 * request is reported, and an owner that keeps it set gets the property corrected; an owner that accepts it
 * releases it.
 */
async function runControlledIndeterminate(
  page: Page,
  adapter: Adapter,
  path: string,
): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, { defaultChecked: false, indeterminate: true, label: 'All' }, path);
  const control = page.locator(CONTROL);
  await control.waitFor({ timeout: 5000 });
  await settle(page);
  expectPosition(out, 'initial', 'mixed-unchecked', await view(page));
  await control.click();
  await settle(page);
  let v = await view(page);
  if (JSON.stringify([...v.events].sort()) !== '["checked:true","indeterminate:false"]')
    out.push(`events ${JSON.stringify(v.events)}`);
  // The owner kept indeterminate: the corrective effect put the property back; checked is uncontrolled.
  expectPosition(out, 'owner kept indeterminate', 'mixed-checked', v);
  await page.evaluate((p) => window.__sj.update(p as never), {
    defaultChecked: false,
    indeterminate: false,
    label: 'All',
  });
  await settle(page);
  v = await view(page);
  expectPosition(out, 'owner released indeterminate', 'checked', v);
  return out;
}

async function runLabel(page: Page, adapter: Adapter, path: string): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, FIXTURES['unchecked']!, path);
  await page.locator(CONTROL).waitFor({ timeout: 5000 });
  await page.locator('.sj-checkbox__root').getByText(LABEL).click();
  await settle(page);
  const v = await view(page);
  expectPosition(out, 'label click', 'checked', v);
  if (JSON.stringify(v.events) !== '["checked:true"]')
    out.push(`events ${JSON.stringify(v.events)}`);
  return out;
}

export async function runScenario(
  page: Page,
  adapter: Adapter,
  path: string,
  s: ReturnType<typeof checkboxScenarios>[number],
): Promise<string[]> {
  switch (s.run.kind) {
    case 'toggle':
      return runToggle(page, adapter, path, s.run.step, s.action);
    case 'prop':
      return runProp(page, adapter, path, s.run.step);
    case 'inert':
      return runInert(page, adapter, path, s.run.fixture);
    case 'controlled-checked':
      return runControlledChecked(page, adapter, path);
    case 'controlled-indeterminate':
      return runControlledIndeterminate(page, adapter, path);
    case 'label':
      return runLabel(page, adapter, path);
  }
}

test.describe('harness checks (not matrix rows)', () => {
  test('the plan is derived from the contract and every contract step has a scenario', () => {
    expect(plan.sequences.length).toBeGreaterThan(0);
    expect(spec.unreachable).toEqual([]);
    for (const s of spec.scenarios) expect(FIXTURES).toHaveProperty(s.fixture);
    expect(spec.states).toEqual([...contract.state.machine].sort());
    const covered = new Set(
      checkboxScenarios()
        .filter((s) => 'step' in s.run)
        .map((s) => (s.run as { step: Step }).step.id),
    );
    expect([...covered].sort()).toEqual(spec.steps.map((s: Step) => s.id).sort());
  });

  test('the contract declares no capability fallback, so only native and fallback:all run', () => {
    expect(spec.component).toBe('SJCheckbox');
    expect(paths().map((p) => p.id)).toEqual(['native', 'fallback:all']);
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter} | forcing every capability false is visible to the runtime`, async ({
      page,
    }) => {
      const { real } = await open(page);
      await mount(page, adapter, FIXTURES['unchecked']!, 'fallback:all');
      const seen = (await seenMap(page))!;
      for (const k of SUPPORT_KEYS) expect(seen[k], k).toBe(false);
      expect(Object.values(real).some(Boolean)).toBe(true);
    });
  }
});

for (const path of paths()) {
  for (const adapter of ADAPTERS) {
    test.describe(`${spec.component} | ${adapter} | path=${path.id}`, () => {
      for (const s of checkboxScenarios()) {
        test(matrixTitle(adapter, s, path.id), async ({ page }) => {
          const { errors, real } = await open(page);
          if (isNoop(real, path))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${path.forced.join(', ')}; path equals native here`,
            });
          expect(await runScenario(page, adapter, path.id, s)).toEqual([]);
          expect(errors).toEqual([]);
          expect(injectionProblems(real, await seenMap(page), parsePath(path.id))).toEqual([]);
        });
      }
    });
  }
}

// The runner is only evidence if a broken checkbox fails it. Seeded defects, per adapter:
//  1. the control stops following its data-state (a wrapper that forgets to re-render);
//  2. `indeterminate` is never applied to the input (the property write is lost).
const toggleStep = spec.steps.find((s: Step) => s.id === 'toggle:unchecked>checked')!;
const propStep = spec.steps.find(
  (s: Step) => s.id === 'setIndeterminate:unchecked>mixed-unchecked',
)!;
for (const adapter of ADAPTERS) {
  test(`seeded defect | ${adapter} | a checkbox whose data-state never advances is reported`, async ({
    page,
  }) => {
    await open(page);
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const c = document.querySelector('[data-part="control"]');
        if (c && c.getAttribute('data-state') !== 'unchecked')
          c.setAttribute('data-state', 'unchecked');
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
    });
    await page.reload();
    await page.waitForFunction(() => window.__sj?.ready === true);
    expect(
      (await runToggle(page, adapter, 'native', toggleStep, 'pointer')).length,
    ).toBeGreaterThan(0);
  });

  test(`seeded defect | ${adapter} | an indeterminate property that is never applied is reported`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLInputElement.prototype, 'indeterminate', {
        configurable: true,
        get: () => false,
        set: () => undefined,
      });
    });
    await open(page);
    expect((await runProp(page, adapter, 'native', propStep)).length).toBeGreaterThan(0);
  });
}
