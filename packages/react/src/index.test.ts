import { describe, expect, it } from 'vitest';

describe('@ramoslabs/react barrel', () => {
  it('loads in a jsdom-free environment, exports SJCheckbox, SJSwitch and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual([
      'SJCheckbox',
      'SJCheckboxControl',
      'SJCheckboxIndicator',
      'SJCheckboxLabel',
      'SJCheckboxRoot',
      'SJSwitch',
      'SJSwitchControl',
      'SJSwitchLabel',
      'SJSwitchRoot',
      'SJSwitchThumb',
    ]);
  });
});
