// Bundles the test-only host (host/entry.ts) in memory for the W1-311 text-safety test. Workspace
// packages are aliased to their source, so the run needs no prior `build` and no static server.
import { build, type Plugin } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..');

/** `@ramoslabs/<pkg>[/<sub>]` -> `packages/<pkg>/src/<sub>/index.ts`. */
const aliasPlugin: Plugin = {
  name: 'ramoslabs-src-alias',
  setup(b) {
    b.onResolve({ filter: /^@ramoslabs\/(core|react|vue|vanilla)(\/.*)?$/ }, (args) => {
      const [, pkg, sub] = /^@ramoslabs\/(\w+)(\/.*)?$/.exec(args.path) ?? [];
      return { path: join(packages, pkg ?? '', 'src', sub ?? '', 'index.ts') };
    });
  },
};

let bundled: Promise<string> | undefined;

/** The ESM bundle of host/entry.ts, built once per test process. */
export function hostScript(): Promise<string> {
  bundled ??= build({
    entryPoints: [join(here, 'host', 'entry.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    logLevel: 'silent',
    plugins: [aliasPlugin],
    // Production framework builds, as in the L2 runner: no dev-only warnings change behaviour.
    define: {
      'process.env.NODE_ENV': '"production"',
      __VUE_OPTIONS_API__: 'false',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  }).then((result) => result.outputFiles[0]?.text ?? '');
  return bundled;
}
