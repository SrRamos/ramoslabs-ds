// Static server for the SJSwitch conformance site (W1-C03s.f). Playwright's `webServer` runs it. Besides
// the files it serves `/echo` (a real GET form submission lands here and the query is reflected, so the
// test reads what the browser really submitted) and `/hydrate/<adapter>/<fixture>.html` (server-rendered
// markup in #root, hydrated by the test). Loopback only.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { normalize, join, sep } from 'node:path';
import { buildSite } from './build.mjs';
import { FIXTURES, FORM_FIXTURES } from './fixtures.ts';

const port = Number(process.env.SJ_SWITCH_PORT ?? 4193);
const { out, renderServer } = await buildSite();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const all = { ...FIXTURES, ...FORM_FIXTURES };
const slug = (s) => s.replace(/\s+/g, '-');
const bySlug = Object.fromEntries(Object.entries(all).map(([k, v]) => [slug(k), v]));

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = decodeURIComponent(url.pathname);
  const send = (status, body, type = 'text/html') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };
  if (path === '/echo')
    return send(
      200,
      `<!doctype html><title>echo</title><pre id="q">${url.search.slice(1).replace(/</g, '&lt;')}</pre>`,
    );
  const m = /^\/hydrate\/(react|vue)\/([\w-]+)\.html$/.exec(path);
  if (m) {
    const props = bySlug[m[2]];
    if (!props) return send(404, 'unknown fixture');
    const markup = await renderServer(m[1], props, 'hy-');
    return send(
      200,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>hydrate</title>` +
        `<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/sj.css"></head>` +
        `<body><form id="f" method="get" action="/echo"><div id="root">${markup}</div></form>` +
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
