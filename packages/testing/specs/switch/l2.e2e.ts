// L2 + L6 for SJSwitch (W1-C03s.f, ADR-013): every derived scenario on 3 engines x 3 adapters x the
// supports paths. Drives the REAL adapters through the L2 runner's executor (reused unchanged), plus the
// scenarios the executor cannot know (controlled `checked`, label click). Title format, parsed by the
// parity matrix: `<component> | <adapter> | <scenario> | <action> | path=<path>`. Titles without
// `path=` are harness checks and are ignored by the matrix.
import { test, expect, type Page } from '@playwright/test';
import { runInert, runSequence, type Failure, type RunOptions } from '../../e2e/runner/executor';
import { injectionProblems } from '../../e2e/supports/injection';
import { SUPPORT_KEYS, isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import { ADAPTERS, FIXTURES, matrixTitle, paths, plan, spec, switchScenarios } from './matrix';
import type { Adapter } from './fixtures';
import { CONTROL, openHost, settle } from './open';

async function open(page: Page): Promise<{ errors: string[]; real: SupportsMap }> {
  const errors = await openHost(page);
  const real = await page.evaluate(() => ({ ...window.__sj.real }) as SupportsMap);
  return { errors, real };
}

const report = (fails: Failure[]) => fails.map((f) => `${f.where}: ${f.message}`);
const seenMap = (page: Page) => page.evaluate(() => window.__sj.seen as SupportsMap | null);

const mount = (page: Page, adapter: Adapter, props: object, path: string) =>
  page.evaluate(
    ([a, p, path]) =>
      window.__sj.mount(a as 'react', p as never, 'none', path).then(() => undefined),
    [adapter, props, path] as const,
  );

const view = (page: Page) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLInputElement;
    return {
      state: el.getAttribute('data-state'),
      checked: el.checked,
      events: window.__sj.events.slice(),
    };
  }, CONTROL);

/** Controlled field: a request is reported, the owner decides, the view follows only the prop. */
async function runControlled(page: Page, adapter: Adapter, path: string): Promise<string[]> {
  const out: string[] = [];
  const bad = (m: string) => void out.push(m);
  await mount(page, adapter, { checked: false, label: 'Wifi' }, path);
  const control = page.locator(CONTROL);
  await control.waitFor({ timeout: 5000 });
  await control.click();
  await settle(page);
  let s = await view(page);
  if (JSON.stringify(s.events) !== '[true]')
    bad(`events ${JSON.stringify(s.events)}, expected [true]`);
  if (s.state !== 'off') bad(`rejected request changed data-state to "${s.state}"`);
  if (s.checked) bad('rejected request left the native input checked (corrective effect missing)');
  await page.evaluate((p) => window.__sj.update(p as never), { checked: true, label: 'Wifi' });
  await settle(page);
  s = await view(page);
  if (s.state !== 'on') bad(`prop true left data-state at "${s.state}"`);
  if (!s.checked) bad('prop true left the native input unchecked');
  if (s.events.length !== 1) bad(`prop change emitted: ${JSON.stringify(s.events)}`);
  await control.click();
  await settle(page);
  s = await view(page);
  if (JSON.stringify(s.events) !== '[true,false]')
    bad(`events ${JSON.stringify(s.events)}, expected [true,false]`);
  if (s.state !== 'on' || !s.checked) bad('controlled on survived a rejected off request wrongly');
  return out;
}

async function runLabel(page: Page, adapter: Adapter, path: string): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, FIXTURES['off']!, path);
  await page.locator(CONTROL).waitFor({ timeout: 5000 });
  await page.locator('.sj-switch__root').getByText('Notifications').click();
  await settle(page);
  const s = await view(page);
  if (s.state !== 'on' || !s.checked)
    out.push(`label click gave state "${s.state}", checked ${s.checked}`);
  if (JSON.stringify(s.events) !== '[true]') out.push(`events ${JSON.stringify(s.events)}`);
  return out;
}

test.describe('harness checks (not matrix rows)', () => {
  test('the plan is derived from the contract and every scenario has a fixture', () => {
    expect(plan.sequences.length).toBeGreaterThan(0);
    expect(spec.unreachable).toEqual([]);
    for (const s of spec.scenarios) expect(FIXTURES).toHaveProperty(s.fixture);
  });

  test('the contract declares no capability fallback, so only native and fallback:all run', () => {
    expect(spec.component).toBe('SJSwitch');
    expect(paths().map((p) => p.id)).toEqual(['native', 'fallback:all']);
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter} | forcing every capability false is visible to the runtime`, async ({
      page,
    }) => {
      const { real } = await open(page);
      await mount(page, adapter, FIXTURES['off']!, 'fallback:all');
      const seen = (await seenMap(page))!;
      for (const k of SUPPORT_KEYS) expect(seen[k], k).toBe(false);
      expect(Object.values(real).some(Boolean)).toBe(true);
    });
  }
});

for (const path of paths()) {
  for (const adapter of ADAPTERS) {
    test.describe(`${spec.component} | ${adapter} | path=${path.id}`, () => {
      const base = (variant: string): RunOptions => ({
        adapter,
        fixtures: FIXTURES,
        variant,
        path: path.id,
        timeoutMs: 5000,
      });

      for (const s of switchScenarios()) {
        test(matrixTitle(adapter, s, path.id), async ({ page }) => {
          const { errors, real } = await open(page);
          if (isNoop(real, path))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${path.forced.join(', ')}; path equals native here`,
            });
          const opts = base(s.action);
          const fails =
            s.run.kind === 'sequence'
              ? report(await runSequence(page, plan, spec, s.run.sequence, opts))
              : s.run.kind === 'inert'
                ? report(await runInert(page, plan, spec, s.run.fixture, opts))
                : s.run.kind === 'controlled'
                  ? await runControlled(page, adapter, path.id)
                  : await runLabel(page, adapter, path.id);
          expect(fails).toEqual([]);
          expect(errors).toEqual([]);
          expect(injectionProblems(real, await seenMap(page), parsePath(path.id))).toEqual([]);
        });
      }
    });
  }
}

// The executor is only evidence if a broken switch fails it. Seeded defect: the control stops following
// its data-state (a wrapper that forgets to re-render). The executor must report it.
for (const adapter of ADAPTERS) {
  test(`seeded defect | ${adapter} | a switch whose data-state never advances is reported`, async ({
    page,
  }) => {
    await open(page);
    const fails: Failure[] = [];
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const c = document.querySelector('[data-part="control"]');
        if (c && c.getAttribute('data-state') !== 'off') c.setAttribute('data-state', 'off');
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
    });
    await page.reload();
    await page.waitForFunction(() => window.__sj?.ready === true);
    for (const sequence of plan.sequences)
      fails.push(
        ...(await runSequence(page, plan, spec, sequence, {
          adapter,
          fixtures: FIXTURES,
          variant: 'pointer',
          timeoutMs: 600,
        })),
      );
    expect(fails.length, 'defect went undetected').toBeGreaterThan(0);
  });
}
