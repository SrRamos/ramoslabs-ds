// @ts-check
// Reference evaluator for the placement parity oracle (W1-110, ADR-005 step 2). It is written
// independently of `core/src/overlay/placement`: it works from the CSS strings and an explicit
// 3x3 grid of track lines, the way css-anchor-position-1 describes `position-area`, so a shared
// bug cannot hide. Subset: the compiled subset only (physical + block/inline start/end keywords).

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ anchor: Rect, size: { width: number, height: number }, bounds: Rect, clip?: Rect }} Geometry
 * @typedef {{
 *   area: string, fallbacks?: string, order?: string, visibility?: string,
 *   dir?: 'ltr' | 'rtl', tries?: Record<string, string>
 * }} Policy
 * @typedef {{ index: number, x: number, y: number, visible: boolean }} Outcome
 */

/** Column/row ranges over track indices 0..2; returns `[rowFrom, rowTo, colFrom, colTo]`. */
function ranges(/** @type {string} */ text, /** @type {boolean} */ rtl) {
  const words = text.trim().split(/\s+/);
  if (words.length < 1 || words.length > 2 || words[0] === '') throw new Error(`bad area ${text}`);
  /** @type {[number, number] | null} */ let row = null;
  /** @type {[number, number] | null} */ let col = null;
  let center = 0;
  for (const w of words) {
    const logicalLeft = rtl ? 'right' : 'left';
    const logicalRight = rtl ? 'left' : 'right';
    const word = w === 'inline-start' ? logicalLeft : w === 'inline-end' ? logicalRight : w;
    if (word === 'top' || word === 'block-start') {
      if (row) throw new Error('row twice');
      row = [0, 0];
    } else if (word === 'bottom' || word === 'block-end') {
      if (row) throw new Error('row twice');
      row = [2, 2];
    } else if (word === 'left') {
      if (col) throw new Error('col twice');
      col = [0, 0];
    } else if (word === 'right') {
      if (col) throw new Error('col twice');
      col = [2, 2];
    } else if (word === 'center') center++;
    else throw new Error(`unsupported ${w}`);
  }
  if (center === 1 && words.length === 1) return [1, 1, 1, 1];
  for (let n = 0; n < center; n++) {
    if (!row) row = [1, 1];
    else if (!col) col = [1, 1];
    else throw new Error('too many keywords');
  }
  return [...(row ?? [0, 2]), ...(col ?? [0, 2])];
}

/** Grid track lines along one axis: containing-block start, anchor start/end, containing-block end. */
const lines = (
  /** @type {number} */ b0,
  /** @type {number} */ a0,
  /** @type {number} */ a1,
  /** @type {number} */ b1,
) => [b0, a0, a1, b1];

/**
 * @param {number} from
 * @param {number} to
 * @param {number[]} L
 * @param {number} size
 */
function placeOnAxis(from, to, L, size) {
  const start = L[from] ?? 0;
  const end = L[to + 1] ?? 0;
  const anchorCenter = ((L[1] ?? 0) + (L[2] ?? 0)) / 2;
  const centered = anchorCenter - size / 2;
  let at;
  if (from === 0 && to === 0)
    at = end - size; // before the anchor: hug its start edge
  else if (from === 2 && to === 2)
    at = start; // after the anchor: hug its end edge
  else if (from === 1 && to === 1) at = centered;
  else at = Math.max(start, Math.min(centered, end - size)); // whole block: anchor-center, safe
  return { start, end, at, room: Math.max(0, end - start) };
}

/** Build the ordered candidate ranges (base first). @param {Policy} policy */
function candidateList(/** @type {Policy} */ policy) {
  const rtl = policy.dir === 'rtl';
  const base = ranges(policy.area, rtl);
  const out = [base];
  const raw = (policy.fallbacks ?? 'none').trim();
  if (raw === 'none') return out;
  for (const piece of raw.split(',')) {
    const words = piece.trim().split(/\s+/);
    if (words[0]?.startsWith('flip-')) {
      let [r0, r1, c0, c1] = base;
      for (const w of words) {
        if (w === 'flip-block')
          [r0, r1] = [2 - /** @type {number} */ (r1), 2 - /** @type {number} */ (r0)];
        else if (w === 'flip-inline')
          [c0, c1] = [2 - /** @type {number} */ (c1), 2 - /** @type {number} */ (c0)];
        else throw new Error(`unsupported tactic ${w}`);
      }
      out.push([r0, r1, c0, c1]);
    } else if (words.length === 1 && words[0]?.startsWith('--')) {
      const body = policy.tries?.[words[0]];
      if (body === undefined) throw new Error(`unknown @position-try ${words[0]}`);
      out.push(ranges(body, rtl));
    } else out.push(ranges(piece, rtl));
  }
  return out;
}

/**
 * @param {Policy} policy
 * @param {Geometry} g
 * @returns {Outcome}
 */
export function referenceEvaluate(policy, g) {
  const { anchor: a, bounds: b, size } = g;
  const X = lines(b.x, a.x, a.x + a.width, b.x + b.width);
  const Y = lines(b.y, a.y, a.y + a.height, b.y + b.height);
  const laidOut = candidateList(policy).map((r, index) => {
    const v = placeOnAxis(
      /** @type {number} */ (r[0]),
      /** @type {number} */ (r[1]),
      Y,
      size.height,
    );
    const h = placeOnAxis(
      /** @type {number} */ (r[2]),
      /** @type {number} */ (r[3]),
      X,
      size.width,
    );
    return { index, v, h, fits: size.height <= v.room && size.width <= h.room };
  });

  const order = policy.order ?? 'normal';
  const key =
    order === 'most-height' || order === 'most-block-size'
      ? (/** @type {typeof laidOut[number]} */ c) => c.v.room
      : order === 'most-width' || order === 'most-inline-size'
        ? (/** @type {typeof laidOut[number]} */ c) => c.h.room
        : null;
  if (order !== 'normal' && !key) throw new Error(`unsupported order ${order}`);
  const walk = key ? laidOut.slice().sort((p, q) => key(q) - key(p) || p.index - q.index) : laidOut;
  let chosen = laidOut[0];
  for (const c of walk) {
    if (c.fits) {
      chosen = c;
      break;
    }
  }
  if (!chosen) throw new Error('no candidates');

  const x = chosen.h.at;
  const y = chosen.v.at;
  const words = (policy.visibility ?? 'always').trim().split(/\s+/);
  for (const w of words) {
    if (!['always', 'anchors-valid', 'anchors-visible', 'no-overflow'].includes(w)) {
      throw new Error(`unsupported visibility ${w}`);
    }
  }
  let visible = true;
  if (words.includes('anchors-visible') && g.clip) {
    const k = g.clip;
    const overlapX = Math.min(a.x + a.width, k.x + k.width) - Math.max(a.x, k.x);
    const overlapY = Math.min(a.y + a.height, k.y + k.height) - Math.max(a.y, k.y);
    if (!(overlapX > 0 && overlapY > 0)) visible = false;
  }
  if (words.includes('no-overflow')) {
    const out =
      x < b.x || y < b.y || x + size.width > b.x + b.width || y + size.height > b.y + b.height;
    if (out) visible = false;
  }
  return { index: chosen.index, x, y, visible };
}
