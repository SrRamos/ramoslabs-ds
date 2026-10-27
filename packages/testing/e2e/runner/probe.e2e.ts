// L2 on the probe (W1-309a): every derived sequence on 3 engines (Playwright projects) x 3 adapters,
// plus the inert and controlled fixtures, plus seeded wrapper defects that MUST fail.
// Title format (parsed by the parity matrix, W1-313): `<component> | <adapter> | <scenario>`.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { l2Plan } from '../../spec/reducer/index.js';
import {
  runControlled,
  runInert,
  runSequence,
  variantsOf,
  type Failure,
  type Props,
  type RunOptions,
} from './executor';

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, '../../probe/probe.contract.json'), 'utf8'));
const spec = deriveSpec(contract);
const plan = l2Plan(spec);
const variants = variantsOf(plan);
const ADAPTERS = ['react', 'vue', 'vanilla'] as const;

// The component author's map from contract fixture names to props. Fixtures that name a machine
// state start in it; `disabled` is the inert one.
const fixtures: Record<string, Props> = {
  off: {},
  on: { defaultPressed: true },
  disabled: { disabled: true },
};

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

const report = (fails: Failure[]) => fails.map((f) => `${f.where}: ${f.message}`);

test.describe('plan', () => {
  test('is derived from the contract and non-empty', () => {
    expect(plan.sequences.length).toBeGreaterThan(0);
    expect(spec.unreachable).toEqual([]);
    for (const s of spec.scenarios) expect(fixtures).toHaveProperty(s.fixture);
  });
});

for (const adapter of ADAPTERS) {
  test.describe(`${spec.component} | ${adapter}`, () => {
    const base = (variant: string, defect?: string): RunOptions => ({
      adapter,
      fixtures,
      variant,
      ...(defect && { defect }),
    });

    for (const sequence of plan.sequences) {
      for (const variant of variants) {
        test(`${spec.component} | ${adapter} | ${sequence.join(' , ')} | ${variant}`, async ({
          page,
        }) => {
          const errors = await open(page);
          const fails = await runSequence(page, plan, spec, sequence, base(variant));
          expect(report(fails)).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
    }

    for (const sc of spec.scenarios.filter((s) => !s.interactive)) {
      test(`${spec.component} | ${adapter} | inert fixture ${sc.fixture}`, async ({ page }) => {
        const errors = await open(page);
        expect(report(await runInert(page, plan, spec, sc.fixture, base('pointer')))).toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test(`${spec.component} | ${adapter} | controlled pressed`, async ({ page }) => {
      const errors = await open(page);
      expect(report(await runControlled(page, spec, base('pointer')))).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

// Seeded behavioural defects, one per wrapper. The harness is only trustworthy if each is caught
// (ADR-013: seeded violations fail). A passing run here means "the defect was reported".
const DEFECTS = [
  { defect: 'vanilla-wrong-emit', adapter: 'vanilla', variants: ['pointer', 'Space'] },
  { defect: 'react-lose-focus', adapter: 'react', variants: ['Space'] },
  { defect: 'vue-wrong-aria', adapter: 'vue', variants: ['pointer'] },
] as const;

for (const d of DEFECTS) {
  for (const variant of d.variants) {
    test(`seeded defect | ${d.adapter} | ${d.defect} | ${variant} is reported`, async ({
      page,
    }) => {
      await open(page);
      const fails: Failure[] = [];
      for (const sequence of plan.sequences)
        fails.push(
          ...(await runSequence(page, plan, spec, sequence, {
            adapter: d.adapter,
            defect: d.defect,
            fixtures,
            variant,
            timeoutMs: 600,
          })),
        );
      if (process.env['SJ_E2E_DEBUG']) console.log(d.defect, variant, JSON.stringify(fails));
      expect(fails.length, `defect ${d.defect} went undetected`).toBeGreaterThan(0);
    });
  }
}
