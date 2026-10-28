import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildOutputs,
  checkOutputs,
  loadList,
  loadUpstream,
  pascal,
  writeOutputs,
} from '../scripts/generate.mjs';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(pkgDir, 'package.json'));
const upstream = JSON.parse(
  readFileSync(
    join(dirname(require.resolve('lucide-static/package.json')), 'icon-nodes.json'),
    'utf8',
  ),
);
const list = JSON.parse(readFileSync(join(pkgDir, 'src/icons.list.json'), 'utf8'));

/** Scratch copy of the package inputs, with lucide-static resolvable from it. */
const scratch = [];
function copyPackage() {
  const dir = mkdtempSync(join(tmpdir(), 'icons-'));
  scratch.push(dir);
  cpSync(join(pkgDir, 'package.json'), join(dir, 'package.json'));
  mkdirSync(join(dir, 'src'));
  cpSync(join(pkgDir, 'src/icons.list.json'), join(dir, 'src/icons.list.json'));
  cpSync(join(pkgDir, 'src/generated'), join(dir, 'src/generated'), { recursive: true });
  cpSync(join(pkgDir, 'THIRD-PARTY-NOTICES.md'), join(dir, 'THIRD-PARTY-NOTICES.md'));
  mkdirSync(join(dir, 'node_modules'));
  cpSync(
    join(dirname(require.resolve('lucide-static/package.json'))),
    join(dir, 'node_modules/lucide-static'),
    {
      recursive: true,
    },
  );
  return dir;
}
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('icon list', () => {
  it('has exactly the 78 icons of the plan and the nine mirrored ones', () => {
    expect(list.icons).toHaveLength(78);
    const mirrored = list.icons
      .filter((i) => i.mirror)
      .map((i) => i.name)
      .sort();
    expect(mirrored).toEqual(
      [
        'arrow-left',
        'arrow-right',
        'chevron-left',
        'chevron-right',
        'log-in',
        'log-out',
        'redo-2',
        'send',
        'undo-2',
      ].sort(),
    );
    expect(list.$source).toMatch(/Material/);
  });
  it('does not offer the two aliases the plan dropped', () => {
    const aliases = list.icons.flatMap((i) => i.aliases ?? []);
    expect(aliases).not.toContain('check-circle');
    expect(aliases).not.toContain('edit-2');
  });
});

describe('codegen determinism and drift (--check)', () => {
  it('committed output is byte-identical to a fresh derivation', () => {
    expect(checkOutputs(pkgDir)).toEqual([]);
    const a = buildOutputs(pkgDir);
    const b = buildOutputs(pkgDir);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('rewriting is idempotent', () => {
    const dir = copyPackage();
    writeOutputs(dir);
    expect(checkOutputs(dir)).toEqual([]);
    expect(readFileSync(join(dir, 'src/generated/index.ts'), 'utf8')).toBe(
      readFileSync(join(pkgDir, 'src/generated/index.ts'), 'utf8'),
    );
  });

  it('seeded failure: one edited path byte is caught', () => {
    const dir = copyPackage();
    const f = join(dir, 'src/generated/icons/search.ts');
    writeFileSync(f, readFileSync(f, 'utf8').replace('m21 21', 'm21 22'));
    expect(checkOutputs(dir)).toEqual(['differs from upstream: src/generated/icons/search.ts']);
  });

  it('seeded failure: a stray or missing generated file and a tampered notice are caught', () => {
    const dir = copyPackage();
    writeFileSync(join(dir, 'src/generated/icons/evil.ts'), 'export {};\n');
    rmSync(join(dir, 'src/generated/icons/star.ts'));
    writeFileSync(join(dir, 'THIRD-PARTY-NOTICES.md'), 'nothing here\n');
    const problems = checkOutputs(dir);
    expect(problems).toContain('unexpected file: src/generated/icons/evil.ts');
    expect(problems).toContain('missing: src/generated/icons/star.ts');
    expect(problems).toContain('differs from upstream: THIRD-PARTY-NOTICES.md');
  });
});

describe('list validation against the pinned upstream', () => {
  const mutate = (fn) => {
    const dir = copyPackage();
    const p = join(dir, 'src/icons.list.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    fn(data);
    writeFileSync(p, JSON.stringify(data));
    return dir;
  };

  it('a missing or renamed upstream name fails with that name', () => {
    const dir = mutate((d) => {
      d.icons[0].name = 'chevron-upp';
    });
    expect(() => buildOutputs(dir)).toThrow(/"chevron-upp"/);
  });

  it('seeded alias: check-circle -> circle-check is rejected with the pair', () => {
    const dir = mutate((d) => {
      d.icons.find((i) => i.name === 'circle-check').aliases = ['check-circle'];
    });
    expect(() => buildOutputs(dir)).toThrow(/"check-circle" -> "circle-check".*"circle-check-big"/);
  });

  it('seeded alias: edit-2 -> pencil is rejected with the pair', () => {
    const dir = mutate((d) => {
      d.icons.find((i) => i.name === 'pencil').aliases = ['edit-2'];
    });
    expect(() => buildOutputs(dir)).toThrow(/"edit-2" -> "pencil".*"pen"/);
  });

  it('an alias that upstream does not know at all is rejected', () => {
    const dir = mutate((d) => {
      d.icons[0].aliases = ['no-such-alias'];
    });
    expect(() => buildOutputs(dir)).toThrow(/maps "no-such-alias" to nothing/);
  });

  it('a non-exact pin is rejected', () => {
    const dir = copyPackage();
    const p = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(p, 'utf8'));
    pkg.devDependencies['lucide-static'] = '^1.63.0';
    writeFileSync(p, JSON.stringify(pkg));
    expect(() => loadUpstream(dir)).toThrow(/exact-pinned/);
    expect(() => loadList(pkgDir, loadUpstream(pkgDir))).not.toThrow();
  });
});

describe('provenance: every nodes value equals the pinned upstream entry', () => {
  it('reads the pinned package directly and compares all 78 icons', async () => {
    for (const icon of list.icons) {
      const mod = await import(
        pathToFileURL(join(pkgDir, `src/generated/icons/${icon.name}.ts`)).href
      );
      const data = mod[pascal(icon.name)];
      expect(data.name).toBe(icon.name);
      expect(data.nodes, icon.name).toEqual(upstream[icon.name]);
      expect(mod[`${pascal(icon.name)}Icon`]).toBe(data);
      expect(data.mirror === true, icon.name).toBe(icon.mirror === true);
    }
  });
});

describe('module content', () => {
  const tags = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
  const attrs = new Set([
    'd',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'width',
    'height',
    'points',
  ]);
  it('only allowlisted tags and attributes, no id/style/class, license banner present', () => {
    const outputs = buildOutputs(pkgDir);
    for (const icon of list.icons) {
      for (const [tag, a] of upstream[icon.name]) {
        expect(tags.has(tag), `${icon.name} ${tag}`).toBe(true);
        for (const k of Object.keys(a)) expect(attrs.has(k), `${icon.name} ${k}`).toBe(true);
      }
      const src = outputs.get(`src/generated/icons/${icon.name}.ts`);
      expect(src).toMatch(/\/\*\* @license lucide-static v1\.63\.0 ISC\./);
    }
  });
});
