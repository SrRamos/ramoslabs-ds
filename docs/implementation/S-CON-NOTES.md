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

## W1-303: kinds

- `packages/contracts/contracts/kinds.contract.json` validated by `packages/contracts/schema/kinds.schema.json` (`$id` `https://design.ramoslabs.com/schema/kinds.v1.json`); `validate.mjs` routes `kinds.contract.json` to it, and `evidence:check` skips it. 31 kinds: every ADR-007 row, with the three combined rows split (`postal`/`reference`/`account` share `group`, `cc-exp`/`cc-exp-month`/`cc-exp-year` share `group: cc-exp`, `amount-signed` has `variantOf: amount` and `requiresSignControl`). The twelve "Rules attached to the table" bullets plus the Enter-key paragraph live in `rules[]`; certification (iOS Safari on the owner's iPhone, Android Chrome `not-run`) and the ten scenario names for W1-506 in `certification`.
- Modelling choices where ADR-007 cells are prose: `autocomplete.policy` is `token | conditional | context | omitted | off` with `tokens`, `variants`, `when`, `default`; `inputmode: null` means n/a; `inputmodeWhen` carries "digits-only"; `enter: position` means computed by the form owner; `otp`/`otp-alnum` use `enter: done` with `enterAlternatives: [go]`; `-` cells are `null`.
- Ambiguities (ADR-007): (1) the `reference` and `account` autocomplete cell reads "`postal-code` or token"; modelled as `context` for both, `postal-code` only for `postal`. (2) `no maxlength` is stated in the table for phone/otp/postal-reference-account/tax-id/card and in the rules for amount; `cc-csc` and `cc-exp*` were set `noMaxlength: true` under the rule's "card". (3) `forbiddenTypes: [number]` also set on `otp`, `amount*` ("no spinbutton") and `cc-*`, derived from the numeric-identifier and OTP rules; `quantity` stays free to use number. (4) The `search` row has "by domain" for autocapitalize: modelled as `value: null, when: "by domain"`. (5) The wave-1 `resolveKind` equality with W1-112a is for W1-304.
- Not done here (other tasks): codegen of the `kind` union (W1-304), unknown-kind lint (W1-307), MCP `get_kind`.

## Cross-stream touch

`packages/testing/size/index.js` (W1-007) read every `*.contract.json` as a component and failed on `kinds.contract.json` ("contract has no budgets.gzipKiB"). One-line fix: skip `kinds.contract.json` there (its ceiling is the shared `kinds` row in `budgets.json`). Any future non-component data contract needs the same exclusion, or a naming convention.

## S-CON-2 (W1-315, W1-317 completed)

Branch `feature/m3-evidence-schema-checks`. `bun run evidence:check` now has no PENDING lines (`PENDING` is exported empty); `bun run gate` passes with `TURBO_FORCE=1`.

### W1-315: registry schema and validator

- Schema: `packages/contracts/schema/at-support.schema.json` (`$id` `https://design.ramoslabs.com/schema/at-support.v1.json`), validator `packages/contracts/scripts/at-validate.mjs` (+ `.d.mts` so the testing package typechecks the import; ajv stays a contracts devDependency). CLI: `node packages/contracts/scripts/at-validate.mjs [file...]`. Tests in `packages/contracts/test/at-validate.test.js`, built from in-memory objects (no fixture files; the plan's `testing/fixtures/at-support/**` is not needed, and the shipped registry is itself validated in a test).
- Schema encodes the ADR-015 field table exactly: all fields required except `impact`, `tested_on`, `log`; versions nullable; `impact` required iff `kind: observation` and forbidden on `contract`; `tested_on` and `log` required iff `tested-real` and forbidden otherwise; `test_status` enum has no `no-measured-evidence`; `constraints.focusStrategy` is the ADR-006 enum; `listboxMount` is `{ fine?, coarse? }` of `top-layer|inline` (the registry form, not the contract's `default/byAnyPointer`); `recommended.atEvidence` requires the five primary keys `nvda, jaws, talkback, voiceover-macos, voiceover-ios`.
- Rules in code: id unique per file; `pattern` equals file name and each entry's pattern; real calendar dates; `retrieved <= next_review <= retrieved + 6 months` (clamped to month end); `supportedBy` ids resolve and hold one T1 or two independent T2 (independent = different last-two-label host of `source_url`, an approximation of "different organizations"); `atEvidence` ids resolve, are `observation`, and match the AT/platform of their key; a per-AT list that is all T3 fails.
- Ambiguity resolved: the plan text says "an evidence-only AT claim needs an observation or no-measured-evidence"; applied to all five keys (VoiceOver too), since the shipped registry does so.

### W1-317: now enforced (`packages/testing/evidence/index.js`)

- Registry validation of every file in the registry dir runs inside `evidence:check`.
- Decision-conflict (structured `constraints` only, prose `decision` never read), checked on the pattern's `recommended.constraints` and on every entry a contract references: `focusStrategy` must equal `focus.strategy`; each `listboxMount.<fine|coarse>` must equal the contract's `byAnyPointer.<class> ?? default`; `listboxMount` present with no `overlay.listboxMount` fails; `nativeOnTouch: true` requires a contract `nativeFallback`. Absent constraint keys say nothing. Not compared (no contract field exists): `domAdjacent` (true by definition of both mount values, ADR-005 step 8) and `mustNot`.
- Pattern coverage: registry file is `pattern.evidence ?? pattern.apg`; missing file reports "unmapped pattern, return to the research peer"; the file must hold an entry for each of the five primary pairs (ADR-013 4b; secondary pairs optional) and the contract `a11y.atSupport` must have a row with evidence for each pair.

### Registry defects found

None. All 12 registry files validate and the two shipped contracts (button, switch) pass conflict and coverage. Registry files were not touched.

### Follow-ups

- Wave-2 contracts for select/tabs etc. will exercise the listboxMount and nativeOnTouch paths for the first time (only the unit tests cover them today).
- If kimi-ds changes the registry shape (e.g. adds fields), `at-support.schema.json` is `additionalProperties: false` and will fail loudly; that is intended, the schema is then the one to amend.

W1-315 follow-up: the per-AT loop in `at-validate.mjs` now fails a pair declared `no-measured-evidence` when the file holds an observation for that AT/platform (error at `/recommended/atEvidence/<key>`, the fifth E3-SHOULD-3 check, ds-fable R3 file-level check). Seeded by a radio-group-shaped fixture (`voiceover-ios` + `vo-ios-safari-a11ysupport-radio`) in `at-validate.test.js`. The registry is untouched; all real files pass.
## S-CON-3 (W1-305, W1-306, W1-307)

Branch `feature/m3-registry-mcp-lint`.

### W1-305: registry from contracts

- `apps/site` gains the dev workspace dependency `@ramoslabs/contracts` (resolved with `createRequire` in the integration). `apps/site/agentic/registry.ts` is the pure projection (types, `buildComponents`, `buildKinds`, `slugOf`); `integration.ts` loads the JSON and `buildRegistry` fills `components`.
- Component row: `name, slug, contractVersion, status, pattern, anatomy, roles, state, keyboard, kinds, supportFloor, atSupport, docs`. `atSupport` rows copy `at, platform, browser, test_status, tested_on?, log?, evidence` verbatim (a test asserts equality with the contract), so nothing is upgraded. Top level adds `kinds` (all 31 rows plus `rules` and `certification`, needed by `get_kind`) and `schemas` (the three served URLs).
- `docs` is built from site pages at `/components/<slug>/`; none exist yet, so it is `[]` (no URL invented). `supportFloor` is the contract's `support` array (`[]` for both shipped contracts).
- The integration also emits `dist/schema/{contract,kinds,at-support}.v1.json`, the `$id` URLs of the three schemas (the plan names only contract.v1; kinds and at-support are also `$schema` targets, so they resolve too). Verified 200 `application/json`, `$id` equal to the URL.
- Ambiguity: the row says "No root registry.json is written". The build already writes the committed root copies (`llms.txt`, `registry.json`, ...) and many docs point at them, so I kept that behaviour and regenerated the root `registry.json` and `llms.txt` (llms.txt now lists the three tools). Drift is compared against both `dist/registry.json` and the root copy. If the plan meant "delete the root copy", that is a one-line removal of the write loop plus `git rm registry.json`.
- Drift check: `bun apps/site/agentic/check-registry.ts` (after `bun run build --filter=site`) compares the built and committed registry with a fresh `generateRegistry()`; exits 1 and names the differing keys. Proven by flipping `button.contract.json` status (fails on `components`), then restored. W1-314 owns wiring it into `ci.yml`.

### W1-306: MCP tools

- `list_components`, `get_component` (name or slug, case-insensitive, `SJ` prefix optional, exact match only, no partial), `get_kind`. Logic is in `apps/site/agentic/registry-tools.ts` (pure, tested); the worker only reads `/registry.json` through ASSETS (cached per isolate like tokens) and wraps the result. Unknown name: `isError: true` text that lists the known names and says not to invent one.
- The two `eslint-disable no-explicit-any` lines are gone: `handleRpc` takes `unknown`, narrowed by `asMessage` to an `RpcMessage` type; `handleMcp` parses to `unknown`. The existing seven tools and the protocol paths are unchanged (curl evidence below).
- The worker imports `lintCssContract` from `packages/testing/lint/contract/css-contract` by relative path (bundled by wrangler); a hand-written `.d.ts` sits beside it, like `at-validate.d.mts`.

### W1-307: contract lint

- `packages/testing/lint/contract/`: `source.js` (rules `contract/unknown-kind`, `contract/missing-label`, `contract/preset-internals`, plus `lintContractData` for kinds listed in a contract), `css-contract.js` (rules `unknown-component`, `unknown-part`, `unknown-data-part`, `unknown-data-state`), `denylist.js`, `index.js`, `cli.js`. Pass and fail fixture per rule in the `*.test.js` files (37 tests).
- Interpretations (the contract has no `internal` or `requiresLabel` flag): missing-label = an `SJ*` usage of a contracted component whose anatomy has a named-role part or a native control, with no `label`, `aria-label`, `aria-labelledby`, spread, or content. Preset-internals = under a `presets/` path, an import through `internal|runtime|src` or deeper than one primitive entry (same policy as the ESLint rule `presets-public-only`, but reported with contract rule ids), or hand-setting `data-part`/`data-state`. Unknown-kind judges only literal `kind` values; dynamic ones make no claim.
- CSS rule: `.sj-<slug>__<part>` must name a part of that contract, `[data-part]`/`[data-state]` are checked only against components the same selector names, and a `sj-` component with no contract is reported as such. The worker `lint_css` appends these findings (issue prefixed with the rule id) after the raw-value findings and returns `contractComponentsChecked`. Raw-value lint is unchanged (W1-202 owns it).
- Deny-list: SHA-256 of the trimmed lower-case term; digests come from `RAMOSLABS_DENYLIST_SHA256`, a file named by `RAMOSLABS_DENYLIST_FILE`, or the committed digest-only `denylist.sha256` (empty). A word is checked whole, by camelCase segment and by leading prefix (2..24 chars), in file contents and in file paths, over `git ls-files` (tracked plus untracked-not-ignored; `bun.lock`, binaries and files over 2 MB skipped). Findings print file, line, column and a digest prefix, never the word. The seeded-term test builds its term at runtime (a synthetic word), and fails the scan as designed.
- **Open, needs the owner:** I do not know the prior-brand terms (and must not write them). Until digests are provisioned, `cli.js` prints `denylist: not configured (skipped)` and exits 0; `--require-denylist` turns that into a failure. Provision the digests as a CI secret (or in `denylist.sha256`) and have W1-314 call `node packages/testing/lint/contract/cli.js --require-denylist`. Limits: a term buried in the middle of a lowercase run (`abxxxcd`) is not found; two-letter prefix terms flag every word starting with them.
- Wiring left to others (files I do not own): `node packages/testing/lint/contract/cli.js` into the root `gate`/`ci.yml` (W1-314), a re-export from `testing/lint/index.js`, and ESLint coverage for `apps/site/{worker,agentic}` (AUDIT-G0 SHOULD-2; these files are still unlinted by `bun run lint`, I ran `eslint` and `tsc` on them by hand, clean).

### Local MCP evidence (`bunx wrangler dev --port 8799`, curl POST /mcp, after `bun run build --filter=site`)

```
## tools/list (names)
['search_tokens', 'get_token', 'check_contrast', 'list_docs', 'get_doc', 'lint_css', 'list_components', 'get_component', 'get_kind', 'get_agents_guide']
## list_components
{
  "count": 2,
  "components": [
    {
      "name": "SJButton",
      "slug": "button",
      "status": "draft",
      "pattern": "button",
      "roles": [
        "button"
      ],
      "atSupport": [
        {
          "at": "voiceover",
          "platform": "macos",
          "browser": "safari",
          "test_status": "pending-real-test"
        },
        {
          "at": "voiceover",
          "platform": "ios",
          "browser": "safari",
          "test_status": "pending-real-test"
        },
        {
          "at": "nvda",
          "platform": "windows",
          "browser": "chrome",
          "test_status": "evidence-only"
        },
        {
          "at": "jaws",
          "platform": "windows",
          "browser": "chrome",
          "test_status": "evidence-only"
        },
        {
          "at": "talkback",
          "platform": "android",
          "
## get_component switch
None SJSwitch ['switch'] [('voiceover', 'macos', 'pending-real-test'), ('voiceover', 'ios', 'pending-real-test'), ('nvda', 'windows', 'evidence-only'), ('jaws', 'windows', 'evidence-only'), ('talkback', 'android', 'evidence-only')] [] []
## get_component SJNope
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"No component named \"SJNope\" in the registry (known: SJButton, SJSwitch). Do not invent one; call list_components."}],"isError":true}}
## get_kind email
None
{
  "kind": {
    "kind": "email",
    "type": [
      "email"
    ],
    "inputmode": "email",
    "autocomplete": {
      "policy": "token",
      "tokens": [
        "email"
      ]
    },
    "enter": "position",
    "autocapitalize": {
      "value": "none"
    },
    "autocorrect": "off",
    "spellcheck": false,
    "noMaxlength": false
  },
  "rules": [
    {
      "id": "otp-single-control",
      "text": "OTP is a single text control; split-character inputs are not the default (extra p
## get_kind nope
{"jsonrpc":"2.0","id":6,"result":{"content":[{"type":"text","text":"No kind named \"nope\" in the registry (known: text, name, username, email, url, phone, otp, otp-alnum, amount, amount-signed, quantity, postal, reference, account, tax-id, search, password, password-new, date, time, choice, cc-numb

## get_token color-primary
{"jsonrpc":"2.0","id":7,"result":{"content":[{"type":"text","text":"{\n  \"token\": \"--color-primary\",\n  \"value\": \"#4f46e5\",\n  \"css\": \"var(--color-primary)\"\n}"}]}}
## search_tokens
{"jsonrpc":"2.0","id":8,"result":{"content":[{"type":"text","text":"{\n  \"query\": \"space-4\",\n  \"count\": 1,\n  \"tokens\": [\n    {\n      \"token\": \"--space-4\",\n      \"value\": \"1rem\"\n    }\n  ]\n}"}]}}
## check_contrast
{"jsonrpc":"2.0","id":9,"result":{"content":[{"type":"text","text":"{\n  \"foreground\": \"#4f46e5\",\n  \"background\": \"#ffffff\",\n  \"ratio\": 6.29,\n  \"normalText\": {\n    \"AA\": true,\n    \"AAA\": false\n  },\n  \"largeText\": {\n    \"AA\

## list_docs
{"jsonrpc":"2.0","id":10,"result":{"content":[{"type":"text","text":"{\n  \"count\": 26,\n  \"pages\": [\n    \"Introduction\",\n    \"Installation\",\n    \"For Agents\",\n    \"MCP Server\",\n    \"

## get_doc Colors
{"jsonrpc":"2.0","id":11,"result":{"content":[{"type":"text","text":"# Colors\n\nSource: https://design.ramoslabs.com/foundations/colors/\n\nRamosLabs runs on a single action accent. Indigo carries ev

## get_agents_guide
{"jsonrpc":"2.0","id":12,"result":{"content":[{"type":"text","text":"# For Agents\n\n> Agent-native, MCP-first, AI-ready by design: the machine-readable contrac

## initialize
{"jsonrpc":"2.0","id":13,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"ramoslabs-ds","version":"0.1.0"},"instructions":"RamosLabs Design

## notification -> status
202
## parse error
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
## GET /mcp
405
## lint_css contract
{
  "clean": false,
  "contractComponentsChecked": 2,
  "count": 4,
  "truncatedInput": false,
  "truncatedFindings": false,
  "rule": "Never hardcode a color, spacing, typography, radius, shadow, or motion value. Always read the token.",
  "findings": [
    {
      "value": "#fff",
      "issue": "raw color; the DS forbids hardcoded colors",
      "suggestion": "map to a --color-* role token (search_tokens)"
    },
    {
      "value": ".sj-button__ghost",
      "issue": "contract/unknown-part: \"ghost\" is not an anatomy part of button",
      "suggestion": "parts of button: root"
    },
    {
      "value": "[data-state=\"open\"]",
      "issue": "contract/unknown-data-state: \"open\" is not a state of switch",
      "suggestion": "switch: off, on"
    },
    {
      "value": ".sj-select__trigger",
      "issue": "contract/unknown-component: no contract for component \"select\" in the registry",
      "suggestion": "use a component from the registry (button, switch); call list_components"
    }
  ]
}
## lint_css raw only
{
  "clean": false,
  "contractComponentsChecked": 2,
  "count": 2,
  "truncatedInput": false,
  "truncatedFindings": false,
  "rule": "Never hardcode a color, spacing, typography, radius, shadow, or motion value. Always read the token.",
  "findings": [
    {
      "value": "#fff",
      "issue": "raw color; the DS forbids hardcoded colors",
      "suggestion": "map to a --color-* role token (search_tokens)"
    },
    {
      "value": "12px",
      "issue": "raw length; spacing/radius/type must come from a token",
      "suggestion": "use the nearest --space-* / --radius-* / --font-size-* token (search_tokens)"
    }
  ]
}
## /registry.json components
['SJButton', 'SJSwitch'] 31
## /schema/contract.v1.json
200 application/json
https://design.ramoslabs.com/schema/contract.v1.json
```

Bytes: no `budgets.json` ceiling applies to site or testing code; `node packages/testing/size/cli.js` result is in the gate output below.
