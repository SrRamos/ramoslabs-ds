import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const cli = new URL('../scripts/validate.mjs', import.meta.url).pathname;
const sample = readFileSync(
  new URL('./fixtures/adr-010-sample.contract.json', import.meta.url),
  'utf8',
);
const run = (...files) => spawnSync(process.execPath, [cli, ...files], { encoding: 'utf8' });

describe('validate CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'contracts-'));

  it('exits 0 on a valid contract', () => {
    const ok = join(dir, 'ok.contract.json');
    writeFileSync(ok, sample);
    expect(run(ok).status).toBe(0);
  });

  it('exits 1 and prints the JSON path of a removed required field', () => {
    const bad = join(dir, 'bad.contract.json');
    const c = JSON.parse(sample);
    delete c.budgets;
    writeFileSync(bad, JSON.stringify(c));
    const r = run(bad);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('/budgets');
  });

  it('exits 1 on unreadable JSON', () => {
    const broken = join(dir, 'broken.contract.json');
    writeFileSync(broken, '{');
    expect(run(broken).status).toBe(1);
  });
});
