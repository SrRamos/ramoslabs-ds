import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const require = createRequire(join(pkgDir, 'package.json'));

describe('manifest', () => {
  it('has no runtime or peer dependencies and an exact-pinned lucide-static devDependency', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
    expect(pkg.devDependencies['lucide-static']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.sideEffects).toBe(false);
  });

  it('exports ".", "./by-name" and "./*" and ships the notices', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', './*', './by-name', './package.json']);
    expect(pkg.files).toEqual(
      expect.arrayContaining(['dist', 'THIRD-PARTY-NOTICES.md', 'LICENSE']),
    );
    expect(existsSync(join(pkgDir, 'THIRD-PARTY-NOTICES.md'))).toBe(true);
    expect(readFileSync(join(pkgDir, 'LICENSE'), 'utf8')).toMatch(/^MIT License/);
  });

  it('the notices carry the pinned ISC text and the Feather MIT notice verbatim', () => {
    const up = readFileSync(
      join(dirname(require.resolve('lucide-static/package.json')), 'LICENSE'),
      'utf8',
    );
    const notices = readFileSync(join(pkgDir, 'THIRD-PARTY-NOTICES.md'), 'utf8');
    expect(notices).toContain(up.trimEnd());
    expect(notices).toMatch(/ISC License/);
    expect(notices).toMatch(/Cole Bemis/);
  });
});

describe('dist scan', () => {
  it('every built icon module keeps the licence banner and the package ships its notice', () => {
    const out = mkdtempSync(join(tmpdir(), 'icons-dist-'));
    try {
      execFileSync(
        process.execPath,
        [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', out],
        { cwd: pkgDir, stdio: 'pipe' },
      );
      const dir = join(out, 'generated/icons');
      const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
      expect(files).toHaveLength(78);
      for (const f of files) {
        const src = readFileSync(join(dir, f), 'utf8');
        expect(src.startsWith('/** @license lucide-static v'), f).toBe(true);
        expect(src, f).toMatch(/ISC\./);
        expect(src, f).toContain('THIRD-PARTY-NOTICES.md');
      }
      // The notice file named by the banner must be inside the published file set.
      for (const f of pkg.files) {
        if (f !== 'dist') expect(existsSync(join(pkgDir, f)), f).toBe(true);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});
