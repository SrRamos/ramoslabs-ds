// SJCheckbox conformance fixtures (W1-C03c.f). One map from the contract's fixture names to props, shared
// by the browser host, every Playwright spec and the node-side tests. Props use the adapter-neutral
// vocabulary of the contract (`checked`, `defaultChecked`, `indeterminate`, `defaultIndeterminate`,
// `disabled`, `name`, `value`, `id`) plus the visible `label`. No Node imports: the browser bundle imports
// this file too.
export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

export type CheckboxFixtureProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  defaultIndeterminate?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  label?: string;
};

export const LABEL = 'Accept the terms';
/** Wraps over several lines at the 480 px viewport; the label must not change with state. */
export const LONG_LABEL =
  'I agree to receive product updates, security notices and occasional offers by email, and I ' +
  'understand that I can withdraw this consent at any time from my account settings page';

/** The contract's `fixtures` list, in order. */
export const FIXTURES: Record<string, CheckboxFixtureProps> = {
  unchecked: { label: LABEL },
  checked: { defaultChecked: true, label: LABEL },
  indeterminate: { defaultIndeterminate: true, label: LABEL },
  disabled: { disabled: true, label: LABEL },
  'long-label': { label: LONG_LABEL },
};

/** The four machine positions as fixture props (the contract's `state.machine`). */
export const POSITIONS: Record<string, CheckboxFixtureProps> = {
  unchecked: { label: LABEL },
  checked: { defaultChecked: true, label: LABEL },
  'mixed-unchecked': { defaultIndeterminate: true, label: LABEL },
  'mixed-checked': { defaultChecked: true, defaultIndeterminate: true, label: LABEL },
};

/** Fixtures that carry form identity, for the submit-equivalence runs. */
export const FORM_FIXTURES: Record<string, CheckboxFixtureProps> = {
  'off named': { name: 'terms', label: LABEL },
  'on named': { name: 'terms', defaultChecked: true, label: LABEL },
  'on custom value': { name: 'terms', value: 'yes', defaultChecked: true, label: LABEL },
  'off custom value': { name: 'terms', value: 'yes', label: LABEL },
  'disabled on': { name: 'terms', defaultChecked: true, disabled: true, label: LABEL },
  'disabled off': { name: 'terms', disabled: true, label: LABEL },
  'no name on': { defaultChecked: true, label: LABEL },
  'long label on': { name: 'terms', defaultChecked: true, label: LONG_LABEL },
  'empty value on': { name: 'terms', value: '', defaultChecked: true, label: LABEL },
  'mixed unchecked': { name: 'terms', defaultIndeterminate: true, label: LABEL },
  'mixed checked': {
    name: 'terms',
    value: 'yes',
    defaultChecked: true,
    defaultIndeterminate: true,
    label: LABEL,
  },
  'mixed disabled': {
    name: 'terms',
    defaultChecked: true,
    defaultIndeterminate: true,
    disabled: true,
    label: LABEL,
  },
};

/** The supports paths the Checkbox runs. It has no capability fallback (`support: []`): `native` is real
 *  detection, `fallback:all` forces every capability false at once (the floor combination). */
export const CHECKBOX_PATHS = ['native', 'fallback:all'] as const;
