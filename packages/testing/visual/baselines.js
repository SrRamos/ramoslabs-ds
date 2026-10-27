/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
// Baseline store and review policy (W1-312, ADR-013 L5).
//
// Layout: baselines/<engine>-<platform>-<dpr>x/<scene>.png plus, per directory, manifest.json (sha256 of
// every PNG) and baselines/REVIEW-LOG.json (one entry per accepted change, with reviewer and reason).
//
// Policy ("mandatory human review; no update all"):
//  - `check` never writes. A missing baseline is reported `not-run`, never auto-accepted.
//  - `update` needs `--update <scene>[,<scene>...]` naming scenes explicitly (no `all`, no `*`, no empty
//    list), plus `--reviewer` and `--reason`. It writes the PNG, the manifest hash and a log entry.
//  - `verify` (the integrity check) fails when a PNG's hash differs from the manifest, when a PNG has no
//    manifest entry or the reverse, or when a manifest hash has no review-log entry. So a baseline that
//    changed without going through `update` fails, even if someone also hand-edited the manifest.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const BASELINE_ROOT = join(here, 'baselines');
export const LOG_FILE = 'REVIEW-LOG.json';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const keyOf = (engine, dpr, platform = process.platform) => `${engine}-${platform}-${dpr}x`;

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

export function loadBaseline(key, scene, root = BASELINE_ROOT) {
  const p = join(root, key, `${scene}.png`);
  return existsSync(p) ? readFileSync(p) : null;
}

/** Scenes named `all`, `*` or nothing are refused: there is no update-all (ADR-013 L5). */
export function parseUpdateList(value, known) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('--update needs explicit scene names; there is no update-all');
  }
  const names = value.split(',').map((s) => s.trim());
  for (const n of names) {
    if (n === '' || n === 'all' || n === '*' || n.includes('*')) {
      throw new Error(`--update "${n}" is not a scene; there is no update-all`);
    }
    if (!known.includes(n)) throw new Error(`--update: unknown scene "${n}"`);
  }
  return [...new Set(names)];
}

/** Writes one accepted baseline. Requires a reviewer and a reason; appends the review log. */
export function acceptBaseline(
  { key, scene, png, reviewer, reason, now = new Date() },
  root = BASELINE_ROOT,
) {
  if (!reviewer?.trim() || !reason?.trim()) {
    throw new Error(
      '--update requires --reviewer <name> and --reason <text> (human review is mandatory)',
    );
  }
  const dir = join(root, key);
  mkdirSync(dir, { recursive: true });
  const before = loadBaseline(key, scene, root);
  writeFileSync(join(dir, `${scene}.png`), png);
  const manifest = readJson(join(dir, 'manifest.json'), {});
  manifest[scene] = sha256(png);
  writeJson(join(dir, 'manifest.json'), Object.fromEntries(Object.entries(manifest).sort()));
  const log = readJson(join(root, LOG_FILE), []);
  log.push({
    key,
    scene,
    before: before ? sha256(before) : null,
    after: sha256(png),
    reviewer: reviewer.trim(),
    reason: reason.trim(),
    date: now.toISOString().slice(0, 10),
  });
  writeJson(join(root, LOG_FILE), log);
}

/** Returns a list of problems; empty means every baseline is manifest-matched and review-logged. */
export function verifyBaselines(root = BASELINE_ROOT) {
  const problems = [];
  if (!existsSync(root)) return problems;
  const log = readJson(join(root, LOG_FILE), []);
  const logged = new Set(log.map((e) => `${e.key}/${e.scene}/${e.after}`));
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const manifest = readJson(join(dir, 'manifest.json'), null);
    const pngs = readdirSync(dir).filter((f) => f.endsWith('.png'));
    if (!manifest) problems.push(`${entry.name}: manifest.json is missing`);
    for (const f of pngs) {
      const scene = f.slice(0, -4);
      const want = manifest?.[scene];
      if (!want)
        problems.push(
          `${entry.name}/${scene}: baseline has no manifest entry (changed without --update)`,
        );
      else if (sha256(readFileSync(join(dir, f))) !== want) {
        problems.push(
          `${entry.name}/${scene}: baseline differs from manifest (changed without --update)`,
        );
      }
    }
    for (const [scene, hash] of Object.entries(manifest ?? {})) {
      if (!pngs.includes(`${scene}.png`))
        problems.push(`${entry.name}/${scene}: in manifest but file is missing`);
      if (!logged.has(`${entry.name}/${scene}/${hash}`)) {
        problems.push(
          `${entry.name}/${scene}: manifest hash has no REVIEW-LOG entry (no human review recorded)`,
        );
      }
    }
  }
  return problems;
}
