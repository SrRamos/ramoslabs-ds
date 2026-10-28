/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behaviour is covered by visual.test.js and the browser matrix.
// SJSwitch visual scenes (W1-C03s.f, ADR-013 L5), in the shape the visual harness (visual/) consumes. Static
// markup identical to what the adapters render; tokens only, no raw values. NOT self-approved: the baselines
// below `baselines/` stay empty until a human reviews candidates (see visual/cli.js). `forced` and `rtl` are
// applied by the capture hook (forced-colors emulation) or by the markup (dir).
import { LABEL, LONG_LABEL } from '../fixtures.ts';

const sw = (state, { disabled = false, label = LABEL, id = 'sw' } = {}) =>
  `<label class="sj-switch__root" data-part="root" data-state="${state}"${disabled ? ' data-disabled="true"' : ''}>` +
  `<input id="${id}" class="sj-switch__control" type="checkbox" role="switch" data-part="control" data-state="${state}"` +
  `${state === 'on' ? ' checked' : ''}${disabled ? ' disabled data-disabled="true"' : ''} />` +
  `<span class="sj-switch__thumb" data-part="thumb" data-state="${state}"></span>` +
  `<span class="sj-switch__label">${label}</span></label>`;

export const SCENES = [
  { name: 'switch-off', html: sw('off') },
  { name: 'switch-on', html: sw('on') },
  { name: 'switch-disabled-off', html: sw('off', { disabled: true }) },
  { name: 'switch-disabled-on', html: sw('on', { disabled: true }) },
  { name: 'switch-focus', html: sw('on'), focus: true },
  { name: 'switch-long-label', html: sw('off', { label: LONG_LABEL }) },
  { name: 'switch-on-rtl', html: `<div dir="rtl">${sw('on')}</div>` },
  { name: 'switch-off-forced-colors', html: sw('off'), forced: true },
  { name: 'switch-on-forced-colors', html: sw('on'), forced: true },
];

/** Capture hook: forced-colors scenes run under `forced-colors: active` emulation. */
export const mutate = async (name, page) => {
  if (SCENES.find((s) => s.name === name)?.forced)
    await page.emulateMedia({ forcedColors: 'active' });
};
