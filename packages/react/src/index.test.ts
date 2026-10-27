import { describe, expect, it } from 'vitest';

describe('@ramoslabs/react barrel', () => {
  it('loads in a jsdom-free environment and registers nothing on import', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel)).toEqual([]);
  });
});
