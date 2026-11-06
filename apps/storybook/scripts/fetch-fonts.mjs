// Regenerates the self-hosted Storybook fonts (ADR-009: nothing remote at runtime).
// Run by hand: `node apps/storybook/scripts/fetch-fonts.mjs` (needs network). Commits the woff2 files plus fonts.css.
//  1. Roboto (the fallback family): the family+weight set the old Google URLs requested, latin subset, normal style.
//     Plus Jakarta Sans, IBM Plex Sans Arabic and Noto Sans Hebrew are committed woff2 files (OFL, variable) and are NOT
//     fetched here; their @font-face lines are written below from the committed files.
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

// 1a. Committed self-hosted faces (OFL). Arabic and Hebrew load only for those scripts (unicode-range).
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const ARABIC = 'U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC';
const HEBREW = 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F';
const own = (family, file, weight, range) =>
  `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('./fonts/${file}') format('woff2'); unicode-range: ${range}; }\n`;
let faces =
  own('IBM Plex Sans Arabic', 'ibm-plex-sans-arabic-500.woff2', '500', ARABIC) +
  own('IBM Plex Sans Arabic', 'ibm-plex-sans-arabic-600.woff2', '600', ARABIC) +
  own('Noto Sans Hebrew', 'noto-sans-hebrew-100-900.woff2', '100 900', HEBREW) +
  own('Plus Jakarta Sans', 'plus-jakarta-sans-200-800.woff2', '200 800', LATIN);
// 1b. Roboto from the Google CSS API
const text = await css(
  'family=Roboto:wght@400;500;700&display=swap',
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
