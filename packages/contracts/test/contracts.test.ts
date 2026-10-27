import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('@ramoslabs/contracts', () => {
  it('ships data only: no runtime dependencies and no JS entry', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.main).toBeUndefined();
  });
});
