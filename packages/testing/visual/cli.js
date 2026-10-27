#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
// Visual harness CLI (W1-312).
//   node visual/cli.js check   [--engine a,b] [--dpr 1,2] [--strict]
//   node visual/cli.js update  --update <scene[,scene]> --reviewer <name> --reason <text> [--engine ..] [--dpr ..]
//   node visual/cli.js verify          baseline integrity only (no browser): fails on unreviewed changes
//   node visual/cli.js stability       two captures must be pixel- and byte-identical
//   node visual/cli.js selftest        seeds a 1 px change; the run MUST fail on exactly that scene
// `--strict` turns "not run" into a failure (CI, where every cell must have a platform-matched baseline).
import { parseArgs } from 'node:util';
import { runVisual, seedOnePixel, stability, verifyBaselines } from './index.js';

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
const opts = {
  ...(values.engine && { engines: list(values.engine) }),
  ...(values.dpr && { dprs: list(values.dpr).map(Number) }),
};

function printProblems(problems) {
  for (const p of problems) console.error(`BASELINE INTEGRITY FAIL: ${p}`);
  return problems.length > 0;
}

try {
  if (cmd === 'verify') {
    process.exit(printProblems(verifyBaselines()) ? 1 : 0);
  }
  if (cmd === 'stability') {
    const r = await stability({
      engine: values.engine ?? 'chromium',
      dpr: Number(values.dpr ?? 1),
    });
    if (r.skipped) console.log('stability: NOT RUN (engine not installed)');
    else if (r.unstable.length)
      console.error(`stability FAIL, unstable scenes: ${r.unstable.join(', ')}`);
    else console.log('stability: two captures are byte-identical');
    process.exit(r.unstable.length ? 1 : 0);
  }
  if (cmd === 'selftest') {
    const rows = await runVisual({
      engines: list(values.engine) ?? ['chromium'],
      dprs: [1],
      mutate: seedOnePixel('probe-on'),
    });
    const ran = rows.filter((r) => r.status !== 'not-run');
    if (!ran.length) {
      console.log('selftest: NOT RUN (no baseline or engine)');
      process.exit(values.strict ? 1 : 0);
    }
    const failed = ran.filter((r) => r.status === 'fail');
    const ok =
      failed.length === 1 &&
      failed[0].scene === 'probe-on' &&
      /^1 px differ/.test(failed[0].detail);
    console.log(
      ok
        ? `selftest: seeded 1 px change failed as required (${failed[0].detail})`
        : 'selftest FAIL: the seeded 1 px change was not caught exactly once',
    );
    process.exit(ok ? 0 : 1);
  }
  if (cmd !== 'check' && cmd !== 'update') throw new Error(`unknown command ${cmd}`);
  if (cmd === 'update' && values.update === undefined) {
    throw new Error('update needs --update <scene[,scene]>; there is no update-all');
  }
  if (cmd === 'check' && values.update !== undefined)
    throw new Error('--update belongs to the update command');
  // Integrity first: a baseline changed outside `update` must fail before anything is compared.
  if (printProblems(verifyBaselines())) process.exit(1);
  const rows = await runVisual({
    ...opts,
    ...(cmd === 'update' && {
      update: values.update,
      reviewer: values.reviewer,
      reason: values.reason,
    }),
  });
  for (const r of rows) {
    console.log(
      `${r.status.toUpperCase().padEnd(8)} ${r.key} / ${r.scene}${r.detail ? `: ${r.detail}` : ''}`,
    );
  }
  const count = (s) => rows.filter((r) => r.status === s).length;
  console.log(
    `visual: ${count('pass')} passed, ${count('fail')} failed, ${count('updated')} updated, ${count('not-run')} NOT RUN`,
  );
  const bad = count('fail') > 0 || (values.strict && count('not-run') > 0);
  if (cmd === 'update') printProblems(verifyBaselines());
  process.exit(bad ? 1 : 0);
} catch (e) {
  console.error(`visual: ${e.message}`);
  process.exit(1);
}
