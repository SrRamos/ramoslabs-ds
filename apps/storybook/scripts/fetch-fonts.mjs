// Regenerates the self-hosted Storybook fonts (ADR-009: nothing remote at runtime).
// Run by hand: `node apps/storybook/scripts/fetch-fonts.mjs` (needs network). Commits the woff2 files plus fonts.css.
//  1. Text families: the exact family+weight set the old Google URLs requested, latin subset, normal style.
//  2. Material Symbols Outlined: a subset font holding only the icon names used in stories/ and .storybook/.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.storybook/static/fonts');
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36'; // gets woff2
mkdirSync(out, { recursive: true });

const css = async (q) => (await fetch('https://fonts.googleapis.com/css2?' + q, { headers: { 'User-Agent': UA } })).text();
const bin = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());
const slug = (s) => s.toLowerCase().replace(/ /g, '-');

// 1. text families
let faces = '';
const text = await css(
  'family=Red+Hat+Display:wght@400;500;700;900&family=Rubik:wght@300;400;500;600;700&family=Roboto:wght@400;500;700&display=swap',
);
for (const m of text.matchAll(/\/\* (\S+) \*\/\s*@font-face \{([^}]*)\}/g)) {
  if (m[1] !== 'latin') continue;
  const g = (k) => m[2].match(new RegExp(k + ': ([^;]+);'))[1];
  const family = g('font-family').replace(/'/g, '');
  const weight = g('font-weight');
  const url = g('src').match(/url\(([^)]+)\)/)[1];
  const file = `${slug(family)}-${weight}.woff2`;
  writeFileSync(join(out, file), await bin(url));
  faces += `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('./fonts/${file}') format('woff2'); unicode-range: ${g('unicode-range')}; }\n`;
}

// 2. icon subset
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? (f === 'node_modules' || f === 'static' ? [] : walk(p)) : [p];
  });
const names = new Set();
for (const f of [...walk(join(root, 'stories')), ...walk(join(root, '.storybook'))]) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:className|class)="[^"]*(?:material|icon)[^"]*"[^>]*>([a-z][a-z_0-9]+)</g)) names.add(m[1]);
}
// Icons set from data (e.g. {item.icon}) cannot be scraped; list them here.
for (const n of ['i', 'ios']) names.delete(n); // false positives of the regex
const sym = await css(`family=Material+Symbols+Outlined:FILL@0..1&icon_names=${[...names].sort().join(',')}`);
writeFileSync(join(out, 'material-symbols-outlined-subset.woff2'), await bin(sym.match(/url\(([^)]+)\)/)[1]));
faces += `@font-face { font-family: 'Material Symbols Outlined'; font-style: normal; font-weight: 400; font-display: block; src: url('./fonts/material-symbols-outlined-subset.woff2') format('woff2'); }\n`;
const headFile = join(root, '.storybook/preview-head.html');
const block = faces.trim().split('\n').map((l) => '  ' + l).join('\n');
writeFileSync(
  headFile,
  readFileSync(headFile, 'utf8').replace(/(\/\* fonts:begin[^*]*\*\/\n)[\s\S]*?(\n  \/\* fonts:end \*\/)/, (_, a, b) => a + block + b),
);
console.log(`${names.size} icons; @font-face block rewritten in .storybook/preview-head.html`);
