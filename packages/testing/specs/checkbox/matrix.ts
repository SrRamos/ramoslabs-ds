// The SJCheckbox L2 scenario list and the parity declaration (W1-C03c.f, ADR-013 L2 + L6). One list feeds
// the Playwright spec and the expected-matrix declaration, so a declared scenario is a scenario that runs
// and a missing cell is a failure, never an inference. The scenarios are derived from the contract's
// steps: a `toggle` step is operated by pointer and by its keyboard trigger; `setIndeterminate` and
// `clearIndeterminate` have no user trigger (the owner drives them), so they run as a controlled prop.
// The stock sequence executor assumes `on`/`off` data-state values and a boolean event log; a checkbox has
// four machine positions and two events, so `l2.e2e.ts` carries its own small runner over the same plan.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { l2Plan } from '../../spec/reducer/index.js';
import { supportsPaths } from '../../e2e/supports/paths';
import { ADAPTERS, CHECKBOX_PATHS, ENGINES, FIXTURES } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
export const contract = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', 'contracts', 'contracts', 'checkbox.contract.json'),
    'utf8',
  ),
);
export const spec = deriveSpec(contract);
export const plan = l2Plan(spec);
export { ADAPTERS, FIXTURES };

export type Step = (typeof spec.steps)[number];

export type ScenarioKind =
  | { kind: 'toggle'; step: Step }
  | { kind: 'prop'; step: Step }
  | { kind: 'inert'; fixture: string }
  | { kind: 'controlled-checked' }
  | { kind: 'controlled-indeterminate' }
  | { kind: 'label' };

export interface Scenario {
  readonly scenario: string;
  readonly action: string;
  readonly run: ScenarioKind;
}

/** `data-state` of a machine position: indeterminate wins, then checked. */
export const dataStateOf = (position: string): 'unchecked' | 'checked' | 'indeterminate' =>
  position.startsWith('mixed') ? 'indeterminate' : position === 'checked' ? 'checked' : 'unchecked';
export const checkedOf = (position: string): boolean =>
  position === 'checked' || position === 'mixed-checked';
export const mixedOf = (position: string): boolean => position.startsWith('mixed');

/** Every step by pointer and by its keyboard trigger (toggle), or by prop (the owner-driven steps), plus the
 *  inert fixtures, the controlled fields and the label click. */
export function checkboxScenarios(): Scenario[] {
  const out: Scenario[] = [];
  for (const step of spec.steps) {
    if (step.triggers.length > 0) {
      out.push({ scenario: step.id, action: 'pointer', run: { kind: 'toggle', step } });
      for (const key of [...new Set(step.triggers.map((t: { key: string }) => t.key))].sort())
        out.push({ scenario: step.id, action: key, run: { kind: 'toggle', step } });
    } else out.push({ scenario: step.id, action: 'prop', run: { kind: 'prop', step } });
  }
  for (const sc of spec.scenarios.filter((s: { interactive: boolean }) => !s.interactive))
    out.push({
      scenario: `inert fixture ${sc.fixture}`,
      action: 'pointer',
      run: { kind: 'inert', fixture: sc.fixture },
    });
  out.push({
    scenario: 'controlled checked',
    action: 'pointer',
    run: { kind: 'controlled-checked' },
  });
  out.push({
    scenario: 'controlled indeterminate',
    action: 'pointer',
    run: { kind: 'controlled-indeterminate' },
  });
  out.push({ scenario: 'label click toggles', action: 'pointer', run: { kind: 'label' } });
  return out;
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${spec.component} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

/** The paths the Checkbox runs: `support: []` means no capability fallback, so `native` (real detection)
 *  and `fallback:all` (every capability forced false, the floor combination). */
export const paths = () =>
  supportsPaths().filter((p) => (CHECKBOX_PATHS as readonly string[]).includes(p.id));

/** What the matrix MUST contain, derived from the contract, never from results. */
export function checkboxExpected() {
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
    scenarios: checkboxScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: [],
  };
}
