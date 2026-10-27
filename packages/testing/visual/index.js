/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
/* global document -- used inside page.evaluate callbacks (browser context) */
// Visual harness API (W1-312, ADR-013 L5). See baselines.js for the review policy.
import {
  acceptBaseline,
  keyOf,
  loadBaseline,
  parseUpdateList,
  sha256,
  verifyBaselines,
} from './baselines.js';
import { captureScenes, launch } from './capture.js';
import { comparePng } from './png.js';
import { SCENES } from './scenes.js';
import { buildSite, serve } from './site.mjs';

export { SCENES, verifyBaselines, parseUpdateList, comparePng, sha256, keyOf };

/**
 * Runs the matrix. Result rows: `{ key, scene, status, detail }` with status
 *   pass | fail | not-run (engine missing, or no baseline for this engine x platform x DPR) | updated.
 * Without `update` nothing is ever written.
 */
export async function runVisual({
  engines = ['chromium', 'firefox', 'webkit'],
  dprs = [1, 2],
  update,
  reviewer,
  reason,
  scenes = SCENES,
  root,
  mutate,
} = {}) {
  const names = scenes.map((s) => s.name);
  const updating = update === undefined ? [] : parseUpdateList(update, names);
  if (update !== undefined && (!reviewer || !reason)) {
    throw new Error(
      '--update requires --reviewer <name> and --reason <text> (human review is mandatory)',
    );
  }
  const site = await serve(buildSite(undefined, scenes));
  const rows = [];
  try {
    for (const engine of engines) {
      const browser = await launch(engine);
      for (const dpr of dprs) {
        const key = keyOf(engine, dpr);
        if (!browser) {
          rows.push(
            ...names.map((scene) => ({
              key,
              scene,
              status: 'not-run',
              detail: `${engine} is not installed`,
            })),
          );
          continue;
        }
        const { shots, blocked } = await captureScenes({
          browser,
          origin: site.origin,
          dpr,
          scenes,
          mutate,
        });
        if (blocked.length)
          throw new Error(`hermetic violation, blocked requests: ${blocked.join(', ')}`);
        for (const scene of names) {
          const png = shots.get(scene);
          if (updating.includes(scene)) {
            acceptBaseline({ key, scene, png, reviewer, reason }, root);
            rows.push({ key, scene, status: 'updated', detail: sha256(png).slice(0, 12) });
            continue;
          }
          const base = loadBaseline(key, scene, root);
          if (!base) {
            rows.push({
              key,
              scene,
              status: 'not-run',
              detail: 'no baseline for this engine x platform x DPR',
            });
            continue;
          }
          const r = comparePng(base, png);
          rows.push({
            key,
            scene,
            status: r.same ? 'pass' : 'fail',
            detail: r.same
              ? ''
              : r.sizeMismatch
                ? `size ${r.expectedSize} vs ${r.actualSize}`
                : `${r.diffPixels} px differ, first at ${r.firstDiff.x},${r.firstDiff.y}`,
          });
        }
      }
      await browser?.close();
    }
  } finally {
    await site.close();
  }
  return rows;
}

/** Captures twice in fresh contexts; returns scenes whose pixels differ between runs (must be empty). */
export async function stability({ engine = 'chromium', dpr = 1, scenes = SCENES } = {}) {
  const site = await serve(buildSite(undefined, scenes));
  const browser = await launch(engine);
  if (!browser) return { skipped: true, unstable: [] };
  try {
    const a = await captureScenes({ browser, origin: site.origin, dpr, scenes });
    const b = await captureScenes({ browser, origin: site.origin, dpr, scenes });
    const unstable = scenes
      .map((s) => s.name)
      .filter((n) => !a.shots.get(n).equals(b.shots.get(n)));
    return { skipped: false, unstable };
  } finally {
    await browser.close();
    await site.close();
  }
}

/** Test-only `mutate` hook: paints exactly one CSS pixel at the page origin of scene `name`. */
export const seedOnePixel = (name) => async (scene, page) => {
  if (scene !== name) return;
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.setAttribute(
      'style',
      'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;background:#000',
    );
    document.body.appendChild(d);
  });
};
