import { describe, expect, it } from 'vitest';

describe('@ramoslabs/vue barrel', () => {
  it('loads in a jsdom-free environment, exports the SJ components and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual([
      'SJButton',
      'SJCheckbox',
      'SJDisclosure',
      'SJField',
      'SJForm',
      'SJIcon',
      'SJInput',
      'SJSkeleton',
      'SJState',
      'SJSwitch',
    ]);
  });
});
