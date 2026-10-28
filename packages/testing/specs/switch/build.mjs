// Builds the SJSwitch conformance site (W1-C03s.f): the real adapters bundled for the browser (host.js),
// a development-mode hydration entry (hydrate.js), the server render bundled for node, the real
// @ramoslabs/css and the generated tokens.css. Workspace packages are aliased to source, so the run never
// depends on a prior `build`. Reuses the css package's own `buildCss`; adds no new tooling.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCss } from '../../../css/scripts/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..', '..');
export const OUT = join(here, '..', '..', 'node_modules', '.cache', 'specs-switch', 'site');

const aliasPlugin = {
  name: 'ramoslabs-src-alias',
  setup(b) {
    b.onResolve({ filter: /^@ramoslabs\/(core|react|vue|vanilla)(\/.*)?$/ }, (args) => {
      const [, pkg, sub] = /^@ramoslabs\/(\w+)(\/.*)?$/.exec(args.path);
      return { path: join(packages, pkg, 'src', sub ?? '', 'index.ts') };
    });
  },
};
const prod = {
  'process.env.NODE_ENV': '"production"',
  __VUE_OPTIONS_API__: 'false',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
};
const dev = {
  'process.env.NODE_ENV': '"development"',
  __VUE_OPTIONS_API__: 'false',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
};

/** Writes the whole site into `out` and returns `{ out, renderServer }`. */
export async function buildSite(out = OUT) {
  const tokens = join(packages, 'tokens', 'dist', 'tokens.css');
  if (!existsSync(tokens))
    throw new Error('tokens.css is missing. Run `bun run --filter @ramoslabs/tokens build` first.');
  mkdirSync(out, { recursive: true });
  const common = {
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: false,
    sourcemap: false,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  };
  await build({
    ...common,
    entryPoints: [join(here, 'host', 'entry.ts')],
    outfile: join(out, 'host.js'),
    platform: 'browser',
    define: prod,
  });
  await build({
    ...common,
    entryPoints: [join(here, 'host', 'hydrate.ts')],
    outfile: join(out, 'hydrate.js'),
    platform: 'browser',
    define: dev,
  });
  await build({
    ...common,
    entryPoints: [join(here, 'ssr-render.ts')],
    outfile: join(out, 'ssr-render.mjs'),
    platform: 'node',
    // Frameworks stay external so the node process uses the same copies the repo resolves.
    external: ['react', 'react-dom', 'react-dom/server', 'vue', 'vue/server-renderer'],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  copyFileSync(join(here, 'host', 'host.html'), join(out, 'host.html'));
  copyFileSync(tokens, join(out, 'tokens.css'));
  buildCss({ srcDir: join(packages, 'css', 'src'), outDir: join(out, 'css') });
  copyFileSync(join(out, 'css', 'index.css'), join(out, 'sj.css'));
  const { renderServer } = await import(pathToFileURL(join(out, 'ssr-render.mjs')).href);
  return { out, renderServer };
}
