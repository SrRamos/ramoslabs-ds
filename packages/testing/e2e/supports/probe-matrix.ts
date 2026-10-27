// The probe's L2 scenarios as a flat list, shared by the Playwright spec and by the expected-matrix
// declaration (W1-313). One list feeds both, so a scenario that is declared is a scenario that runs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { l2Plan } from '../../spec/reducer/index.js';
import { variantsOf, type Plan, type Props } from '../runner/executor';
import { supportsPaths } from './paths';

const here = dirname(fileURLToPath(import.meta.url));
export const contract = JSON.parse(
  readFileSync(join(here, '..', '..', 'probe', 'probe.contract.json'), 'utf8'),
);
export const spec = deriveSpec(contract);
export const plan: Plan = l2Plan(spec);

export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

/** The component author's map from contract fixture names to props (same as runner/probe.e2e.ts). */
export const fixtures: Record<string, Props> = {
  off: {},
  on: { defaultPressed: true },
  disabled: { disabled: true },
};

export type ScenarioKind =
  | { kind: 'sequence'; sequence: string[] }
  | { kind: 'inert'; fixture: string }
  | { kind: 'controlled' };

export interface Scenario {
  /** Matrix `scenario` column. */
  readonly scenario: string;
  /** Matrix `action` column: pointer or the keyboard key that drives the scenario. */
  readonly action: string;
  readonly run: ScenarioKind;
}

/** Sequence x variant, then the inert fixtures, then the controlled field. Deterministic order. */
export function probeScenarios(): Scenario[] {
  const out: Scenario[] = [];
  for (const sequence of plan.sequences)
    for (const action of variantsOf(plan))
      out.push({ scenario: sequence.join(' , '), action, run: { kind: 'sequence', sequence } });
  for (const sc of spec.scenarios.filter((s) => !s.interactive))
    out.push({
      scenario: `inert fixture ${sc.fixture}`,
      action: 'pointer',
      run: { kind: 'inert', fixture: sc.fixture },
    });
  out.push({ scenario: 'controlled pressed', action: 'pointer', run: { kind: 'controlled' } });
  return out;
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${spec.component} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

/**
 * What the matrix MUST contain, derived from the contract, the adapters, the engines and the
 * `supports` keys; never from results. Floor-lane and device rows are declared `not run` with the
 * ADR-013 reason, so the matrix says so explicitly instead of staying silent.
 */
export function probeExpected() {
  return {
    version: 1,
    component: spec.component as string,
    browsers: [
      ...ENGINES.map((id) => ({ id })),
      {
        id: 'chromium-114',
        status: 'not-run',
        reason: 'real floor lane runs per release (ADR-013); not part of the per-PR run',
      },
      {
        id: 'firefox-125',
        status: 'not-run',
        reason: 'real floor lane runs per release (ADR-013); not part of the per-PR run',
      },
      {
        id: 'ios-17-safari',
        status: 'not-run',
        reason:
          'no physical iOS 17 device available (owner decision, ADR-013); not hands-on verified',
      },
      {
        id: 'android-floor',
        status: 'not-run',
        reason:
          'no Android floor device available (owner decision, ADR-013); not hands-on verified',
      },
    ],
    adapters: [...ADAPTERS],
    paths: supportsPaths().map((p) => ({ id: p.id, forced: [...p.forced] })),
    scenarios: probeScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: [],
  };
}
