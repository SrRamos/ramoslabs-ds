// Registry projection of the component contracts (W1-305, ADR-010).
// Pure and fs-free: the integration loads the JSON, this module shapes it. The worker (MCP) and
// the lint tests import the same types, so `registry.json` has one definition.

import { atWording } from '../../../packages/contracts/scripts/at-wording.mjs';

export type AnatomyPart = {
  part: string;
  element: string;
  role?: string;
  native?: boolean;
  attributes?: Record<string, string>;
};

export type AtRow = {
  at: string;
  platform: string;
  browser: string;
  test_status: 'tested-real' | 'evidence-only' | 'pending-real-test';
  tested_on?: string;
  log?: string;
  evidence: string[];
};
/** An atSupport row as registry.json prints it: the contract row plus the only permitted wording. */
export type AtRowOut = AtRow & { statement: string };

export type SupportRow = { feature: string; nativeFrom: unknown; fallbackUntil?: unknown };

/** The fields of a `*.contract.json` the registry reads (the schema is the full definition). */
export type ContractJson = {
  name: string;
  contractVersion: string;
  status: 'draft' | 'beta' | 'stable';
  pattern: { apg: string; evidence?: string; native?: string };
  anatomy: AnatomyPart[];
  state: { machine: string[]; controllable: string[] };
  keyboard: Record<string, Record<string, string>>;
  kinds: string[];
  support: SupportRow[];
  a11y: { atSupport: AtRow[] };
};

export type KindRow = { kind: string; [field: string]: unknown };

export type KindsContractJson = {
  contractVersion: string;
  kinds: KindRow[];
  rules: Array<{ id: string; text: string }>;
  certification: Record<string, unknown>;
};

export type DocLink = { title: string; url: string };

export type RegistryComponent = {
  name: string;
  slug: string;
  contractVersion: string;
  status: ContractJson['status'];
  pattern: ContractJson['pattern'];
  anatomy: AnatomyPart[];
  roles: string[];
  state: ContractJson['state'];
  keyboard: ContractJson['keyboard'];
  kinds: string[];
  supportFloor: SupportRow[];
  atSupport: AtRowOut[];
  docs: DocLink[];
};

export type RegistryKinds = {
  contractVersion: string;
  items: KindRow[];
  rules: KindsContractJson['rules'];
  certification: KindsContractJson['certification'];
};

/** `SJSelect` -> `select`, `SJDatePicker` -> `date-picker`. The class/hook name source. */
export function slugOf(name: string): string {
  return name
    .replace(/^SJ/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * `docLinks` are the site pages that document a component, keyed by slug. Nothing is invented:
 * a component with no page has `docs: []`.
 */
export function buildComponents(
  contracts: ContractJson[],
  docLinks: Record<string, DocLink[]> = {},
): RegistryComponent[] {
  return [...contracts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const slug = slugOf(c.name);
      return {
        name: c.name,
        slug,
        contractVersion: c.contractVersion,
        status: c.status,
        pattern: c.pattern,
        anatomy: c.anatomy,
        roles: [...new Set(c.anatomy.flatMap((p) => (p.role ? [p.role] : [])))],
        state: c.state,
        keyboard: c.keyboard,
        kinds: c.kinds,
        supportFloor: c.support,
        atSupport: c.a11y.atSupport.map((r) => ({
          at: r.at,
          platform: r.platform,
          browser: r.browser,
          test_status: r.test_status,
          ...(r.tested_on === undefined ? {} : { tested_on: r.tested_on }),
          ...(r.log === undefined ? {} : { log: r.log }),
          evidence: r.evidence,
          statement: atWording(r),
        })),
        docs: docLinks[slug] ?? [],
      };
    });
}

export function buildKinds(kinds: KindsContractJson | null): RegistryKinds | null {
  if (!kinds) return null;
  return {
    contractVersion: kinds.contractVersion,
    items: kinds.kinds,
    rules: kinds.rules,
    certification: kinds.certification,
  };
}

/** The `$id` URLs the integration serves under /schema/. */
export const SCHEMA_FILES = {
  'contract.v1.json': 'contract.schema.json',
  'kinds.v1.json': 'kinds.schema.json',
  'at-support.v1.json': 'at-support.schema.json',
} as const;
