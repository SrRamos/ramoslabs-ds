# M0 repo foundation: implementation notes

Branch `feature/wave1-m0-foundation`. Scope W1-001 to W1-008. Spec: `PLAN-WAVE-1.md` sections 0 and 2,
ADR-002, ADR-009, ADR-011, ADR-013 (architecture branch, read-only).

## Decisions

- **Vitest 5 has no workspace file.** The plan names `vitest.workspace.ts`; Vitest 5 only reads
  `test.projects` from `vitest.config.ts`. `vitest.workspace.ts` is kept as the shared definition
  (`sharedTestConfig`, `projects`) imported by the root `vitest.config.ts` and every
  `packages/*/vitest.config.ts`.
- **Lint-staged replaced by lefthook staged-file globs.** `lefthook.yml` runs eslint, prettier
  `--check` and stylelint on `{staged_files}`. Same behavior, one fewer dependency.
- **Conventional-commit check is a 30-line Node script** (`scripts/check-commit-msg.mjs`), no
  commitlint dependency (no runtime or tooling weight for a regex).
- **Adapters never import CSS (ADR-002).** `packages/vue/src/index.ts` used to import
  `@ramoslabs/tokens/css`; that import is removed and `@ramoslabs/tokens` moved from `dependencies`
  to `devDependencies`. `@ramoslabs/css` declares tokens as a peer dependency.
- **Vue build is ESM only**, one entry per component (`dist/<slug>/index.js`), matching "one ESM
  entry per component per package". The 0.0.0 scaffold was unpublished, so dropping CJS is safe.
- **Core and adapters build with `tsc`** (per-file ESM output keeps tree-shaking exact); the vue
  package keeps Vite (SFCs arrive later). `core` compiles with `lib: ["ES2022"]` (no DOM), so DOM
  use in core is also a type error.
- **Format scope.** `prettier --check` runs per package (Turbo) plus the root config files. `apps/`
  (Astro/MDX), `docs/`, generated files and `packages/tokens/src/tokens` + its README are in
  `.prettierignore` so the pre-existing files are not reformatted in this milestone.
- **Docs site and Storybook lint.** Storybook has no `lint` script (nothing to lint: stories only),
  so Turbo skips it. The site's `lint` runs its existing stylelint config.
- **Placeholders are loud.** `contracts:check` (W1-301) and `evidence:check` (W1-317) print
  "not implemented yet (owned by W1-xxx)" and exit 0 through `scripts/pending-check.mjs`.
- **Rule semantics chosen for ambiguous boundary rules (W1-006):**
  rule 3 "public primitives" = a sibling preset, `../primitives`, or exactly one segment below it,
  or a bare package specifier that is not a deep `src`/`internal`/`runtime` path;
  rule 4 forbids `@ramoslabs/core/store` and `core/src/store` outside `<adapter>/src/runtime/**`;
  rule 5 requires a `signal` key in the options object of every adapter `addEventListener`;
  rule 6 requires `passive: true`, or an inline handler that calls `preventDefault()`, for
  `wheel`, `touch*`, `pointer*`; it applies to every package `src`.
- **Size harness (W1-007).** esbuild 0.28.2 (pinned, devDependency of `testing`), minify + gzip level 9,
  raw bytes, import graph (metafile), `--graph` and `--json <file>` options. Empty modules report
  0 B (not the 20-byte gzip header). `budgets.json` lives at `packages/testing/size/budgets.json`.
  Component ceilings are read from `packages/contracts/contracts/*.contract.json` `budgets.gzipKiB`
  (ADR-010) with shared kernel modules externalized; none exist yet, so no component rows today.
- **New tokens (W1-008)**, in `packages/tokens/src/tokens/control.json` and `overlay.json`:
  `--target-min` 2.75rem (44px), `--target-floor` 1.5rem (24px, WCAG 2.5.8 floor used by W1-204),
  `--focus-ring-width` / `--focus-ring-offset` 0.125rem (match `shadow.focus`: 2px edge, 2px gap),
  `--control-text-min` 1rem, `--scroll-margin` (= target-min), `--border-width-hairline` 1px,
  `--overlay-max-width` 24rem, `--overlay-max-height` 20rem, `--overlay-dialog-max-width` 32rem,
  `--overlay-viewport-margin` (= space-4). Overlay cap values are engineering choices, revisable.
- The site build regenerates `registry.json` and `llms-full.txt` (token totals); they are committed
  with the tokens commit.

## Deviations and deferred

- **W1-009 deferred**: writes under `docs/architecture/`, which exists only on the architecture branch.
- Each commit was gated on the full working tree at the end of the work, not re-run commit by commit.
  The final HEAD passes the full gate.
- Existing app/package devDependency ranges (`site`, `storybook`, `tokens`, `vue`) are untouched;
  all devDependencies added by this milestone are exact-pinned. Lockfile is frozen in CI.
- `prepare` (lefthook install) is skipped in CI and without `.git`; hooks were verified by
  `lefthook run pre-commit` and by calling the commit-msg script directly.
- No Android, iOS 17 or JAWS items exist in M0 (D2).

## Acceptance criteria and verification

| Task   | Criterion                                                                                | How verified (command, result)                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W1-001 | `lint` and `format:check` exit 0 clean                                                   | `bun run lint` and `bun run format:check`: exit 0                                                                                                                        |
| W1-001 | non-zero on seeded violation, per package via Turbo                                      | unused var in `packages/core/src/seed.ts`: `bun run lint` exit 1; misformatted line: `bun run format:check` exit 1                                                       |
| W1-001 | declares P0 devDeps and `prepare`                                                        | root `package.json`: eslint, prettier, stylelint, vitest, fast-check, lefthook, @changesets/cli, `prepare`                                                               |
| W1-002 | `test` runs in every package                                                             | `bun run test`: 8 packages ran (tokens, css, contracts, core, react, vue, vanilla, testing), all pass                                                                    |
| W1-002 | core test touching `document` at import fails                                            | `packages/core/src/core.test.ts` imports `fixtures/touches-document.ts` and expects `ReferenceError`                                                                     |
| W1-002 | fast-check usable                                                                        | property test in `core.test.ts` passes                                                                                                                                   |
| W1-003 | fails on seeded lint/format/type/test error, no `continue-on-error`                      | `ci.yml` runs the same root scripts as separate steps; seeded lint exit 1, format exit 1, typecheck exit 2, test exit 1; `grep -c continue-on-error ci.yml` = 0          |
| W1-004 | bad format or message rejected locally                                                   | `lefthook run pre-commit` with a badly formatted staged file: exit 1; `check-commit-msg.mjs` on `wip stuff`: exit 1, on `feat(core): ok`: exit 0                         |
| W1-005 | every package builds, typechecks, lints; core zero deps                                  | `bun run build`, `typecheck`, `lint`: all tasks successful; `core/package.json` has no `dependencies`                                                                    |
| W1-005 | peers `react >=18`, `vue >=3.5.0`; changesets lockstep                                   | package.json peers; `.changeset/config.json` `fixed` group of the six published packages                                                                                 |
| W1-006 | each rule has a seeded failure and a clean pass                                          | `packages/testing/lint/boundaries/boundaries.test.js`: 50 RuleTester cases pass; end-to-end seeded files in core and vanilla reported by `eslint .`                      |
| W1-007 | reports every ADR-011 row, seeded oversize fails, adapters separate, raw bytes and graph | `bun run size` table; `size.test.js` seeded oversize and leaked-fixture cases fail as expected                                                                           |
| W1-008 | tokens appear in generated CSS/TS/JSON; build passes; contrast passes                    | `bun run --filter @ramoslabs/tokens build`; `packages/tokens/test/tokens.test.ts` checks all three formats and contrast of core pairs (same formula as `check_contrast`) |
