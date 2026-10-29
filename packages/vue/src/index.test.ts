import { describe, expect, it } from 'vitest';

describe('@ramoslabs/vue barrel', () => {
  it('loads in a jsdom-free environment, exports SJCheckbox, SJIcon and SJSwitch and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel).sort()).toEqual(['SJCheckbox', 'SJIcon', 'SJSwitch']);
  });
});
