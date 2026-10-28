# Kernel size report (W1-113, ADR-011)

Measured on main at 842ed10 plus the harness change in this branch. Tool: `node packages/testing/size/cli.js --graph`
(esbuild, minified, gzip level 9, `platform: neutral`, `target: es2022`, tree-shaken, peers and `@ramoslabs/*` external
for adapters). Bytes are exact; KiB = bytes / 1024.

Re-measured after G1 fixes on 2026-10-27 (branch `feature/g1r2-fixes`, base `5003089`); every table in sections 1 to 3 is refreshed.

## 1. Result against the ADR-011 ceilings

Every ADR-011 ceiling holds. No ceiling is missed, so **no ADR-011 amendment is needed and none is proposed.**

| Module (ADR-011 row) | Ceiling | gzip | raw min | Used | Headroom | Status |
|---|---|---|---|---|---|---|
| store (snapshot/subscription) | 1 KiB | 282 B (0.275 KiB) | 384 B | 27 % | 742 B | pass |
| overlay + geometry fallback | 4 KiB | 2,375 B (2.319 KiB) | 5,105 B | 58 % | 1,721 B | pass |
| collection + focus + typeahead | 3 KiB | 1,607 B (1.569 KiB) | 3,293 B | 52 % | 1,465 B | pass |
| live-region registry | 1 KiB | 457 B (0.446 KiB) | 710 B | 45 % | 567 B | pass |
| field-kinds + number parser | 2 KiB | 1,711 B (1.671 KiB) | 4,131 B | 84 % | 337 B | pass |
| unused component in a fixture | 0 KiB JS | 0 B | 0 B | n/a | n/a | pass |

Byte counts are exact from the CLI JSON output. `kinds` is the tightest row (84 %); its raw size
is dominated by the generated field-kinds table, so further kinds in `kinds.contract.json` will consume the 337 B headroom
first. A watch item for G1, not a miss.

Notes on reading the table:

- `live` includes `HIDDEN_STYLE` (the inline visually-hidden style every host applies, G1 MUST-3), which costs 124 B gzip
  (333 B before, 457 B now; re-measured at `5003089`, R2-NICE-2).
- `overlay` bundles `ids`, `collection` and `focus` (see graph), so those bytes are inside the overlay row and also inside
  the collection row. The rows are per-artifact ceilings (ADR-011), not additive. Derived consumer caps in ADR-011
  (8 / 8 / 16 / 6 KiB) are caps from ceilings, not sums of these measurements.
- `button` and `switch` component rows report 0 B because their `packages/core/src/<slug>/index.ts` are still pre-stubs
  (`export {}`); component rows become meaningful as W1-2xx lands. This is real, not a fixture wiring fault.
- The `fixture` row passes by measuring bytes of the unused module `b.ts` inside the consumer bundle (0), with the bundle
  itself non-empty.

## 2. Modules with no ADR-011 row (reported only, no ceiling)

Added to `budgets.json` as `reported` rows. They are measured and printed, never gated, and no ceiling is invented.

| Module | gzip | raw min | Stream-reported gzip / raw | Note |
|---|---|---|---|---|
| ids | 489 B (0.478 KiB) | 859 B | 489 / 859 (K1) | matches |
| runtime | 890 B (0.869 KiB) | 1,687 B | 723 / 1,332 (K1) | grew since K1 (config, supports, `serializeRuntime`, G1 corrections) |
| effects | 521 B (0.509 KiB) | 812 B | 500 / 780 (K1) | grew by 21 B (SHOULD-5 `correctiveVersion`) |
| merge | 901 B (0.880 KiB) | 1,706 B | 829 dev / 645 prod gzip, 1,529 dev / 1,207 prod raw (K2) | measured unbundled, so the dev branch is in: this is the dev build. Above K2's 829 B (72 B), K2 used a different define and wrapper |
| controlled | 695 B (0.679 KiB) | 1,183 B | none reported | first measurement |

Shared-kernel total outside ADR-011 rows (ids + runtime + effects + merge + controlled): about 3.41 KiB gzip as separate
bundles, an upper bound since each is measured alone.

## 3. Adapter runtime entries (reported, core and peers excluded)

The `adapter:*` rows reported 0 B because they measured each adapter's `src/index.ts` barrel, which is a generated,
intentionally empty `export {}` until its milestone. They now measure `src/runtime/index.ts` (`adapterEntries` in
`budgets.json`), with `@ramoslabs/core` and framework peers external, so adapter bytes and kernel bytes are counted once
and separately.

| Adapter | gzip | raw min | Files in graph | Stream-reported (bundled core, dist) |
|---|---|---|---|---|
| react | 1,560 B (1.523 KiB) | 3,394 B | 5 | R1: 3,210 B gzip / 6,860 B raw including bundled core |
| vue | 1,357 B (1.325 KiB) | 2,751 B | 4 | R2: 3.64 kB gzip / 9.26 kB raw including bundled core |
| vanilla | 1,358 B (1.326 KiB) | 2,623 B | 1 | none reported |

R1 and R2 numbers include core copies in the adapter `dist`, a different quantity from the rows above (adapter only). See
clarification (a): adapters do not bundle core, so those bundled figures are not what ships.

## 4. Import graphs

Verbatim from `--graph` (paths relative to repo root).

- store: `core/src/store/index.ts`.
- overlay (9): `overlay/placement/{parse,evaluate,scheduler,index}.ts`, `ids/index.ts`, `collection/index.ts`,
  `focus/index.ts`, `overlay/behavior/index.ts`, `overlay/index.ts`.
- collection (4): `ids/index.ts`, `collection/index.ts`, `focus/index.ts`, `typeahead/index.ts`.
- live (1): `live/index.ts`.
- kinds (4): `generated/kinds/table.ts`, `kinds/table.ts`, `kinds/index.ts`, `number/index.ts`.
- ids, runtime, effects, controlled (1 each): their own `index.ts`. merge (2): `merge/merge.ts`, `merge/index.ts`.
- fixture (5): `unused-component/{a,b,index,consumer,size-entry}.ts`.
- adapter:react (5): `react/src/runtime/{live-host,dev,provider,machine,index}.ts`.
- adapter:vue (4): `vue/src/runtime/{dom,context,store,index}.ts`.
- adapter:vanilla (1): `vanilla/src/runtime/index.ts`.

No graph contains a node_modules path, a framework import, or a path outside its own module family (the `overlay` pull of
`ids`, `collection`, `focus` is the documented ADR-001 composition).

## 5. Harness changes (this branch)

- `budgets.json`: new `reported` array (ids, runtime, effects, merge, controlled) and `adapterEntries`.
- `index.js` (harness, minimally touched): measures the `reported` rows without a ceiling and measures adapters from
  `adapterEntries` instead of the barrel. `size.test.js` passes unchanged (5 tests).
- Open: the `size` Turbo task input list should include `../core/src/**` (K1-NOTES), outside this stream.

## Proposed ADR clarifications for G1

ARCHITECTURE.md is not edited here; G1 decides.

### (a) ADR-002: adapters depend on `@ramoslabs/core` as a regular dependency, never bundled

- **Proposal.** Add `@ramoslabs/core` to the "runtime deps" column of `@ramoslabs/vue`, `@ramoslabs/react` and
  `@ramoslabs/vanilla` (`dependencies`, `workspace:*` in the monorepo). Adapter builds mark `^@ramoslabs/core(/.*)?$`
  external, so core is never inlined.
- **Why.** The table omits core while the ADR-002 text (line 33) says "each layer depends only on the layers above it", so
  adapters already depend on core in intent. A single shared copy means a page using two adapters (or two adapter subpaths)
  runs one store/effects/runtime instance, and kernel bytes are counted once, which is what the ADR-011 per-artifact
  ceilings assume. Bundling core per adapter would duplicate the kernel in every adapter entry and invalidate the
  zero-unused-bytes guarantee. Implemented as such by R1, R2 and vanilla; the bundled figures in R1/R2 notes are a
  measurement artifact, not the shipped shape.

### (b) Dev-only guard convention (from K2-NOTES)

- **Proposal.** Dev-only code, including warnings, is guarded inline at each site with
  `typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`, with a local `declare const process`
  because core has `types: []`. No shared helper or constant.
- **Why.** K2 verified with esbuild that this form never throws unbundled (no `process` in browsers/workers), and folds to
  a constant under `define process.env.NODE_ENV="production"`, removing the dead block and its message strings
  (merge: 1,207 B raw / 645 B gzip production versus 1,529 / 829 dev). The `&&` form and an extracted constant or helper do
  not fold in esbuild, so the dead code and strings would ship. This protects the byte ceilings of every module that
  warns, and the unit test (delete `globalThis.process`) guards the no-throw case.

### (c) The ten `supports` keys (K1)

- **Proposal.** `SUPPORT_KEYS` in `core/src/runtime` is the closed ADR-013 capability list: `anchorPositioning`, `popover`,
  `dialogRequestClose`, `invokerCommands`, `detailsName`, `userInvalid`, `viewTransitions`, `schedulerYield`, `weekInfo`,
  `focusVisible`. The `supports` map defaults all-false on the server and is replaced by real detection after hydration
  (`withSupports`).
- **Why.** ADR-013 names an injected `supports` map but gives no key list. K1 derived the keys from the ADR-001 native
  versus fallback table, one per feature whose native-or-fallback path the core must choose (popover and anchor
  positioning, dialog close, invoker commands, details exclusivity, `:user-invalid`, view transitions, scheduler yield,
  Intl week info, `:focus-visible`). Closing the list makes the map type-checked and serializable, and a new fallback needs
  an ADR-visible key. G1 should confirm the ten keys against the ADR-001 table row by row and record the list in ADR-013.
