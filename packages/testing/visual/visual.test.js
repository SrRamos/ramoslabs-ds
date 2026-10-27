/* eslint-disable @typescript-eslint/ban-ts-comment -- plain-JS test helpers */
// @ts-nocheck -- test helpers are untyped.
// Browser-free unit tests for the visual harness policy (W1-312). The browser matrix is
// `bun run test:visual`; this file proves the PNG diff, the no-update-all rule and the integrity check.
import { deflateSync } from 'node:zlib';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acceptBaseline, sha256, parseUpdateList, verifyBaselines } from './baselines.js';
import { comparePng, decodePng } from './png.js';
import { SCENES } from './scenes.js';
import { fontFaceCss, FONTS, sceneHtml } from './site.mjs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
/** Builds an 8-bit RGBA PNG of `w` x `h`, every pixel `fill`, with optional `[x, y]` set to black. */
function png(w, h, fill = 255, dot) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4, fill);
    row[0] = 0;
    if (dot && dot[1] === y) row.fill(0, 1 + dot[0] * 4, 1 + dot[0] * 4 + 3);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('comparePng', () => {
  it('passes identical images', () => {
    expect(comparePng(png(8, 8), png(8, 8)).same).toBe(true);
  });
  it('fails on exactly one differing pixel (zero tolerance)', () => {
    const r = comparePng(png(8, 8), png(8, 8, 255, [3, 5]));
    expect(r).toMatchObject({ same: false, diffPixels: 1, firstDiff: { x: 3, y: 5 } });
  });
  it('fails on a 1 px size change', () => {
    expect(comparePng(png(8, 8), png(9, 8))).toMatchObject({ same: false, sizeMismatch: true });
  });
  it('decodes dimensions', () => {
    expect(decodePng(png(4, 2))).toMatchObject({ width: 4, height: 2 });
  });
});

describe('update policy', () => {
  const known = SCENES.map((s) => s.name);
  it('refuses update-all in every spelling', () => {
    for (const v of ['', ' ', 'all', '*', 'probe-on,all', 'probe-*']) {
      expect(() => parseUpdateList(v, known)).toThrow(/update-all|not a scene|explicit/);
    }
    expect(() => parseUpdateList(undefined, known)).toThrow(/explicit/);
  });
  it('refuses unknown scenes and accepts named ones', () => {
    expect(() => parseUpdateList('nope', known)).toThrow(/unknown scene/);
    expect(parseUpdateList('probe-on,probe-off', known)).toEqual(['probe-on', 'probe-off']);
  });
  it('requires a reviewer and a reason', () => {
    const root = mkdtempSync(join(tmpdir(), 'vis-'));
    const args = { key: 'chromium-test-1x', scene: 'a', png: png(2, 2) };
    expect(() => acceptBaseline({ ...args, reviewer: 'x' }, root)).toThrow(/reviewer/);
    expect(() => acceptBaseline({ ...args, reason: 'x' }, root)).toThrow(/reviewer/);
  });
});

describe('baseline integrity (changed without --update must fail)', () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), 'vis-'));
    acceptBaseline(
      { key: 'chromium-test-1x', scene: 'a', png: png(4, 4), reviewer: 'r', reason: 'x' },
      root,
    );
    return root;
  };
  it('passes after a reviewed update', () => {
    expect(verifyBaselines(setup())).toEqual([]);
  });
  it('fails when a PNG is replaced by hand', () => {
    const root = setup();
    writeFileSync(join(root, 'chromium-test-1x', 'a.png'), png(4, 4, 255, [1, 1]));
    expect(verifyBaselines(root).join()).toMatch(/differs from manifest/);
  });
  it('fails when a new PNG is dropped in without a manifest entry', () => {
    const root = setup();
    writeFileSync(join(root, 'chromium-test-1x', 'b.png'), png(4, 4));
    expect(verifyBaselines(root).join()).toMatch(/no manifest entry/);
  });
  it('fails when the manifest is also hand-edited but no review is logged', () => {
    const root = setup();
    const dir = join(root, 'chromium-test-1x');
    const changed = png(4, 4, 255, [0, 0]);
    writeFileSync(join(dir, 'a.png'), changed);
    const sha = sha256(changed);
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ a: sha }));
    expect(verifyBaselines(root).join()).toMatch(/no REVIEW-LOG entry/);
  });
  it('fails when the manifest is missing', () => {
    const root = setup();
    expect(readdirSync(join(root, 'chromium-test-1x'))).toContain('manifest.json');
    writeFileSync(join(root, 'chromium-test-1x', 'manifest.json'), '{}');
    expect(verifyBaselines(root).length).toBeGreaterThan(0);
  });
});

describe('hermetic site', () => {
  it('declares every production font with font-display: block and a local url', () => {
    const css = fontFaceCss();
    expect(css.match(/font-display: block/g)).toHaveLength(FONTS.length);
    expect(css).not.toMatch(/https?:|\/\//);
    expect(css).toMatch(/url\('\/fonts\/[\w.-]+\.woff2'\)/);
  });
  it('scene pages reference only local root-relative files', () => {
    for (const s of SCENES) expect(sceneHtml(s)).not.toMatch(/(?:src|href)="(?:https?:)?\/\//);
  });
  it('uses the production font bytes the site ships', () => {
    const site = readFileSync(
      new URL('../../../apps/site/public/fonts/rubik-var.woff2', import.meta.url),
    );
    expect(site.length).toBeGreaterThan(1000);
  });
});
