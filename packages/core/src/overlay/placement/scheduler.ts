// Read-compute-write scheduler for the geometry fallback and `visualViewport` reactions
// (ADR-005 steps 4 and 9). It owns no timer and no `requestAnimationFrame`: work is requested as
// `geometry` effects and runs when the adapter drains the ADR-003 post-commit queue.

import { evaluatePlacement } from './evaluate';
import type { PlacementInput, PlacementResult, Rect } from './evaluate';
import type { Placement } from './parse';

export interface PlacementTarget {
  readonly placement: Placement;
  /** Layout reads only. Called for every dirty target before any `write`. */
  read(): PlacementInput;
  /** Style writes only. */
  write(result: PlacementResult): void;
}

export interface GeometryEffect {
  readonly type: 'geometry';
  readonly target: string;
}

export interface ViewportLike {
  readonly width: number;
  readonly height: number;
  readonly offsetLeft: number;
  readonly offsetTop: number;
  addEventListener(type: 'resize' | 'scroll', fn: () => void): void;
  removeEventListener(type: 'resize' | 'scroll', fn: () => void): void;
}

/** The containing block while the on-screen keyboard or pinch zoom shrinks the visual viewport. */
export function viewportRect(v: ViewportLike): Rect {
  return { x: v.offsetLeft, y: v.offsetTop, width: v.width, height: v.height };
}

export interface PlacementScheduler {
  /** Register a target; returns its remover. A no-op when native positioning is active. */
  add(id: string, target: PlacementTarget): () => void;
  /** Mark dirty and enqueue one `geometry` effect. Never measures synchronously. */
  request(id: string): void;
  /** `DrainHost.run` for `geometry` effects: the first one flushes every dirty target. */
  run(effect: { readonly type: string }): void;
  /** Read all dirty targets, compute, then write all. Returns how many were placed. */
  flush(): number;
  /** Re-place every target on visual-viewport resize/scroll; returns the teardown. */
  observe(viewport: ViewportLike): () => void;
}

export function createPlacementScheduler(options: {
  enqueue(effect: GeometryEffect): void;
  /** `supports.anchorPositioning`: when true the scheduler is inactive (ADR-005 step 3). */
  native?: boolean;
}): PlacementScheduler {
  const targets = new Map<string, PlacementTarget>();
  const dirty = new Set<string>();
  const request = (id: string) => {
    if (options.native || !targets.has(id)) return;
    if (dirty.has(id)) return;
    dirty.add(id);
    options.enqueue({ type: 'geometry', target: id });
  };
  const flush = () => {
    const ids = [...dirty].filter((id) => targets.has(id));
    dirty.clear();
    const inputs = ids.map((id) => targets.get(id)!.read());
    const results = ids.map((id, n) => evaluatePlacement(targets.get(id)!.placement, inputs[n]!));
    ids.forEach((id, n) => targets.get(id)!.write(results[n]!));
    return ids.length;
  };
  return {
    add(id, target) {
      if (options.native) return () => {};
      targets.set(id, target);
      return () => {
        targets.delete(id);
        dirty.delete(id);
      };
    },
    request,
    run(effect) {
      if (effect.type === 'geometry') flush();
    },
    flush,
    observe(viewport) {
      const all = () => targets.forEach((_, id) => request(id));
      viewport.addEventListener('resize', all);
      viewport.addEventListener('scroll', all);
      return () => {
        viewport.removeEventListener('resize', all);
        viewport.removeEventListener('scroll', all);
      };
    },
  };
}
