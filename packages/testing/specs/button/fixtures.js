// @ts-check
// SJButton conformance fixtures (W1-C01.f). Data only: the single map from contract fixture names to the
// props every adapter mounts. `text` is the visible label, `icon` a decorative glyph (rendered aria-hidden).
// The five names in `button.contract.json#fixtures` are required; `EXTRA_FIXTURES` are conformance-only
// (named here, not in the contract) because they need a form owner or a form value.

/**
 * @typedef {{ text?: string, icon?: string, variant?: string, tone?: string, size?: string,
 *   disabled?: boolean, type?: string, href?: string, target?: string, rel?: string, iconOnly?: boolean,
 *   label?: string, name?: string, value?: string }} FixtureProps
 */

/** @type {Record<string, FixtureProps>} */
export const FIXTURES = {
  default: { text: 'Save changes' },
  disabled: { text: 'Save changes', disabled: true },
  'long-label': {
    text: 'Archive every conversation older than ninety days and notify all of the workspace owners',
  },
  'icon-only': { iconOnly: true, label: 'Close dialog', icon: '✕' },
  link: { href: '#activated', text: 'Read the documentation' },
  // Conformance-only: a real submit button. name/value prove the submitter reaches the form data.
  submit: { type: 'submit', name: 'intent', value: 'save', text: 'Submit form' },
};

/** Fixture names that exist only for conformance. */
export const EXTRA_FIXTURES = ['submit'];

/** Fixtures that must not fire `press` (the contract's inert fixture name, plus nothing else). */
export const INERT = ['disabled'];

/** Container width (CSS px) for the long-label fixture, so wrapping is exercised in every engine. */
export const NARROW_PX = 240;
