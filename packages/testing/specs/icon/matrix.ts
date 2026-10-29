// SJIcon L2 parity-matrix scenarios (W1-C12.f, ADR-013 L2 and L6). SJIcon has no actions and no events
// (ADR-010 G-ICON ruling: `actions: []`, `events: []`), so `deriveSpec` yields no steps. Left alone, L2 would have
// no tests and the parity matrix would have empty cells (ADR-013 L6). So each fixture declares ONE `render`
// action with outcome `none` (PLAN-ICONS row .f, NICE-5): the scenario mounts the fixture on every adapter and
// path and asserts what the contract promises (markup, role, size, mirror), and nothing is ever pressed.
// The same list feeds the Playwright spec and the declaration of what the parity matrix MUST contain (W1-313).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { ADAPTERS, ENGINES, EXECUTED_PATHS, FIXTURES } from './fixtures';
import { SUPPORT_KEYS, supportsPaths } from '../../e2e/supports/paths';

const here = dirname(fileURLToPath(import.meta.url));
export const contract = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', 'contracts', 'contracts', 'icon.contract.json'),
    'utf8',
  ),
);
export const spec = deriveSpec(contract);
export const COMPONENT: string = spec.component ?? 'SJIcon';

export { ADAPTERS, ENGINES, EXECUTED_PATHS };
export type Action = 'render';
export const ACTIONS: readonly Action[] = ['render'];

/** The contract declares no action; a fixture that gained one would make `deriveSpec` produce steps. */
export const DECLARED_ACTIONS: readonly string[] = spec.steps.flatMap((s) => s.triggers.map((t: { key: string }) => t.key));

export type Outcome = 'none';

export interface Scenario {
  /** Matrix `scenario` column: the fixture name. */
  readonly scenario: string;
  readonly fixture: string;
  readonly action: Action;
  readonly outcome: Outcome;
}

/** One `render` scenario per fixture (the contract's, then the conformance-only extras). */
export function iconScenarios(): Scenario[] {
  return Object.keys(FIXTURES).map((fixture) => ({
    scenario: fixture,
    fixture,
    action: 'render' as const,
    outcome: 'none' as const,
  }));
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${COMPONENT} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

const FLOOR_NOTE = 'real floor lane runs per release (ADR-013); not part of the per-PR run';

/**
 * What the matrix MUST contain, derived from the contract, adapters, engines and `supports` keys; never from
 * results. Floor and device rows are declared `not run` with the ADR-013 reason. The ten single-key forced-false
 * paths are `not-applicable` WITH a reason: SJIcon declares `support: []` and reads no capability (only `dir`,
 * which is not a capability), so a path forcing one key false is the same program as `native`; `fallback:all`
 * forces all ten at once and is executed.
 */
export function iconExpected() {
  const noBranch = (key: string) => ({
    match: { path: `fallback:${key}` },
    status: 'not-applicable' as const,
    reason: `SJIcon declares no support[] entry and reads no capability, so forcing ${key} false equals native; fallback:all forces every key false at once and runs`,
  });
  return {
    version: 1,
    component: COMPONENT,
    browsers: [
      ...ENGINES.map((id) => ({ id })),
      { id: 'chromium-114', status: 'not-run', reason: FLOOR_NOTE },
      { id: 'firefox-125', status: 'not-run', reason: FLOOR_NOTE },
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
    scenarios: iconScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: SUPPORT_KEYS.map(noBranch),
  };
}
