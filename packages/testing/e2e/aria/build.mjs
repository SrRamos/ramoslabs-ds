// Bundles the runner's host page (probe on three adapters) plus the IME fixture (W1-309c).
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHost } from '../runner/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..', '..');

const alias = {
  name: 'ramoslabs-src-alias',
  setup(b) {
    b.onResolve({ filter: /^@ramoslabs\/core(\/.*)?$/ }, (args) => {
      const [, sub] = /^@ramoslabs\/core(\/.*)?$/.exec(args.path);
      return { path: join(packages, 'core', 'src', sub ?? '', 'index.ts') };
    });
  },
};

/** Writes host.* (runner) and ime.html / ime.js into `outDir`. */
export async function buildAria(outDir) {
  await buildHost(outDir);
  await mkdir(outDir, { recursive: true });
  await build({
    entryPoints: [join(here, 'ime', 'host.ts')],
    outfile: join(outDir, 'ime.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    logLevel: 'silent',
    plugins: [alias],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  await copyFile(join(here, 'ime', 'ime.html'), join(outDir, 'ime.html'));
  return outDir;
}
