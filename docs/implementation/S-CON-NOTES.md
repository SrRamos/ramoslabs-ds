# S-CON notes (M3, first part: W1-301..303)

Branch `feature/m3-contracts-schema`. Schema is v1 and subject to the risk-6 freeze at G2; any change after this is a broadcast event (PLAN-WAVE-1 section 9).

## Layout decisions

- Schema: `packages/contracts/schema/contract.schema.json` (the scaffold from W1-005 already has `schema/` and `contracts/`; the plan's `contracts/contract.schema.json` path was not used). `$id` and the required `$schema` value are the ADR-010 URL `https://design.ramoslabs.com/schema/contract.v1.json`.
- Validator: `packages/contracts/scripts/validate.mjs` (library `validateContract`, `validateKinds`, `validateFile` plus CLI). `bun run contracts:check` runs it over `packages/contracts/contracts/*.contract.json`. Uses Ajv 2020 in strict mode, a devDependency only (package still ships data only, no runtime dependency).
- Errors print as `<file>: <json-path>: <message>`; a removed required field reports `/<path>/<field>`.
- Beyond JSON Schema, the validator checks: unique anatomy parts, event, prop and slot names, unique (action id, from) rows, action `from`/`to` in `state.machine`, `aria`/`dom`/`keyboard`/`focus.owner` naming real anatomy parts, unique (at, platform, browser) AT rows, `tested_on` a real, non-future date.

## AT honesty rules enforced by the schema (ADR-010 line "AT honesty gate", ADR-015, D2)

- `tested-real` requires `tested_on` and `log`, and at least one `evidence` ref.
- `tested-real` is allowed only for `at: voiceover` (D2: NVDA, JAWS, TalkBack are evidence-only and never labelled tested). Lifting this when an NVDA lane exists is a schema change (broadcast).
- `tested_on` and `log` are forbidden on `evidence-only` and `pending-real-test` rows.
- `evidence: []` is allowed only for `pending-real-test` (ADR-010 sample). The wave-1 drafts still list the registry ref for pending VoiceOver rows, because the registry has the entries and the status stays honest (P-SHOULD-3).
- Evidence ref form is the ADR-010 sample form `at-support/<file>.json#<id>` (the task text says `<file>#<id>`; the sample is the authority).

## W1-302 schema gaps list (found by drafting `button` and `switch`; all fixed in v1 before any composite)

1. Native element with a fixed type (switch is `input type=checkbox` + `role=switch`): anatomy had no place for static attributes. Added `anatomy[].attributes`.
2. Native state must not be mirrored in ARIA (registry `mustNot: aria-checked-on-native-checkbox`): `actions[].aria` cannot express "checked is a DOM property". Added `actions[].dom` (per part, native properties after the action).
3. One keyboard key maps to one action id, but a toggle is two transitions (off to on, on to off). Resolved without a new field: an action `id` is the reducer event name and may repeat on several rows when `from` differs (state-table semantics); `(id, from)` must be unique. W1-304 equivalence check "reducer events == actions" must compare the set of ids.
4. APG pattern id and registry file name differ (`combobox-select-only` vs `select-only-combobox`), so W1-317 (decision-conflict, coverage) cannot map a contract to its registry file by name. Added optional `pattern.evidence` (registry basename); `evidence:check` fails refs outside it. Optional only so the ADR-010 sample still validates; consider making it required at G2.
5. Stateless component (button): `state.machine` needs at least one state. Convention: single state `idle` with a self-transition. Not a schema change; flag if W1-304 codegen dislikes self-transitions.
6. `props` and `events` had no item shape in ADR-010 (`[]`, `{name, payload}`). Defined `props[]` as `{name, type, default?, required?, description?}`, `slots[]` as `{name, description?}`. W1-304 "one types file" will need richer prop types; `type` is a TypeScript type string for now.

## Open gaps, deliberately not enforced (ambiguity or the ADR sample would fail)

- `state.controllable` should correspond to props, and `actions[].emit` to declared `events`. The ADR-010 sample violates both (`controllable: ["open","value"]` with `props: []`; `emit: "openChange"` with only `valueChange` declared), and the plan requires the sample to validate. Candidate for the G2 freeze.
- `keyboard` values are free strings (action ids or movement words `next`, `prev`, `first`, `last`, `typeahead: prefix`); ADR-010 lists no closed vocabulary, and the sample uses `close` with no `close` action.
- `runtime` is a closed enum of the five names in the ADR-010 sample; ADR-010 does not say the list is closed.
- `kinds` values are not cross-checked against `kinds.contract.json` (W1-307 owns unknown-kind lint).
- No rule that the `atSupport` matrix is complete (every AT in the support matrix); that is the W1-317 coverage report (pending below).

## W1-317 (partial): what `evidence:check` does now

Implemented in `packages/testing/evidence/` (`index.js`, `cli.js`; the repo has no `testing/` at root, it is `packages/testing/`). For every `*.contract.json` (not kinds):

- ref form valid, registry file exists, entry id exists (dangling ref fails);
- `next_review` valid and not before today (stale fails);
- entry `at`, `platform`, `browser` equal the contract row (case-insensitive);
- refs sit inside `pattern.evidence` when declared.

Still pending, printed as `evidence:check: PENDING (not enforced)` on every run: (a) decision-conflict, comparing registry `constraints` (`focusStrategy`, `listboxMount`) with `focus.strategy` / `overlay.listboxMount`; (b) pattern coverage report (an entry for every AT in the support matrix, unmapped patterns returned to the research peer). Both need W1-315's schema/validated registry and the support-matrix definition. The gate is not weakened: it was never green with contracts present before, and it now fails on real defects.
