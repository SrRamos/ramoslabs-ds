import { afterEach, describe, expect, it, vi } from 'vitest';
import contract from '../../../contracts/contracts/skeleton.contract.json';
import tokens from '../../../tokens/src/tokens/motion.json';
import { skeletonLive, skeletonMachine } from '../generated/skeleton/index';
import { createFakeScheduler } from '../runtime/index';
import {
  createSkeleton,
  createSkeletonTiming,
  parseDuration,
  SKELETON_DELAY_MS,
  SKELETON_MIN_DURATION_MS,
} from './index';
import { reduce, reducerEvents } from './reducer';
import type { SkeletonPhase, SkeletonProps } from './index';

declare const console: { warn(m: string): void };
const mk = (props: SkeletonProps = {}) => createSkeleton(() => props);
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => vi.restoreAllMocks());

describe('contract and tokens', () => {
  it('one idle state, no actions or events; reducer is a no-op', () => {
    expect(contract.actions).toEqual([]);
    expect(contract.events).toEqual([]);
    expect(skeletonMachine.states).toEqual(['idle']);
    expect([...reducerEvents]).toEqual([]);
    expect(reduce('idle')).toBe('idle');
  });
  it('declares the polite status region, so the live region is eager', () => {
    expect(contract.a11y.liveRegions.map((r) => r.politeness)).toEqual(['polite']);
    expect(skeletonLive).toBe('eager');
  });
  it('JS fallbacks equal the motion.skeleton tokens (the tokens are the source of truth)', () => {
    const t = tokens.motion.skeleton;
    expect(parseDuration(t.delay.$value, -1)).toBe(SKELETON_DELAY_MS);
    expect(parseDuration(t['min-duration'].$value, -1)).toBe(SKELETON_MIN_DURATION_MS);
    expect(SKELETON_DELAY_MS).toBe(300);
    expect(SKELETON_MIN_DURATION_MS).toBe(500);
  });
  it('parseDuration reads ms and s, and falls back on anything else', () => {
    expect(parseDuration('300ms', 1)).toBe(300);
    expect(parseDuration(' 0.5s ', 1)).toBe(500);
    expect(parseDuration('', 7)).toBe(7);
    expect(parseDuration('fast', 7)).toBe(7);
    expect(parseDuration(undefined, 7)).toBe(7);
  });
});

describe('shapes', () => {
  it('a shape is hidden from assistive tech and never busy; unknown falls back to block', () => {
    spyWarn();
    for (const shape of ['text', 'circle', 'rect', 'block'] as const) {
      const bag = mk({ shape }).getRootProps();
      expect(bag).toMatchObject({
        class: 'sj-skeleton',
        'data-shape': shape,
        'aria-hidden': 'true',
      });
      expect(bag['aria-busy']).toBeUndefined();
      expect(bag['data-state']).toBeUndefined();
    }
    expect(mk().getRootProps()['data-shape']).toBe('block');
    expect(mk({ shape: 'x' as never }).getRootProps()['data-shape']).toBe('block');
  });
  it('text: lines clamp to 1..12 and default to 3; other shapes have no lines', () => {
    expect(mk({ shape: 'text' }).lineCount()).toBe(3);
    expect(mk({ shape: 'text', lines: 0 }).lineCount()).toBe(1);
    expect(mk({ shape: 'text', lines: 99 }).lineCount()).toBe(12);
    expect(mk({ shape: 'text', lines: NaN }).lineCount()).toBe(3);
    expect(mk({ shape: 'text', lines: 5 }).getRootProps()['data-lines']).toBe(5);
    expect(mk({ shape: 'circle' }).lineCount()).toBe(0);
    expect(mk({ shape: 'rect' }).getRootProps()['data-lines']).toBeUndefined();
    expect(mk().getLineProps()).toMatchObject({ class: 'sj-skeleton__line', 'data-part': 'line' });
  });
  it('rect ratio and circle size fall back to 16/9 and md', () => {
    expect(mk({ shape: 'rect' }).getRootProps()['data-ratio']).toBe('16/9');
    expect(mk({ shape: 'rect', ratio: '4/3' }).getRootProps()['data-ratio']).toBe('4/3');
    expect(mk({ shape: 'rect', ratio: '5/1' as never }).getRootProps()['data-ratio']).toBe('16/9');
    expect(mk({ shape: 'circle' }).getRootProps()['data-size']).toBe('md');
    expect(mk({ shape: 'circle', size: 'xl' }).getRootProps()['data-size']).toBe('xl');
    expect(mk({ shape: 'circle', size: 'huge' as never }).getRootProps()['data-size']).toBe('md');
  });
  it('animation defaults to shimmer; none is honoured', () => {
    expect(mk().getRootProps()['data-animation']).toBe('shimmer');
    expect(mk({ animation: 'none' }).getRootProps()['data-animation']).toBe('none');
  });
  it('class merges, other consumer attributes pass through, own attributes are protected', () => {
    const bag = mk({ shape: 'text' }).getRootProps({
      class: 'mine',
      'data-test': 'k',
      'aria-hidden': 'false',
    });
    expect(bag).toMatchObject({
      class: 'sj-skeleton mine',
      'data-test': 'k',
      'aria-hidden': 'true',
    });
  });
});

describe('group', () => {
  it('is busy while pending, visible and holding, and not once idle', () => {
    const phases: SkeletonPhase[] = ['pending', 'visible', 'holding', 'idle'];
    for (const phase of phases) {
      const bag = mk({ shape: 'group', phase }).getRootProps();
      expect(bag['aria-busy']).toBe(phase === 'idle' ? undefined : 'true');
      expect(bag['aria-hidden']).toBeUndefined();
      expect(bag['data-state']).toBe(phase);
    }
    expect(mk({ shape: 'group' }).getRootProps()['data-state']).toBe('pending');
  });
  it('never renders live markup, even when a consumer spreads it', () => {
    const warn = spyWarn();
    const bag = mk({ shape: 'group' }).getRootProps({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    for (const k of ['role', 'aria-live', 'aria-atomic']) expect(bag[k]).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
  it('announces once the placeholder is shown, politely, and never before', () => {
    const g = (phase: SkeletonPhase, announce?: string) =>
      mk({ shape: 'group', phase, announce }).getAnnouncement();
    expect(g('pending', 'Loading')).toBeUndefined();
    expect(g('idle', 'Loading')).toBeUndefined();
    expect(g('visible', 'Loading')).toEqual({ text: 'Loading', urgent: false });
    expect(g('holding', ' Loading ')).toEqual({ text: 'Loading', urgent: false });
    expect(g('visible')).toBeUndefined();
    expect(g('visible', '  ')).toBeUndefined();
    expect(
      mk({ shape: 'text', phase: 'visible', announce: 'x' }).getAnnouncement(),
    ).toBeUndefined();
  });
});

describe('timing', () => {
  const setup = (delay = 300, minDuration = 500) => {
    const sched = createFakeScheduler();
    const seen: SkeletonPhase[] = [];
    const t = createSkeletonTiming({
      after: sched.after,
      delay,
      minDuration,
      onPhase: (p) => seen.push(p),
    });
    return { sched, seen, t };
  };
  it('a load that ends inside the delay never shows the placeholder', () => {
    const { sched, seen, t } = setup();
    t.set(true);
    sched.advance(299);
    t.set(false);
    sched.advance(5000);
    expect(seen).toEqual(['pending', 'idle']);
    expect(sched.pending).toBe(0);
  });
  it('shows after the delay and stays at least the minimum duration', () => {
    const { sched, seen, t } = setup();
    t.set(true);
    sched.advance(300);
    expect(t.phase()).toBe('visible');
    sched.advance(100);
    t.set(false);
    expect(t.phase()).toBe('holding');
    sched.advance(399);
    expect(t.phase()).toBe('holding');
    sched.advance(1);
    expect(t.phase()).toBe('idle');
    expect(seen).toEqual(['pending', 'visible', 'holding', 'idle']);
  });
  it('content arriving after the minimum swaps at once', () => {
    const { sched, t } = setup();
    t.set(true);
    sched.advance(300 + 500);
    t.set(false);
    expect(t.phase()).toBe('idle');
  });
  it('loading again while holding resumes visible and the minimum then lets go', () => {
    const { sched, seen, t } = setup();
    t.set(true);
    sched.advance(300);
    t.set(false);
    t.set(true);
    expect(t.phase()).toBe('visible');
    sched.advance(500);
    expect(t.phase()).toBe('visible');
    t.set(false);
    expect(t.phase()).toBe('idle');
    expect(seen).toEqual(['pending', 'visible', 'holding', 'visible', 'idle']);
  });
  it('is idempotent and zero delay shows at once', () => {
    const a = setup();
    a.t.set(false);
    a.t.set(true);
    a.t.set(true);
    expect(a.sched.pending).toBe(1);
    const b = setup(0);
    b.t.set(true);
    expect(b.t.phase()).toBe('visible');
  });
  it('configure applies to the next cycle; destroy cancels every timer', () => {
    const { sched, t } = setup();
    t.configure(50, 60);
    t.set(true);
    sched.advance(50);
    expect(t.phase()).toBe('visible');
    t.destroy();
    expect(sched.pending).toBe(0);
  });
});
