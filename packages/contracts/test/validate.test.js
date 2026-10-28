import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateContract } from '../scripts/validate.mjs';

const sample = () =>
  JSON.parse(
    readFileSync(new URL('./fixtures/adr-010-sample.contract.json', import.meta.url), 'utf8'),
  );

const paths = (contract) => validateContract(contract).errors.map((e) => e.path);

describe('contract.schema.json v1 validator', () => {
  it('accepts the ADR-010 sample (VoiceOver rows pending-real-test)', () => {
    const result = validateContract(sample());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  const required = [
    '$schema',
    'name',
    'contractVersion',
    'status',
    'pattern',
    'anatomy',
    'state',
    'actions',
    'keyboard',
    'focus',
    'kinds',
    'runtime',
    'support',
    'a11y',
    'events',
    'props',
    'slots',
    'fixtures',
    'budgets',
  ];
  it.each(required)('fails with a path when required field "%s" is removed', (field) => {
    const c = sample();
    delete c[field];
    expect(paths(c)).toContain(`/${field}`);
  });

  it('fails with a path when a nested required field is removed', () => {
    const c = sample();
    delete c.a11y.atSupport[2].evidence;
    expect(paths(c)).toContain('/a11y/atSupport/2/evidence');
  });

  it('G2 freeze: controllable must be a subset of props[].name (seeded)', () => {
    const c = sample();
    c.state.controllable.push('ghost');
    expect(paths(c)).toContain('/state/controllable/2');
  });

  it('G2 freeze: every actions[].emit must name an events[] entry (seeded)', () => {
    const c = sample();
    c.actions[0].emit = 'ghostChange';
    expect(paths(c)).toContain('/actions/0/emit');
  });

  it('G2 freeze: pattern.evidence is required (seeded)', () => {
    const c = sample();
    delete c.pattern.evidence;
    expect(paths(c)).toContain('/pattern/evidence');
  });

  it('G-ICON ruling: no actions is valid only with events: [] (seeded)', () => {
    const c = sample();
    c.actions = [];
    c.state.controllable = [];
    c.events = [{ name: 'ghost', payload: '{}' }];
    expect(paths(c)).toContain('/events');
    c.events = [];
    expect(validateContract(c).errors.map((e) => e.path)).not.toContain('/events');
    expect(paths(c)).not.toContain('/actions');
  });

  it('rejects an unknown top-level field, a wrong $schema URL and a bad name', () => {
    expect(paths({ ...sample(), extra: 1 })).toContain('/extra');
    expect(paths({ ...sample(), $schema: 'https://example.com/x.json' })).toContain('/$schema');
    expect(paths({ ...sample(), name: 'Select' })).toContain('/name');
  });

  it('rejects an unknown status, focus strategy or runtime input', () => {
    const c = sample();
    c.status = 'draft | beta | stable';
    c.focus.strategy = 'both';
    c.runtime.push('clock');
    const p = paths(c);
    expect(p).toContain('/status');
    expect(p).toContain('/focus/strategy');
    expect(p).toContain('/runtime/5');
  });

  it('requires a focus owner for composite strategies', () => {
    const c = sample();
    delete c.focus.owner;
    expect(paths(c)).toContain('/focus/owner');
  });

  describe('AT honesty gate (ADR-010, ADR-015)', () => {
    const vo = (c) => c.a11y.atSupport[0];
    const ev = ['at-support/select-only-combobox.json#vo-macos-safari-webkit231724'];

    it('tested-real without tested_on fails', () => {
      const c = sample();
      Object.assign(vo(c), {
        test_status: 'tested-real',
        evidence: ev,
        log: 'logs/vo-macos-2026-11-02.md',
      });
      expect(paths(c)).toContain('/a11y/atSupport/0/tested_on');
    });

    it('tested-real without a log reference fails', () => {
      const c = sample();
      Object.assign(vo(c), { test_status: 'tested-real', evidence: ev, tested_on: '2026-11-02' });
      expect(paths(c)).toContain('/a11y/atSupport/0/log');
    });

    it('tested-real with date and log passes', () => {
      const c = sample();
      Object.assign(vo(c), {
        test_status: 'tested-real',
        evidence: ev,
        tested_on: '2026-10-27',
        log: 'logs/vo-macos-2026-10-27.md',
      });
      expect(validateContract(c, { today: '2026-10-27' }).errors).toEqual([]);
    });

    it('tested-real on an evidence-only AT (NVDA, JAWS, TalkBack) fails (D2)', () => {
      const c = sample();
      Object.assign(c.a11y.atSupport[2], {
        test_status: 'tested-real',
        tested_on: '2026-10-27',
        log: 'logs/nvda.md',
      });
      expect(paths(c)).toContain('/a11y/atSupport/2/at');
    });

    it('rejects an impossible or future tested_on date', () => {
      const c = sample();
      Object.assign(vo(c), {
        test_status: 'tested-real',
        evidence: ev,
        tested_on: '2026-02-31',
        log: 'l.md',
      });
      expect(paths(c)).toContain('/a11y/atSupport/0/tested_on');
      vo(c).tested_on = '2099-01-01';
      expect(paths(c)).toContain('/a11y/atSupport/0/tested_on');
    });

    it('evidence-only with empty evidence fails; pending-real-test may be empty', () => {
      const c = sample();
      c.a11y.atSupport[2].evidence = [];
      expect(paths(c)).toContain('/a11y/atSupport/2/evidence');
      expect(paths(sample())).toEqual([]);
    });

    it('evidence-only or pending-real-test carrying tested_on or log fails', () => {
      const c = sample();
      c.a11y.atSupport[2].tested_on = '2026-10-27';
      c.a11y.atSupport[0].log = 'l.md';
      const p = paths(c);
      expect(p.some((x) => x.startsWith('/a11y/atSupport/2'))).toBe(true);
      expect(p.some((x) => x.startsWith('/a11y/atSupport/0'))).toBe(true);
    });

    it('rejects a malformed evidence reference', () => {
      const c = sample();
      c.a11y.atSupport[2].evidence = ['select-only-combobox.json'];
      expect(paths(c)).toContain('/a11y/atSupport/2/evidence/0');
    });
  });

  describe('cross-reference rules', () => {
    it('rejects actions to unknown states and unknown anatomy parts', () => {
      const c = sample();
      c.actions[0].to = 'ajar';
      c.keyboard.ghost = { Enter: 'open' };
      c.actions[0].aria.ghost = { 'aria-hidden': 'true' };
      const p = paths(c);
      expect(p).toContain('/actions/0/to');
      expect(p).toContain('/keyboard/ghost');
      expect(p).toContain('/actions/0/aria/ghost');
    });

    it('rejects duplicate anatomy parts and duplicate AT pairings', () => {
      const c = sample();
      c.anatomy.push({ part: 'root', element: 'div' });
      c.a11y.atSupport.push({ ...c.a11y.atSupport[2] });
      const p = paths(c);
      expect(p).toContain('/anatomy/4/part');
      expect(p).toContain('/a11y/atSupport/5');
    });

    it('allows one action id on several rows only when their from differs', () => {
      const c = sample();
      c.actions.push({ ...c.actions[0], from: 'open', to: 'closed' });
      expect(paths(c)).toEqual([]);
      c.actions.push({ ...c.actions[0] });
      expect(paths(c)).toContain('/actions/2/id');
    });
  });
});
