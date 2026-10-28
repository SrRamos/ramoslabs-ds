// The SJSwitch L2 scenario list and the parity declaration (W1-C03s.f, ADR-013 L2 + L6). One list feeds
// the Playwright spec and the expected-matrix declaration, so a declared scenario is a scenario that runs
// and a missing cell is a failure, never an inference. Mirrors the probe's matrix (e2e/supports).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { l2Plan } from '../../spec/reducer/index.js';
import { variantsOf, type Plan } from '../../e2e/runner/executor';
import { supportsPaths } from '../../e2e/supports/paths';
import { ADAPTERS, ENGINES, FIXTURES, SWITCH_PATHS } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
export const contract = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', 'contracts', 'contracts', 'switch.contract.json'),
    'utf8',
  ),
);
export const spec = deriveSpec(contract);
export const plan: Plan = l2Plan(spec);
export { ADAPTERS, FIXTURES };

export type ScenarioKind =
  | { kind: 'sequence'; sequence: string[] }
  | { kind: 'inert'; fixture: string }
  | { kind: 'controlled' }
  | { kind: 'label' };

export interface Scenario {
  readonly scenario: string;
  readonly action: string;
  readonly run: ScenarioKind;
}

/** Sequence x variant (pointer, Space), the inert fixtures, the controlled field and the label click. */
export function switchScenarios(): Scenario[] {
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
  out.push({ scenario: 'controlled checked', action: 'pointer', run: { kind: 'controlled' } });
  out.push({ scenario: 'label click toggles', action: 'pointer', run: { kind: 'label' } });
  return out;
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${spec.component} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

/** The paths the Switch runs: `support: []` means no capability fallback, so `native` (real detection)
 *  and `fallback:all` (every capability forced false, the floor combination). */
export const paths = () =>
  supportsPaths().filter((p) => (SWITCH_PATHS as readonly string[]).includes(p.id));

/** What the matrix MUST contain, derived from the contract, never from results. */
export function switchExpected() {
  const floor = (id: string, reason: string) => ({ id, status: 'not-run', reason });
  return {
    version: 1,
    component: spec.component as string,
    browsers: [
      ...ENGINES.map((id) => ({ id })),
      floor(
        'chromium-114',
        'real floor lane runs per release (ADR-013); not part of the per-PR run',
      ),
      floor(
        'firefox-125',
        'real floor lane runs per release (ADR-013); not part of the per-PR run',
      ),
      floor(
        'ios-17-safari',
        'no physical iOS 17 device available (owner decision, ADR-013); not hands-on verified',
      ),
      floor(
        'android-floor',
        'no Android floor device available (owner decision, ADR-013); not hands-on verified',
      ),
    ],
    adapters: [...ADAPTERS],
    paths: paths().map((p) => ({ id: p.id, forced: [...p.forced] })),
    scenarios: switchScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: [],
  };
}
