// Seeded failures for `specs:check` (G3A MUST-1): the real tree passes, and each kind of drift is reported.
import { cpSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkAll, checkDir, componentDirs, REQUIRED } from './check.mjs';

const here = import.meta.dirname;
const tmp: string[] = [];
afterEach(() => tmp.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A copy of one real component directory, so a seed can break it without touching the repo. */
function copyOf(name: string): string {
  const root = mkdtempSync(join(tmpdir(), 'sj-specs-'));
  tmp.push(root);
  const dir = join(root, name);
  cpSync(join(here, name), dir, { recursive: true });
  mkdirSync(join(dir, 'visual', 'baselines'), { recursive: true });
  return dir;
}
const opts = (slug: string) => ({
  slug,
  scripts: Object.fromEntries(
    ['test:e2e', 'parity', 'visual', 'voiceover'].map((s) => [`${s}:${slug}`, 'x']),
  ),
});

describe('specs:check', () => {
  it('the repository tree follows the layout, template included', () => {
    expect(checkAll()).toEqual([]);
    expect(componentDirs()).toEqual(expect.arrayContaining(['button', 'switch']));
  });

  it('a copy of the real directories passes (the seeds below are the only difference)', () => {
    expect(checkDir(copyOf('button'), opts('button'))).toEqual([]);
    expect(checkDir(copyOf('switch'), opts('switch'))).toEqual([]);
  });

  it.each(REQUIRED as string[])('seeded: removing %s is reported', (f) => {
    const dir = copyOf('switch');
    unlinkSync(join(dir, f));
    expect(checkDir(dir, opts('switch')).join('\n')).toContain(`missing ${f}`);
  });

  it('composition/ is optional: spec files pass, anything else is unexpected (G-ICON MUST-2)', () => {
    const dir = copyOf('switch');
    mkdirSync(join(dir, 'composition'), { recursive: true });
    writeFileSync(join(dir, 'composition', 'button.e2e.ts'), 'export {};\n');
    expect(checkDir(dir, opts('switch'))).toEqual([]);
    writeFileSync(join(dir, 'composition', 'notes.md'), 'x');
    expect(checkDir(dir, opts('switch')).join('\n')).toContain('unexpected composition/notes.md');
  });

  it('seeded: a per-component triage file, a stray file, a standalone config and a missing script fail', () => {
    const dir = copyOf('button');
    writeFileSync(join(dir, 'a11y-triage.json'), '{}');
    writeFileSync(join(dir, 'notes.txt'), 'x');
    writeFileSync(join(dir, 'playwright.config.ts'), 'export default {};\n');
    const out = checkDir(dir, { slug: 'button', scripts: {} }).join('\n');
    expect(out).toContain('per-component triage files are forbidden');
    expect(out).toContain('unexpected notes.txt');
    expect(out).toContain('must extend e2e/runner/playwright.config');
    expect(out).toContain('no script "parity:button"');
  });
});
