import { describe, expect, it } from 'vitest';

describe('@ramoslabs/react barrel', () => {
  it('loads in a jsdom-free environment, exports SJSwitch and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual([
      'SJSwitch',
      'SJSwitchControl',
      'SJSwitchLabel',
      'SJSwitchRoot',
      'SJSwitchThumb',
    ]);
  });
});
