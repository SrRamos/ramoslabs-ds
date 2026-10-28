// Builds the SJButton conformance site (W1-C01.f): the visual harness's hermetic site (tokens, the built
// component CSS, production fonts; reused, not re-implemented) plus an esbuild bundle of host/entry.ts with
// the real adapters. Workspace packages alias to source so the run never depends on a prior `build`.
import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../../visual/site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..', '..');

const aliasPlugin = {
  name: 'ramoslabs-src-alias',
  setup(b) {
    b.onResolve({ filter: /^@ramoslabs\/(core|react|vue|vanilla)(\/.*)?$/ }, (args) => {
      const [, pkg, sub] = /^@ramoslabs\/(\w+)(\/.*)?$/.exec(args.path);
      return { path: join(packages, pkg, 'src', sub ?? '', 'index.ts') };
    });
  },
};

/** Writes host.html, host.js and the site assets into `outDir`. Returns the directory. */
export async function buildButtonHost(outDir) {
  buildSite(outDir, []);
  await build({
    entryPoints: [join(here, 'host', 'entry.ts')],
    outfile: join(outDir, 'host.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    minify: false,
    logLevel: 'silent',
    plugins: [aliasPlugin],
    define: {
      'process.env.NODE_ENV': '"production"',
      __VUE_OPTIONS_API__: 'false',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  });
  await copyFile(join(here, 'host', 'host.html'), join(outDir, 'host.html'));
  return outDir;
}
