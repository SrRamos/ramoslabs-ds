import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('core test environment (ADR-002)', () => {
  it('runs without a DOM by default', () => {
    expect('document' in globalThis).toBe(false);
    expect('window' in globalThis).toBe(false);
  });

  it('fails a module that touches `document` at import time', async () => {
    await expect(import('../fixtures/touches-document')).rejects.toThrow(ReferenceError);
  });

  it('loads the barrel without side effects', async () => {
    const barrel = await import('./index');
    expect(Object.keys(barrel)).toEqual([]);
  });
});

describe('fast-check is available (ADR-013 layer 1)', () => {
  it('checks a property over generated inputs', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (xs) => {
        const sorted = [...xs].sort((a, b) => a - b);
        return sorted.length === xs.length && sorted.every((v, i) => i === 0 || sorted[i - 1] <= v);
      }),
    );
  });
});
