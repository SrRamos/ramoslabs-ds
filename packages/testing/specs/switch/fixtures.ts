// SJSwitch conformance fixtures (W1-C03s.f). One map from the contract's fixture names to props, shared
// by the browser host, every Playwright spec and the node-side tests. Props use the adapter-neutral
// vocabulary of the contract (`checked`, `defaultChecked`, `disabled`, `name`, `value`, `id`) plus the
// visible `label`. No Node imports: the browser bundle imports this file too.
export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

export type SwitchFixtureProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  label?: string;
};

export const LABEL = 'Notifications';
/** Wraps over several lines at the 480 px viewport; the label must not change with state. */
export const LONG_LABEL =
  'Send me a notification whenever someone mentions me, replies to one of my threads, or assigns me ' +
  'a task, including on weekends, holidays and during the quiet hours I configured earlier';

/** The contract's `fixtures` list, in order. */
export const FIXTURES: Record<string, SwitchFixtureProps> = {
  off: { label: LABEL },
  on: { defaultChecked: true, label: LABEL },
  disabled: { disabled: true, label: LABEL },
  'long-label': { label: LONG_LABEL },
};

/** Fixtures that carry form identity, for the submit-equivalence runs. */
export const FORM_FIXTURES: Record<string, SwitchFixtureProps> = {
  'off named': { name: 'alerts', label: LABEL },
  'on named': { name: 'alerts', defaultChecked: true, label: LABEL },
  'on custom value': { name: 'alerts', value: 'yes', defaultChecked: true, label: LABEL },
  'off custom value': { name: 'alerts', value: 'yes', label: LABEL },
  'disabled on': { name: 'alerts', defaultChecked: true, disabled: true, label: LABEL },
  'disabled off': { name: 'alerts', disabled: true, label: LABEL },
  'no name on': { defaultChecked: true, label: LABEL },
  'long label on': { name: 'alerts', defaultChecked: true, label: LONG_LABEL },
  'empty value on': { name: 'alerts', value: '', defaultChecked: true, label: LABEL },
};

/** The supports paths the Switch runs. It has no capability fallback (`support: []`): `native` is real
 *  detection, `fallback:all` forces every capability false at once (the floor combination). */
export const SWITCH_PATHS = ['native', 'fallback:all'] as const;
