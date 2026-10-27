import { describe, expect, it, vi } from 'vitest';
import { createEffectQueue } from '../../effects';
import { evaluatePlacement, parsePlacement } from './index';
import type { PlacementInput, PlacementResult, ViewportLike } from './index';
import { createPlacementScheduler, viewportRect } from './scheduler';

const B = { x: 0, y: 0, width: 400, height: 300 };
const input = (over: Partial<PlacementInput> = {}): PlacementInput => ({
  anchor: { x: 150, y: 100, width: 100, height: 40 },
  size: { width: 120, height: 80 },
  bounds: B,
  ...over,
});

describe('parsePlacement', () => {
  it('parses areas, logical keywords by direction, and rejects the unsupported subset', () => {
    expect(parsePlacement({ area: 'bottom' })?.candidates).toEqual([[2, 3]]);
    expect(parsePlacement({ area: 'center' })?.candidates).toEqual([[1, 1]]);
    expect(parsePlacement({ area: 'left top' })?.candidates).toEqual([[0, 0]]);
    expect(parsePlacement({ area: 'top center' })?.candidates).toEqual([[0, 1]]);
    expect(parsePlacement({ area: 'inline-start' }, { dir: 'rtl' })?.candidates).toEqual([[3, 2]]);
    for (const area of ['', 'span-all', 'top bottom', 'start', 'top left right', 'x-start'])
      expect(parsePlacement({ area }), area).toBeNull();
  });

  it('keeps fallbacks in declaration order, applying tactics to the base', () => {
    const p = parsePlacement(
      { area: 'bottom right', fallbacks: 'flip-block, flip-inline, --n, flip-block flip-inline' },
      { tries: { '--n': 'left' } },
    )!;
    expect(p.candidates).toEqual([
      [2, 2],
      [0, 2],
      [2, 0],
      [3, 0],
      [0, 0],
    ]);
  });

  it('rejects unknown fallbacks, orders, visibility and unresolved names', () => {
    expect(parsePlacement({ area: 'top', fallbacks: 'flip-start' })).toBeNull();
    expect(parsePlacement({ area: 'top', fallbacks: '--missing' })).toBeNull();
    expect(parsePlacement({ area: 'top', order: 'most-area' })).toBeNull();
    expect(parsePlacement({ area: 'top', visibility: 'sometimes' })).toBeNull();
    expect(parsePlacement({ area: 'top', fallbacks: 'none' })?.candidates).toHaveLength(1);
  });

  it('reads order and visibility', () => {
    const p = parsePlacement({
      area: 'top',
      order: 'most-inline-size',
      visibility: 'anchors-visible no-overflow',
    })!;
    expect([p.order, p.anchorsVisible, p.noOverflow]).toEqual(['width', true, true]);
  });
});

describe('evaluatePlacement', () => {
  it('walks candidates in declaration order and flips when the base overflows', () => {
    const p = parsePlacement({ area: 'bottom', fallbacks: 'flip-block' })!;
    expect(evaluatePlacement(p, input())).toMatchObject({ index: 0, x: 140, y: 140 });
    const low = input({ anchor: { x: 150, y: 250, width: 100, height: 40 } });
    expect(evaluatePlacement(p, low)).toMatchObject({ index: 1, y: 170 });
  });

  it('is pure: same rectangles, same result, inputs untouched', () => {
    const p = parsePlacement({ area: 'top', fallbacks: 'flip-block' })!;
    const i = input();
    const snap = JSON.stringify(i);
    expect(evaluatePlacement(p, i)).toEqual(evaluatePlacement(p, i));
    expect(JSON.stringify(i)).toBe(snap);
  });

  it('hides per position-visibility', () => {
    const tall = input({ size: { width: 120, height: 400 } });
    expect(
      evaluatePlacement(parsePlacement({ area: 'bottom', visibility: 'no-overflow' })!, tall)
        .visible,
    ).toBe(false);
    const clip = { x: 0, y: 200, width: 400, height: 100 };
    const av = parsePlacement({ area: 'bottom', visibility: 'anchors-visible' })!;
    expect(evaluatePlacement(av, input({ clip })).visible).toBe(false);
    expect(evaluatePlacement(av, input()).visible).toBe(true);
  });
});

describe('viewportRect and scheduler', () => {
  const placement = parsePlacement({ area: 'bottom', fallbacks: 'flip-block' })!;

  function viewport() {
    const fns: Record<string, (() => void)[]> = { resize: [], scroll: [] };
    const vv: ViewportLike = {
      width: 400,
      height: 300,
      offsetLeft: 0,
      offsetTop: 0,
      addEventListener: (t, f) => void fns[t]!.push(f),
      removeEventListener: (t, f) => void (fns[t] = fns[t]!.filter((g) => g !== f)),
    };
    return { vv, fns };
  }

  it('maps the visual viewport to bounds', () => {
    const { vv } = viewport();
    expect(viewportRect({ ...vv, width: 300, height: 120, offsetLeft: 5, offsetTop: 7 })).toEqual({
      x: 5,
      y: 7,
      width: 300,
      height: 120,
    });
  });

  function setup(native = false) {
    const queue = createEffectQueue<{ type: 'geometry'; target: string }>();
    const scheduler = createPlacementScheduler({ native, enqueue: (e) => queue.enqueue([e], 1) });
    const log: string[] = [];
    const writes: Record<string, PlacementResult> = {};
    const target = (id: string) => ({
      placement,
      read: () => (log.push(`read ${id}`), input()),
      write: (r: PlacementResult) => (log.push(`write ${id}`), (writes[id] = r)),
    });
    return { queue, scheduler, log, writes, target };
  }

  it('reads every dirty target before writing any, only inside the drain', () => {
    const { queue, scheduler, log, writes, target } = setup();
    scheduler.add('a', target('a'));
    scheduler.add('b', target('b'));
    scheduler.request('a');
    scheduler.request('b');
    scheduler.request('a');
    expect(log).toEqual([]);
    expect(queue.drain({ run: (e) => scheduler.run(e) })).toBe(2);
    expect(log).toEqual(['read a', 'read b', 'write a', 'write b']);
    expect(writes.a).toMatchObject({ index: 0, y: 140 });
  });

  it('is inactive when native anchor positioning is supported', () => {
    const { queue, scheduler, log, target } = setup(true);
    scheduler.add('a', target('a'))();
    scheduler.request('a');
    expect(queue.size).toBe(0);
    expect(scheduler.flush()).toBe(0);
    expect(log).toEqual([]);
  });

  it('removed targets are not measured; unknown ids are ignored', () => {
    const { queue, scheduler, log, target } = setup();
    const off = scheduler.add('a', target('a'));
    scheduler.request('a');
    off();
    scheduler.request('zzz');
    queue.drain({ run: (e) => scheduler.run(e) });
    expect(log).toEqual([]);
  });

  it('re-places on visualViewport resize/scroll and stops after teardown', () => {
    const { queue, scheduler, target } = setup();
    const { vv, fns } = viewport();
    scheduler.add('a', target('a'));
    const stop = scheduler.observe(vv);
    fns.resize![0]!();
    fns.scroll![0]!();
    expect(queue.size).toBe(1); // coalesced: one dirty target, one effect
    stop();
    expect(fns.resize).toHaveLength(0);
    expect(fns.scroll).toHaveLength(0);
  });

  it('never schedules its own frames', () => {
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    const { scheduler, target } = setup();
    scheduler.add('a', target('a'));
    scheduler.request('a');
    scheduler.flush();
    expect(raf).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
