# PROBE notes (W1-316)

Branch `feature/m3-probe`. Everything lives in `packages/testing/probe/`:
`probe.contract.json`, `reducer.ts`, `probe.css`, `react|vue|vanilla/index.ts`, `index.ts`, two test files.

## What the probe is
`SJProbe`: a two-state switch-like toggle (`off`/`on`, root `button role=switch`, `indicator` span,
controllable `pressed`, event `pressedChange`, Space/Enter on root, native focus). It reuses the
`switch` AT registry file (`pattern.evidence: switch`), copying the switch `a11y` block, so no
registry entry is invented. Fixtures: `off`, `on`, `disabled`.

## Import surface (for W1-114 SSR runner and W1-308b reducer harness; not wired into them)
`packages/testing/probe/index.ts` exports `contract`, `contractPath`, `contractsDir`, `cssPath`,
`reducerEvents`, `reduce`, `storeReducer`, `probeFields`, `rootAttrs`, `stateOf`, `ReactProbe`,
`VueProbe`, `mountProbe`/`probeSpec` (vanilla). Import by relative path; `testing/package.json`
`exports` is untouched.

## Existing tools accept it by path (no tool was edited)
- `contracts:check` validation: `validate.mjs <path>` / `validateFile(path)`.
- codegen: `generate({ contractsDir })` is in-memory and path-based; `checkReducerEquivalence` takes
  the module values. The probe is never written under `src/generated`.
- evidence:check: `checkEvidence({ contractsDir, registryDir })`.
- W1-205 anatomy check: `checkStylesheets(srcDir, contractsDir)` with a scratch dir holding `probe.css`.
- stylelint W1-202 rules: `packages/css/.stylelintrc.json` via `stylelint.lint({ files })`.
All five are exercised in `probe.test.js` with seeded failures. The default scans (`packages/contracts/contracts`,
`packages/css/src`) never see the probe, so it cannot reach the public registry or `dist/`.

## Decisions
- Reducer follows the G-CODE convention: `reducerEvents` plus `reduce(state, {type})` over contract state
  names; `storeReducer` adapts it to the store shape (snapshot `{ pressed }`). Effects: none (a two-state
  toggle has no native/focus/announce effect; the probe proves state, markup, controlled pipeline, SSR).
- Vue: `pressed` declared `default: undefined`, otherwise Vue's boolean casting makes it controlled-false.
- Test files carry `// @ts-nocheck`: the sibling tools are untyped `.mjs` that fail `noImplicitAny` once
  pulled into the testing program (they are loaded through a computed specifier).
- L5/L6 (a11y, visual) need a browser and the Playwright executor (W1-309*): not in this task's files; the
  probe exposes the contract, CSS and wrappers they will mount.

## Shared-file touches (declared)
- `packages/testing/package.json` devDependencies: identical lines to the SSR stream (feature/m3-ssr-determinism):
  `@ramoslabs/{core,react,vanilla,vue}` workspace, `react`, `react-dom`, `vue`, `jsdom`, `@types/react{,-dom}`,
  `@types/jsdom`. Needed because the wrappers import the adapter runtimes. `bun.lock` regenerated (take
  main's on rebase and re-run `bun install`). Adapter `dist/` must be built first (turbo `test` already builds).

## Bytes
Probe is test-only and not in any size ceiling (`node packages/testing/size/cli.js`: unchanged).
