import { describe, expect, it } from 'vitest';
import { createFakeScheduler } from '../runtime';
import { HIDDEN_STYLE, createLiveRegistry, type LiveHost, type LiveRole } from './index';

function setup() {
  const s = createFakeScheduler();
  const created: LiveRole[] = [];
  const text: Record<string, string> = {};
  const writes: string[] = [];
  const host: LiveHost = {
    create(role) {
      created.push(role);
      return { setText: (t) => ((text[role] = t), t && writes.push(`${role}:${t}`)) };
    },
  };
  const r = createLiveRegistry(s);
  const go = () => (s.flush(), undefined);
  return { s, r, host, created, text, writes, go };
}

describe('live-region registry (W1-111, ADR-006)', () => {
  it('G1 MUST-3: HIDDEN_STYLE hides visually without display/visibility (SR-exposed)', () => {
    for (const p of ['position:absolute', 'width:1px', 'height:1px', 'overflow:hidden'])
      expect(HIDDEN_STYLE).toContain(p);
    expect(HIDDEN_STYLE).not.toMatch(/display:|visibility:/);
  });

  it('server: no markup and no announcement before attach', () => {
    const t = setup();
    expect(t.r.announce('3 results')).toBe(false);
    t.go();
    expect(t.created).toEqual([]);
    expect(t.writes).toEqual([]);
  });

  it('attach creates one persistent status node; alert only on explicit urgent', () => {
    const t = setup();
    t.r.attach(t.host);
    expect(t.created).toEqual(['status']);
    t.r.announce('3 results');
    t.go();
    expect(t.text.status).toBe('3 results');
    expect(t.created).toEqual(['status']);
    t.r.announce('Failed', { urgent: true });
    t.go();
    expect(t.created).toEqual(['status', 'alert']);
    expect(t.text.alert).toBe('Failed');
  });

  it('dedupes an identical message until the region clears, then allows it again', () => {
    const t = setup();
    t.r.attach(t.host);
    expect(t.r.announce('Saved')).toBe(true);
    expect(t.r.announce('Saved')).toBe(false);
    t.go();
    t.s.advance(1000);
    expect(t.text.status).toBe('');
    expect(t.r.announce('Saved')).toBe(true);
    t.go();
    expect(t.writes).toEqual(['status:Saved', 'status:Saved']);
  });

  it('never announces an active-descendant move twice', () => {
    const t = setup();
    t.r.attach(t.host);
    expect(t.r.announce('Option 2, 2 of 5', { activeDescendant: true })).toBe(false);
    t.r.noteActive('Option 2');
    expect(t.r.announce('Option 2')).toBe(false);
    t.go();
    expect(t.writes).toEqual([]);
  });

  it('latest message wins and detach resets', () => {
    const t = setup();
    t.r.attach(t.host);
    t.r.announce('a');
    t.r.announce('b');
    t.go();
    expect(t.writes).toEqual(['status:b']);
    t.r.detach();
    expect(t.r.announce('c')).toBe(false);
  });
});
