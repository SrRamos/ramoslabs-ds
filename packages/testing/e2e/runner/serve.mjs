// Static server for the host page (W1-309a). Playwright's `webServer` runs this file: it builds the
// bundle, then serves it on E2E_PORT (default 4179). No dependencies beyond node and esbuild.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHost } from './build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'node_modules', '.cache', 'e2e', 'host');
const port = Number(process.env.E2E_PORT ?? 4179);
await buildHost(out);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const file = path === '/' ? 'host.html' : path.slice(1);
  if (!/^[\w.-]+$/.test(file)) return void res.writeHead(404).end();
  try {
    const body = await readFile(join(out, file));
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, {
      'content-type': types[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, '127.0.0.1');
