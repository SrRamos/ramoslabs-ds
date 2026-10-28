// SJButton L2 parity-matrix scenarios (W1-C01.f, ADR-013 L2 and L6). The scenario list is derived from the
// contract (`deriveSpec`: which key activates which part) and from `fixtures.js`; the same list feeds the
// Playwright spec and the declaration of what the parity matrix MUST contain, so a declared scenario is a
// scenario that runs (W1-313).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { ADAPTERS, ENGINES, EXECUTED_PATHS } from './fixtures';
import { SUPPORT_KEYS, supportsPaths } from '../../e2e/supports/paths';

const here = dirname(fileURLToPath(import.meta.url));
export const contract = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', 'contracts', 'contracts', 'button.contract.json'),
    'utf8',
  ),
);
export const spec = deriveSpec(contract);
export const COMPONENT: string = spec.component ?? 'SJButton';

export { ADAPTERS, ENGINES, EXECUTED_PATHS };
export type Action = 'pointer' | 'Enter' | 'Space';
export const ACTIONS: readonly Action[] = ['pointer', 'Enter', 'Space'];

/** `press` triggers declared by the contract: part -> keys (from `keyboard`, via deriveSpec). */
export const KEYS: Record<string, string[]> = {};
for (const step of spec.steps) for (const t of step.triggers) (KEYS[t.part] ??= []).push(t.key);

export type Outcome =
  | 'press' // the component reports exactly one `press`
  | 'none' // no `press`
  | 'submit' // one `press` and the browser submits the form once, with the submitter's name/value
  | 'press-no-submit'; // one `press`, the form is NOT submitted (type=button is never an implicit submit)

export interface Scenario {
  /** Matrix `scenario` column. */
  readonly scenario: string;
  readonly fixture: string;
  readonly form: boolean;
  /** Anatomy part that receives the interaction. */
  readonly part: 'root' | 'link';
  readonly action: Action;
  readonly outcome: Outcome;
}

interface Base {
  scenario: string;
  fixture: string;
  form?: boolean;
  part?: 'root' | 'link';
  /** Outcome when the action is a trigger (or the pointer); `none` otherwise. */
  active: Outcome;
  /** Fixture never reports `press`, whatever the action. */
  inert?: boolean;
}

const BASES: Base[] = [
  { scenario: 'default', fixture: 'default', active: 'press' },
  { scenario: 'long-label', fixture: 'long-label', active: 'press' },
  { scenario: 'icon-only', fixture: 'icon-only', active: 'press' },
  { scenario: 'link', fixture: 'link', part: 'link', active: 'press' },
  { scenario: 'disabled', fixture: 'disabled', active: 'none', inert: true },
  { scenario: 'submit in form', fixture: 'submit', form: true, active: 'submit' },
  { scenario: 'type=button in form', fixture: 'default', form: true, active: 'press-no-submit' },
];

/** Every (scenario x action). Key actions are expected to press only when the contract lists them. */
export function buttonScenarios(): Scenario[] {
  const out: Scenario[] = [];
  for (const b of BASES) {
    const part = b.part ?? 'root';
    for (const action of ACTIONS) {
      const triggers = action === 'pointer' || (KEYS[part] ?? []).includes(action);
      out.push({
        scenario: b.scenario,
        fixture: b.fixture,
        form: b.form ?? false,
        part,
        action,
        outcome: b.inert || !triggers ? 'none' : b.active,
      });
    }
  }
  return out;
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${COMPONENT} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

const FLOOR_NOTE = 'real floor lane runs per release (ADR-013); not part of the per-PR run';

/**
 * What the matrix MUST contain, derived from the contract, adapters, engines and `supports` keys; never from
 * results. Floor and device rows are declared `not run` with the ADR-013 reason. The ten single-key forced-false
 * paths are `not-applicable` WITH a reason: SJButton has no `support[]` entry and reads no capability, so a path
 * forcing one key false is the same program as `native`; `fallback:all` forces all ten at once and is executed.
 */
export function buttonExpected() {
  const noBranch = (key: string) => ({
    match: { path: `fallback:${key}` },
    status: 'not-applicable' as const,
    reason: `SJButton declares no support[] entry and reads no capability, so forcing ${key} false equals native; fallback:all forces every key false at once and runs`,
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
    scenarios: buttonScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: SUPPORT_KEYS.map(noBranch),
  };
}
