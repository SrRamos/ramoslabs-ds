import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('@ramoslabs/css', () => {
  it('is the only package declaring CSS side effects', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.sideEffects).toEqual(['**/*.css']);
    expect(pkg.dependencies).toBeUndefined();
  });
});
