/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
// Visual scenes (W1-312). Static markup only: the harness is hermetic, so a scene never runs a
// framework, a timer or a network call. Layout uses tokens (`var(--space-*)`), never raw values.
// Each scene is `{ name, html, focus? }`. `focus: true` presses Tab once (keyboard modality) so the
// focus ring is the real :focus-visible one.

const probe = (state, extra = '') =>
  `<button type="button" class="sj-probe__root" data-part="root" role="switch" ` +
  `aria-checked="${state === 'on'}" data-state="${state}" data-variant="solid" data-tone="primary" ${extra}>` +
  `<span class="sj-probe__indicator" data-part="indicator"></span>Notifications</button>`;

export const SCENES = [
  { name: 'probe-off', html: probe('off') },
  { name: 'probe-on', html: probe('on') },
  { name: 'probe-disabled', html: probe('off', 'disabled data-disabled') },
  { name: 'probe-focus', html: probe('off'), focus: true },
  {
    name: 'type-specimen',
    html: [
      ['--font-family-display', '800', 'Display Aa Gg 0123'],
      ['--font-family-sans', '400', 'Sans regular: the quick brown fox'],
      ['--font-family-sans', '600', 'Sans semibold: the quick brown fox'],
      ['--font-family-alt', '400', 'Alt regular: the quick brown fox'],
    ]
      .map(
        ([fam, w, text]) =>
          `<p class="spec" style="font-family: var(${fam}); font-weight: ${w}">${text}</p>`,
      )
      .join(''),
  },
  {
    name: 'color-swatches',
    html: ['primary', 'slate-900', 'slate-500', 'white']
      .map((c) => `<span class="swatch" style="background-color: var(--color-${c})"></span>`)
      .join(''),
  },
];
