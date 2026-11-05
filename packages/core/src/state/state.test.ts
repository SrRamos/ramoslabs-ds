import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import contract from '../../../contracts/contracts/state.contract.json';
import { stateLive, stateMachine } from '../generated/state/index';
import { createState } from './index';
import { reduce, reducerEvents } from './reducer';
import type { StateProps, StateVariant } from './index';

declare const console: { warn(m: string): void };
const variants: StateVariant[] = ['first-use', 'no-results', 'cleared', 'loading', 'error'];
const mk = (props: StateProps = {}) => createState(() => props);
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => vi.restoreAllMocks());

describe('contract', () => {
  it('one idle state, no actions or events; reducer is a no-op', () => {
    expect(contract.actions).toEqual([]);
    expect(contract.events).toEqual([]);
    expect(stateMachine.states).toEqual(['idle']);
    expect([...reducerEvents]).toEqual([]);
    expect(reduce('idle')).toBe('idle');
  });
  it('declares both live regions, so codegen derives live: eager', () => {
    expect(contract.a11y.liveRegions.map((r) => r.politeness)).toEqual(['polite', 'assertive']);
    expect(stateLive).toBe('eager');
  });
  it('variant prop type lists exactly the five variants', () => {
    const union = (
      contract.props.find((p) => p.name === 'variant')!.type.match(/'([^']+)'/g) ?? []
    ).map((s) => s.slice(1, -1));
    expect(union).toEqual(variants);
  });
});

describe('variants', () => {
  it('each variant is distinct on every part, default and unknown are first-use', () => {
    for (const v of variants) {
      const s = mk({ variant: v, heading: 't' });
      for (const bag of [
        s.getRootProps(),
        s.getIconProps(),
        s.getTitleProps(),
        s.getActionsProps(),
      ])
        expect(bag['data-variant']).toBe(v);
    }
    expect(mk().getRootProps()['data-variant']).toBe('first-use');
    spyWarn();
    expect(mk({ variant: 'done' as never }).getRootProps()['data-variant']).toBe('first-use');
  });
  it('unknown variant warns in dev only', () => {
    const warn = spyWarn();
    mk({ variant: 'x' as never }).getRootProps();
    expect(warn).toHaveBeenCalledTimes(1);
    vi.stubEnv('NODE_ENV', 'production');
    mk({ variant: 'x' as never }).getRootProps();
    vi.unstubAllEnvs();
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('aria-busy only while loading; icon is always decorative', () => {
    for (const v of variants)
      expect(mk({ variant: v }).getRootProps()['aria-busy']).toBe(
        v === 'loading' ? 'true' : undefined,
      );
    expect(mk().getIconProps()['aria-hidden']).toBe('true');
    expect(mk().getIconProps({ 'aria-hidden': 'false' })['aria-hidden']).toBe('true');
  });
});

describe('no live markup at render (SSR)', () => {
  it('root never carries role or aria-live, even when a consumer spreads them', () => {
    const warn = spyWarn();
    for (const v of variants) {
      const bag = mk({ variant: v }).getRootProps({
        role: 'alert',
        'aria-live': 'assertive',
        'aria-atomic': 'true',
      });
      for (const k of ['role', 'aria-live', 'aria-atomic']) expect(bag[k]).toBeUndefined();
    }
    expect(warn).toHaveBeenCalled();
  });
  it('class merges, other consumer attributes pass through', () => {
    const bag = mk().getRootProps({ class: 'mine', 'data-test': 'k' });
    expect(bag).toMatchObject({ class: 'sj-state mine', 'data-part': 'root', 'data-test': 'k' });
    expect(mk().getTitleProps()).toMatchObject({ class: 'sj-state__title', 'data-part': 'title' });
  });
});

describe('getAnnouncement', () => {
  it('loading, no-results and error announce the title politely by default', () => {
    for (const v of ['loading', 'no-results', 'error'] as const)
      expect(mk({ variant: v, heading: ' Hello ' }).getAnnouncement()).toEqual({
        text: 'Hello',
        urgent: false,
      });
  });
  it('first-use and cleared are static: silent unless announce is given', () => {
    for (const v of ['first-use', 'cleared'] as const) {
      expect(mk({ variant: v, heading: 'T' }).getAnnouncement()).toBeUndefined();
      expect(mk({ variant: v, heading: 'T', announce: 'Done' }).getAnnouncement()).toEqual({
        text: 'Done',
        urgent: false,
      });
    }
  });
  it('announce overrides title; empty or missing text is silent', () => {
    expect(
      mk({ variant: 'loading', heading: 'T', announce: '12 results' }).getAnnouncement()?.text,
    ).toBe('12 results');
    expect(
      mk({ variant: 'loading', heading: 'T', announce: '  ' }).getAnnouncement(),
    ).toBeUndefined();
    expect(mk({ variant: 'loading' }).getAnnouncement()).toBeUndefined();
  });
  it('alert (urgent) only for an interrupting error', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StateVariant>(...variants),
        fc.boolean(),
        fc.string({ minLength: 1 }).filter((t) => t.trim() !== ''),
        (variant, interrupt, announce) => {
          const a = mk({ variant, interrupt, announce }).getAnnouncement();
          expect(a?.urgent).toBe(variant === 'error' && interrupt);
        },
      ),
    );
  });
  it('is pure and reads props on each call', () => {
    let props: StateProps = { variant: 'loading', heading: 'a' };
    const s = createState(() => props);
    expect(s.getAnnouncement()).toEqual(s.getAnnouncement());
    props = { variant: 'error', heading: 'b', interrupt: true };
    expect(s.getAnnouncement()).toEqual({ text: 'b', urgent: true });
  });
});
