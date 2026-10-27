# AUDIT G0: M0 repo foundation

Auditor: ds-fable. Date: 2026-10-27. Subject: worktree `/Users/srramos/projects/ramoslabs-ds-m0`, branch `feature/wave1-m0-foundation`, nine commits `774a0d6..79bcc55` over `main`. Source of truth: `PLAN-WAVE-1.md` section 2 (W1-001 to W1-009, gate G0) and ADR-002, ADR-003, ADR-009, ADR-011, ADR-013 on the architecture branch; `M0-NOTES.md` for the declared deviations.
Method: every root config, package manifest, scaffold source, lint rule, size-harness module and token source was read. The full gate was run twice: once as committed (all Turbo cache hits) and once with `TURBO_FORCE=true` (every task executed; exit 0). Then one failure was seeded per gate stage and per boundary rule, run, and reverted with `git checkout` (working tree clean at the end; no commit made). The hooks were exercised with `lefthook run pre-commit` on a staged misformatted file and with the commit-msg script on three subjects. `bun install --frozen-lockfile` reports no changes.

## Verdict: FAIL, on one defect

Everything in W1-001 to W1-008 is implemented and verified except one acceptance item of W1-007: the ADR-011 "unused component in a fixture = 0 KiB" row cannot fail in the shipped layout. It reports 0 bytes because the whole measurement bundle is empty, not because tree-shaking removed the unused component; seeding a consumer that uses the "unused" component still passes. The fix is two files and one test assertion. With MUST-1 applied, G0 passes; the remaining items are SHOULD or NICE.

## (a) Acceptance criteria, W1-001 to W1-008

| Task | Criterion | Result | Evidence |
|---|---|---|---|
| W1-001 | `lint` and `format:check` exit 0 clean, per package via Turbo | Pass | Forced run: lint 9 packages, format:check 8 packages plus the root file list, all green |
| W1-001 | non-zero on a seeded violation | Pass | Unused variable in `packages/core/src/index.ts`: `bun run lint` exit 1 (`no-unused-vars`); misformatted line in `packages/react/src/index.ts`: `bun run format:check` exit 1 |
| W1-001 | every P0 devDependency and `prepare` declared up front | Pass | Root `package.json`: eslint, prettier, stylelint, vitest, fast-check, lefthook, @changesets/cli, all exact-pinned; `prepare` runs `scripts/prepare.mjs` (skips in CI and without `.git`) |
| W1-001 | storybook handled | Pass | No `lint`/`format:check` script in `apps/storybook`, so Turbo skips it; `apps/` ignored by ESLint and Prettier (see SHOULD-2) |
| W1-001 | no other P0 task edits a root file | Pass with a note | Root files by commit: W1-001 owns `package.json`, `turbo.json`, ESLint, Prettier, stylelint configs; W1-002 adds its own `vitest.*.ts`; W1-005 adds `.changeset/`; W1-004 adds `lefthook.yml`; W1-006 adds two lines to `eslint.config.js` (NICE-1); W1-008 regenerates `registry.json` and `llms-full.txt` (build outputs) |
| W1-002 | `test` runs in every package | Pass | Forced run: contracts 1, core 4, react 1, vanilla 1, vue, css 1, tokens 16, testing 55 tests, all green |
| W1-002 | a core test touching `document` at import fails | Pass | `fixtures/touches-document.ts` rejects with `ReferenceError` under the default `node` environment; the environment assertion itself breaks the gate when flipped (`bun run test` exit 1) |
| W1-002 | fast-check usable | Pass | Property test in `core.test.ts`; `fast-check` 4.10.2 pinned in root and every package |
| W1-003 | CI fails on seeded lint/format/type/test error; no `continue-on-error` | Pass | `ci.yml` runs the same root scripts as named steps with `bun install --frozen-lockfile`; `continue-on-error` absent; each script verified to exit non-zero on its seed (lint 1, format 1, typecheck 2, test 1, build 2, size 1) |
| W1-004 | bad format or message rejected locally; no runtime dependency | Pass | `lefthook run pre-commit` with a staged misformatted file: exit 1 (prettier); `check-commit-msg.mjs`: `wip stuff` exit 1, `feat(core): ok` exit 0, `feat(core)!: breaking change` exit 0; the script has no dependency |
| W1-005 | every package builds, typechecks, lints; `core` has zero `dependencies` | Pass | Forced build/typecheck/lint green; `core` has no `dependencies` key, `sideEffects: false`, `lib: ["ES2022"]` so a DOM global inside a function is a type error (verified: `TS2584 Cannot find name 'document'`) |
| W1-005 | peers `react >=18`, `vue >=3.5.0`; changesets lockstep | Pass | Peers as stated; `.changeset/config.json` `fixed` group of core, css, contracts, react, vue, vanilla; `testing`, `site`, `storybook` ignored |
| W1-005 | pre-stubbed `core` subpath exports, adapter per-component entries, full `testing` devDependency set, `testing` exports | Pass | `core` exports 13 kernel modules and 13 component entries; react, vue, vanilla export 13 components plus `./runtime`; Vue's Vite config builds one ES entry per export; `testing` devDependencies: playwright, @playwright/test, axe-core, @axe-core/playwright, @guidepup/guidepup, fast-check, esbuild; exports `./lint`, `./size`, `./contrast`, `./spec`, `./e2e` |
| W1-006 | each of the six rules has a seeded failure and a clean pass | Pass | 50 RuleTester cases pass (6 rules); end-to-end seeds break `bun run lint`: `import { ref } from 'vue'` in core (`core-purity`), `import '@ramoslabs/tokens/css'` in vue (`no-css-import`), `@ramoslabs/core/store` import and a `click` listener without `signal` in vanilla (`store-via-runtime`, `listener-signal`); rules 3 and 6 verified by RuleTester only, since no preset or pointer listener exists yet |
| W1-007 | reports every ADR-011 row, raw bytes and graph; adapters separate, peers excluded | Pass | Report rows store 1, overlay 4, collection 3 (collection+focus+typeahead), live 1, kinds 2 (kinds+number), fixture 0, adapter:react/vue/vanilla reported; esbuild 0.28.2 pinned; `--graph` and `--json`; component ceilings read from contract `budgets.gzipKiB` |
| W1-007 | seeded oversize fails | Pass | 4 KiB blob in `core/src/store/index.ts`: `bun run size` exit 1, `store 4.088 KiB … fail` |
| W1-007 | 0 KiB unused-component fixture | **Fail** | See MUST-1 |
| W1-008 | tokens exist in generated CSS/TS/JSON; build passes; `check_contrast` still passes | Pass | `control.json` and `overlay.json` in DTCG form (`$type`, `$value`, `$description`, aliases `{target.min}`, `{space.4}`); `tokens.css` lines 142-160 carry the eleven variables; `tokens.test.ts` asserts each in JSON, CSS and TS and the core contrast pairs; `style-dictionary.config.mjs` unchanged (new files picked up by the existing glob) |
| W1-009 | evidence scaffolding | Deferred | See SHOULD-1 |

## MUST

**MUST-1. The 0 KiB fixture row is vacuous.** `runSize` measures the fixture with the entry `import "<consumer.ts>";` and the fixture package declares `"sideEffects": false`, so esbuild drops the bare import of a side-effect-free package and the bundle is empty: `rawBytes 0`, `bytesInOutput` holds only the entry. Verified by calling `measure()` directly on a consumer that uses `componentB` (`console.log(componentA(), componentB())`): still 0 bytes, status `pass`. The unit test "fails when an unused fixture component leaks" passes only because its temp directory has no `package.json`, so the import is kept there. In the repository the row can never fail, which defeats the one ADR-011 gate that guards tree-shaking when components land.
Correction (three edits):
1. `packages/testing/size/fixtures/unused-component/consumer.ts`: `import { componentA } from './index'; export const used = componentA();`
2. `packages/testing/size/index.js`, fixture branch: `contents: \`export * from ${JSON.stringify(entry)};\`` (as the kernel rows do) so the entry survives; keep `sideEffects: false` on the fixture package, which is what makes the ADR-011 row meaningful.
3. `size.test.js`: in "measures zero bytes of an unused component", also assert `fixture.rawBytes` is undefined-safe and that the bundle itself is non-empty, for example by returning `bundleRawBytes` in the row and asserting `> 0`; and run the leak test against the real fixture directory (copy it to the temp root including its `package.json`) so the test exercises the shipped layout.
After the fix, the seed above must yield `fail` with `bytes of the unused component in the bundle` > 0, and the clean tree must still report 0.

## (b) Declared deviations against the ADRs

| Deviation | Ruling | Why |
|---|---|---|
| Vitest 5 has no workspace file; `vitest.workspace.ts` is a shared definition imported by `vitest.config.ts` and every package config | Acceptable | ADR-013 L1 asks for a runner per package with fast-check; the plan's file name is kept and documented. NICE-5 suggests the honest name |
| lefthook staged-file globs instead of lint-staged | Acceptable | Same behaviour, one fewer dependency; verified exit 1 on a staged misformatted file |
| Conventional-commit check as a Node script, no commitlint | Acceptable | Section 1.2 principle 3; the script is dependency-free and verified on three subjects |
| `@ramoslabs/vue` ESM-only, one entry per component; CJS dropped | Acceptable | ADR-002 "one ESM entry per component per package"; the 0.0.0 scaffold was unpublished |
| Core and adapters built with `tsc`, Vue with Vite | Acceptable | Per-file ESM keeps tree-shaking exact; `core` typechecks without DOM libs (verified) |
| Prettier excludes `apps/`, `docs/`, token sources, generated files | **Correction required (SHOULD-2)** | `apps/site` holds production TypeScript (the MCP worker, the agentic integration, the data modules) that is now outside both ESLint and Prettier; CONTRIBUTING's gate rule is "lint is not done until the format check passes too" |
| `contracts:check` and `evidence:check` placeholders exit 0 | **Correction required (SHOULD-3)** | Loud today, silent the day a contract or an evidence file lands before W1-301/W1-317 wire the real checks |
| `@ramoslabs/css` declares tokens as a peer dependency, not a dependency | Acceptable, record it | ADR-002's table says css depends on "tokens (CSS import)"; a peer is the correct semantic for a CSS `@import` the consumer's bundler resolves. W1-509's wording ("`dependencies` empty except `tokens` for css") must match (NICE-3) |
| W1-009 deferred | **Plan amendment required (SHOULD-1)** | G0's stated pass condition is "W1-001..009 done" |

## (c) Zero runtime dependencies in publishable packages

Pass. `@ramoslabs/core`, `react`, `vanilla`, `vue`, `contracts`, `css`, `tokens` have no `dependencies` key. Peers only: `react >=18`, `vue >=3.5.0`, `@ramoslabs/tokens >=0.1.0` (css). `@ramoslabs/testing` is `private: true`. The previous `@ramoslabs/tokens` dependency and the CSS import in the Vue scaffold were removed (ADR-002). Every devDependency added in this milestone is exact-pinned; the lockfile is frozen in CI and `bun install --frozen-lockfile` reports no change. NICE-2: `@ramoslabs/vue` is the only publishable package without `publishConfig.access: "public"`.

## (d) W1-008 tokens entered through the DTCG source

Pass. `packages/tokens/src/tokens/control.json` and `overlay.json` are DTCG groups with `$type: dimension`, `$value`, `$description`, and aliases (`{target.min}`, `{space.4}`) in the same string form as the existing files; nothing was hand-written into `dist/`. Generated names: `--target-min` 2.75rem, `--target-floor` 1.5rem, `--focus-ring-width` and `--focus-ring-offset` 0.125rem (matching `shadow.focus`), `--control-text-min` 1rem, `--scroll-margin` 2.75rem, `--border-width-hairline` 1px, `--overlay-max-width` 24rem, `--overlay-max-height` 20rem, `--overlay-dialog-max-width` 32rem, `--overlay-viewport-margin` 1rem. All eleven are asserted in JSON, CSS and TS by the tokens test, which also keeps the touch target at 44 px, control text at 16 px and the three core contrast pairs above 4.5:1. ADR-009's required additions (touch target, focus ring width/offset, control text minimum, overlay caps) plus the plan's scroll-margin and hairline are all present.

## (e) Prior brands

Pass on the scan performed: a case-insensitive search of the tree (excluding `node_modules`, `.git`, `dist`) for the candidate prior names and prefixes returned only false positives inside `bun.lock` hashes and unrelated words. The new prefix is `SJ`/`sj-` throughout. The real deny-list scan is W1-307's; NICE-4 flags a design point for it.

## SHOULD

- **SHOULD-1. W1-009 deferral needs a plan amendment, not silence.** The plan's G0 condition reads "W1-001..009 done". The reason given (the `docs/architecture/` tree lives only on the architecture branch) is real. Correction: execute W1-009 on the architecture branch now (it depends on nothing), and record in `CHANGELOG-PLAN-R1.md` that W1-009 is a precondition of G1 rather than G0, because W1-113 (M1) writes `docs/architecture/evidence/kernel-sizes.md` and W1-501/504/505/508 depend on it.
- **SHOULD-2. `apps/site` TypeScript is linted and formatted by nothing.** ESLint ignores `apps/**`; Prettier ignores `apps`; the site's `lint` script is stylelint only. The MCP worker (`apps/site/worker/index.ts`), `agentic/integration.ts` and `src/data/*.ts` are production code. Correction: add an ESLint block for `apps/site/{worker,agentic,src}/**/*.ts` (Node globals for the worker and integration, browser globals for `src`), and narrow the Prettier ignore to `apps/**/*.{astro,mdx}` until `prettier-plugin-astro` is adopted; keep `docs/` ignored only if the architecture branch owns its formatting, and say so in `.prettierignore`.
- **SHOULD-3. Placeholders must fail once they have input.** `scripts/pending-check.mjs` exits 0 unconditionally. Correction: give it the glob it will one day check (`packages/contracts/contracts/*.contract.json` for `contracts:check`, `docs/architecture/evidence/at-support/*.json` for `evidence:check`) and exit 1 with "input exists but the check is not implemented (W1-xxx)" when any file matches, so the gate cannot go green on unverified contracts or evidence by accident.

## NICE

- **NICE-1.** W1-006 edited the W1-001-owned `eslint.config.js` (two lines wiring `boundariesConfigs`). Harmless here because the work was serial on one branch; the plan intended W1-001 to pre-wire that import. Note it in M0-NOTES as the one exception.
- **NICE-2.** Add `"publishConfig": { "access": "public" }` to `@ramoslabs/vue` like the other five publishable packages; scoped packages default to restricted on first publish.
- **NICE-3.** Record the css-tokens peer decision where W1-509 will read it (M0-NOTES already; add one line to `CHANGELOG-PLAN-R1.md` so W1-509's "`dependencies` empty except `tokens` for css" becomes "css lists tokens as a peer").
- **NICE-4.** For W1-307: the deny-list of prior-brand terms cannot itself be committed in clear text without violating BRIEF constraint 1. Plan for hashed terms or an environment-provided list before that task starts.
- **NICE-5.** `vitest.workspace.ts` is not a Vitest workspace file; rename it `vitest.shared.ts` (and the plan's reference) or keep the explanatory comment, which is accurate.
- **NICE-6.** `tokens.test.ts` uses the 0.03928 luminance threshold, the page scripts in the answers use 0.04045; both are accepted WCAG forms but W1-203 should expose one shared implementation that the test, the MCP `check_contrast` tool and the docs all import.
- **NICE-7.** lefthook's `eslint {staged_files}` will print "file ignored" warnings for staged files under `apps/`; add `--no-warn-ignored`.

## Editorial record required by G0

This audit records, for the architecture changelog: the ADR-002 table's Role cell for `@ramoslabs/testing` reads "spec runner, fixtures, lint rules, size and contrast tooling" (the package README already uses this wording). Append the line to `CHANGELOG-ARCH-R1.md` on the architecture branch.

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| MUST-1 | MUST | `testing/size/index.js`, fixture `consumer.ts`, `size.test.js` | Export from the fixture entry so the bundle is non-empty; test against the shipped layout |
| SHOULD-1 | SHOULD | plan, W1-009 | Run W1-009 on the architecture branch; make it a G1 precondition in the changelog |
| SHOULD-2 | SHOULD | `eslint.config.js`, `.prettierignore` | Lint and format `apps/site` TypeScript; ignore only `.astro`/`.mdx` |
| SHOULD-3 | SHOULD | `scripts/pending-check.mjs` | Exit 1 when the future check's inputs already exist |
| NICE-1..7 | NICE | as listed | as listed |

Re-audit trigger: MUST-1 applied; a file-level check of the three files plus one seeded run of the fixture row suffices for G0 PASS. SHOULD-2 and SHOULD-3 may land in the same commit; SHOULD-1 lands on the architecture branch.

G0-AUDIT DONE

---

# Round 2: commits `c97f290..e4f82f0` (m0) and `62deea8` (architecture)

Auditor: ds-fable. Date: 2026-10-27. Scope: every round-1 finding, the two implementer decisions named by the coordinator, and the full gate rerun with `TURBO_FORCE=true` (exit 0; lint 9, format:check 9, typecheck/build 7, tests 17 tasks, size 1, both pending checks printing "no inputs"). Seeds rerun and reverted; working tree clean.

## Verdict: PASS

| Finding | Status | Verified how |
|---|---|---|
| MUST-1 vacuous 0 KiB fixture | **Resolved** | `consumer.ts` now exports `used`; the harness measures the fixture with `export * from` and reports `bundleRawBytes`; `size.test.js` asserts the bundle is non-empty and runs the leak test on a copy of the shipped fixture including its `sideEffects: false` manifest. My seed (consumer using `componentB` in the real layout): `fixture 0.067 KiB 69 B … fail`, `bun run size` exit 1. Clean tree: 0 bytes, pass |
| SHOULD-1 W1-009 and plan amendment | **Resolved** on the architecture branch | `docs/architecture/evidence/{clean-room/TEMPLATE.md, issue-log/TEMPLATE.md, manifest/evidence-manifest.schema.json, devices/registry.json + schema}` exist; plan W1-009 row, G0 ("W1-001..008 done") and G1 ("W1-009 done") amended; CHANGELOG-PLAN-R1 "G0 audit follow-ups" records it with NICE-1, NICE-3, NICE-4, NICE-6 |
| SHOULD-2 `apps/site` TypeScript unlinted | **Resolved** | ESLint ignores only storybook, `public` and the generated icon file, with browser globals for `src`; Prettier ignores only `.astro`, `.mdx`, `.vue`, doctrine content, storybook, public, the generated file and the audit record; site `lint` runs eslint then stylelint and has `format:check`. Seeds: unused variable in `worker/index.ts` → site lint exit 1; misformatted line in `src/data/pages.ts` → site format:check exit 1 |
| SHOULD-3 silent placeholders | **Resolved** | `pending-check.mjs` takes a directory and suffix; seeded `packages/contracts/contracts/x.contract.json` → `contracts:check` exit 1 with the owning task named; clean → exit 0 "no inputs". The evidence directory does not exist on this branch, so that path reports "no inputs" until merge, which is the correct state |
| NICE-1 root-file exception | Recorded | M0-NOTES and the plan's W1-001/W1-006 cells |
| NICE-2 vue `publishConfig` | Applied | `packages/vue/package.json` |
| NICE-3 css peer wording for W1-509 | Applied | plan W1-509 cell |
| NICE-4 deny-list not in clear text | Applied | plan W1-307 cell |
| NICE-5 `vitest.shared.ts` | Applied | renamed; every package config updated; tests pass |
| NICE-6 one luminance implementation | Applied | plan W1-203 cell |
| NICE-7 `--no-warn-ignored` | Applied | `lefthook.yml` |
| Editorial line for ADR-002 `testing` Role cell | **Open** | Neither `CHANGELOG-ARCH-R1.md` nor ADR-002 carries the widened Role wording ("spec runner, fixtures, lint rules, size and contrast tooling"); ADR-002 line 196 still reads "spec runner, fixtures (private, unpublished)". Not a G0 blocker (the audit itself is the record G0 asked for) but it is the one item from round 1 still undone: append the line to the architecture changelog before the architecture branch merges |

## Decision 1: the five `eslint-disable-next-line` comments

All five are single-line, carry a reason, and sit in code that predates M0 and became lint-visible only because SHOULD-2 widened the scope. Ruling per site:

- `apps/site/src/scripts/analytics.ts` lines 77 and 92, `prefer-rest-params`: **accepted as correct.** The GA4 `gtag` function and the Clarity loader push the live `arguments` object; both vendors' processing relies on it being an `Arguments` object, and a rest array changes behaviour. The comments say exactly that.
- `analytics.ts` line 87, `no-explicit-any` on the Clarity loader's `c` parameter: **accepted.** It is a verbatim vendor snippet that writes an untyped global; typing it would mean rewriting vendor code for no runtime gain, and the reason is stated.
- `apps/site/worker/index.ts` lines 395 and 464, `no-explicit-any` on `handleRpc(msg: any)` and `let body: any`: **accepted for G0, to be removed at the next worker change.** The reason ("untyped input, validated field by field") is honest, but `any` switches off checking inside the very function that does the validation. The right TypeScript shape for untrusted JSON is `unknown` plus a small guard (`isJsonRpcRequest(x): x is { id?: unknown; method: string; params?: unknown }`) that narrows once; then no disable is needed and the validation becomes type-checked. W1-306 edits this file's MCP block, so assign it there (SHOULD-4 below).

No disable hides a real defect, none is file-wide, and none is in a published package.

## Decision 2: `AUDIT-G0.md` committed with `--no-verify` and ignored by Prettier

- The record was committed byte-for-byte as delivered: 101 lines, same first and last line, `git diff c97f290 HEAD -- AUDIT-G0.md` is empty. That is the right choice for an audit record: Prettier would have reflowed its tables and changed a signed document.
- The `.prettierignore` entry arrived two commits later (`205b1b6`), so at `c97f290` the pre-commit hook's `prettier --check` on the staged file would have failed, which is why `--no-verify` was used. Today `prettier --check AUDIT-G0.md` passes (ignored), so the bypass is no longer needed and would not recur.
- Ruling: **accepted as a one-off**, on two conditions. (1) Replace the per-file ignore with a pattern that covers future audit records (`AUDIT-*.md` at the root, or move audits to `docs/audits/` and ignore that folder) so no future audit commit needs a hook bypass. (2) Record the bypass in M0-NOTES (the commit message says "committed as delivered"; the notes do not mention `--no-verify`). A hook bypass that is disclosed and made unnecessary is fine; an undisclosed one would not be.

## Findings (round 2)

- **SHOULD-4.** Worker JSON-RPC: replace the two `any` disables with `unknown` and a type guard; owner W1-306 (next task that touches `apps/site/worker/index.ts`).
- **SHOULD-5.** Architecture branch: append the ADR-002 `testing` Role editorial line to `CHANGELOG-ARCH-R1.md` (and the ADR-002 table cell) before merge; this closes the only round-1 item still open.
- **NICE-8.** `.prettierignore`: `AUDIT-*.md` (or a `docs/audits/` folder) instead of `AUDIT-G0.md`; one line in M0-NOTES stating that `c97f290` used `--no-verify` and why.

G0 passes. M1 may start. SHOULD-4 and SHOULD-5 are tracked to W1-306 and the architecture-branch merge; NICE-8 can land with the next m0 commit.

G0-AUDIT-2 DONE
