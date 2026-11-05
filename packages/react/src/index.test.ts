import { describe, expect, it } from 'vitest';

describe('@ramoslabs/react barrel', () => {
  it('loads in a jsdom-free environment, exports SJCheckbox, SJDisclosure, SJIcon, SJState, SJSwitch and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual([
      'SJCheckbox',
      'SJCheckboxControl',
      'SJCheckboxIndicator',
      'SJCheckboxLabel',
      'SJCheckboxRoot',
      'SJDisclosure',
      'SJDisclosureContent',
      'SJDisclosureRoot',
      'SJDisclosureTrigger',
      'SJField',
      'SJFieldContext',
      'SJFieldHint',
      'SJFieldLabel',
      'SJFieldRoot',
      'SJForm',
      'SJFormContext',
      'SJFormRoot',
      'SJIcon',
      'SJIconRoot',
      'SJInput',
      'SJInputRoot',
      'SJState',
      'SJStateRoot',
      'SJSwitch',
      'SJSwitchControl',
      'SJSwitchLabel',
      'SJSwitchRoot',
      'SJSwitchThumb',
      'useSJField',
    ]);
  });
});
