// Builds the SJSkeleton conformance site : the visual harness's hermetic site (tokens, the built
// component CSS, production fonts; reused, not re-implemented) plus an esbuild bundle of host/entry.ts with
// the real adapters. Workspace packages alias to source so the run never depends on a prior `build`.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

/** The layout the fixtures render (a card: avatar + body of three lines). Tokens only; the placeholder and the loaded
 * content share one box, which is what keeps the swap free of layout shift. Shared by host.html and the hydration pages. */
export const CARD_CSS = `
.w-card{display:flex;gap:var(--space-3);align-items:flex-start}
.w-card__avatar{flex:none;box-sizing:border-box;inline-size:var(--skeleton-avatar-md);block-size:var(--skeleton-avatar-md);border-radius:var(--radius-pill);background:var(--color-primary)}
.w-card__body{flex:1;min-inline-size:0;display:flex;flex-direction:column;gap:var(--space-2)}
.w-card__line{margin:0;block-size:var(--skeleton-line-height);line-height:var(--skeleton-line-height);font-size:var(--skeleton-line-height);overflow:hidden;white-space:nowrap}
`;

const prod = {
  'process.env.NODE_ENV': '"production"',
  __VUE_OPTIONS_API__: 'false',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
};
const dev = {
  ...prod,
  'process.env.NODE_ENV': '"development"',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
};

/**
 * Writes host.html, host.js, hydrate.js (development build), the node server render and the site assets into
 * `outDir`. Returns the directory and the server-render function.
 */
export async function buildSkeletonHost(outDir) {
  buildSite(outDir, []);
  const common = {
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: false,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  };
  await build({
    ...common,
    entryPoints: [join(here, 'host', 'entry.ts')],
    outfile: join(outDir, 'host.js'),
    platform: 'browser',
    define: prod,
  });
  await build({
    ...common,
    entryPoints: [join(here, 'host', 'hydrate.ts')],
    outfile: join(outDir, 'hydrate.js'),
    platform: 'browser',
    define: dev,
  });
  await build({
    ...common,
    entryPoints: [join(here, 'host', 'ssr-render.ts')],
    outfile: join(outDir, 'ssr-render.mjs'),
    platform: 'node',
    // Frameworks stay external so the node process uses the same copies the repo resolves.
    external: ['react', 'react-dom', 'react-dom/server', 'vue', 'vue/server-renderer'],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const html = await readFile(join(here, 'host', 'host.html'), 'utf8');
  await writeFile(join(outDir, 'host.html'), html.replace('/*CARD_CSS*/', CARD_CSS));
  const { renderServer } = await import(pathToFileURL(join(outDir, 'ssr-render.mjs')).href);
  return { out: outDir, renderServer };
}
