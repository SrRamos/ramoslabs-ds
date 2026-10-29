/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behaviour is covered by conformance.test.ts and the browser matrix.
// SJCheckbox visual scenes (W1-C03c.f, ADR-013 L5), in the shape the visual harness (visual/) consumes. Static
// markup identical to what the adapters render; tokens only, no raw values. NOT self-approved: the baselines
// below `baselines/` stay empty until a human reviews candidates (see visual/cli.js). `forced` and `rtl` are
// applied by the capture hook (forced-colors emulation) or by the markup (dir). Static markup cannot set the
// `indeterminate` property (it has no attribute), so the indeterminate scenes show exactly what a
// server-rendered page paints before hydration: the dash comes from `data-state="indeterminate"`.
import { LABEL, LONG_LABEL } from '../fixtures.ts';

const cb = (state, { disabled = false, label = LABEL, id = 'cb' } = {}) =>
  `<label class="sj-checkbox__root" data-part="root" data-state="${state}"${disabled ? ' data-disabled="true"' : ''}>` +
  `<input id="${id}" class="sj-checkbox__control" type="checkbox" data-part="control" data-state="${state}"` +
  `${state === 'checked' ? ' checked' : ''}${disabled ? ' disabled data-disabled="true"' : ''} />` +
  `<span class="sj-checkbox__indicator" data-part="indicator" data-state="${state}"></span>` +
  `<span class="sj-checkbox__label" data-part="label" data-state="${state}"${disabled ? ' data-disabled="true"' : ''}>${label}</span></label>`;

export const SCENES = [
  { name: 'checkbox-unchecked', html: cb('unchecked') },
  { name: 'checkbox-checked', html: cb('checked') },
  { name: 'checkbox-indeterminate', html: cb('indeterminate') },
  { name: 'checkbox-disabled-unchecked', html: cb('unchecked', { disabled: true }) },
  { name: 'checkbox-disabled-checked', html: cb('checked', { disabled: true }) },
  { name: 'checkbox-disabled-indeterminate', html: cb('indeterminate', { disabled: true }) },
  { name: 'checkbox-focus', html: cb('checked'), focus: true },
  { name: 'checkbox-focus-indeterminate', html: cb('indeterminate'), focus: true },
  { name: 'checkbox-long-label', html: cb('unchecked', { label: LONG_LABEL }) },
  { name: 'checkbox-checked-rtl', html: `<div dir="rtl">${cb('checked')}</div>` },
  { name: 'checkbox-indeterminate-rtl', html: `<div dir="rtl">${cb('indeterminate')}</div>` },
  { name: 'checkbox-unchecked-forced-colors', html: cb('unchecked'), forced: true },
  { name: 'checkbox-checked-forced-colors', html: cb('checked'), forced: true },
  { name: 'checkbox-indeterminate-forced-colors', html: cb('indeterminate'), forced: true },
];

/** Capture hook: forced-colors scenes run under `forced-colors: active` emulation. */
export const mutate = async (name, page) => {
  if (SCENES.find((s) => s.name === name)?.forced)
    await page.emulateMedia({ forcedColors: 'active' });
};
