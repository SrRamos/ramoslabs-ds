import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashTerm, loadHashes, parseHashes, scanText, scanTree } from './index.js';

// A synthetic term; the real prior-brand terms never appear in this repo.
const TERM = 'zorbglax';
const hashes = new Set([hashTerm(TERM)]);

describe('deny-list scan', () => {
  it('hashes the normalized term', () => {
    expect(hashTerm('  ZorbGlax ')).toBe(hashTerm(TERM));
    expect(hashTerm(TERM)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('fails on a seeded term as a word, a prefix, a segment, in kebab and snake case', () => {
    for (const text of [
      'the Zorbglax brand',
      'ZorbglaxButton',
      'zorbglax-button',
      'MyZorbglaxThing',
      'ZORBGLAX_VAR',
      'x\n\nlet zorbglaxId = 1',
    ])
      expect(scanText(text, hashes).length, text).toBeGreaterThan(0);
  });
  it('reports line and column, never the matched word', () => {
    const f = scanText('a\nxx Zorbglax', hashes);
    expect(f).toEqual([{ line: 2, col: 4, digest: hashTerm(TERM).slice(0, 8) }]);
  });
  it('passes clean text', () => {
    expect(scanText('SJButton sj-select design system tokens', hashes)).toEqual([]);
  });
  it('an empty list matches nothing', () => {
    expect(scanText('Zorbglax', new Set())).toEqual([]);
  });
  it('parses digests from env and files, ignoring comments and junk', () => {
    const h = hashTerm(TERM);
    expect([...parseHashes(`# c\n${h} # trailing\nnot-a-hash\n`)]).toEqual([h]);
    const files = { '/x/list': `${hashTerm('other')}\n` };
    const loaded = loadHashes({
      env: { RAMOSLABS_DENYLIST_SHA256: `${h},xyz`, RAMOSLABS_DENYLIST_FILE: '/x/list' },
      readFile: (p) => files[/** @type {keyof typeof files} */ (p)] ?? null,
    });
    expect(loaded.size).toBe(2);
  });
  it('scans a tree (contents and paths) and reports not-configured without digests', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deny-'));
    fs.writeFileSync(path.join(dir, 'ok.txt'), 'SJButton\n');
    fs.writeFileSync(path.join(dir, 'bad.txt'), 'hello\nZorbglaxCard\n');
    fs.writeFileSync(path.join(dir, 'zorbglax.md'), 'clean body\n');
    fs.writeFileSync(path.join(dir, 'bin.dat'), Buffer.from([0, 90, 111, 114, 98]));
    const files = ['ok.txt', 'bad.txt', 'zorbglax.md', 'bin.dat'];
    const none = scanTree({ env: {}, root: dir, files });
    expect(none.configured).toBe(false);
    const env = { RAMOSLABS_DENYLIST_SHA256: hashTerm(TERM) };
    const hit = scanTree({ env, root: dir, files });
    expect(hit.findings.map((f) => `${f.file}:${f.line}`).sort()).toEqual([
      'bad.txt:2',
      'zorbglax.md:0',
    ]);
  });
});
