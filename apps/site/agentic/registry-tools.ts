// Read-only lookups over registry.json for the MCP tools get_component, list_components and
// get_kind (W1-306). Pure functions of the registry object: every value returned is copied from
// it, nothing is computed or defaulted (ADR-010, ADR-015 honesty). `test_status` is passed
// through verbatim for each AT row.
import type { RegistryComponent, RegistryKinds, KindRow } from './registry';

export type Registry = {
  components: RegistryComponent[];
  kinds: RegistryKinds | null;
};

export type Lookup<T> = { ok: true; value: T } | { ok: false; message: string };

/** Names compare case-insensitively; `SJButton`, `sjbutton` and `button` all name the same row. */
function normName(name: string): string {
  return name.trim().toLowerCase().replace(/^sj/, '');
}

export function listComponents(reg: Registry) {
  return {
    count: reg.components.length,
    components: reg.components.map((c) => ({
      name: c.name,
      slug: c.slug,
      status: c.status,
      pattern: c.pattern.apg,
      roles: c.roles,
      atSupport: c.atSupport.map((r) => ({
        at: r.at,
        platform: r.platform,
        browser: r.browser,
        test_status: r.test_status,
        ...(r.tested_on === undefined ? {} : { tested_on: r.tested_on }),
        ...(r.log === undefined ? {} : { log: r.log }),
        statement: r.statement,
      })),
    })),
  };
}

export function getComponent(reg: Registry, name: unknown): Lookup<RegistryComponent> {
  const want = normName(String(name ?? ''));
  if (!want) return { ok: false, message: 'Provide a component name. Call list_components.' };
  const hit = reg.components.find((c) => normName(c.name) === want || c.slug === want);
  if (hit) return { ok: true, value: hit };
  const known = reg.components.map((c) => c.name).join(', ') || 'none yet';
  return {
    ok: false,
    message: `No component named "${String(name)}" in the registry (known: ${known}). Do not invent one; call list_components.`,
  };
}

export function getKind(
  reg: Registry,
  name: unknown,
): Lookup<{ kind: KindRow; rules: RegistryKinds['rules'] }> {
  if (!reg.kinds) return { ok: false, message: 'The registry holds no kinds.' };
  const want = String(name ?? '')
    .trim()
    .toLowerCase();
  if (!want) return { ok: false, message: 'Provide a kind name, e.g. "email".' };
  const hit = reg.kinds.items.find((k) => k.kind === want);
  if (hit) return { ok: true, value: { kind: hit, rules: reg.kinds.rules } };
  const known = reg.kinds.items.map((k) => k.kind).join(', ');
  return {
    ok: false,
    message: `No kind named "${String(name)}" in the registry (known: ${known}). Do not invent one.`,
  };
}
