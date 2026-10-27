// @ts-check
/* global document, getComputedStyle, matchMedia, ClipboardEvent, DataTransfer, window, location */
// Browser-side collectors for the L3 gates (W1-310). Each function is SELF-CONTAINED: Playwright
// serialises it with toString() and runs it in the page, so it may not close over module scope.
// Collectors only measure; verdicts.js decides.

/** Describes an element for a failure message. */
export function collectFocusObscured() {
  /** @param {Element} e */
  const describe = (e) =>
    `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${typeof e.className === 'string' && e.className ? `.${e.className.split(' ')[0]}` : ''}`;
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement)
    return { total: 0, obscured: 0, offscreen: 0, occluders: [], error: 'nothing is focused' };
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0)
    return {
      total: 0,
      obscured: 0,
      offscreen: 0,
      occluders: [],
      error: 'focused element has no size',
    };
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  /** The nearest fixed/sticky/top-layer ancestor-or-self of a hit node, or null. @param {Element} n */
  const overlayOf = (n) => {
    for (let c = /** @type {Element | null} */ (n); c; c = c.parentElement) {
      if (['fixed', 'sticky'].includes(getComputedStyle(c).position)) return c;
      try {
        if (c.matches(':modal, :popover-open')) return c;
      } catch {
        /* older engines lack the selector; position covers dialogs */
      }
    }
    return null;
  };
  const N = 9;
  let total = 0;
  let obscured = 0;
  let offscreen = 0;
  /** @type {string[]} */
  const occluders = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = r.left + ((i + 0.5) / N) * r.width;
      const y = r.top + ((j + 0.5) / N) * r.height;
      if (x < 0 || y < 0 || x >= vw || y >= vh) {
        offscreen++;
        continue;
      }
      total++;
      const hit = document.elementFromPoint(x, y);
      if (!hit || el.contains(hit) || hit.contains(el)) continue;
      const o = overlayOf(hit);
      if (o && !o.contains(el)) {
        obscured++;
        occluders.push(describe(o));
      }
    }
  }
  return { total, obscured, offscreen, occluders };
}

export function collectFocusAppearance() {
  const el = /** @type {HTMLElement} */ (document.activeElement);
  const s = getComputedStyle(el);
  /** @type {string[]} */
  const chain = [];
  for (let n = /** @type {Element | null} */ (el); n; n = n.parentElement)
    chain.push(getComputedStyle(n).backgroundColor);
  return {
    outline: {
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth) || 0,
      color: s.outlineColor,
    },
    boxShadow: s.boxShadow,
    backdropChain: chain,
    focusVisible: el.matches(':focus-visible'),
    forcedColors: matchMedia('(forced-colors: active)').matches,
  };
}

export function collectTargets() {
  const SEL =
    'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [role=option], [role=combobox], [tabindex]:not([tabindex="-1"])';
  /** @param {Element} e */
  const name = (e) =>
    e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}[${(e.textContent ?? '').trim().slice(0, 20)}]`;
  /** An inline link that sits in a sentence: inline display and sibling text in its block. @param {HTMLElement} e */
  const inlineInText = (e) => {
    if (e.tagName !== 'A' || getComputedStyle(e).display !== 'inline') return false;
    const block = e.parentElement;
    if (!block) return false;
    let own = '';
    for (const n of block.childNodes) if (n.nodeType === 3) own += n.textContent ?? '';
    return own.replace(/\s+/g, ' ').trim().length > 0;
  };
  return [...document.querySelectorAll(SEL)]
    .filter((e) => {
      const el = /** @type {HTMLElement} */ (e);
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        cs.visibility !== 'hidden' &&
        !el.matches(':disabled') &&
        el.getAttribute('aria-disabled') !== 'true'
      );
    })
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        id: name(e),
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        w: r.width,
        h: r.height,
        inline: inlineInText(/** @type {HTMLElement} */ (e)),
      };
    });
}

export function collectDragCandidates() {
  /** @type {Map<Element, string>} */
  const found = new Map();
  for (const e of document.querySelectorAll('[draggable="true"]')) found.set(e, 'draggable');
  for (const e of document.querySelectorAll('[data-sj-drag]'))
    found.set(e, found.get(e) ?? 'data-sj-drag');
  for (const e of document.querySelectorAll('body *')) {
    if (found.has(e)) continue;
    const s = getComputedStyle(e);
    if (s.cursor === 'grab' || s.cursor === 'grabbing') found.set(e, 'cursor: grab');
    else if (s.touchAction === 'none') found.set(e, 'touch-action: none');
  }
  return [...found].map(([e, reason]) => ({
    id: e.id ? `#${e.id}` : e.tagName.toLowerCase(),
    reason,
    alt: e.getAttribute('data-sj-drag-alt'),
    scope: e.getAttribute('data-sj-drag-scope'),
  }));
}

/** @param {{ alt: string, scope: string | null }} a */
export function inspectDragAlt(a) {
  const el = /** @type {HTMLElement | null} */ (document.getElementById(a.alt));
  if (!el)
    return { exists: false, visible: false, enabled: false, focusable: false, scopeHtml: null };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const scope = a.scope ? document.getElementById(a.scope) : null;
  return {
    exists: true,
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
    enabled: !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true',
    focusable: el.tabIndex >= 0,
    scopeHtml: scope ? scope.innerHTML : null,
  };
}

/** @param {string | null} scope */
export function readScope(scope) {
  const el = scope ? document.getElementById(scope) : null;
  return el ? el.innerHTML : null;
}

/** Visible, fillable fields of the current step, with their autocomplete token. */
export function collectStepFields() {
  return [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => {
      const el = /** @type {HTMLInputElement} */ (e);
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        !['hidden', 'checkbox', 'radio', 'button', 'submit'].includes(el.type)
      );
    })
    .map((e) => {
      const el = /** @type {HTMLInputElement} */ (e);
      const tokens = (el.getAttribute('autocomplete') ?? '').split(/\s+/).filter(Boolean);
      const list = el.getAttribute('list');
      return {
        id: el.id,
        token: tokens[tokens.length - 1] ?? '',
        value: el.value,
        exempt: el.getAttribute('data-sj-redundant-exempt'),
        reuse: [...document.querySelectorAll(`[data-sj-reuse-of~="${el.id}"]`)].map((r) => r.id),
        listValues: list
          ? [...(document.getElementById(list)?.querySelectorAll('option') ?? [])].map(
              (o) => o.value,
            )
          : [],
      };
    });
}

export function collectAuth() {
  /** @param {HTMLInputElement} el */
  const pasteBlocked = (el) => {
    el.focus();
    let ev;
    try {
      ev = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
    } catch {
      ev = new Event('paste', { bubbles: true, cancelable: true });
    }
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  /** @type {{ id: string, kind: string, autocomplete: string, pasteBlocked: boolean }[]} */
  const fields = [];
  for (const e of document.querySelectorAll('input')) {
    const el = /** @type {HTMLInputElement} */ (e);
    const ac = el.getAttribute('autocomplete') ?? '';
    const isOtp = /one-time-code/.test(ac) || el.hasAttribute('data-sj-otp');
    const kind =
      el.type === 'password'
        ? 'password'
        : isOtp
          ? 'otp'
          : el.hasAttribute('data-sj-username') || /\busername\b|\bwebauthn\b/.test(ac)
            ? 'username'
            : null;
    if (!kind) continue;
    fields.push({ id: el.id, kind, autocomplete: ac, pasteBlocked: pasteBlocked(el) });
  }
  /** @type {string[]} */
  const cognitive = [];
  const markers =
    '.g-recaptcha, .h-captcha, [data-sitekey], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [class*="captcha" i], [id*="captcha" i], input[name*="captcha" i]';
  for (const e of document.querySelectorAll(markers))
    cognitive.push(`captcha marker ${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}`);
  const text = document.body.innerText;
  const phrase =
    /(type|enter) the (characters|letters|text) (you see|shown|in the image)|select all (images|squares)|solve (the|this) puzzle|what is \d+\s*[+\-x*]\s*\d+|drag the (slider|piece)/i.exec(
      text,
    );
  if (phrase) cognitive.push(`test phrase "${phrase[0]}"`);
  return { fields, cognitive };
}

export function collectHelp() {
  const LANDMARKS =
    'header, nav, main, aside, footer, [role=banner], [role=navigation], [role=main], [role=complementary], [role=contentinfo]';
  /** @param {Element} e */
  const lmName = (e) => {
    const role = e.getAttribute('role');
    if (role)
      return (
        {
          banner: 'header',
          navigation: 'nav',
          main: 'main',
          complementary: 'aside',
          contentinfo: 'footer',
        }[role] ?? role
      );
    return e.tagName.toLowerCase();
  };
  /** @param {Element} e */
  const nameOf = (e) =>
    (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim();
  const lms = [...document.querySelectorAll(LANDMARKS)];
  const landmarks = lms.map(lmName);
  const marked = document.querySelector('[data-sj-help]');
  /** @type {{ name: string, landmark: string, items: string[] } | null} */
  let help = null;
  if (marked) {
    const lm = marked.closest(LANDMARKS);
    help = {
      name: nameOf(marked),
      landmark: lm ? lmName(lm) : 'none',
      items: lm ? [...lm.querySelectorAll('a[href], button, [role=button]')].map(nameOf) : [],
    };
  }
  const unmarkedHelp = [...document.querySelectorAll('a[href]')]
    .filter((a) => !a.closest('[data-sj-help]') && !a.hasAttribute('data-sj-help'))
    .filter(
      (a) =>
        /(^|[/#?=-])(help|support|contact)([/#?=.-]|$)/i.test(a.getAttribute('href') ?? '') ||
        /^(help|support|contact( us)?)$/i.test(nameOf(a)),
    )
    .map(nameOf);
  return { url: location.pathname, landmarks, help, unmarkedHelp };
}
