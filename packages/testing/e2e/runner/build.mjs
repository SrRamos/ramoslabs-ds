// Bundles the host page for the L2 runner (W1-309a). Workspace packages are aliased to their
// source so the run never depends on a prior `build`; esbuild is already a testing devDependency.
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..', '..');

/** `@ramoslabs/<pkg>[/<sub>]` -> `packages/<pkg>/src/<sub>/index.ts`. */
const aliasPlugin = {
  name: 'ramoslabs-src-alias',
  setup(b) {
    b.onResolve({ filter: /^@ramoslabs\/(core|react|vue|vanilla)(\/.*)?$/ }, (args) => {
      const [, pkg, sub] = /^@ramoslabs\/(\w+)(\/.*)?$/.exec(args.path);
      return { path: join(packages, pkg, 'src', sub ?? '', 'index.ts') };
    });
  },
};

/** Writes host.html, host.js and host.css into `outDir`. Returns the directory. */
export async function buildHost(outDir) {
  await mkdir(outDir, { recursive: true });
  await build({
    entryPoints: [join(here, 'host', 'entry.ts')],
    outfile: join(outDir, 'host.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    minify: false,
    sourcemap: false,
    logLevel: 'silent',
    plugins: [aliasPlugin],
    // Unminified production build of the frameworks: no dev-only warnings change behaviour.
    define: {
      'process.env.NODE_ENV': '"production"',
      __VUE_OPTIONS_API__: 'false',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  });
  await copyFile(join(here, 'host', 'host.html'), join(outDir, 'host.html'));
  await writeFile(
    join(outDir, 'host.css'),
    await readFile(join(packages, 'testing', 'probe', 'probe.css')),
  );
  return outDir;
}
