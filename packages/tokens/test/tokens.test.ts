import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const flat = new URL('../dist/tokens.json', import.meta.url);

describe('@ramoslabs/tokens build output', () => {
  it('emits the flat token map', () => {
    expect(existsSync(flat)).toBe(true);
    const map = JSON.parse(readFileSync(flat, 'utf8'));
    expect(map['color-indigo-600']).toBe('#4f46e5');
  });
});
