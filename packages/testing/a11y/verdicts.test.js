// Unit tests for the L3 verdicts on hand-built measurements (no browser): each criterion has a pass
// input and a seeded-fail input, so a verdict that stopped failing would be caught here too.
import { describe, expect, it } from 'vitest';
import {
  accessibleAuthentication,
  applyAxeTriage,
  consistentHelp,
  draggingAlternative,
  focusAppearance,
  focusNotObscured,
  parseBoxShadow,
  parseCssColor,
  redundantEntry,
  targetSize,
  validateTriage,
} from './verdicts.js';

const ring = '#4f46e5';
const base = (over = {}) => ({
  outline: { style: 'none', width: 0, color: 'rgba(0, 0, 0, 0)' },
  boxShadow: 'none',
  backdropChain: ['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'],
  focusVisible: true,
  forcedColors: false,
  ...over,
});

describe('triage', () => {
  const ok = { rule: 'x', fixture: 'f', issue: '#1', owner: '@me', reason: 'r' };
  it('accepts an entry with issue and owner', () =>
    expect(validateTriage({ axe: [ok] })).toEqual([]));
  it('rejects missing or malformed issue and owner', () => {
    expect(validateTriage({ axe: [{ ...ok, issue: '' }] })).not.toEqual([]);
    expect(validateTriage({ axe: [{ ...ok, issue: 'soon' }] })).not.toEqual([]);
    expect(validateTriage({ axe: [{ ...ok, owner: '' }] })).not.toEqual([]);
  });
  it('an invalid entry triages nothing; a valid one is scoped to rule and fixture', () => {
    const v = [{ id: 'x' }, { id: 'y' }];
    expect(applyAxeTriage(v, 'f', { axe: [{ ...ok, owner: '' }] }).untriaged).toHaveLength(2);
    expect(applyAxeTriage(v, 'f', { axe: [ok] }).untriaged.map((e) => e.id)).toEqual(['y']);
    expect(applyAxeTriage(v, 'other', { axe: [ok] }).untriaged).toHaveLength(2);
  });
  it('a target-size exception needs a known kind, a reason and an owner', () => {
    const e = { fixture: 'f', target: '#a', exception: 'essential', reason: 'r', owner: '@me' };
    expect(validateTriage({ targetSize: [e] })).toEqual([]);
    expect(validateTriage({ targetSize: [{ ...e, exception: 'because' }] })).not.toEqual([]);
    expect(validateTriage({ targetSize: [{ ...e, target: '' }] })).not.toEqual([]);
  });
});

describe('2.4.11', () => {
  it('passes with no covered samples', () =>
    expect(focusNotObscured({ total: 81, obscured: 0, offscreen: 0, occluders: [] }).pass).toBe(
      true,
    ));
  it('fails partial cover (ADR strict) and flags entire hiding separately', () => {
    const part = focusNotObscured({
      total: 81,
      obscured: 10,
      offscreen: 0,
      occluders: ['div#banner'],
    });
    expect(part.pass).toBe(false);
    expect(part.entirelyHidden).toBe(false);
    expect(
      focusNotObscured({ total: 81, obscured: 81, offscreen: 0, occluders: ['div#b'] })
        .entirelyHidden,
    ).toBe(true);
  });
  it('fails when nothing is measurable', () =>
    expect(focusNotObscured({ total: 0, obscured: 0, offscreen: 81, occluders: [] }).pass).toBe(
      false,
    ));
});

describe('2.4.13', () => {
  it('parses colours and shadows', () => {
    expect(parseCssColor('rgb(79, 70, 229)')?.hex).toBe(ring);
    expect(parseCssColor('rgba(0, 0, 0, 0)')?.alpha).toBe(0);
    expect(
      parseBoxShadow('rgb(255, 255, 255) 0px 0px 0px 2px, rgb(79, 70, 229) 0px 0px 0px 4px'),
    ).toHaveLength(2);
  });
  it('passes the two-tone token ring (white gap, 2px indigo edge)', () => {
    const v = focusAppearance(
      base({ boxShadow: 'rgb(255, 255, 255) 0px 0px 0px 2px, rgb(79, 70, 229) 0px 0px 0px 4px' }),
    );
    expect(v.failures).toEqual([]);
    expect(v.thickness).toBe(2);
  });
  it('passes a 2px solid outline', () =>
    expect(
      focusAppearance(base({ outline: { style: 'solid', width: 2, color: 'rgb(79, 70, 229)' } }))
        .pass,
    ).toBe(true));
  it('fails: nothing, 1px, low contrast, blurred glow, not focus-visible', () => {
    expect(focusAppearance(base()).pass).toBe(false);
    expect(
      focusAppearance(base({ outline: { style: 'solid', width: 1, color: 'rgb(79, 70, 229)' } }))
        .pass,
    ).toBe(false);
    expect(
      focusAppearance(base({ outline: { style: 'solid', width: 3, color: 'rgb(226, 232, 240)' } }))
        .pass,
    ).toBe(false);
    expect(focusAppearance(base({ boxShadow: 'rgb(79, 70, 229) 0px 0px 8px 4px' })).pass).toBe(
      false,
    );
    expect(
      focusAppearance(base({ boxShadow: 'rgb(79, 70, 229) 0px 0px 0px 3px', focusVisible: false }))
        .pass,
    ).toBe(false);
  });
  it('contrast is judged against the real backdrop, not white', () => {
    const dark = base({
      backdropChain: ['rgba(0, 0, 0, 0)', 'rgb(30, 41, 59)'],
      outline: { style: 'solid', width: 2, color: 'rgb(79, 70, 229)' },
    });
    expect(focusAppearance(dark).pass).toBe(false); // indigo on slate 800 is below 3:1
  });
});

describe('2.5.8', () => {
  /** @param {string} id @param {number} x @param {number} y @param {number} w @param {number} h @param {boolean} [inline] */
  const t = (id, x, y, w, h, inline = false) => ({ id, x, y, w, h, inline });
  it('passes 24px+ targets, spaced small targets and inline links', () => {
    const v = targetSize([
      t('#a', 0, 0, 44, 44),
      t('#b', 100, 0, 16, 16),
      t('#c', 200, 0, 16, 16),
      t('#i', 0, 100, 60, 14, true),
    ]);
    expect(v.failures).toEqual([]);
    expect(v.exceptionsUsed).toHaveLength(2);
  });
  it('fails adjacent undersized targets', () =>
    expect(targetSize([t('#a', 0, 0, 16, 16), t('#b', 18, 0, 16, 16)]).failures).toHaveLength(2));
  it('fails an undersized target close to a large one', () =>
    expect(targetSize([t('#a', 0, 0, 16, 16), t('#big', 18, 0, 44, 44)]).failures).toHaveLength(1));
  it('an exact valid exception clears only that target', () => {
    const ex = { fixture: 'f', target: '#a', exception: 'essential', reason: 'r', owner: '@me' };
    const ts = [t('#a', 0, 0, 16, 16), t('#b', 18, 0, 16, 16)];
    expect(targetSize(ts, [ex], 'f').failures).toHaveLength(1);
    expect(targetSize(ts, [{ ...ex, owner: '' }], 'f').failures).toHaveLength(2);
    expect(targetSize(ts, [ex], 'other').failures).toHaveLength(2);
  });
  it('24px exactly is enough', () =>
    expect(targetSize([t('#a', 0, 0, 24, 24), t('#b', 25, 0, 24, 24)]).pass).toBe(true));
});

describe('2.5.7', () => {
  const c = { id: '#i', reason: 'draggable', alt: 'btn', scope: 'list' };
  const ok = { exists: true, visible: true, enabled: true, focusable: true, changedScope: true };
  it('passes with a working alternative', () =>
    expect(draggingAlternative([c], { '#i': ok }).pass).toBe(true));
  it('fails: no candidate, no alt, missing, disabled, inert', () => {
    expect(draggingAlternative([], {}).pass).toBe(false);
    expect(draggingAlternative([{ ...c, alt: null }], {}).pass).toBe(false);
    expect(draggingAlternative([c], { '#i': { ...ok, exists: false } }).pass).toBe(false);
    expect(draggingAlternative([c], { '#i': { ...ok, enabled: false } }).pass).toBe(false);
    expect(draggingAlternative([c], { '#i': { ...ok, changedScope: false } }).pass).toBe(false);
  });
});

describe('3.3.7', () => {
  /** @param {'prefilled'|'offered'|'missing'} status @param {string | null} [exempt] */
  const f = (status, exempt = null) => ({ id: '#f', token: 'email', status, exempt });
  it('passes prefilled, offered and validly exempt', () => {
    expect(redundantEntry([f('prefilled'), f('offered')]).pass).toBe(true);
    expect(redundantEntry([f('missing', 'security')]).pass).toBe(true);
  });
  it('fails missing, unknown exemption, and an empty exercise', () => {
    expect(redundantEntry([f('missing')]).pass).toBe(false);
    expect(redundantEntry([f('missing', 'lazy')]).pass).toBe(false);
    expect(redundantEntry([]).pass).toBe(false);
  });
});

describe('3.3.8', () => {
  /** @param {Record<string, unknown>} [over] @returns {any} */
  const field = (over = {}) => ({
    id: '#p',
    kind: 'password',
    autocomplete: 'current-password',
    pasteBlocked: false,
    fillKept: true,
    ...over,
  });
  it('passes managers, paste and OTP autofill with no cognitive test', () =>
    expect(
      accessibleAuthentication({
        fields: [field(), field({ id: '#o', kind: 'otp', autocomplete: 'one-time-code' })],
        cognitive: [],
      }).pass,
    ).toBe(true));
  it('fails each seeded defect', () => {
    for (const bad of [{ autocomplete: 'off' }, { pasteBlocked: true }, { fillKept: false }])
      expect(accessibleAuthentication({ fields: [field(bad)], cognitive: [] }).pass).toBe(false);
    expect(accessibleAuthentication({ fields: [field()], cognitive: ['captcha'] }).pass).toBe(
      false,
    );
    expect(accessibleAuthentication({ fields: [], cognitive: [] }).pass).toBe(false);
  });
});

describe('3.2.6', () => {
  /** @param {string} url @param {string[]} items @param {string} [landmark] @param {string[]} [landmarks] */
  const page = (url, items, landmark = 'footer', landmarks = ['header', 'main', 'footer']) => ({
    url,
    landmarks,
    help: { name: 'Help', landmark, items },
    unmarkedHelp: [],
  });
  it('passes a stable placement', () =>
    expect(
      consistentHelp([page('/1', ['Terms', 'Help']), page('/2', ['Terms', 'Help'])]).pass,
    ).toBe(true));
  it('fails: moved landmark, reordered neighbours, reordered landmarks, unmarked help, single page', () => {
    expect(
      consistentHelp([page('/1', ['Terms', 'Help']), page('/2', ['Help'], 'header')]).pass,
    ).toBe(false);
    expect(
      consistentHelp([page('/1', ['Terms', 'Help']), page('/2', ['Help', 'Terms'])]).pass,
    ).toBe(false);
    expect(
      consistentHelp([
        page('/1', ['Help']),
        page('/2', ['Help'], 'footer', ['footer', 'main', 'header']),
      ]).pass,
    ).toBe(false);
    expect(
      consistentHelp([page('/1', ['Help']), { ...page('/2', ['Help']), unmarkedHelp: ['Contact'] }])
        .pass,
    ).toBe(false);
    expect(consistentHelp([page('/1', ['Help'])]).pass).toBe(false);
  });
});
