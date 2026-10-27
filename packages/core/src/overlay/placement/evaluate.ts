// Candidate evaluator: a pure function of rectangles (ADR-005 steps 2 and 4). It is the fallback
// executor of the same policy the CSS compiler emits; native anchor positioning never reaches it.

import type { Area, Placement, Track } from './parse';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlacementInput {
  readonly anchor: Rect;
  /** Border-box size of the positioned element. */
  readonly size: { readonly width: number; readonly height: number };
  /** The containing block (the viewport rectangle, or `viewportRect` while a keyboard is open). */
  readonly bounds: Rect;
  /** Anchor's visible clip (ancestor scrollports); only read for `anchors-visible`. */
  readonly clip?: Rect;
}

export interface PlacementResult {
  /** Index into `Placement.candidates`; 0 is the base `position-area`. */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

interface Axis {
  lo: number; // region start
  hi: number; // region end
  at: number; // element start
}

// One axis of the 3x3 grid: the region the track selects, and where the element sits inside it.
// Edge tracks hug the anchor; the centered/whole tracks center on the anchor, kept inside the whole
// region (safe alignment) when the track spans the containing block.
function axis(t: Track, a0: number, a1: number, b0: number, b1: number, size: number): Axis {
  if (t === 0) return { lo: b0, hi: a0, at: a0 - size };
  if (t === 2) return { lo: a1, hi: b1, at: a1 };
  const c = (a0 + a1) / 2 - size / 2;
  if (t === 1) return { lo: a0, hi: a1, at: c };
  return { lo: b0, hi: b1, at: Math.max(b0, Math.min(c, b1 - size)) };
}

const room = (v: Axis) => Math.max(0, v.hi - v.lo);

export function evaluatePlacement(p: Placement, i: PlacementInput): PlacementResult {
  const { anchor: a, size: s, bounds: b } = i;
  const all = p.candidates.map((c: Area, index) => ({
    index,
    r: axis(c[0], a.y, a.y + a.height, b.y, b.y + b.height, s.height),
    c: axis(c[1], a.x, a.x + a.width, b.x, b.x + b.width, s.width),
  }));
  const fits = (o: (typeof all)[number]) => s.height <= room(o.r) && s.width <= room(o.c);
  const pool =
    p.order === 'normal'
      ? all
      : [...all].sort((m, n) =>
          p.order === 'height' ? room(n.r) - room(m.r) : room(n.c) - room(m.c),
        );
  const pick = pool.find(fits) ?? all[0]!;
  const x = pick.c.at;
  const y = pick.r.at;
  const inside =
    x >= b.x && y >= b.y && x + s.width <= b.x + b.width && y + s.height <= b.y + b.height;
  const k = i.clip;
  const seen =
    !k ||
    (a.x < k.x + k.width && a.x + a.width > k.x && a.y < k.y + k.height && a.y + a.height > k.y);
  return {
    index: pick.index,
    x,
    y,
    visible: (!p.anchorsVisible || seen) && (!p.noOverflow || inside),
  };
}
