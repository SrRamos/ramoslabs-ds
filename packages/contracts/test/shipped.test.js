import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contractFiles, validateFile } from '../scripts/validate.mjs';

describe('shipped contracts', () => {
  for (const file of contractFiles()) {
    it(`${file.split('/').pop()} validates`, () => {
      expect(validateFile(file).errors).toEqual([]);
    });
  }

  it('shake-out contracts (W1-302) exist: button and switch', () => {
    const names = contractFiles().map((f) => f.split('/').pop());
    expect(names).toEqual(expect.arrayContaining(['button.contract.json', 'switch.contract.json']));
  });

  it('no shipped AT row claims tested-real without a recorded real test', () => {
    for (const file of contractFiles()) {
      const c = JSON.parse(readFileSync(file, 'utf8'));
      for (const row of c.a11y?.atSupport ?? [])
        if (row.test_status === 'tested-real') {
          expect(row.tested_on).toBeTruthy();
          expect(row.log).toBeTruthy();
        }
    }
  });
});
