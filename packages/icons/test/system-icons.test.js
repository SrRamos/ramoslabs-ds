import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SYSTEM_ADAPTERS,
  buildSystemOutputs,
  checkSystemOutputs,
  writeSystemOutputs,
} from '../scripts/generate.mjs';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(pkgDir, '..', '..');
const require = createRequire(join(pkgDir, 'package.json'));
const upstreamDir = dirname(require.resolve('lucide-static/package.json'));
const read = (...p) => readFileSync(join(root, ...p), 'utf8');

const scratch = [];
/** Scratch repo: icons inputs, the list, and the committed adapter output. */
function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'sysicons-'));
  scratch.push(dir);
  mkdirSync(join(dir, 'packages/icons/src'), { recursive: true });
  mkdirSync(join(dir, 'packages/icons/node_modules'), { recursive: true });
  mkdirSync(join(dir, 'packages/contracts'), { recursive: true });
  cpSync(join(pkgDir, 'package.json'), join(dir, 'packages/icons/package.json'));
  cpSync(join(pkgDir, 'src/icons.list.json'), join(dir, 'packages/icons/src/icons.list.json'));
  cpSync(upstreamDir, join(dir, 'packages/icons/node_modules/lucide-static'), { recursive: true });
  cpSync(
    join(root, 'packages/contracts/system-icons.json'),
    join(dir, 'packages/contracts/system-icons.json'),
  );
  for (const a of SYSTEM_ADAPTERS) {
    mkdirSync(join(dir, `packages/${a}/src/generated`), { recursive: true });
    cpSync(
      join(root, `packages/${a}/src/generated/icons`),
      join(dir, `packages/${a}/src/generated/icons`),
      {
        recursive: true,
      },
    );
    cpSync(
      join(root, `packages/${a}/THIRD-PARTY-NOTICES.md`),
      join(dir, `packages/${a}/THIRD-PARTY-NOTICES.md`),
    );
  }
  return dir;
}
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('system icons: committed output', () => {
  it('is clean and deterministic', () => {
    expect(checkSystemOutputs(root)).toEqual([]);
    expect([...buildSystemOutputs(root)]).toEqual([...buildSystemOutputs(root)]);
  });

  it('holds circle-alert, camel-cased, in vue, react and vanilla', () => {
    const list = JSON.parse(read('packages/contracts/system-icons.json'));
    expect(list.icons).toEqual(['circle-alert']);
    for (const a of SYSTEM_ADAPTERS) {
      expect(read(`packages/${a}/src/generated/icons/circle-alert.ts`)).toContain(
        'export const circleAlert: IconData',
      );
    }
  });

  it('icon data and license banner are byte-identical to the @ramoslabs/icons module', () => {
    const body = (src) => src.slice(src.indexOf('/** @license'));
    const pub = body(read('packages/icons/src/generated/icons/circle-alert.ts'))
      .replace('CircleAlert: IconData', 'circleAlert: IconData')
      .replace('export { CircleAlert as CircleAlertIcon };\n', '');
    for (const a of SYSTEM_ADAPTERS) {
      expect(body(read(`packages/${a}/src/generated/icons/circle-alert.ts`))).toBe(pub);
    }
  });

  it('nodes equal the pinned upstream entry', () => {
    const nodes = JSON.parse(readFileSync(join(upstreamDir, 'icon-nodes.json'), 'utf8'));
    const src = read('packages/vue/src/generated/icons/circle-alert.ts');
    const literal = /nodes: (\[.*\]),\n/.exec(src)[1];
    expect(JSON.parse(literal)).toEqual(nodes['circle-alert']);
  });

  it('every adapter ships the ISC notice and lists it in files', () => {
    for (const a of SYSTEM_ADAPTERS) {
      const pkg = JSON.parse(read(`packages/${a}/package.json`));
      expect(pkg.files).toContain('THIRD-PARTY-NOTICES.md');
      expect(read(`packages/${a}/THIRD-PARTY-NOTICES.md`)).toContain('ISC License');
    }
  });

  it('adapters do not import @ramoslabs/icons at runtime', () => {
    for (const a of SYSTEM_ADAPTERS) {
      expect(read(`packages/${a}/src/generated/icons/circle-alert.ts`)).not.toContain(
        '@ramoslabs/icons',
      );
      const pkg = JSON.parse(read(`packages/${a}/package.json`));
      expect(JSON.stringify(pkg)).not.toContain('@ramoslabs/icons');
    }
  });
});

describe('system icons: seeded failures', () => {
  it('a hand-edited path byte is caught', () => {
    const dir = copyRepo();
    const f = join(dir, 'packages/react/src/generated/icons/circle-alert.ts');
    writeFileSync(f, readFileSync(f, 'utf8').replace('"r":"10"', '"r":"11"'));
    expect(checkSystemOutputs(dir)).toEqual([
      'differs from upstream: packages/react/src/generated/icons/circle-alert.ts',
    ]);
  });

  it('a removed license banner is caught', () => {
    const dir = copyRepo();
    const f = join(dir, 'packages/vanilla/src/generated/icons/circle-alert.ts');
    writeFileSync(f, readFileSync(f, 'utf8').replace(/\/\*\* @license.*\n/, ''));
    expect(checkSystemOutputs(dir)).toContain(
      'differs from upstream: packages/vanilla/src/generated/icons/circle-alert.ts',
    );
  });

  it('drift against the list: a new name is missing, a removed name is stray', () => {
    const dir = copyRepo();
    const p = join(dir, 'packages/contracts/system-icons.json');
    writeFileSync(p, JSON.stringify({ icons: ['circle-alert', 'info'] }));
    expect(checkSystemOutputs(dir)).toContain('missing: packages/vue/src/generated/icons/info.ts');
    writeFileSync(p, JSON.stringify({ icons: [] }));
    expect(checkSystemOutputs(dir)).toContain(
      'unexpected file: packages/vue/src/generated/icons/circle-alert.ts',
    );
  });

  it('a name missing from upstream fails with that name', () => {
    const dir = copyRepo();
    writeFileSync(
      join(dir, 'packages/contracts/system-icons.json'),
      JSON.stringify({ icons: ['circle-alertt'] }),
    );
    expect(() => checkSystemOutputs(dir)).toThrow(/"circle-alertt"/);
  });

  it('an invalid or duplicate name fails', () => {
    const dir = copyRepo();
    const p = join(dir, 'packages/contracts/system-icons.json');
    writeFileSync(p, JSON.stringify({ icons: ['Circle_Alert'] }));
    expect(() => buildSystemOutputs(dir)).toThrow(/invalid icon name/);
    writeFileSync(p, JSON.stringify({ icons: ['circle-alert', 'circle-alert'] }));
    expect(() => buildSystemOutputs(dir)).toThrow(/duplicate/);
  });

  it('a stray file and a tampered or missing notice are caught', () => {
    const dir = copyRepo();
    writeFileSync(join(dir, 'packages/vue/src/generated/icons/evil.ts'), 'export {};\n');
    writeFileSync(join(dir, 'packages/react/THIRD-PARTY-NOTICES.md'), 'nothing\n');
    rmSync(join(dir, 'packages/vanilla/THIRD-PARTY-NOTICES.md'));
    const problems = checkSystemOutputs(dir);
    expect(problems).toContain('unexpected file: packages/vue/src/generated/icons/evil.ts');
    expect(problems).toContain('differs from upstream: packages/react/THIRD-PARTY-NOTICES.md');
    expect(problems).toContain('missing: packages/vanilla/THIRD-PARTY-NOTICES.md');
  });

  it('rewriting repairs everything and is idempotent', () => {
    const dir = copyRepo();
    writeFileSync(join(dir, 'packages/vue/src/generated/icons/evil.ts'), 'export {};\n');
    writeSystemOutputs(dir);
    expect(checkSystemOutputs(dir)).toEqual([]);
  });
});
