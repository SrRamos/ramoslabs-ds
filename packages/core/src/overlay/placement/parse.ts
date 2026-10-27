// Parser for the placement vocabulary of the contract (ADR-005 step 2): `position-area`,
// `position-try-fallbacks`, `position-try-order`, `position-visibility`. Only the exact compiled
// subset is understood; anything else yields `null`, never a guess (no inference from Baseline).

/** One axis of a 3x3 area: 0 before the anchor, 1 over it, 2 after it, 3 the whole containing block. */
export type Track = 0 | 1 | 2 | 3;
/** `[row, column]` in physical terms (horizontal writing mode). */
export type Area = readonly [row: Track, col: Track];
export type Order = 'normal' | 'height' | 'width';

export interface Placement {
  /** Base `position-area` first, then each fallback in declaration order. */
  readonly candidates: readonly Area[];
  readonly order: Order;
  readonly anchorsVisible: boolean;
  readonly noOverflow: boolean;
}

export interface PlacementSource {
  area: string;
  fallbacks?: string;
  order?: string;
  visibility?: string;
}

export interface ParseOptions {
  dir?: 'ltr' | 'rtl';
  /** Resolved `@position-try` rules: dashed name to its `position-area` value. */
  tries?: Readonly<Record<string, string>>;
}

// [axis, track]; axis 2 is `center`, which takes whichever axis is still free.
const KW: Record<string, readonly [number, Track]> = {
  top: [0, 0],
  'block-start': [0, 0],
  bottom: [0, 2],
  'block-end': [0, 2],
  left: [1, 0],
  right: [1, 2],
  center: [2, 1],
};

function area(s: string, rtl: boolean): Area | null {
  const t = s.trim().split(/\s+/);
  if (t.length > 2 || !t[0]) return null;
  const out: Track[] = [3, 3];
  const used = [false, false];
  let centers = 0;
  for (const w of t) {
    const k =
      w === 'inline-start'
        ? KW[rtl ? 'right' : 'left']
        : w === 'inline-end'
          ? KW[rtl ? 'left' : 'right']
          : KW[w];
    if (!k) return null;
    if (k[0] === 2) centers++;
    else if (used[k[0]]) return null;
    else {
      used[k[0]] = true;
      out[k[0]] = k[1];
    }
  }
  if (centers === 1 && t.length === 1) return [1, 1];
  while (centers--) {
    const free = used[0] ? 1 : 0;
    if (used[free]) return null;
    used[free] = true;
    out[free] = 1;
  }
  return out as unknown as Area;
}

const flip = (t: Track, on: boolean): Track => (on ? ((2 - t) as Track) : t);

export function parsePlacement(src: PlacementSource, opts: ParseOptions = {}): Placement | null {
  const rtl = opts.dir === 'rtl';
  const base = area(src.area, rtl);
  if (!base) return null;
  const candidates: Area[] = [base];
  const list = (src.fallbacks ?? 'none').trim();
  if (list !== 'none') {
    for (const entry of list.split(',')) {
      const w = entry.trim().split(/\s+/);
      let a: Area | null;
      if (w[0]?.startsWith('flip-')) {
        // Tactics always transform the base style (css-anchor-position-1), never the previous option.
        if (w.some((x) => x !== 'flip-block' && x !== 'flip-inline')) return null;
        const b = w.includes('flip-block');
        const i = w.includes('flip-inline');
        a = [3 === base[0] ? 3 : flip(base[0], b), 3 === base[1] ? 3 : flip(base[1], i)];
      } else if (w.length === 1 && w[0]?.startsWith('--')) {
        const v = opts.tries?.[w[0]];
        a = v === undefined ? null : area(v, rtl);
      } else a = area(entry, rtl);
      if (!a) return null;
      candidates.push(a);
    }
  }
  const o = src.order ?? 'normal';
  const order: Order | null =
    o === 'normal'
      ? 'normal'
      : o === 'most-height' || o === 'most-block-size'
        ? 'height'
        : o === 'most-width' || o === 'most-inline-size'
          ? 'width'
          : null;
  if (!order) return null;
  let anchorsVisible = false;
  let noOverflow = false;
  for (const v of (src.visibility ?? 'always').trim().split(/\s+/)) {
    if (v === 'anchors-visible') anchorsVisible = true;
    else if (v === 'no-overflow') noOverflow = true;
    else if (v !== 'always' && v !== 'anchors-valid') return null;
  }
  return { candidates, order, anchorsVisible, noOverflow };
}
