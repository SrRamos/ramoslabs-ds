/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
// Hermetic scene site for the visual harness (W1-312). Everything the page loads is a local file:
// tokens CSS and component CSS built from this repo, the production font files the site ships
// (`apps/site/public/fonts`), and the scene markup. No remote URL appears anywhere (ADR-009, W1-202).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from './scenes.js';

const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, '..', '..');
const repo = join(packages, '..');
export const OUT_DIR = join(packages, 'testing', 'node_modules', '.cache', 'visual', 'site');

/** Production font files (the same bytes the site serves) and the family each one backs. */
export const FONTS = [
  { family: 'Rubik', file: 'rubik-var.woff2' },
  { family: 'Red Hat Display', file: 'red-hat-display-var.woff2' },
  { family: 'Roboto', file: 'roboto-var.woff2' },
];
const FONT_SOURCE = join(repo, 'apps', 'site', 'public', 'fonts');

/** `font-display: block`: text stays invisible rather than falling back, so a late font never shows. */
export const fontFaceCss = () =>
  FONTS.map(
    (f) =>
      `@font-face {\n  font-family: '${f.family}';\n  src: url('/fonts/${f.file}') format('woff2');\n` +
      `  font-weight: 100 900;\n  font-style: normal;\n  font-display: block;\n}\n`,
  ).join('');

// Scene chrome. Tokens only; the page is a fixed-size canvas so every scene has identical bounds.
const pageCss = `
*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent; }
html { background-color: var(--color-white); }
body { margin: 0; font-family: var(--font-family-sans); color: var(--color-slate-900); }
#scene { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4);
  padding: var(--space-6); }
.spec { margin: 0; font-size: var(--font-size-xl, 1.25rem); }
.swatch { display: inline-block; inline-size: var(--space-12); block-size: var(--space-12);
  border-radius: var(--radius-md); }
`;

function run(cwd, args) {
  execFileSync(process.execPath, args, { cwd, stdio: 'pipe' });
}

function bin(pkg, name) {
  for (const p of [
    join(packages, pkg, 'node_modules', '.bin', name),
    join(repo, 'node_modules', '.bin', name),
  ]) {
    if (existsSync(p)) return p;
  }
  throw new Error(`cannot find ${name} for ${pkg}; run bun install`);
}

/** Builds tokens and css, copies fonts, writes `<scene>.html` for every scene into OUT_DIR. */
export function buildSite(out = OUT_DIR, scenes = SCENES) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'fonts'), { recursive: true });
  run(join(packages, 'tokens'), [
    bin('tokens', 'style-dictionary'),
    'build',
    '--config',
    'style-dictionary.config.mjs',
  ]);
  run(join(packages, 'css'), ['scripts/build.mjs']);
  copyFileSync(join(packages, 'tokens', 'dist', 'tokens.css'), join(out, 'tokens.css'));
  copyFileSync(join(packages, 'css', 'dist', 'index.css'), join(out, 'components.css'));
  writeFileSync(
    join(out, 'probe.css'),
    readFileSync(join(packages, 'testing', 'probe', 'probe.css')),
  );
  writeFileSync(join(out, 'fonts.css'), fontFaceCss());
  writeFileSync(join(out, 'page.css'), pageCss);
  for (const f of FONTS) copyFileSync(join(FONT_SOURCE, f.file), join(out, 'fonts', f.file));
  for (const s of scenes) writeFileSync(join(out, `${s.name}.html`), sceneHtml(s));
  return out;
}

export function sceneHtml(scene) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${scene.name}</title>
    <link rel="stylesheet" href="/fonts.css" />
    <link rel="stylesheet" href="/tokens.css" />
    <link rel="stylesheet" href="/components.css" />
    <link rel="stylesheet" href="/probe.css" />
    <link rel="stylesheet" href="/page.css" />
  </head>
  <body>
    <div id="scene">${scene.html}</div>
  </body>
</html>
`;
}

const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};

/** Serves OUT_DIR on an ephemeral loopback port. Returns `{ origin, close }`. */
export function serve(out = OUT_DIR) {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (!/^\/(fonts\/)?[\w.-]+$/.test(path)) return void res.writeHead(404).end();
    try {
      const body = readFileSync(join(out, path));
      res.writeHead(200, {
        'content-type': TYPES[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        origin: `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`,
        close: () => new Promise((r) => server.close(r)),
      }),
    ),
  );
}
