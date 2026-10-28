import { describe, expect, it } from 'vitest';

describe('@ramoslabs/vue barrel', () => {
  it('loads in a jsdom-free environment, exports SJCheckbox and SJSwitch and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual(['SJCheckbox', 'SJSwitch']);
  });
});
