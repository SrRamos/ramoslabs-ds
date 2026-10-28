# CLOSE-M3 notes: W1-314 CI extension

## Layout
- `.github/workflows/ci.yml`: `static` (lint incl. apps/site worker+agentic, format, typecheck, contracts, contract lint,
  evidence W1-317, honesty W1-319, skip check), `test` (vitest incl. SSR and contrast, named again as steps), `size-and-drift`
  (build, size, `registry:check`, generated files unchanged), `ci` aggregate (the one required status).
- `.github/workflows/e2e.yml`: `changes` (path gate), `browser` matrix (L2 runner, ARIA, supports then parity, a11y, text
  safety; each a parallel job on 3 engines), `visual`, `e2e` aggregate.
- `.github/workflows/visual-baselines.yml`: manual dispatch that produces Linux baselines as an artifact.
- `.github/actions/setup` (bun 1.3.5, node 22, frozen install) and `.github/actions/browsers` (cache on the Playwright
  version, `install --with-deps`; on a cache hit `install-deps` still runs because system libs are outside the cache).
- Root `gate` now also runs `registry:check`, `contract:lint`, `skips:check`. `format:check` covers all of `.github`.
- Pushes to `feature/**` trigger both workflows (PRs need explicit approval, so branch pushes are how CI is proven).

## Decisions
1. **Visual / Linux baselines (reviewed updates only).** Baselines are darwin-only and pixels differ across platforms, so
   the Linux ones must be generated on the CI image. `visual-baselines.yml` (dispatch, `ubuntu-24.04`, pinned Playwright)
   runs the real `visual/cli.js update` for every scene with `--reviewer "<input> (PENDING human review of CI artifact, run N)"`
   and uploads `*-linux-*` plus `REVIEW-LOG.json`. It never commits. A person inspects every PNG, commits them in a
   normal PR. The log honestly says review was pending at generation time. Until Linux baselines are committed the
   `visual` job runs `visual:verify` (integrity, real), prints NOT RUN via `::warning::` and the step summary, runs
   `stability`, and succeeds without claiming a comparison. Once any `-linux-` directory exists it runs the strict
   `test:visual` (check, selftest, stability). To do: dispatch the workflow, review, commit.
2. **Cold-start flakiness.** `test:e2e` failed 2/87 cold, then 5/5 passes. Cause: a worker's browser launch is charged to the
   first test that uses it inside its 30 s budget, and a fresh install or runner launches 3 engines x N workers at once
   (profile creation, library loading, font cache). The esbuild bundle is NOT the cause: it builds in `webServer`
   (60 s budget) before any test. Fix: `e2e/warmup.ts`, called from a `globalSetup` in runner, aria, supports (chained),
   a11y and text-safety; it launches each engine once and loads the host page, outside any test timeout. No retries, no
   longer test timeout. CSS probe Chromium launch timeouts under load: `packages/css/vitest.config.ts` timeouts 30 s to 60 s
   (a timeout, not a retry); CI runs the css probes in their own job with only Chromium.
3. **Real bug found by CI:** `probe.paths.e2e.ts` "forcing a supported capability false" failed on Linux WebKit for the React
   runtime: `root.render` returns before `ReactTap` commits, so `window.__sj.seen` held the previous mount's map. Fixed in
   `runner/host/entry.ts` (`flushSync` around the render, and `seen` reset to null on every mount). Local runs passed by timing.
4. **Skip without issue.** `scripts/skip-check.mjs` (`bun run skips:check`, in the gate): any `skip`/`fixme`/`todo`/`xit`
   needs a reason string (`test.skip(cond, 'why')`), a `// skip-reason: ...` comment within two lines above, or an issue
   reference (`#N` or an issues URL). It runs a selftest (6 seeded violations must be caught) before scanning. It found two
   real unjustified skips (`packages/contracts/test/codegen.test.js`, `packages/testing/spec/reducer/index.test.js`);
   comments added.
5. **Lint coverage of apps/site worker and agentic:** already covered, because `apps/site` runs `eslint .` which includes
   `worker/` and `agentic/`; `eslint worker agentic` is clean, `--print-config` resolves for both. Nothing to add.
6. **Affected components.** Only the probe exists, so suites cannot be narrowed per component; the `changes` job skips the
   browser suites for pull requests that touch no `packages/`, `apps/storybook`, workflows or root config (the job shows as
   skipped, the aggregate accepts that only then). Push to main and manual runs always run everything. Narrow by slug when
   real components land.
7. a11y: PRs run `test:a11y` (@pr lane); main and manual runs run `test:a11y:release`.

## Open
- Deny-list digests are not provisioned; `contract:lint` prints "not configured (skipped)". Once the secret exists, pass
  `--require-denylist` and set `RAMOSLABS_DENYLIST_SHA256`.
- Linux visual baselines: needs a human (see decision 1).
- Actions `checkout@v4`, `setup-node@v4`, `cache@v4`, `upload-artifact@v4` warn about Node 20 deprecation; bump when v5 lines are adopted.
