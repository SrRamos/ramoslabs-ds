/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as the rest of visual/.
// The one visual command set every component's `specs/<c>/visual/cli.js` delegates to (G3A ruling (c)):
//   check [--engine a,b] [--dpr 1,2] [--strict]   compare against reviewed baselines (never writes; NOT RUN when none)
//   candidates                                    write candidate PNGs for review; changes no baseline
//   update --update <scene[,scene]> --reviewer <name> --reason <text>   (a human; no update-all)
//   verify                                        baseline integrity (hash manifest + review log)
// The agent that wrote a component never runs `update`: a person looks at the captures and records the review.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runVisual, verifyBaselines } from './index.js';
import { captureScenes, launch } from './capture.js';
import { buildSite, serve } from './site.mjs';

const testingRoot = dirname(fileURLToPath(import.meta.url));

/**
 * @param {{ label: string, slug: string, scenes: object[], root: string, mutate?: Function, argv?: string[] }} o
 *   `root` is the component's `visual/baselines` directory.
 */
export async function main({ label, slug, scenes, root, mutate, argv = process.argv.slice(2) }) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      engine: { type: 'string' },
      dpr: { type: 'string' },
      update: { type: 'string' },
      reviewer: { type: 'string' },
      reason: { type: 'string' },
      strict: { type: 'boolean', default: false },
    },
  });
  const cmd = positionals[0] ?? 'check';
  const list = (s) => (s ? s.split(',') : undefined);

  const problems = verifyBaselines(root);
  for (const p of problems) console.error(`BASELINE INTEGRITY FAIL: ${p}`);
  if (problems.length) return 1;
  if (cmd === 'verify') return 0;

  if (cmd === 'candidates') {
    const out = join(
      testingRoot,
      '..',
      'node_modules',
      '.cache',
      `specs-${slug}`,
      'visual-candidates',
    );
    const site = await serve(buildSite(undefined, scenes));
    try {
      for (const engine of list(values.engine) ?? ['chromium', 'firefox', 'webkit']) {
        const browser = await launch(engine);
        if (!browser) continue;
        for (const dpr of list(values.dpr)?.map(Number) ?? [1, 2]) {
          const { shots } = await captureScenes({
            browser,
            origin: site.origin,
            dpr,
            scenes,
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
    return 0;
  }

  const rows = await runVisual({
    scenes,
    root,
    ...(mutate && { mutate }),
    ...(values.engine && { engines: list(values.engine) }),
    ...(values.dpr && { dprs: list(values.dpr).map(Number) }),
    ...(cmd === 'update' && {
      update: values.update,
      reviewer: values.reviewer,
      reason: values.reason,
    }),
  });
  for (const r of rows.filter((r) => r.status !== 'pass'))
    console.log(
      `${r.status.toUpperCase().padEnd(8)} ${r.key} / ${r.scene}${r.detail ? `: ${r.detail}` : ''}`,
    );
  const n = (s) => rows.filter((r) => r.status === s).length;
  console.log(
    `${label} visual: ${n('pass')} passed, ${n('fail')} failed, ${n('updated')} updated, ${n('not-run')} NOT RUN (awaiting human-reviewed baselines)`,
  );
  return n('fail') > 0 || (values.strict && n('not-run') > 0) ? 1 : 0;
}
