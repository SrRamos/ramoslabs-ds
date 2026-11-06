/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behaviour is covered by conformance.test.ts and the browser matrix.
// SJField / SJInput / SJForm visual scenes (W1-C02.f, ADR-013 L5), in the shape the visual harness (visual/)
// consumes. Static markup identical to what the adapters render (same classes, data-parts, ids and ARIA); tokens
// only, no raw values. NOT self-approved: the baselines below `baselines/` stay empty until a human reviews
// candidates (see visual/cli.js). `forced` and `rtl` are applied by the capture hook (forced-colors emulation)
// or by the markup (dir). `focus: true` presses Tab once, so the ring is the real :focus-visible one. There is no
// SJForm scene: SJForm ships no stylesheet and has no visible part (C02.b).
import { ERROR, HINT, LABEL, LONG_LABEL } from '../fixtures.ts';

const ICON =
  '<span class="sj-field__icon" data-part="icon" aria-hidden="true">' +
  '<svg class="sj-icon" data-part="root" data-size="sm" viewBox="0 0 24 24" width="1em" height="1em" fill="none" ' +
  'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line>' +
  '<line x1="12" x2="12.01" y1="16" y2="16"></line></svg></span>';

/** One SJField > SJInput as the adapters render it. */
const field = ({
  id = 'f',
  label = LABEL,
  kind = 'email',
  hint,
  error,
  required = false,
  disabled = false,
  touched = false,
  textarea = false,
} = {}) => {
  const describedby = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  const attrs =
    `class="sj-input__control" data-part="control" ${textarea ? '' : 'type="' + kind + '" '}` +
    `id="${id}" name="${id}"${required ? ' required' : ''}${disabled ? ' disabled' : ''}` +
    `${touched ? ' data-touched="true"' : ''}` +
    `${describedby ? ` aria-describedby="${describedby}"` : ''}${error ? ' aria-invalid="true"' : ''}`;
  return (
    `<div class="sj-field__root" data-part="root"${error ? ' data-invalid="true"' : ''}${disabled ? ' data-disabled="true"' : ''}>` +
    `<label class="sj-field__label" data-part="label" id="${id}-label" for="${id}">${label}</label>` +
    (hint ? `<div class="sj-field__hint" data-part="hint" id="${id}-hint">${hint}</div>` : '') +
    `<span class="sj-input__root" data-part="root" data-kind="${kind}">` +
    (textarea ? `<textarea ${attrs}></textarea>` : `<input ${attrs} />`) +
    `</span>` +
    (error
      ? `<div class="sj-field__error" data-part="error" id="${id}-error">${ICON}${error}</div>`
      : '') +
    `</div>`
  );
};

export const SCENES = [
  { name: 'field-default', html: field() },
  { name: 'field-hint', html: field({ hint: HINT }) },
  { name: 'field-required', html: field({ required: true }) },
  { name: 'field-invalid', html: field({ error: ERROR, hint: HINT }) },
  { name: 'field-disabled', html: field({ disabled: true }) },
  { name: 'field-long-label', html: field({ label: LONG_LABEL, hint: HINT }) },
  { name: 'field-focus', html: field(), focus: true },
  { name: 'field-focus-invalid', html: field({ error: ERROR }), focus: true },
  {
    name: 'input-textarea',
    html: field({ label: 'Street address', kind: 'address', textarea: true }),
  },
  {
    name: 'input-textarea-focus',
    html: field({ label: 'Street address', kind: 'address', textarea: true }),
    focus: true,
  },
  // The :user-invalid fallback: touched + required + empty, painted by [data-touched]:invalid alone (no aria-invalid).
  { name: 'input-touched-fallback', html: field({ required: true, touched: true }) },
  { name: 'field-default-rtl', html: `<div dir="rtl">${field()}</div>` },
  {
    name: 'field-invalid-rtl',
    html: `<div dir="rtl">${field({ error: ERROR, hint: HINT })}</div>`,
  },
  { name: 'field-default-forced-colors', html: field(), forced: true },
  { name: 'field-invalid-forced-colors', html: field({ error: ERROR }), forced: true },
  { name: 'field-disabled-forced-colors', html: field({ disabled: true }), forced: true },
  { name: 'field-focus-forced-colors', html: field(), forced: true, focus: true },
];

/** Capture hook: forced-colors scenes run under `forced-colors: active` emulation. */
export const mutate = async (name, page) => {
  if (SCENES.find((s) => s.name === name)?.forced)
    await page.emulateMedia({ forcedColors: 'active' });
};
