/* global document, getComputedStyle */
// W1-201: layer string verbatim, generated full file, layer contract, unlayered consumer CSS wins.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LAYER_ORDER, buildCss, listSources, validateSource } from '../scripts/build.mjs';
import { buildReal, doc, launch } from './helpers.js';

const LAYERS = '@layer sj.reset, sj.base, sj.component, sj.variant, sj.state;';

/** Writes `{ 'a/b.css': 'content' }` into a fresh temp dir. */
function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'sj-tree-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe('@ramoslabs/css package', () => {
  it('is the only package declaring CSS side effects and has no dependencies', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.sideEffects).toEqual(['**/*.css']);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toEqual({ '@ramoslabs/tokens': '>=0.1.0' });
  });
});

describe('build', () => {
  it('declares the layer order verbatim (ADR-009)', () => {
    expect(LAYER_ORDER).toBe(LAYERS);
    const { outDir, index } = buildReal();
    expect(index).toContain(`\n${LAYERS}\n`);
    // Every per-file output repeats it so a single import still fixes the order.
    for (const f of buildCss({
      srcDir: tree({ 'a.css': '@layer sj.component { .x { color: red; } }' }),
      outDir,
    })) {
      expect(readFileSync(join(outDir, f), 'utf8')).toContain(LAYERS);
    }
  });

  it('generates index.css from a glob: adding a component file edits no shared file', () => {
    const base = {
      'base/base.css': '@layer sj.base { :root { --a: 1; } }',
      'button.css': '@layer sj.component { .sj-button { display: block; } }',
    };
    const out1 = mkdtempSync(join(tmpdir(), 'sj-out-'));
    buildCss({ srcDir: tree(base), outDir: out1 });
    const out2 = mkdtempSync(join(tmpdir(), 'sj-out-'));
    const files = buildCss({
      srcDir: tree({
        ...base,
        'switch.css': '@layer sj.component { .sj-switch { display: block; } }',
      }),
      outDir: out2,
    });
    expect(files).toContain('switch.css');
    const idx = readFileSync(join(out2, 'index.css'), 'utf8');
    expect(idx).toContain('.sj-switch');
    expect(idx).toContain('.sj-button');
    expect(idx.indexOf('--a: 1')).toBeLessThan(idx.indexOf('.sj-button')); // base first
    expect(readFileSync(join(out1, 'index.css'), 'utf8')).not.toContain('.sj-switch');
    expect(readFileSync(join(out2, 'base.css'), 'utf8')).not.toContain('.sj-button');
  });

  it('skips underscore files and folders (the authoring template)', () => {
    const dir = tree({
      '_template/x.css': 'not css {{{',
      '_x.css': 'junk',
      'ok.css': '@layer sj.component { a { color: red } }',
    });
    expect(listSources(dir)).toEqual(['ok.css']);
  });

  it('is deterministic', () => {
    expect(buildReal().index).toBe(buildReal().index);
  });

  it('keeps every real rule inside an sj.* layer', () => {
    expect(() =>
      validateSource('dist/index.css', buildReal().index.replace(LAYERS, '')),
    ).not.toThrow();
  });
});

describe('layer contract', () => {
  it.each([
    ['.a { color: red; }', /outside an sj\.\* layer/],
    ['@media (min-width: 40em) { .a { color: red } }', /@media outside an sj\.\* layer/],
    ['@layer other { .a { color: red } }', /unknown layer/],
    ['@layer sj.component, sj.state { .a { color: red } }', /unknown layer/],
    ['@layer sj.component, sj.base;', /do not declare layer order/],
    ['@import "x.css";', /@import is not allowed/],
  ])('rejects %s', (css, message) => {
    expect(() => validateSource('x.css', css)).toThrow(message);
  });

  it('allows keyframes and @property beside layers', () => {
    expect(() =>
      validateSource(
        'x.css',
        '@keyframes k { to { opacity: 0 } } @property --x { syntax: "<length>"; inherits: false; initial-value: 0 } @layer sj.state { a { color: red } }',
      ),
    ).not.toThrow();
  });

  it('fails the build on a violating source', () => {
    expect(() =>
      buildCss({
        srcDir: tree({ 'bad.css': '.a { color: red }' }),
        outDir: mkdtempSync(join(tmpdir(), 'sj-out-')),
      }),
    ).toThrow(/bad\.css:1/);
  });
});

describe('unlayered consumer CSS overrides every sj.* layer (ADR-009)', () => {
  let b;
  beforeAll(async () => {
    b = await launch();
  });
  afterAll(() => b.browser.close());

  // One rule per layer with absurd specificity and a later position, against a one-class consumer rule.
  const fixture = ['reset', 'base', 'component', 'variant', 'state']
    .map(
      (l, i) =>
        `@layer sj.${l} { #fx.fx.fx[data-part] { --p${i}: library; padding-block-start: ${i + 1}rem; color: rgb(${i}, 0, 0); } }`,
    )
    .join('\n');

  it('lets a plain consumer rule win, with no !important and no specificity fight', async () => {
    const { index } = buildReal();
    const consumer = '.fx { padding-block-start: 9px; color: rgb(10, 20, 30); }';
    const page = await b.page(
      {},
      doc({
        css: index + fixture,
        extra: consumer,
        body: '<div id="fx" class="fx" data-part="x">x</div>',
      }),
    );
    const cs = await page.evaluate(() => {
      const s = getComputedStyle(document.getElementById('fx'));
      return { pad: s.paddingBlockStart, color: s.color };
    });
    expect(cs).toEqual({ pad: '9px', color: 'rgb(10, 20, 30)' });
  });

  it('without the consumer rule the library layers apply (control)', async () => {
    const { index } = buildReal();
    const page = await b.page(
      {},
      doc({ css: index + fixture, body: '<div id="fx" class="fx" data-part="x">x</div>' }),
    );
    expect(
      await page.evaluate(() => getComputedStyle(document.getElementById('fx')).paddingBlockStart),
    ).toBe('80px'); // sj.state, last layer
  });

  it('documents the consumer-reset caveat: an unlayered reset also beats the library (risk 9)', async () => {
    const { index } = buildReal();
    const page = await b.page(
      {},
      doc({
        css: index,
        extra: 'button { min-block-size: 0; min-inline-size: 0; }',
        body: '<button id="b" data-part="trigger" style="padding:0;border:0;font-size:10px">x</button>',
      }),
    );
    const h = await page.evaluate(
      () => document.getElementById('b').getBoundingClientRect().height,
    );
    expect(h).toBeLessThan(44); // the consumer's reset removed the 44px target; see README "Consumer resets".
  });
});
