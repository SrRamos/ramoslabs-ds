# G-CODE notes (M3, W1-304 codegen)

Branch `feature/m3-codegen`. Generator: `packages/contracts/scripts/codegen.mjs` (library plus CLI). `bun run codegen` regenerates; `codegen.mjs --check` is hooked into `bun run contracts:check` (so into `gate`) and into `packages/contracts/test/codegen.test.js`. Output is formatted through the prettier API with the repo config, so `format:check` and eslint pass on generated files without ignore entries.

## What is generated

- `packages/core/src/generated/kinds/{table,index}.ts`: `Row`, the explicit `Kind` union (31 kinds, contract order) and `KINDS` (`satisfies Record<Kind, Row>`). From `kinds.contract.json`.
- `packages/core/src/generated/<slug>/{machine,keyboard,aria,index}.ts` per component: `<camel>Machine` (initial = first of `state.machine`, states, events = unique action ids, controllable, `transitions[state][event] = {to, emit?, focus?}`), `<camel>Keyboard` (part -> key -> action), `<camel>Aria` (static anatomy parts, per-transition `aria`/`dom`), plus `<Pascal>State`, `<Pascal>Event`, `<Pascal>KeyboardMap` types.
- `packages/{react,vue,vanilla}/src/generated/<slug>/{types,index}.ts`: ADR-004 "one types file". React: `SJXProps` (props, `on<Event>` handlers, slots as props, `children` for `default`). Vue: `SJXProps`, `SJXEmits` (tuple form), `SJXSlots`. Vanilla: `SJXOptions` and `SJXEventDetail` (CustomEvent detail map). One `SJX<Event>Payload` alias per event from the contract `payload` string.
- Barrels: `src/generated/index.ts` in each of the four packages (`export *` of every module). Not wired into `src/index.ts` (not mine); names are prefixed per component so there are no collisions.
- Stale files in `src/generated/` (no contract produces them) count as drift, and `codegen` rewrites the directories from scratch. So nothing hand-written may live under `src/generated/` (my own `generated.test.ts` sits at `core/src/generated.test.ts` for that reason).

## Kinds table: replaced, and proven identical first

Before replacing, I compared the generated `KINDS` with the hand-written one: same key order, `JSON.stringify` byte-identical, `toEqual` equal. Then `core/src/kinds/table.ts` became a three-line re-export of `generated/kinds/table`. The existing W1-112a drift test (`kinds.test.ts`, its `project()` oracle) still runs unchanged against the generated table and passes. `project()` in that test and `kindRow()` in codegen are two copies of the same projection; if the contract encoding changes, the test oracle is the independent check. Kinds bundle stays 1.671 KiB gzip against the 2 KiB ceiling (size CLI).

## Reducer-event equivalence (ADR-010)

`checkReducerEquivalence(contract, { reducerEvents, reduce? })` in codegen.mjs: set equality of reducer events and contract action ids (repeated ids, like switch `toggle`, count once: S-CON gap 3), plus, when `reduce(state, {type})` is exported, every row `reduce(from, id) === to` and every pair without a row leaves the state unchanged.

- Exercised on a fixture contract and reducer (`packages/contracts/test/fixtures/reducer/`) with seeded failures: extra event, missing event, wrong target, state change on an unlisted pair, missing `reducerEvents`.
- Automatic: `codegen.test.js` ("real component reducers") looks for `packages/core/src/<slug>/reducer.ts` for every contract. Absent -> reported as a skipped test (button, switch today). Present -> must export `reducerEvents: readonly string[]` (and optionally `reduce`), else the test fails with a clear message.
- Convention is mine (the plan does not name a file); follow-up: tell the stream that writes the first reducers (W1-2xx button/switch) to use `src/<slug>/reducer.ts` with those exports. The generated `<Pascal>Event`/`<Pascal>State` unions give them compile-time typing as well.

## Decisions and ambiguities

- Machine `initial` is `state.machine[0]`: the schema has no initial field (stateless components use `idle`, S-CON gap 5). Self-transitions work as-is.
- `keyboard` values are free strings (movement words included), so the generated map is `as const` data, not a union of action ids.
- Slots in adapters are `unknown` (React `children`) / `() => unknown` (Vue) / `string | Node` (vanilla): `@types/react` and `vue` types are not importable from the React package typecheck today. Follow-up: tighten to `ReactNode` / `VNodeChild` when the adapters add the type deps.
- The package `contracts` imports `prettier` (a root devDependency, hoisted); I did not add it to `contracts/package.json` to avoid `bun.lock` churn. Follow-up if the package is ever installed standalone.
- Deterministic by construction: contracts read in sorted file order, no timestamps, prettier-formatted.

## Shared-file touches

- Root `package.json`: new `codegen` script; `contracts:check` now also runs `codegen.mjs --check`.
- `packages/core/src/kinds/table.ts`: replaced with a re-export (authorised by the brief).
