// @ts-check
// Pure verdict functions for the L3 WCAG 2.2 gates (W1-310, ADR-013 L3). DOM-free: the browser-side
// collectors (collectors.js) measure, these decide. Every verdict returns `{ pass, failures[] }` and
// never throws on bad input, so a seeded fixture is REPORTED rather than crashing the run.
//
// What each gate does and does not prove is written in docs/implementation/S-TEST-A11Y-NOTES.md.
import { compositeOver, contrastRatio } from '../contrast/wcag.js';

/** @typedef {{ pass: boolean, failures: string[] }} Verdict */

/** @param {string[]} failures @returns {Verdict} */
const verdict = (failures) => ({ pass: failures.length === 0, failures });

// ---------------------------------------------------------------------------------------------
// Triage (axe violations and documented target-size exceptions)
// ---------------------------------------------------------------------------------------------

export const ISSUE_RE = /^(https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+|#\d+)$/;
export const OWNER_RE = /^@?[\w-]+$/;
/** The exceptions WCAG 2.5.8 itself defines, plus the two spec-level ones (equivalent, essential). */
export const TARGET_EXCEPTIONS = ['spacing', 'inline', 'equivalent', 'essential', 'user-agent'];

/**
 * @typedef {{ rule: string, fixture: string, issue: string, owner: string, reason: string, result?: 'violation' | 'incomplete', reviewed?: string }} AxeTriage
 * @typedef {{ fixture: string, target: string, exception: string, reason: string, owner: string }} TargetException
 * @typedef {{ axe?: AxeTriage[], targetSize?: TargetException[] }} Triage
 */

/** A triage file is valid only when every entry names an issue and an owner (ADR-013 L3). @param {Triage} t */
export function validateTriage(t) {
  /** @type {string[]} */
  const errors = [];
  (t.axe ?? []).forEach((e, i) => {
    const at = `axe[${i}]`;
    if (!e.rule) errors.push(`${at}: missing rule`);
    if (!e.fixture) errors.push(`${at}: missing fixture`);
    if (!e.reason) errors.push(`${at}: missing reason`);
    if (e.result === 'incomplete' && e.reviewed !== 'pass')
      errors.push(`${at}: an incomplete result is triaged only with reviewed: "pass"`);
    if (!e.issue || !ISSUE_RE.test(e.issue)) errors.push(`${at}: missing or malformed issue link`);
    if (!e.owner || !OWNER_RE.test(e.owner)) errors.push(`${at}: missing or malformed owner`);
  });
  (t.targetSize ?? []).forEach((e, i) => {
    const at = `targetSize[${i}]`;
    if (!e.fixture) errors.push(`${at}: missing fixture`);
    if (!e.target) errors.push(`${at}: missing exact target selector`);
    if (!TARGET_EXCEPTIONS.includes(e.exception)) errors.push(`${at}: unknown exception kind`);
    if (!e.reason) errors.push(`${at}: missing reason`);
    if (!e.owner || !OWNER_RE.test(e.owner)) errors.push(`${at}: missing or malformed owner`);
  });
  return errors;
}

/**
 * Splits axe violations into untriaged and triaged. An axe node is triaged only by an entry with the
 * same rule and fixture; an invalid entry (no issue or owner) never triages anything.
 * @template {{ id: string }} V
 * @param {V[]} violations @param {string} fixture @param {Triage} triage
 * @param {'violation' | 'incomplete'} [result] which axe bucket these nodes came from
 */
export function applyAxeTriage(violations, fixture, triage, result = 'violation') {
  const valid = (triage.axe ?? []).filter(
    (e) =>
      validateTriage({ axe: [e] }).length === 0 &&
      e.fixture === fixture &&
      (e.result ?? 'violation') === result,
  );
  const untriaged = violations.filter((v) => !valid.some((e) => e.rule === v.id));
  return { untriaged, triaged: violations.filter((v) => !untriaged.includes(v)) };
}

// ---------------------------------------------------------------------------------------------
// 2.4.11 Focus Not Obscured
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{ total: number, obscured: number, offscreen: number, occluders: string[], error?: string }} ObscuredMeasure
 * The ADR gate is STRICT: any sampled point of the focused rect covered by a non-ancestor
 * sticky/fixed/top-layer box fails. `entirelyHidden` is the literal WCAG 2.4.11 (AA) failure and is
 * reported separately so a fixture can show the difference.
 * @param {ObscuredMeasure} m
 */
export function focusNotObscured(m) {
  if (m.error) return { ...verdict([m.error]), fraction: 0, entirelyHidden: false };
  const fraction = m.total === 0 ? 0 : m.obscured / m.total;
  const entirelyHidden = m.total > 0 && m.obscured === m.total;
  const failures =
    m.total === 0
      ? ['focused element has no on-screen sample points (off-screen or zero size)']
      : m.obscured > 0
        ? [
            `${m.obscured}/${m.total} sample points of the focused element are covered by ${[...new Set(m.occluders)].join(', ')}`,
          ]
        : [];
  return { ...verdict(failures), fraction, entirelyHidden };
}

// ---------------------------------------------------------------------------------------------
// 2.4.13 Focus Appearance (AAA, adopted as the internal floor)
// ---------------------------------------------------------------------------------------------

/** `rgb(r, g, b)` / `rgba(r, g, b, a)` / `color(srgb r g b / a)` to `{hex, alpha}`; null if unparsable. @param {string} s */
export function parseCssColor(s) {
  const t = s.trim();
  let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(t);
  /** @type {number[]} */
  let rgb;
  let a = 1;
  if (m) {
    rgb = [m[1], m[2], m[3]].map((v) => Math.round(Number(v)));
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
  } else {
    m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(t);
    if (!m) return null;
    rgb = [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255));
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
  }
  const hex = `#${rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
  return { hex, alpha: a };
}

/**
 * Splits a computed `box-shadow` into layers (commas inside colour functions are respected).
 * @param {string} value
 * @returns {{ color: string, x: number, y: number, blur: number, spread: number, inset: boolean }[]}
 */
export function parseBoxShadow(value) {
  if (!value || value === 'none') return [];
  /** @type {string[]} */
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => {
    const inset = /\binset\b/.test(p);
    const colorMatch = /(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8})/i.exec(p);
    const color = colorMatch ? colorMatch[1] : '';
    const nums = (colorMatch ? p.replace(colorMatch[1], '') : p)
      .replace('inset', '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => parseFloat(n));
    const [x = 0, y = 0, blur = 0, spread = 0] = nums;
    return { color, x, y, blur, spread, inset };
  });
}

/**
 * Resolves the opaque colour behind the focus indicator by compositing the ancestor chain
 * (nearest first) onto white. Gradients and images are NOT modelled.
 * @param {string[]} chain computed background-color values, element first, root last
 */
export function resolveBackdrop(chain) {
  let hex = '#ffffff';
  for (const c of [...chain].reverse()) {
    const p = parseCssColor(c);
    if (p && p.alpha > 0) hex = compositeOver(p.hex, p.alpha, hex);
  }
  return hex;
}

/**
 * Computed indicator model. Bands are the visible rings outside the component: a non-blurred,
 * zero-offset outer box-shadow layer paints a band from the next smaller spread to its own spread;
 * a solid outline paints a band of its width. A band counts as indicator when its colour differs from
 * the unfocused pixels it replaced (the backdrop) by >= 3:1. A uniform ring of thickness t >= 2 CSS px
 * has area t*perimeter + 4t^2, so thickness >= 2 satisfies "area >= perimeter x 2 CSS px".
 *
 * @typedef {{
 *   outline: { style: string, width: number, color: string },
 *   boxShadow: string, backdropChain: string[], focusVisible: boolean, forcedColors: boolean
 * }} AppearanceMeasure
 * @param {AppearanceMeasure} m
 * @param {{ minThickness?: number, minContrast?: number }} [opts]
 */
export function focusAppearance(m, opts = {}) {
  const minThickness = opts.minThickness ?? 2;
  const minContrast = opts.minContrast ?? 3;
  const backdrop = resolveBackdrop(m.backdropChain);
  /** @type {{ source: string, thickness: number, contrast: number }[]} */
  const bands = [];

  const outline = m.outline;
  if (outline.style !== 'none' && outline.width > 0) {
    const c = parseCssColor(outline.color);
    if (c && c.alpha > 0) {
      bands.push({
        source: 'outline',
        thickness: outline.width,
        contrast: contrastRatio(compositeOver(c.hex, c.alpha, backdrop), backdrop),
      });
    }
  }

  const rings = parseBoxShadow(m.boxShadow)
    .filter((l) => !l.inset && l.blur === 0 && l.x === 0 && l.y === 0 && l.spread > 0)
    .sort((a, b) => a.spread - b.spread);
  let inner = 0;
  for (const l of rings) {
    const c = parseCssColor(l.color);
    if (c && c.alpha > 0) {
      bands.push({
        source: `box-shadow ${l.spread}px`,
        thickness: l.spread - inner,
        contrast: contrastRatio(compositeOver(c.hex, c.alpha, backdrop), backdrop),
      });
    }
    inner = l.spread;
  }

  const qualifying = bands.filter((b) => b.contrast >= minContrast);
  const thickness = qualifying.reduce((s, b) => s + b.thickness, 0);
  /** @type {string[]} */
  const failures = [];
  if (!m.focusVisible) failures.push('element does not match :focus-visible after keyboard focus');
  if (bands.length === 0) failures.push('no visible focus indicator (no outline, no solid ring)');
  else if (qualifying.length === 0)
    failures.push(
      `indicator contrast below ${minContrast}:1 against the unfocused pixels (best ${Math.max(...bands.map((b) => b.contrast)).toFixed(2)}:1)`,
    );
  else if (thickness < minThickness)
    failures.push(
      `indicator thickness ${thickness}px is below ${minThickness}px (area < perimeter x ${minThickness})`,
    );
  return { ...verdict(failures), bands, thickness, backdrop };
}

// ---------------------------------------------------------------------------------------------
// 2.5.8 Target Size (Minimum)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{ id: string, x: number, y: number, w: number, h: number, inline: boolean }} Target
 * @param {Target} t @param {number} min
 */
const undersized = (t, min) => t.w < min || t.h < min;

/** Does the circle (centre, radius) intersect the rect? @param {number} cx @param {number} cy @param {number} r @param {Target} t */
function circleHitsRect(cx, cy, r, t) {
  const nx = Math.max(t.x, Math.min(cx, t.x + t.w));
  const ny = Math.max(t.y, Math.min(cy, t.y + t.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/**
 * Measured bounds >= 24 CSS px, or an exception: inline (exempt by the SC), spacing (a 24px circle
 * centred on the bounding box meets no other target and no other undersized target's circle), or an
 * exact documented exception from triage.
 * @param {Target[]} targets @param {TargetException[]} [exceptions] @param {string} [fixture]
 * @param {number} [min]
 */
export function targetSize(targets, exceptions = [], fixture = '', min = 24) {
  const r = min / 2;
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const used = [];
  for (const t of targets) {
    if (!undersized(t, min)) continue;
    if (t.inline) continue;
    const documented = exceptions.find(
      (e) =>
        e.fixture === fixture &&
        e.target === t.id &&
        validateTriage({ targetSize: [e] }).length === 0,
    );
    if (documented) {
      used.push(`${t.id}: ${documented.exception}`);
      continue;
    }
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const clash = targets.find((u) => {
      if (u === t) return false;
      if (circleHitsRect(cx, cy, r, u)) return true;
      if (undersized(u, min)) {
        const ux = u.x + u.w / 2;
        const uy = u.y + u.h / 2;
        return (cx - ux) ** 2 + (cy - uy) ** 2 < min * min;
      }
      return false;
    });
    if (clash) {
      failures.push(
        `${t.id} is ${Math.round(t.w)}x${Math.round(t.h)}px (< ${min}) and its ${min}px circle meets ${clash.id}`,
      );
    } else used.push(`${t.id}: spacing`);
  }
  return { ...verdict(failures), exceptionsUsed: used };
}

// ---------------------------------------------------------------------------------------------
// 2.5.7 Dragging Movements
// ---------------------------------------------------------------------------------------------

/**
 * Every drag source must name a single-pointer alternative that exists, is visible, enabled and
 * focusable, and that, when clicked once, changes the drag scope.
 * @typedef {{ id: string, reason: string, alt: string | null, scope: string | null }} DragCandidate
 * @typedef {{ exists: boolean, visible: boolean, enabled: boolean, focusable: boolean, changedScope: boolean | null }} AltCheck
 * @param {DragCandidate[]} candidates @param {Record<string, AltCheck>} checks keyed by candidate id
 */
export function draggingAlternative(candidates, checks) {
  /** @type {string[]} */
  const failures = [];
  if (candidates.length === 0)
    failures.push('no drag fixture found (a drag gate with nothing to drag proves nothing)');
  for (const c of candidates) {
    if (!c.alt) {
      failures.push(
        `${c.id} (${c.reason}) declares no single-pointer alternative (data-sj-drag-alt)`,
      );
      continue;
    }
    const k = checks[c.id];
    if (!k || !k.exists) failures.push(`${c.id}: alternative #${c.alt} does not exist`);
    else if (!k.visible) failures.push(`${c.id}: alternative #${c.alt} is not visible`);
    else if (!k.enabled) failures.push(`${c.id}: alternative #${c.alt} is disabled`);
    else if (!k.focusable) failures.push(`${c.id}: alternative #${c.alt} is not focusable`);
    else if (!c.scope)
      failures.push(`${c.id}: no data-sj-drag-scope, the effect cannot be observed`);
    else if (!k.changedScope)
      failures.push(`${c.id}: a single click on #${c.alt} did not change the drag scope`);
  }
  return verdict(failures);
}

// ---------------------------------------------------------------------------------------------
// 3.3.7 Redundant Entry
// ---------------------------------------------------------------------------------------------

export const REDUNDANT_EXEMPT = ['essential', 'security', 'invalid'];

/**
 * @typedef {{ id: string, token: string, status: 'prefilled' | 'offered' | 'missing', exempt: string | null }} StepField
 * Fields on a later step whose autocomplete token was already entered on an earlier step.
 * @param {StepField[]} fields
 */
export function redundantEntry(fields) {
  /** @type {string[]} */
  const failures = [];
  if (fields.length === 0)
    failures.push('no later-step field repeats an earlier entry (nothing was exercised)');
  for (const f of fields) {
    if (f.exempt !== null) {
      if (!REDUNDANT_EXEMPT.includes(f.exempt))
        failures.push(
          `${f.id}: unknown exemption "${f.exempt}" (allowed: ${REDUNDANT_EXEMPT.join(', ')})`,
        );
      continue;
    }
    if (f.status === 'missing')
      failures.push(
        `${f.id} (${f.token}) asks again for a value entered earlier and offers no reuse`,
      );
  }
  return verdict(failures);
}

// ---------------------------------------------------------------------------------------------
// 3.3.8 Accessible Authentication (Minimum)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{ id: string, kind: 'password' | 'username' | 'otp', autocomplete: string,
 *   pasteBlocked: boolean, fillKept: boolean }} AuthField
 * @typedef {{ fields: AuthField[], cognitive: string[] }} AuthMeasure
 * @param {AuthMeasure} m
 */
export function accessibleAuthentication(m) {
  /** @type {string[]} */
  const failures = [];
  if (m.fields.length === 0) failures.push('no authentication field found (nothing was exercised)');
  for (const c of m.cognitive) failures.push(`cognitive function test present: ${c}`);
  const want = {
    password: ['current-password', 'new-password'],
    username: ['username', 'email', 'webauthn'],
    otp: ['one-time-code'],
  };
  for (const f of m.fields) {
    const tokens = f.autocomplete.split(/\s+/).filter(Boolean);
    if (!want[f.kind].some((t) => tokens.includes(t)))
      failures.push(
        `${f.id}: autocomplete "${f.autocomplete}" lacks ${want[f.kind].join(' or ')} (managers and OTP autofill)`,
      );
    if (f.pasteBlocked) failures.push(`${f.id}: paste is blocked`);
    if (!f.fillKept)
      failures.push(`${f.id}: a programmatic fill (password manager) is rejected or altered`);
  }
  return verdict(failures);
}

// ---------------------------------------------------------------------------------------------
// 3.2.6 Consistent Help
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{ url: string, landmarks: string[], help: { name: string, landmark: string, items: string[] } | null,
 *   unmarkedHelp: string[] }} HelpPage
 * Compares help placement across the pages of one set. "Relative order" is: the landmark that holds
 * it, the order of landmarks present on every page, and the order of the items shared by every page
 * within that landmark with the help item included.
 * @param {HelpPage[]} pages
 */
export function consistentHelp(pages) {
  /** @type {string[]} */
  const failures = [];
  if (pages.length < 2) failures.push('a page set needs at least two pages');
  for (const p of pages)
    for (const u of p.unmarkedHelp)
      failures.push(`${p.url}: help-like link "${u}" is not marked data-sj-help`);
  const withHelp = pages.filter((p) => p.help);
  if (withHelp.length < 2)
    failures.push('help appears on fewer than two pages (nothing repeated to compare)');
  const first = withHelp[0];
  if (first?.help) {
    const firstHelp = first.help;
    // Pairwise against the first page: only content present on BOTH pages can define relative order.
    const shared = (/** @type {string[]} */ a, /** @type {string[]} */ b) =>
      a.filter((x) => b.includes(x));
    for (const p of withHelp.slice(1)) {
      const h = /** @type {NonNullable<HelpPage['help']>} */ (p.help);
      if (h.landmark !== firstHelp.landmark)
        failures.push(
          `${p.url}: help sits in <${h.landmark}>, on ${first.url} it sits in <${firstHelp.landmark}>`,
        );
      const lm = shared(first.landmarks, p.landmarks);
      const lmOrder = (/** @type {string[]} */ l) => l.filter((x) => lm.includes(x)).join('>');
      if (lmOrder(first.landmarks) !== lmOrder(p.landmarks))
        failures.push(`${p.url}: landmark order differs from ${first.url}`);
      const items = shared(firstHelp.items, h.items);
      const itemOrder = (/** @type {string[]} */ l) => l.filter((x) => items.includes(x)).join('>');
      if (h.landmark === firstHelp.landmark && itemOrder(firstHelp.items) !== itemOrder(h.items))
        failures.push(
          `${p.url}: items around help are ordered ${itemOrder(h.items)}, on ${first.url} ${itemOrder(firstHelp.items)}`,
        );
    }
  }
  return verdict(failures);
}
