// "The button is untouched" (W1-C12.f, PLAN-ICONS decision 9 and row .f). SJButton is `beta`: its contract and
// getters are frozen (ADR-010), and the icon composes with it through the EXISTING `icon` part, so adopting SJIcon
// needs no edit to the button contract, its core getters or `button.css`.
// CI checks out with depth 1, so there is no base ref to diff against; the frozen files are pinned by content hash
// instead. A deliberate button change updates the pin in the same PR, where a reviewer sees it (ADR-010 process).
// The button spec files (`specs/button/**`) are checked by diff in the .f change itself (empty diff against
// main, recorded in C12-NOTES.md ".f"); a permanent pin there would block the button's own fixture lane.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..', '..');
const sha = (rel: string) =>
  createHash('sha256')
    .update(readFileSync(join(repo, rel)))
    .digest('hex');

/** sha256 of each frozen SJButton file at the commit .f was written against (origin/main 9b50b29). */
export const FROZEN: Record<string, string> = {
  'packages/contracts/contracts/button.contract.json':
    '8503c9e1c2b1913815f6278ec39c7af8b63ee863733c050fb337271dbbc7929f',
  'packages/core/src/button/index.ts':
    '2a88b0175d7d01eae436c332d68e267ba77ebc3766ecc5380eeec8b97de383a9',
  'packages/core/src/button/reducer.ts':
    'ce5a6ddac7c54952054814db579b58358404e5f07b509aef2b4f6531e18cee55',
  'packages/css/src/button.css': 'fcb392fc18543503cba574f3da4c8af87845ff5e1b0d3bb20561f22418d2fd19',
};

/** Pure: which pinned files differ from the given hashes. */
export const drift = (actual: Record<string, string>): string[] =>
  Object.keys(FROZEN).filter((f) => actual[f] !== FROZEN[f]);

describe('SJButton stays frozen while SJIcon composes with it', () => {
  it('the button contract, core getters and button.css match their pins', () => {
    const actual = Object.fromEntries(Object.keys(FROZEN).map((f) => [f, sha(f)]));
    expect(drift(actual)).toEqual([]);
  });

  it('seeded: an edited button file is reported', () => {
    const edited = { ...Object.fromEntries(Object.keys(FROZEN).map((f) => [f, FROZEN[f]!])) };
    edited['packages/css/src/button.css'] = 'deadbeef';
    expect(drift(edited)).toEqual(['packages/css/src/button.css']);
  });

  it('the icon contract adds no part, prop or slot to the button: it declares only its own surface', () => {
    const icon = JSON.parse(
      readFileSync(join(repo, 'packages/contracts/contracts/icon.contract.json'), 'utf8'),
    );
    const button = JSON.parse(
      readFileSync(join(repo, 'packages/contracts/contracts/button.contract.json'), 'utf8'),
    );
    expect(button.anatomy.map((a: { part: string }) => a.part)).toContain('icon');
    expect(icon.anatomy.map((a: { part: string }) => a.part)).toEqual(['root']);
  });

  it('the icon specs never import from the button specs (independent lanes)', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|js|mjs)$/.test(n) && n !== 'frozen.test.ts') files.push(p);
      }
    };
    walk(join(here, '..'));
    for (const f of files)
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/specs\/button|\.\.\/button\//);
  });
});
