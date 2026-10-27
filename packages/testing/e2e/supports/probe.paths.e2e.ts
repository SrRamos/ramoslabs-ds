// L2 + L6 on the probe across `supports` paths (W1-309b): every scenario of the probe on 3 engines
// x 3 adapters x (real detection + each of the ten capabilities forced false). The path is part of
// the title, so each forced-false run is its own row of the parity matrix (W1-313):
//   <component> | <adapter> | <scenario> | <action> | path=<path>
// Titles WITHOUT `path=` are harness checks and are ignored by the matrix.
import { test, expect, type Page } from '@playwright/test';
import {
  runControlled,
  runInert,
  runSequence,
  type Failure,
  type RunOptions,
} from '../runner/executor';
import { injectionProblems } from './injection';
import { ADAPTERS, fixtures, matrixTitle, plan, probeScenarios, spec } from './probe-matrix';
import { SUPPORT_KEYS, isNoop, supportsPaths, type SupportsMap } from './paths';

async function open(page: Page): Promise<{ errors: string[]; real: SupportsMap }> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  const real = await page.evaluate(() => ({ ...window.__sj.real }) as SupportsMap);
  return { errors, real };
}

const report = (fails: Failure[]) => fails.map((f) => `${f.where}: ${f.message}`);
const seenMap = (page: Page) => page.evaluate(() => window.__sj.seen as SupportsMap | null);

test.describe('supports detection (harness checks, not matrix rows)', () => {
  test('real detection returns exactly the ten core keys as booleans', async ({ page }) => {
    const { real } = await open(page);
    expect(Object.keys(real).sort()).toEqual([...SUPPORT_KEYS].sort());
    for (const k of SUPPORT_KEYS) expect(typeof real[k]).toBe('boolean');
    // Every engine Playwright ships implements these; a false here means the detector is broken.
    expect(real.popover).toBe(true);
    expect(real.focusVisible).toBe(true);
  });

  for (const adapter of ADAPTERS) {
    test(`forcing a supported capability false changes what the ${adapter} runtime sees`, async ({
      page,
    }) => {
      const { real } = await open(page);
      let forcedAtLeastOne = false;
      for (const path of supportsPaths().filter((p) => p.forced.length > 0)) {
        if (isNoop(real, path)) continue;
        forcedAtLeastOne = true;
        await page.evaluate(
          ([a, p]) => window.__sj.mount(a as 'react', {}, 'none', p).then(() => undefined),
          [adapter, path.id] as const,
        );
        const seen = (await seenMap(page))!;
        expect(seen[path.forced[0]!], path.id).toBe(false);
        expect(real[path.forced[0]!], path.id).toBe(true);
      }
      expect(forcedAtLeastOne).toBe(true);
    });
  }
});

for (const path of supportsPaths()) {
  for (const adapter of ADAPTERS) {
    test.describe(`${spec.component} | ${adapter} | path=${path.id}`, () => {
      const base = (variant: string): RunOptions => ({
        adapter,
        fixtures,
        variant,
        path: path.id,
      });

      for (const s of probeScenarios()) {
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
              ? await runSequence(page, plan, spec, s.run.sequence, opts)
              : s.run.kind === 'inert'
                ? await runInert(page, plan, spec, s.run.fixture, opts)
                : await runControlled(page, spec, opts);
          expect(report(fails)).toEqual([]);
          expect(errors).toEqual([]);
          // The path is what the adapter's own runtime reported, not a label we attached.
          expect(injectionProblems(real, await seenMap(page), path)).toEqual([]);
        });
      }
    });
  }
}
