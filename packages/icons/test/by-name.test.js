import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { aliases, getIcon, icons } from '../src/by-name.ts';

const here = dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(readFileSync(join(here, '../src/icons.list.json'), 'utf8'));

describe('getIcon', () => {
  it('resolves every canonical name to its data', () => {
    expect(Object.keys(icons)).toHaveLength(78);
    for (const { name } of list.icons) expect(getIcon(name)?.name).toBe(name);
  });

  it('resolves every alias to its canonical icon and names the canonical form in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const { name, aliases: al } of list.icons) {
      for (const alias of al ?? []) {
        expect(getIcon(alias)?.name).toBe(name);
        expect(warn).toHaveBeenLastCalledWith(expect.stringContaining(`"${name}"`));
      }
    }
    expect(Object.keys(aliases).length).toBeGreaterThanOrEqual(15);
    warn.mockRestore();
  });

  it('returns undefined for unknown names, including prototype keys', () => {
    for (const n of [
      'nope',
      '',
      'check-circle',
      'edit-2',
      'constructor',
      '__proto__',
      'toString',
    ]) {
      expect(getIcon(n), n).toBeUndefined();
    }
  });
});
