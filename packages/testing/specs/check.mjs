// `specs:check` (G3A MUST-1): one conformance layout for every component. Asserts, per `specs/<component>/`,
// the file set of ruling (c) (same idea as the css package's `checkStylesheets`): required files present, no
// stray top-level files, no per-component triage file, the config extends the shared runner config, the four
// package scripts exist, and `_template/` carries the same file set (each file with a `.tmpl` suffix, so no
// runner picks the template up). Exit 1 on any problem. The seeded failures live in check.test.ts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const testingDir = join(here, '..');

/** Files every component directory contains (paths relative to `specs/<c>/`). */
export const REQUIRED = [
  'fixtures.ts',
  'matrix.ts',
  'playwright.config.ts',
  'global-setup.ts',
  'build.mjs',
  'serve.mjs',
  'open.ts',
  'l2.e2e.ts',
  'hydrate.e2e.ts',
  'aria.e2e.ts',
  'a11y.e2e.ts',
  'ssr.test.ts',
  'bundle.test.ts',
  'conformance.test.ts',
  'voiceover.js',
  'render-voiceover.js',
  'host/entry.ts',
  'host/host.html',
  'host/hydrate.ts',
  'host/ssr-render.ts',
  'host/ssr-tree.ts',
  'visual/cli.js',
  'visual/scenes.js',
];
/** Present only where the component is (or wraps) a native form control. */
export const OPTIONAL = ['form.e2e.ts'];
/**
 * Optional subdirectories (G-ICON MUST-2): `composition/` holds specs that compose this component with another
 * (e.g. an icon inside a button); its files must be `*.e2e.ts`, `*.test.ts` or `fixtures.ts`.
 */
export const OPTIONAL_DIRS = ['composition'];
const COMPOSITION_FILE = /^composition\/(?:[\w.-]+\.e2e\.ts|[\w.-]+\.test\.ts|fixtures\.ts)$/;
/** Directories a component owns: ARIA snapshots (>= 1 `.yml`) and the reviewed visual baselines. */
export const DIRS = ['aria', 'host', 'visual', 'visual/baselines'];
/** Package scripts every component has (`<name>:<slug>`). */
export const SCRIPTS = ['test:e2e', 'parity', 'visual', 'voiceover'];

/** @param {string} dir */
const slugOf = (dir) => dir.replace(/^SJ/, '').toLowerCase();

/**
 * Problems for one directory; `suffix` is '.tmpl' for the template.
 * @param {string} dir
 * @param {{ suffix?: string, slug?: string, scripts?: Record<string, string> | null, read?: (f: string) => string }} [o]
 * @returns {string[]}
 */
export function checkDir(
  dir,
  { suffix = '', slug = '', scripts = null, read = (f) => readFileSync(f, 'utf8') } = {},
) {
  /** @type {string[]} */
  const problems = [];
  /** @param {string} m */
  const at = (m) => problems.push(`${dir}: ${m}`);
  const files = new Set();
  /** @param {string} rel */
  const walk = (rel) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (r !== 'visual/baselines' && !r.startsWith('visual/baselines/')) walk(r);
      } else files.add(r);
    }
  };
  walk('');
  for (const f of REQUIRED) if (!files.has(f + suffix)) at(`missing ${f + suffix}`);
  const known = new Set([...REQUIRED, ...OPTIONAL].map((f) => f + suffix));
  for (const f of files) {
    if (known.has(f)) continue;
    if (f.startsWith('composition/')) {
      if (suffix ? f === 'composition/.gitkeep' : COMPOSITION_FILE.test(f)) continue;
      at(`unexpected ${f} (composition/ holds only *.e2e.ts, *.test.ts or fixtures.ts)`);
      continue;
    }
    if (
      f.startsWith('aria/') &&
      (suffix ? f.endsWith('.yml.tmpl') || f.endsWith('.gitkeep') : f.endsWith('.yml'))
    )
      continue;
    if (/triage/i.test(f))
      at(`${f}: per-component triage files are forbidden; use packages/testing/a11y/triage.json`);
    else at(`unexpected ${f} (not part of the conformance layout)`);
  }
  const scenes = join(dir, 'visual', 'scenes.js' + suffix);
  if (!suffix && existsSync(scenes) && !/export const SCENES\b/.test(read(scenes)))
    at(
      'visual/scenes.js must `export const SCENES` (the baseline workflow lists scenes through it)',
    );
  if (![...files].some((f) => f.startsWith('aria/'))) at('aria/ has no snapshot');
  if (!existsSync(join(dir, 'visual', 'baselines'))) at('missing visual/baselines/');
  if (!suffix) {
    const cfg = files.has('playwright.config.ts') ? read(join(dir, 'playwright.config.ts')) : '';
    if (cfg && !/from '\.\.\/\.\.\/e2e\/runner\/playwright\.config'/.test(cfg))
      at('playwright.config.ts must extend e2e/runner/playwright.config');
    if (cfg && !cfg.includes(`SJ_${slug.toUpperCase()}_PORT`))
      at(`playwright.config.ts must read SJ_${slug.toUpperCase()}_PORT`);
    if (cfg && !cfg.includes(`'${slug}-results.json'`))
      at(`results file must be ${slug}-results.json`);
    if (scripts)
      for (const s of SCRIPTS)
        if (!scripts[`${s}:${slug}`]) at(`package.json has no script "${s}:${slug}"`);
  }
  return problems;
}

/**
 * Lists the component directories under specs/ (those not starting with `_`).
 * @param {string} [root]
 */
export function componentDirs(root = here) {
  return readdirSync(root).filter(
    (n) => !n.startsWith('_') && statSync(join(root, n)).isDirectory(),
  );
}

/** @param {string} [root] */
export function checkAll(root = here) {
  const scripts = JSON.parse(readFileSync(join(testingDir, 'package.json'), 'utf8')).scripts;
  /** @type {string[]} */
  const problems = [];
  for (const c of componentDirs(root))
    problems.push(...checkDir(join(root, c), { slug: slugOf(c), scripts }));
  const tmpl = join(root, '_template');
  if (!existsSync(tmpl)) problems.push('specs/_template is missing');
  else problems.push(...checkDir(tmpl, { suffix: '.tmpl' }));
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkAll();
  if (problems.length) {
    for (const p of problems) console.error(`specs:check: ${p}`);
    process.exit(1);
  }
  console.log(
    `specs:check: ${componentDirs().length} component dir(s) and _template follow the conformance layout.`,
  );
}
