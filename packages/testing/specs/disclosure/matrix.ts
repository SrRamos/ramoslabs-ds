// The SJDisclosure L2 scenario list and the parity declaration (W1-C06.f, ADR-013 L2 + L6). One list feeds the
// Playwright spec and the expected-matrix declaration, so a declared scenario is a scenario that runs and a
// missing cell is a failure, never an inference. The scenarios are derived from the contract's steps: a
// `toggle` step is operated by pointer and by each of its keyboard triggers; `open` and `close` have no user
// trigger (the owner drives them), so they run as a controlled prop. The exclusive-group scenarios run on both
// supports paths: `native` (real detection) and `fallback:all` (every capability forced false, so
// `detailsName` is false and the owned fallback is the code that runs).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { l2Plan } from '../../spec/reducer/index.js';
import { supportsPaths } from '../../e2e/supports/paths';
import { ADAPTERS, DISCLOSURE_PATHS, ENGINES, FIXTURES } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
export const contract = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', 'contracts', 'contracts', 'disclosure.contract.json'),
    'utf8',
  ),
);
export const spec = deriveSpec(contract);
export const plan = l2Plan(spec);
export { ADAPTERS, FIXTURES };

export type Step = (typeof spec.steps)[number];

export type GroupKind = 'pointer' | 'controlled' | 'programmatic' | 'rejected';
export type ScenarioKind =
  | { kind: 'toggle'; step: Step }
  | { kind: 'prop'; step: Step }
  | { kind: 'inert'; fixture: string }
  | { kind: 'controlled-open' }
  | { kind: 'group'; group: GroupKind };

export interface Scenario {
  readonly scenario: string;
  readonly action: string;
  readonly run: ScenarioKind;
}

/** `data-state` of a machine position. */
export const dataStateOf = (position: string): 'open' | 'closed' =>
  position === 'open' ? 'open' : 'closed';
export const openOf = (position: string): boolean => position === 'open';

/** Every step by pointer and by its keyboard trigger (toggle), or by prop (the owner-driven steps), plus the
 *  inert fixtures, the controlled field and the four exclusive-group paths (pointer, controlled member,
 *  programmatic open, rejected open). */
export function disclosureScenarios(): Scenario[] {
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
  out.push({ scenario: 'controlled open', action: 'pointer', run: { kind: 'controlled-open' } });
  const groups: [string, GroupKind, string][] = [
    ['exclusive group', 'pointer', 'pointer'],
    ['exclusive group controlled member', 'controlled', 'pointer'],
    ['exclusive group programmatic open', 'programmatic', 'script'],
    ['exclusive group rejected open', 'rejected', 'pointer'],
  ];
  for (const [scenario, group, action] of groups)
    out.push({ scenario, action, run: { kind: 'group', group } });
  return out;
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${spec.component} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

/** The paths the Disclosure runs: `native` (real detection) and `fallback:all` (every capability forced false,
 *  `detailsName` included). The single-key path `fallback:detailsName` equals `fallback:all` for this
 *  component, which reads no other capability. */
export const paths = () =>
  supportsPaths().filter((p) => (DISCLOSURE_PATHS as readonly string[]).includes(p.id));

/** What the matrix MUST contain, derived from the contract, never from results. */
export function disclosureExpected() {
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
    scenarios: disclosureScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: [],
  };
}
