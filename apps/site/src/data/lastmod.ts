// Last-modified dates for the sitemap (<lastmod>) and the TechArticle JSON-LD (dateModified).
// Each page's date is the newest git commit that touched one of its source files: the .astro
// page, its distilled agentic content, or (for Answers) its reviewed JSON. Node-only: used at
// build time by astro.config.ts and BaseHead.astro, never by the Worker.
//
// A shallow clone (some CI checkouts) only knows the tip commit, so every page would get the
// same wrong date. In that case, or when git is unavailable, no date is emitted at all: a
// missing lastmod is honest, a wrong one misleads crawlers. The deploy build should run
// `git fetch --unshallow` first (see DEPLOY.md).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pages } from './pages';

// import.meta.url is not reliable here: Astro bundles this module into dist/chunks when
// BaseHead renders. Walk up from the build's working directory to the monorepo root instead.
function findRepoRoot(start: string): string {
  let dir = start;
  while (!fs.existsSync(path.join(dir, 'turbo.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
  return dir;
}

const repoRoot = findRepoRoot(process.cwd());
const siteRoot = path.join(repoRoot, 'apps', 'site');

let shallow: boolean | null = null;
function isShallow(): boolean {
  if (shallow === null) {
    try {
      shallow =
        execFileSync('git', ['-C', repoRoot, 'rev-parse', '--is-shallow-repository'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() !== 'false';
    } catch {
      shallow = true;
    }
  }
  return shallow;
}

const cache = new Map<string, string | undefined>();

function gitDate(files: string[]): string | undefined {
  const existing = files.filter((f) => fs.existsSync(f));
  if (existing.length === 0 || isShallow()) return undefined;
  const key = existing.join('|');
  if (cache.has(key)) return cache.get(key);
  let date: string | undefined;
  try {
    const out = execFileSync(
      'git',
      [
        '-C',
        repoRoot,
        'log',
        '-1',
        '--format=%cI',
        '--',
        ...existing.map((f) => path.relative(repoRoot, f)),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    date = out || undefined; // empty: the files are not committed yet
  } catch {
    date = undefined;
  }
  cache.set(key, date);
  return date;
}

function astroSources(pagePath: string): string[] {
  const rel = pagePath.replace(/^\/|\/$/g, '');
  const base = path.join(siteRoot, 'src', 'pages');
  return rel === ''
    ? [path.join(base, 'index.astro')]
    : [path.join(base, `${rel}.astro`), path.join(base, rel, 'index.astro')];
}

/** Newest commit date (ISO 8601) for the sources behind a clean path like '/foundations/colors/'. */
export function lastModifiedForPath(pagePath: string): string | undefined {
  const answer = pagePath.match(/^\/answers\/([^/]+)\/$/);
  if (answer) return gitDate([path.join(siteRoot, 'src', 'data', 'answers', `${answer[1]}.json`)]);
  if (pagePath === '/answers/') {
    const dir = path.join(siteRoot, 'src', 'data', 'answers');
    const data = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => path.join(dir, f)) : [];
    return gitDate([
      ...astroSources(pagePath),
      path.join(siteRoot, 'src', 'data', 'answers.ts'),
      ...data,
    ]);
  }
  const files = astroSources(pagePath);
  const page = pages.find((p) => p.path === pagePath);
  if (page) files.push(path.join(siteRoot, 'agentic', 'content', page.contentFile));
  return gitDate(files);
}

/** Same, from an absolute URL such as the ones @astrojs/sitemap hands to serialize(). */
export function lastModifiedForUrl(url: string): string | undefined {
  try {
    return lastModifiedForPath(new URL(url).pathname);
  } catch {
    return undefined;
  }
}
