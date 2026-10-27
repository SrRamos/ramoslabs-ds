/* eslint-disable @typescript-eslint/ban-ts-comment -- drives TypeScript harness modules */
// @ts-nocheck -- drives TypeScript runner modules.
// Unit tests for the pure parts of the supports injector (W1-309b). The browser run is
// `bun run test:e2e:supports`.
import { describe, expect, it } from 'vitest';
import { detectSupports } from './detect.ts';
import { injectionProblems } from './injection.ts';
import { NATIVE, SUPPORT_KEYS, applyPath, isNoop, parsePath, supportsPaths } from './paths.ts';
import { probeExpected, probeScenarios } from './probe-matrix.ts';
import config, { SUPPORTS_RESULTS } from './playwright.config.ts';

const allTrue = Object.fromEntries(SUPPORT_KEYS.map((k) => [k, true]));
const allFalse = Object.fromEntries(SUPPORT_KEYS.map((k) => [k, false]));

describe('paths', () => {
  it('has the ten core keys and one native plus ten fallback paths', () => {
    expect(SUPPORT_KEYS).toHaveLength(10);
    const ps = supportsPaths();
    expect(ps).toHaveLength(11);
    expect(ps[0]).toEqual({ id: NATIVE, forced: [] });
    expect(new Set(ps.map((p) => p.id)).size).toBe(11);
    expect(ps[1].id).toBe('fallback:anchorPositioning');
  });
  it('round-trips ids and rejects unknown ones', () => {
    for (const p of supportsPaths()) expect(parsePath(p.id)).toEqual(p);
    expect(() => parsePath('fallback:nope')).toThrow(/unknown supports path/);
    expect(() => parsePath('floor')).toThrow(/unknown/);
  });
  it('forces exactly one key false and leaves the rest as detected', () => {
    for (const p of supportsPaths().slice(1)) {
      const eff = applyPath(allTrue, p);
      expect(SUPPORT_KEYS.filter((k) => !eff[k])).toEqual(p.forced);
    }
    expect(applyPath(allTrue, parsePath(NATIVE))).toEqual(allTrue);
    expect(Object.isFrozen(applyPath(allTrue, parsePath('fallback:popover')))).toBe(true);
  });
  it('flags a forced-false path the engine already lacks', () => {
    const p = parsePath('fallback:popover');
    expect(isNoop(allFalse, p)).toBe(true);
    expect(isNoop(allTrue, p)).toBe(false);
    expect(isNoop(allTrue, parsePath(NATIVE))).toBe(true);
  });
});

describe('detectSupports', () => {
  const proto = (props) => ({ prototype: Object.fromEntries(props.map((p) => [p, null])) });
  const full = {
    CSS: { supports: () => true },
    HTMLElement: proto(['popover']),
    HTMLDialogElement: proto(['requestClose']),
    HTMLButtonElement: proto(['commandForElement']),
    HTMLDetailsElement: proto(['name']),
    document: { startViewTransition() {} },
    scheduler: { yield() {} },
    Intl: { Locale: proto(['getWeekInfo']) },
  };
  it('is all true on a fully capable environment and all false on an empty one', () => {
    expect(detectSupports(full)).toEqual(allTrue);
    expect(detectSupports({})).toEqual(allFalse);
  });
  it('detects each key independently', () => {
    for (const k of SUPPORT_KEYS) {
      const env = {
        ...full,
        ...{
          anchorPositioning: { CSS: { supports: (c) => !c.includes('anchor') } },
          popover: { HTMLElement: proto([]) },
          dialogRequestClose: { HTMLDialogElement: proto([]) },
          invokerCommands: { HTMLButtonElement: proto([]) },
          detailsName: { HTMLDetailsElement: proto([]) },
          userInvalid: { CSS: { supports: (c) => !c.includes('user-invalid') } },
          viewTransitions: { document: {} },
          schedulerYield: { scheduler: {} },
          weekInfo: { Intl: { Locale: proto([]) } },
          focusVisible: { CSS: { supports: (c) => !c.includes('focus-visible') } },
        }[k],
      };
      const got = detectSupports(env);
      expect(
        SUPPORT_KEYS.filter((x) => !got[x]),
        k,
      ).toEqual([k]);
    }
  });
  it('accepts the weekInfo getter spelling and survives a throwing probe', () => {
    expect(detectSupports({ ...full, Intl: { Locale: proto(['weekInfo']) } }).weekInfo).toBe(true);
    const throwing = {
      ...full,
      CSS: {
        supports: () => {
          throw new Error('x');
        },
      },
    };
    const got = detectSupports(throwing);
    expect(got.anchorPositioning).toBe(false);
    expect(got.popover).toBe(true);
  });
});

describe('injectionProblems', () => {
  const real = { ...allTrue, popover: false };
  it('accepts the exact effective map', () => {
    for (const p of supportsPaths())
      expect(injectionProblems(real, applyPath(real, p), p)).toEqual([]);
  });
  it('SEEDED: an injector that ignores the path is reported', () => {
    const p = parsePath('fallback:viewTransitions');
    const problems = injectionProblems(real, real, p);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /viewTransitions: runtime has true, path "fallback:viewTransitions" requires false/,
    );
  });
  it('SEEDED: forcing the wrong key, leaking a forced key, extra keys and no read-back are reported', () => {
    const p = parsePath('fallback:weekInfo');
    expect(
      injectionProblems(real, applyPath(real, parsePath('fallback:focusVisible')), p).length,
    ).toBe(2);
    expect(injectionProblems(real, { ...applyPath(real, p), bogus: true }, p)[0]).toMatch(
      /unexpected keys/,
    );
    expect(injectionProblems(real, null, p)).toEqual(['adapter runtime was never read back']);
  });
});

describe('probe declaration and config', () => {
  it('declares 11 paths x 3 adapters x 3 engines of every scenario, from the contract', () => {
    const e = probeExpected();
    expect(e.paths).toHaveLength(11);
    expect(e.adapters).toEqual(['react', 'vue', 'vanilla']);
    expect(e.browsers.slice(0, 3).map((b) => b.id)).toEqual(['chromium', 'firefox', 'webkit']);
    expect(e.scenarios).toHaveLength(probeScenarios().length);
    expect(e.scenarios.length).toBeGreaterThanOrEqual(8);
  });
  it('declares floor and device rows as not run with a reason', () => {
    const e = probeExpected();
    for (const b of e.browsers.slice(3)) {
      expect(b.status).toBe('not-run');
      expect(b.reason.length).toBeGreaterThan(10);
    }
  });
  it('keeps retries: 0 and a manifest-safe results file', () => {
    expect(config.retries).toBe(0);
    expect(SUPPORTS_RESULTS).toBe('e2e-supports-results.json');
  });
});
