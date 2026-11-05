import { describe, expect, it } from 'vitest';

describe('@ramoslabs/vue barrel', () => {
  it('loads in a jsdom-free environment, exports the SJ components and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual([
      'SJCheckbox',
      'SJDisclosure',
      'SJField',
      'SJForm',
      'SJIcon',
      'SJInput',
      'SJState',
      'SJSwitch',
    ]);
  });
});
