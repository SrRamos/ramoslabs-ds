// Static server for the L3 a11y gates (W1-310). Playwright's `webServer` runs this file: it builds
// the L2 host bundle (reused from e2e/runner), the real @ramoslabs/css and the generated tokens.css,
// copies the test-only fixtures, and serves everything on A11Y_PORT (default 4180), loopback only.
import { createServer } from 'node:http';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHost } from '../e2e/runner/build.mjs';
import { buildCss } from '../../css/scripts/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..');
export const OUT = join(here, '..', 'node_modules', '.cache', 'a11y', 'site');
const port = Number(process.env.A11Y_PORT ?? 4180);

export async function buildSite(out = OUT) {
  const tokens = join(packages, 'tokens', 'dist', 'tokens.css');
  if (!existsSync(tokens))
    throw new Error('tokens.css is missing. Run `bun run --filter @ramoslabs/tokens build` first.');
  mkdirSync(out, { recursive: true });
  await buildHost(out); // host.html (L2), host.js, host.css (= probe.css)
  copyFileSync(tokens, join(out, 'tokens.css'));
  buildCss({ srcDir: join(packages, 'css', 'src'), outDir: join(out, 'css') });
  copyFileSync(join(out, 'css', 'index.css'), join(out, 'sj.css'));
  copyFileSync(join(here, 'host', 'a11y-host.html'), join(out, 'a11y-host.html'));
  cpSync(join(here, 'fixtures'), join(out, 'fixtures'), { recursive: true });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildSite();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const file = normalize(join(out, path === '/' ? 'a11y-host.html' : path));
    if (!file.startsWith(out + sep) || !existsSync(file) || !statSync(file).isFile())
      return void res.writeHead(404).end();
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, {
      'content-type': types[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(readFileSync(file));
  }).listen(port, '127.0.0.1');
}
