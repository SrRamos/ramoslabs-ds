/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness script.
// SJSwitch visual runs (W1-C03s.f), on the visual harness's own capture, site and baseline code. Baselines
// live in specs/switch/baselines and need a HUMAN: this script never approves anything.
//   node specs/switch/visual.mjs check [--strict]          compare against reviewed baselines (not-run when none)
//   node specs/switch/visual.mjs candidates               write candidate PNGs for review; changes no baseline
//   node specs/switch/visual.mjs update --update <scene[,scene]> --reviewer <name> --reason <text>   (human)
//   node specs/switch/visual.mjs verify                   baseline integrity (hash manifest + review log)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runVisual, verifyBaselines } from '../../visual/index.js';
import { captureScenes, launch } from '../../visual/capture.js';
import { buildSite, serve } from '../../visual/site.mjs';
import { SWITCH_SCENES, mutate } from './scenes.js';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, 'baselines');
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    update: { type: 'string' },
    reviewer: { type: 'string' },
    reason: { type: 'string' },
    strict: { type: 'boolean', default: false },
  },
});
const cmd = positionals[0] ?? 'check';

if (cmd === 'verify') {
  const problems = verifyBaselines(ROOT);
  for (const p of problems) console.error(`BASELINE INTEGRITY FAIL: ${p}`);
  process.exit(problems.length ? 1 : 0);
}

if (cmd === 'candidates') {
  const out = join(here, '..', '..', 'node_modules', '.cache', 'specs-switch', 'visual-candidates');
  const site = await serve(buildSite(undefined, SWITCH_SCENES));
  try {
    for (const engine of ['chromium', 'firefox', 'webkit']) {
      const browser = await launch(engine);
      if (!browser) continue;
      for (const dpr of [1, 2]) {
        const { shots } = await captureScenes({
          browser,
          origin: site.origin,
          dpr,
          scenes: SWITCH_SCENES,
          mutate,
        });
        const dir = join(out, `${engine}-${process.platform}-${dpr}x`);
        mkdirSync(dir, { recursive: true });
        for (const [name, png] of shots) writeFileSync(join(dir, `${name}.png`), png);
      }
      await browser.close();
    }
  } finally {
    await site.close();
  }
  console.log(
    `candidates written to ${out}. REVIEW THEM, then run "update" as the named reviewer.`,
  );
  process.exit(0);
}

const rows = await runVisual({
  scenes: SWITCH_SCENES,
  root: ROOT,
  mutate,
  ...(cmd === 'update' && {
    update: values.update,
    reviewer: values.reviewer,
    reason: values.reason,
  }),
});
const bad = rows.filter((r) => r.status === 'fail');
const notRun = rows.filter((r) => r.status === 'not-run');
for (const r of rows.filter((r) => r.status !== 'pass'))
  console.log(`${r.status}: ${r.key} ${r.scene} ${r.detail}`);
console.log(
  `visual: ${rows.length - bad.length - notRun.length} pass, ${bad.length} fail, ${notRun.length} not run (no reviewed baseline)`,
);
process.exit(bad.length || (values.strict && notRun.length) ? 1 : 0);
