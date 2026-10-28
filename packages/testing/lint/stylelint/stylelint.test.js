// W1-202: every rule has a seeded failure and a clean pass; the tree has no remote fonts.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { config, plugins } from './index.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

/** Lints `code` and returns `{ rule, text }` per warning. */
async function lint(/** @type {string} */ code) {
  const { results } = await stylelint.lint({
    code,
    config: { plugins: config.plugins, rules: config.rules },
  });
  return results[0].warnings.map((w) => ({ rule: w.rule, text: w.text }));
}

const rulesOf = async (/** @type {string} */ code) => (await lint(code)).map((w) => w.rule);

describe('sj stylelint rules', () => {
  it('registers all six rules', () => {
    expect(plugins.map((p) => /** @type {any} */ (p).ruleName).sort()).toEqual([
      'sj/logical-properties',
      'sj/no-outline-none',
      'sj/no-raw-color',
      'sj/no-raw-duration',
      'sj/no-raw-px',
      'sj/no-remote-url',
    ]);
  });

  it('accepts a token-only stylesheet', async () => {
    const css = `
      .sj-a {
        padding: var(--space-4) 0;
        margin-inline-start: var(--space-2);
        color: var(--color-slate-900);
        border: var(--border-width-hairline) solid var(--color-border);
        transition: color var(--duration-fast) ease;
        animation-duration: var(--sj-duration-normal);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        background-image: url('data:image/svg+xml;utf8,<svg width="10px"/>');
        transition-delay: 0s;
      }
      .sj-a:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
      .sj-b:focus-visible { outline: var(--focus-ring-width) solid transparent; }
      @media (min-width: 640px) { .sj-a { padding: 0; } }
    `;
    expect(await lint(css)).toEqual([]);
  });

  describe('sj/no-raw-color', () => {
    it.each([
      '#fff',
      '#4f46e5',
      '#4f46e580',
      'rgb(0 0 0 / 0.5)',
      'hsl(240 10% 50%)',
      'oklch(60% 0.2 280)',
    ])('rejects %s', async (v) => {
      expect(await rulesOf(`.a { color: ${v}; }`)).toContain('sj/no-raw-color');
    });
    it('rejects a hex inside a custom property and a fallback', async () => {
      expect(await rulesOf('.a { --x: #123456; }')).toContain('sj/no-raw-color');
      expect(await rulesOf('.a { color: var(--c, #123456); }')).toContain('sj/no-raw-color');
    });
    it('allows a color function over tokens and ignores hex-looking ids in urls', async () => {
      expect(await rulesOf('.a { color: rgb(from var(--c) r g b / 50%); }')).toEqual([]);
      expect(await rulesOf('.a { background: url(#clip); }')).toEqual([]);
    });
  });

  describe('sj/no-raw-px', () => {
    it.each(['4px', '0px', '1px', '-2px', '.5px', '12.5px'])('rejects %s', async (v) => {
      expect(await rulesOf(`.a { margin-block: ${v}; }`)).toContain('sj/no-raw-px');
    });
    it('rejects px inside calc and var fallbacks', async () => {
      expect(await rulesOf('.a { width: calc(100% - 8px); }')).toContain('sj/no-raw-px');
      expect(await rulesOf('.a { width: var(--w, 8px); }')).toContain('sj/no-raw-px');
    });
    it('allows unitless zero, tokens, rem-free names ending in px and media params', async () => {
      expect(await rulesOf('.a { margin: 0; padding: var(--space-2); }')).toEqual([]);
      expect(await rulesOf('@media (min-width: 640px) { .a { margin: 0; } }')).toEqual([]);
    });
  });

  describe('sj/no-raw-duration', () => {
    it.each([
      'transition: opacity 150ms ease',
      'transition-duration: 0.2s',
      'animation: spin 1s linear infinite',
      'animation-delay: 100ms',
      '--sj-enter-duration: 200ms',
    ])('rejects %s', async (decl) => {
      expect(await rulesOf(`.a { ${decl}; }`)).toContain('sj/no-raw-duration');
    });
    it('allows tokens and zero', async () => {
      expect(
        await rulesOf('.a { transition: opacity var(--duration-fast) ease, color 0s; }'),
      ).toEqual([]);
    });
  });

  describe('sj/no-outline-none', () => {
    it.each(['outline: none', 'outline: 0', 'outline-style: none', 'outline-width: 0'])(
      'rejects %s with no replacement',
      async (decl) => {
        expect(await rulesOf(`.a:focus { ${decl}; }`)).toContain('sj/no-outline-none');
      },
    );
    it('rejects when the only box-shadow is none', async () => {
      expect(await rulesOf('.a:focus { outline: none; box-shadow: none; }')).toContain(
        'sj/no-outline-none',
      );
    });
    it('allows a replacement box-shadow in the same rule', async () => {
      expect(await rulesOf('.a:focus { outline: none; box-shadow: var(--shadow-focus); }')).toEqual(
        [],
      );
    });
  });

  describe('sj/no-remote-url', () => {
    it.each([
      '@import url("https://fonts.googleapis.com/css2?family=Rubik");',
      "@import 'https://example.com/x.css';",
      '@import "//example.com/x.css";',
      '@font-face { font-family: X; src: url(https://example.com/x.woff2); }',
      '@font-face { font-family: X; src: url("//cdn.example.com/x.woff2"); }',
      '.a { background: url(http://example.com/a.png); }',
    ])('rejects %s', async (css) => {
      expect(await rulesOf(css)).toContain('sj/no-remote-url');
    });
    it('allows local and data urls', async () => {
      expect(await rulesOf('@font-face { font-family: X; src: url("./x.woff2"); }')).toEqual([]);
      expect(await rulesOf('.a { background: url(data:image/png;base64,AAAA); }')).toEqual([]);
    });
  });

  describe('sj/logical-properties', () => {
    it.each([
      'margin-left: 0',
      'padding-right: var(--space-2)',
      'border-top: var(--border-width-hairline) solid',
      'left: 0',
      'text-align: left',
      'float: right',
      'border-top-left-radius: var(--radius-sm)',
    ])('rejects %s', async (decl) => {
      expect(await rulesOf(`.a { ${decl}; }`)).toContain('sj/logical-properties');
    });
    it('allows logical properties', async () => {
      expect(
        await rulesOf(
          '.a { margin-inline-start: 0; inset-block-start: 0; text-align: start; border-start-start-radius: var(--radius-sm); }',
        ),
      ).toEqual([]);
    });
  });

  it('reports the offending value in the message', async () => {
    const [w] = await lint('.a { color: #abcdef; }');
    expect(w.text).toContain('#abcdef');
  });
});

const REMOTE_FONT =
  /fonts\.(?:googleapis|gstatic)\.com|@import\s+(?:url\()?['"]?(?:https?:)?\/\/|@font-face[^}]*url\(\s*['"]?(?:https?:)?\/\//i;

/** Tracked and untracked source files in the whole tree (includes apps/storybook), minus fixtures and tests. */
function treeFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => /\.(css|astro|vue|html|mdx?|ts|js|mjs)$/.test(f))
    .filter(
      (f) =>
        !f.includes('/fixtures/') &&
        !f.endsWith('.test.js') &&
        !f.includes('/node_modules/') &&
        !f.startsWith('docs/') &&
        !f.startsWith('specs/'),
    );
}

describe('no remote font anywhere in the tree (ADR-009)', () => {
  it('has no remote font or remote @import in any source file, storybook included', () => {
    const files = treeFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.startsWith('apps/storybook/'))).toBe(true);
    expect(files.filter((f) => REMOTE_FONT.test(readFileSync(root + f, 'utf8')))).toEqual([]);
  });

  it('seeded remote font URLs fail the scan (preview head, MDX, CSS)', () => {
    expect(REMOTE_FONT.test('<link href="https://fonts.googleapis.com/css2?family=Rubik" />')).toBe(
      true,
    );
    expect(
      REMOTE_FONT.test("<style>\n  @import url('https://fonts.gstatic.com/x.woff2');</style>"),
    ).toBe(true);
    expect(REMOTE_FONT.test("@font-face { src: url('https://cdn.example.com/a.woff2'); }")).toBe(
      true,
    );
    expect(REMOTE_FONT.test("@font-face { src: url('./fonts/a.woff2'); }")).toBe(false);
  });
});
