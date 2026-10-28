#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/cli.js
// SJButton visual run (W1-C01.f): reuses the visual harness with the button scenes and its own baseline root.
//   node specs/button/visual/cli.js check [--engine a,b] [--dpr 1,2]     reports pass | fail | NOT RUN, never writes
//   node specs/button/visual/cli.js update --update <scene[,scene]> --reviewer <name> --reason <text>
// There is no update-all, and the agent that wrote the component does not run `update`: a person looks at the
// captures and records the review (reviewer and reason land in baselines/REVIEW-LOG.json).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runVisual, verifyBaselines } from '../../../visual/index.js';
import { SCENES } from './scenes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), 'baselines');
const { positionals, values } = parseArgs({
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
if (problems.length) process.exit(1);
const rows = await runVisual({
  scenes: SCENES,
  root,
  ...(values.engine && { engines: list(values.engine) }),
  ...(values.dpr && { dprs: list(values.dpr).map(Number) }),
  ...(cmd === 'update' && {
    update: values.update,
    reviewer: values.reviewer,
    reason: values.reason,
  }),
});
for (const r of rows)
  console.log(
    `${r.status.toUpperCase().padEnd(8)} ${r.key} / ${r.scene}${r.detail ? `: ${r.detail}` : ''}`,
  );
const n = (s) => rows.filter((r) => r.status === s).length;
console.log(
  `button visual: ${n('pass')} passed, ${n('fail')} failed, ${n('updated')} updated, ${n('not-run')} NOT RUN (awaiting human-reviewed baselines)`,
);
process.exit(n('fail') > 0 || (values.strict && n('not-run') > 0) ? 1 : 0);
