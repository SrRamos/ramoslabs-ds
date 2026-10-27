import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ANCHOR_PROPERTIES,
  SUPPORT_KEYS,
  createFakeScheduler,
  createRuntime,
  detectAnchorPositioning,
  platformScheduler,
  serializeRuntime,
  withSupports,
} from './index';

describe('createRuntime (W1-103, ADR-003)', () => {
  it('server defaults: all-false supports, fake scheduler, fixed locale/dir', () => {
    const r = createRuntime();
    expect(Object.keys(r.supports).sort()).toEqual([...SUPPORT_KEYS].sort());
    expect(Object.values(r.supports).every((v) => v === false)).toBe(true);
    expect(r.scheduler).not.toBe(platformScheduler);
    expect([r.locale, r.dir, r.idPrefix, r.density]).toEqual(['en', 'ltr', '', 'touch']);
    expect(Object.isFrozen(r) && Object.isFrozen(r.supports)).toBe(true);
  });

  it('client target uses platform timers', () => {
    expect(createRuntime({ target: 'client' }).scheduler).toBe(platformScheduler);
  });

  it('runtimes are isolated: schedulers, supports and ids share nothing', () => {
    const a = createRuntime();
    const b = createRuntime();
    expect(a.scheduler).not.toBe(b.scheduler);
    expect(a.supports).not.toBe(b.supports);
    const ran: number[] = [];
    a.scheduler.after(() => ran.push(1), 5);
    (b.scheduler as ReturnType<typeof createFakeScheduler>).advance(10);
    expect(ran).toEqual([]);
    (a.scheduler as ReturnType<typeof createFakeScheduler>).advance(10);
    expect(ran).toEqual([1]);
  });

  it('does not alias caller input', () => {
    const supports = { popover: true };
    const r = createRuntime({ supports });
    supports.popover = false;
    expect(r.supports.popover).toBe(true);
  });

  it('server defaults equal serialized client values (property)', () => {
    const arb = fc.record({
      locale: fc.constantFrom('en', 'es-CO', 'ar', 'he-IL'),
      dir: fc.constantFrom('ltr' as const, 'rtl' as const),
      idPrefix: fc.string({ maxLength: 6 }),
      density: fc.constantFrom('touch' as const, 'compact' as const),
    });
    fc.assert(
      fc.property(arb, (cfg) => {
        const server = createRuntime(cfg);
        const wire = JSON.parse(JSON.stringify(serializeRuntime(server)));
        const client = createRuntime({ ...wire, target: 'client' });
        expect(serializeRuntime(client)).toEqual(serializeRuntime(server));
      }),
    );
  });

  it('withSupports returns a new runtime and leaves the original untouched', () => {
    const r = createRuntime({ locale: 'es' });
    const r2 = withSupports(r, { anchorPositioning: true });
    expect(r.supports.anchorPositioning).toBe(false);
    expect(r2.supports.anchorPositioning).toBe(true);
    expect(r2.locale).toBe('es');
  });

  it('keeps an injected idFactory and omits the key otherwise', () => {
    const f = () => 'id';
    expect(createRuntime({ idFactory: f }).idFactory).toBe(f);
    expect('idFactory' in createRuntime()).toBe(false);
  });

  it('creating a runtime reads no navigator/document/documentElement', () => {
    const trap = {
      get: () => {
        throw new Error('ambient read');
      },
    };
    for (const k of ['navigator', 'document'])
      Object.defineProperty(globalThis, k, { ...trap, configurable: true });
    try {
      expect(() =>
        withSupports(createRuntime({ target: 'client' }), { popover: true }),
      ).not.toThrow();
    } finally {
      for (const k of ['navigator', 'document']) delete (globalThis as Record<string, unknown>)[k];
    }
  });

  it('fake scheduler: ordered timers, cancel, soon queue, virtual time', () => {
    const s = createFakeScheduler();
    const out: string[] = [];
    s.after(() => out.push('b'), 20);
    s.after(() => out.push('a'), 10);
    const cancel = s.after(() => out.push('x'), 15);
    cancel();
    s.soon(() => out.push('s'));
    expect(s.pending).toBe(3);
    s.flush();
    s.advance(25);
    expect(out).toEqual(['s', 'a', 'b']);
    expect(s.pending).toBe(0);
  });

  it('platform scheduler delegates to host timers at call time', async () => {
    let fired = 0;
    const cancel = platformScheduler.after(() => fired++, 1000);
    cancel();
    await new Promise<void>((r) => platformScheduler.soon(r));
    expect(fired).toBe(0);
  });
});

describe('anchorPositioning detection (G1 SHOULD-2)', () => {
  const engine = (missing: string[]) => (p: string) => !missing.includes(p);
  it('is true only when every emitted anchor property passes', () => {
    expect(ANCHOR_PROPERTIES.map(([p]) => p)).toEqual([
      'anchor-name',
      'position-area',
      'position-try-fallbacks',
      'position-try-order',
      'position-visibility',
    ]);
    expect(detectAnchorPositioning(engine([]))).toBe(true);
  });
  it('Chromium-125-like (core anchors, no position-area) is false', () => {
    expect(detectAnchorPositioning(engine(['position-area']))).toBe(false);
  });
  it.each(ANCHOR_PROPERTIES.map(([p]) => p))('missing %s is false', (p) => {
    expect(detectAnchorPositioning(engine([p]))).toBe(false);
  });
});

describe('undefined supports entries (G1 NICE-3)', () => {
  it('createRuntime and withSupports drop undefined, keeping booleans', () => {
    const r = createRuntime({ supports: { popover: undefined, weekInfo: true } });
    expect(r.supports.popover).toBe(false);
    expect(r.supports.weekInfo).toBe(true);
    expect(withSupports(r, { weekInfo: undefined }).supports.weekInfo).toBe(true);
    expect(Object.values(r.supports).every((v) => typeof v === 'boolean')).toBe(true);
  });
});
