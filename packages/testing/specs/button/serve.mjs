// Static server for the SJButton conformance site. Playwright's `webServer` runs this file: it builds the
// site, then serves it on SJ_BUTTON_PORT (default 4181).
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildButtonHost } from './build.mjs';
import { FIXTURES } from './fixtures.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const OUT = join(here, '..', '..', 'node_modules', '.cache', 'e2e', 'button-host');
const port = Number(process.env.SJ_BUTTON_PORT ?? 4181);
const { renderServer } = await buildButtonHost(OUT);

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const m = /^\/hydrate\/(react|vue)\/([\w-]+)\.html$/.exec(path);
  if (m) {
    const props = FIXTURES[m[2]];
    if (!props) return void res.writeHead(404).end('unknown fixture');
    const markup = await renderServer(m[1], props);
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    return void res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>hydrate</title>` +
        ['fonts', 'tokens', 'components', 'page']
          .map((n) => `<link rel="stylesheet" href="/${n}.css">`)
          .join('') +
        `</head><body><main id="root">${markup}</main>` +
        `<script type="module" src="/hydrate.js"></script></body></html>`,
    );
  }
  const file = path === '/' ? 'host.html' : path.slice(1);
  if (!/^(fonts\/)?[\w.-]+$/.test(file)) return void res.writeHead(404).end();
  try {
    const body = await readFile(join(OUT, file));
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
