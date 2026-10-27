# K5 notes: W1-112a resolveKind + W1-112b number parser

Branch `feature/m1-k5-kinds-number`. Code: `packages/core/src/kinds/**` (`table.ts`, `index.ts`), `packages/core/src/number/index.ts`.

## API

- `resolveKind(kind, ctx?)` returns `{ type, inputmode?, autocomplete?, enterkeyhint?, autocapitalize?, autocorrect?, spellcheck? }`; absent attributes are omitted, `maxlength` is never produced. `type` may be `select`/`textarea` (element kinds; adapters map them).
- `enterKeyHints(kinds, { action?, submits?, autoSubmit? })`: form-owner computation. Textarea kinds (`enter` fixed) are `enter` and excluded from position; kind overrides win (url go, search search, otp done/go, cc-csc done); otherwise `next` while a non-textarea field follows, else `action` / `go` (submits) / `done` (ADR-007 l.563-568).
- `parseNumber(text, locale | [group, decimal], signed?)` returns a canonical decimal string or `null`; `separators(locale)` reads Intl. Never a JS number, never `parseFloat`.
- `KINDS` / `Kind` / `Row` are exported from `table.ts` only. **W1-304 replaces `table.ts` wholesale** (same three exports). `Kind` is the generated union; an unknown kind is a type error.

## Ambiguities resolved

| Question                                                                                   | Resolution                                                                                                                                                                                                                                                                                                                            | Basis                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Enter = position` with no owner hint                                                      | `enterkeyhint` omitted (browser default)                                                                                                                                                                                                                                                                                              | ADR-007 "default when the owner gives no position" does not name a value |
| Conditional autocomplete (url, bday, transaction-amount)                                   | emitted only when `ctx.meaningful`                                                                                                                                                                                                                                                                                                    | contract `policy: conditional`                                           |
| `inputmodeWhen` (postal/reference/account "digits-only by contract", tax-id "digits-only") | numeric unless `ctx.digits === false` (postal group); tax-id numeric only when `ctx.digits === true`; `quantity` number variant has no inputmode                                                                                                                                                                                      | contract `inputmodeWhen`                                                 |
| `otp-alnum` capitalize "when canonical uppercase"                                          | `characters` only when `ctx.uppercase`                                                                                                                                                                                                                                                                                                | contract `autocapitalize.when`                                           |
| Variants (`given-name`, `tel-*`, `address-line1..3`)                                       | `ctx.autocomplete` accepted if listed (or prefix family `tel-*`), else first token; `country` text variant defaults to `country-name`; `ctx.section` adds `section-<x> `                                                                                                                                                              | contract `variants`, ADR-007 section tokens                              |
| Parser separator rule                                                                      | last distinct separator is decimal, others must be grouping (1-3 digits, no leading 0, then triples); a repeated separator is grouping; a single one is decimal if it is the locale decimal, grouping if locale group and structure valid, else decimal. Spaces (incl. NBSP/U+202F), `'`, U+2019, U+066C are group; U+066B is decimal | ADR-007 "both separators with a grouping-structure rule"                 |
| Sign                                                                                       | leading `-` or U+2212, only when `signed`; canonical uses ASCII `-`; `+` rejected                                                                                                                                                                                                                                                     | ADR-007 amount-signed                                                    |
| Leading zeroes                                                                             | kept verbatim in the canonical string (`007.50`)                                                                                                                                                                                                                                                                                      | row W1-112b                                                              |
| Arabic numerals                                                                            | tested as ASCII digits and as Arabic-Indic / Extended (U+0660-9, U+06F0-9) incl. `ar-EG` Intl round trip                                                                                                                                                                                                                              | ambiguous term, both covered                                             |

## Drift guard

`kinds.test.ts` imports `packages/contracts/contracts/kinds.contract.json`, projects each contract row onto the table encoding and compares per kind, order and set; `variantOf`, `forbiddenTypes` and a seeded-drift case are covered. The table deliberately omits `noMaxlength`, `forbiddenTypes`, `notes`, `group`: they are not runtime inputs (`maxlength` is structurally never emitted; property-tested).

## Size (node packages/testing/size/cli.js)

`kinds` row (kinds + number entries together): 3816 B raw min, **1.696 KiB gzip**, ceiling 2 KiB.

## Deviations / follow-ups

- Contract `country` has `inputmode: null`, but its note says the text variant uses `inputmode=text`; table mirrors the field (null). Follow-up for the contract owner.
- `requiresSignControl` (amount-signed) is not in the runtime table; adapters key on `kind === 'amount-signed'`. W1-304 may add it.
- No shared files edited.
