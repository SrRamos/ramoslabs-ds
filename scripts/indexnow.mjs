#!/usr/bin/env node
// IndexNow ping: tells Bing, Yandex and other IndexNow engines which URLs changed.
// Run it AFTER a deploy, because the engines fetch the key file from the live site.
//
//   node scripts/indexnow.mjs                 dry run: list what would be sent (default)
//   node scripts/indexnow.mjs --submit        POST the URL list to IndexNow
//   node scripts/indexnow.mjs --local         read the sitemap from apps/site/dist, not the live site
//   node scripts/indexnow.mjs --site <url>    override the site origin
//
// Docs: docs/INDEXNOW.md. The key is public by design (IndexNow proves ownership by serving it
// from your own domain), so it lives in the repo as apps/site/public/<key>.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'apps', 'site', 'public');
const distDir = path.join(root, 'apps', 'site', 'dist');
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const MAX_URLS = 10000;

const args = process.argv.slice(2);
const submit = args.includes('--submit');
const local = args.includes('--local');
const siteArg = args.indexOf('--site');
const site = (siteArg !== -1 ? args[siteArg + 1] : 'https://design.ramoslabs.com').replace(
  /\/+$/,
  '',
);
const host = new URL(site).host;

function findKey() {
  const hits = fs
    .readdirSync(publicDir)
    .filter((f) => /^[a-f0-9]{32}\.txt$/.test(f))
    .filter((f) => fs.readFileSync(path.join(publicDir, f), 'utf8').trim() === f.slice(0, -4));
  if (hits.length !== 1)
    throw new Error(`expected exactly one IndexNow key file in ${publicDir}, found ${hits.length}`);
  return hits[0].slice(0, -4);
}

async function readText(rel) {
  if (local) return fs.readFileSync(path.join(distDir, rel), 'utf8');
  const res = await fetch(`${site}/${rel}`);
  if (!res.ok) throw new Error(`${site}/${rel} -> ${res.status}`);
  return res.text();
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

async function sitemapUrls() {
  const children = locs(await readText('sitemap-index.xml'));
  const urls = [];
  for (const child of children)
    urls.push(...locs(await readText(new URL(child).pathname.replace(/^\//, ''))));
  return [...new Set(urls)];
}

const key = findKey();
const urlList = (await sitemapUrls()).filter((u) => new URL(u).host === host);
if (urlList.length === 0) throw new Error('sitemap listed no URLs for ' + host);
if (urlList.length > MAX_URLS)
  throw new Error(`IndexNow accepts at most ${MAX_URLS} URLs per request`);
const body = { host, key, keyLocation: `${site}/${key}.txt`, urlList };

console.log(
  `IndexNow: ${urlList.length} URLs for ${host} (${local ? 'local dist' : 'live sitemap'})`,
);
console.log(`key file: ${body.keyLocation}`);
if (!submit) {
  for (const u of urlList) console.log('  ' + u);
  console.log('dry run only. Re-run with --submit after the deploy is live.');
  process.exit(0);
}

// The engine fetches the key file to verify ownership; fail early if it is not live yet.
const keyCheck = await fetch(body.keyLocation);
if (!keyCheck.ok || (await keyCheck.text()).trim() !== key) {
  throw new Error(
    `key file not live at ${body.keyLocation} (status ${keyCheck.status}); deploy first`,
  );
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
console.log(`IndexNow responded ${res.status} ${res.statusText}`);
// 200 = received, 202 = received and key validation pending. Anything else is a failure.
if (res.status !== 200 && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
