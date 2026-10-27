// @ts-check
import { gzipSync } from 'node:zlib';
import { relative, resolve, sep } from 'node:path';
import { build } from 'esbuild';

const KIB = 1024;

/**
 * Bundle `contents` (an ES module that re-exports or consumes the code under test) with the
 * pinned bundler and report minified + gzip bytes, raw minified bytes and the import graph.
 *
 * @param {object} options
 * @param {string} options.root repo root; paths in the graph are relative to it
 * @param {string} options.contents entry module source
 * @param {string} options.resolveDir directory used to resolve imports in `contents`
 * @param {string[]} [options.external] bare specifiers whose code is never counted (peers)
 * @param {import('esbuild').Plugin[]} [options.plugins]
 */
export async function measure({ root, contents, resolveDir, external = [], plugins = [] }) {
  const result = await build({
    stdin: { contents, resolveDir, loader: 'ts', sourcefile: 'size-entry.ts' },
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    treeShaking: true,
    metafile: true,
    logLevel: 'silent',
    absWorkingDir: root,
    external,
    plugins,
  });
  const code = result.outputFiles[0].contents;
  const rawBytes = code.byteLength;
  // gzip of an empty module is a 20 byte header, which is not code: report zero.
  const gzipBytes = rawBytes === 0 ? 0 : gzipSync(code, { level: 9 }).byteLength;
  const output = Object.values(result.metafile.outputs)[0];
  const inputs = Object.keys(result.metafile.inputs)
    .filter((p) => p !== 'size-entry.ts' && !p.includes('node_modules'))
    .map((p) => relative(root, resolve(root, p)).split(sep).join('/'));
  /** @type {Record<string, number>} */
  const bytesInOutput = {};
  for (const [path, info] of Object.entries(output?.inputs ?? {})) {
    bytesInOutput[relative(root, resolve(root, path)).split(sep).join('/')] = info.bytesInOutput;
  }
  return { gzipBytes, rawBytes, graph: inputs, bytesInOutput };
}

/**
 * esbuild plugin that treats shared kernel modules as external for a component bundle, so a
 * component is measured without the kernel it imports (ADR-011: ceilings are per artifact).
 *
 * @param {string} root repo root
 * @param {string[]} sharedModules names under packages/core/src
 * @param {string} ownDir absolute directory of the artifact being measured
 * @returns {import('esbuild').Plugin}
 */
export function externalizeShared(root, sharedModules, ownDir) {
  const dirs = sharedModules.map((m) => resolve(root, 'packages/core/src', m) + sep);
  return {
    name: 'externalize-shared-kernel',
    setup(b) {
      b.onResolve({ filter: /^\.{1,2}\// }, (args) => {
        const target = resolve(args.resolveDir, args.path) + sep;
        if (target.startsWith(ownDir + sep)) return null;
        if (dirs.some((d) => target.startsWith(d))) return { path: args.path, external: true };
        return null;
      });
    },
  };
}

export { KIB };
