// W1-305 / W1-306 at L1: the registry projection and the MCP lookups answer only from the
// contracts (no invented values), and expose test_status verbatim (ADR-010, ADR-015).
import fs from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildComponents, buildKinds, slugOf } from '../../../../apps/site/agentic/registry';
import {
  getComponent,
  getKind,
  listComponents,
} from '../../../../apps/site/agentic/registry-tools';
import { loadContracts } from './index.js';

const dir = path.resolve(import.meta.dirname, '../../../contracts/contracts');
const { contracts, kinds } = loadContracts(dir);
const kindsJson = JSON.parse(fs.readFileSync(path.join(dir, 'kinds.contract.json'), 'utf8'));
const components = buildComponents(contracts.map((c) => c.json));
const reg = { components, kinds: buildKinds(kindsJson) };

describe('registry from contracts', () => {
  it('has one component per contract, name-sorted, with the ADR-010 fields', () => {
    expect(components.map((c) => c.name)).toEqual(contracts.map((c) => c.json.name).sort());
    for (const c of components) {
      for (const k of [
        'name',
        'status',
        'anatomy',
        'roles',
        'keyboard',
        'kinds',
        'supportFloor',
        'atSupport',
        'docs',
      ])
        expect(c, k).toHaveProperty(k);
    }
  });
  it('copies test_status, evidence and dates verbatim, never upgrading them', () => {
    for (const c of contracts) {
      const out = components.find((x) => x.name === c.json.name);
      expect(out?.atSupport).toEqual(c.json.a11y.atSupport);
    }
    // evidence-only stays evidence-only (ADR-015)
    expect(
      components.flatMap((c) => c.atSupport).some((r) => r.test_status === 'evidence-only'),
    ).toBe(true);
  });
  it('docs are empty when no page exists, and come only from the supplied links', () => {
    expect(components.every((c) => c.docs.length === 0)).toBe(true);
    const withDoc = buildComponents(
      contracts.map((c) => c.json),
      { button: [{ title: 'Button', url: 'https://x/components/button/' }] },
    );
    expect(withDoc.find((c) => c.slug === 'button')?.docs).toHaveLength(1);
  });
  it('kinds carry all rows', () => {
    expect(reg.kinds?.items.length).toBe(kinds.length);
    expect(buildKinds(null)).toBeNull();
  });
  it('slugOf follows the class-name convention', () => {
    expect(slugOf('SJSelect')).toBe('select');
    expect(slugOf('SJDatePicker')).toBe('date-picker');
  });
});

describe('MCP lookups', () => {
  it('list_components mirrors the registry', () => {
    const l = listComponents(reg);
    expect(l.count).toBe(components.length);
    expect(l.components[0]?.atSupport[0]).toHaveProperty('test_status');
  });
  it('get_component finds by name, slug, case and SJ prefix', () => {
    for (const q of ['SJSwitch', 'switch', 'SWITCH', 'sjswitch', ' switch ']) {
      const r = getComponent(reg, q);
      expect(r.ok, q).toBe(true);
      if (r.ok) expect(r.value.name).toBe('SJSwitch');
    }
  });
  it('get_component returns not-found for an unknown or empty name', () => {
    for (const q of ['SJNope', '', undefined, null, 42, 'swit', 'but']) {
      const r = getComponent(reg, q);
      expect(r.ok, String(q)).toBe(false);
    }
    const r = getComponent(reg, 'SJNope');
    if (!r.ok) expect(r.message).toContain('SJButton');
  });
  it('property: a result is always a registry entry, never an invented one', () => {
    const names = new Set(components.flatMap((c) => [c.name.toLowerCase(), c.slug]));
    fc.assert(
      fc.property(fc.string(), (q) => {
        const r = getComponent(reg, q);
        const key = q.trim().toLowerCase().replace(/^sj/, '');
        if (r.ok) {
          expect(components).toContain(r.value);
        } else {
          expect(names.has(key) || names.has('sj' + key)).toBe(false);
        }
      }),
    );
  });
  it('get_kind returns the row and the rules, not-found otherwise', () => {
    const r = getKind(reg, 'Email');
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.value.kind).toEqual(
        kinds.find((/** @type {{ kind: string }} */ k) => k.kind === 'email'),
      );
    expect(getKind(reg, 'emial').ok).toBe(false);
    expect(getKind(reg, '').ok).toBe(false);
    expect(getKind({ components, kinds: null }, 'email').ok).toBe(false);
  });
});
