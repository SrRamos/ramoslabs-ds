// Static server for the SJDisclosure conformance site (W1-C06.f). Playwright's `webServer` runs it. Besides
// the files it serves `/hydrate/<adapter>/<case>.html` (server-rendered markup in #root, hydrated by the test
// after it has toggled the `<details>` natively; `vanilla` adopts the same markup). Loopback only.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { normalize, join, sep } from 'node:path';
import { buildSite } from './build.mjs';
import { HYDRATE_CASES } from './fixtures.ts';

const port = Number(process.env.SJ_DISCLOSURE_PORT ?? 4206);
const { out, renderServer } = await buildSite();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const slug = (s) => s.replace(/\s+/g, '-');
const bySlug = Object.fromEntries(
  Object.entries(HYDRATE_CASES).map(([k, v]) => [slug(k), v.props]),
);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = decodeURIComponent(url.pathname);
  const send = (status, body, type = 'text/html') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };
  const m = /^\/hydrate\/(react|vue|vanilla)\/([\w-]+)\.html$/.exec(path);
  if (m) {
    const props = bySlug[m[2]];
    if (!props) return send(404, 'unknown case');
    const markup = await renderServer(m[1], props, 'hy-');
    return send(
      200,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>hydrate</title>` +
        `<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/sj.css"></head>` +
        `<body><main><div id="root">${markup}</div></main>` +
        `<script type="module" src="/hydrate.js"></script></body></html>`,
    );
  }
  const file = normalize(join(out, path === '/' ? 'host.html' : path));
  if (!file.startsWith(out + sep) || !existsSync(file) || !statSync(file).isFile())
    return send(404, 'not found');
  send(
    200,
    readFileSync(file),
    types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream',
  );
}).listen(port, '127.0.0.1');
