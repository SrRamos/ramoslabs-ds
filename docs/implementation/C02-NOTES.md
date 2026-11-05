# C02 notes: SJField, SJInput and the SJForm context

## W1-C02.a1: SJForm and SJField contracts and core

Branch `feature/m4-c02-field-core`. Owned: `packages/contracts/contracts/{form,field}.contract.json`, `packages/core/src/{form,field}/**`, regenerated `*/src/generated/**`, this file. SJInput is `.a2` and is not touched.

### Surface (draft, freezes to `beta` with the getters)

```ts
// @ramoslabs/core/form
createForm(getProps?: () => FormProps): FormOwner
FormProps = { fields?: {key, kind?}[]; action?: 'go'|'send'|'search'; submits?: boolean /* true */; autoSubmit?: boolean }
FormOwner = { store; getRootProps; register(field): off; hint(key); retain(key, v); prior(key); offers(key) }
// @ramoslabs/core/field
createField(getProps: () => FieldProps, ctx: { id; form?; live? }): FieldParts
FieldProps = { id?, name?, required?, disabled?, hasHint?, error?, errorMessage? }
FieldParts = { ids, getRoot/Label/Control/Hint/ErrorProps, connect(), setKind(kind), announce(), enterHint(), retain(v), prior(), offers() }
```

- **Ids** (ADR-003, ADR-014): control `<id>`, `<id>-label`, `<id>-hint`, `<id>-error`. The label emits `for` (HTML name, like `class`; the React adapter maps it to `htmlFor`).
- **Derived ARIA**: `aria-describedby` = hint id (when `hasHint`), error id (when the trimmed error is non-empty), then any consumer ids; `aria-invalid="true"` only while an error shows (never `"false"`). `aria-errormessage` is off by default and emitted only with `errorMessage: true` while invalid (ADR-014 "only where supported and tested"; text-field recommended variant says additive only). `required`/`disabled`/`name` are native attributes, `aria-required` is not emitted.
- **Announcement** (ADR-006, ADR-014): `announce()` (adapter calls it after each commit, client only) hands a *new* trimmed error to the live registry once; the same text again is silent, a changed text announces, clearing and repeating announces again. Polite `status` only. The error element carries no `role`/`aria-live`, so there is no second announcement. Without a registry (server) it is silent and nothing is rendered.
- **Enter hint**: the form owner computes it with the existing `enterKeyHints` (textarea kinds `enter` and excluded, kind overrides win, `submits` default true -> last field `go`, false -> `done`). Order comes from the data-first `fields` prop (SSR safe) or from `register` order after mount. `field.enterHint()` is meant for `resolveKind(kind, { enter })` in SJInput (.a2); the control bag does not emit `enterkeyhint` itself.
- **3.3.7**: `retain/prior/offers` keyed by field `name` (id when no name). `offers` = distinct values entered under other keys. Values survive unregistering (multi-step flows). Secret kinds (`password*`, `otp*`, `cc-csc`) are never retained.
- **SJForm scope**: Enter position + retained values + a native `<form>` root (`class`, `data-part`, no handlers, no `novalidate`). No validation orchestration, no submission handling.
- **Zero actions** (G-ICON amendment): both contracts have one `idle` state, `actions: []`, `events: []`; `reducer.ts` exists only for harness discovery and is not re-exported.

### Decisions and ambiguities

- No `error` slot: the vanilla adapter options merge props and slots in one object, so a slot named like the `error` prop collides; the error text is the prop (visible text, one announcement source).
- Root class is `sj-field__root` / `sj-form__root` (checkbox convention, so the anatomy check sees it), not `sj-icon`.
- `hasHint` (not `hint`) names the presence prop so it cannot be confused with the `hint` slot.
- `invalid` is not a prop: invalid is derived from the error text, so a state without a visible message (3.3.1) is not expressible.
- Form pattern evidence is `text-field` (no form file exists in the registry); AT rows point at the same `text-field` entries as SJField. NVDA row uses the registry's `edge` entry.
- A standing error at creation is silent (ruling 3); only transitions announce.
- `connect()` registers with the key at call time; an adapter must reconnect if `name` changes.

### Size (ADR-011, `node packages/testing/size/cli.js`)

Core `field`: 0.68 KiB gzip (ceiling 3 KiB); core `form`: 0.69 KiB (ceiling 1.5 KiB); combined about 1.4 KiB, far inside the field ceiling that includes the form context. Shared modules (`ids`, `merge`, `kinds`, `live`, `store`) are excluded as for every component.

### Shared-file edit (listed per the ownership rule)

- `packages/core/package.json`: `./form` export (the `./field` and `./input` stubs existed, `./form` did not).

### Not done / follow-ups

- Live-region `live: 'eager'` derivation from `liveRegions` is C11.a's. The `field` contract declares `liveRegions: [{ id: 'error', politeness: 'polite' }]`; rebase and `bun run codegen` once C11.a is on main.
- Post-submit focus path (text-field evidence variant) is not part of the two SJForm duties; left to the consumer/adapters.

### Audit fixes (Fable, dd011cd)

- MUST-1: `LiveRegistry.attached()` added (shared `live` module, one line); `announce()` records nothing until a host is attached, so a mount-time transition is announced on the first call after attach.
- MUST-2: `retain()` checks the secret kinds against the data-first `fields` list as well as the store.
- SHOULD-1: the consumer `aria-describedby` is removed from the bag before the merge (no discarded-value warning), then appended.
- SHOULD-2 known limit: two fields announcing in one commit speak only the last text (the registry holds one pending text per role). A summary or focus path is for SJInput (.a2) or the consumer.
- SHOULD-3: SJForm AT rows cite `text-field.json#crossat-crossbrowser-html-label` (no form evidence file exists; the errormessage rows were unrelated to enterkeyhint and 3.3.7).
- NICE-1: form budget 1.5 KiB is an engineering limit chosen as about twice the measured 0.69 KiB; plan 6.2 puts the form context inside SJField's 3 KiB, and field + form measure 1.4 KiB combined, so the 3 KiB reading holds with margin.
- Ruling 1: `kind` dropped from SJField; SJInput owns it and calls `field.setKind(kind)` (re-registers; `connect()` registers with kind undefined) and reads `field.enterHint()`.
- Ruling 3: `last` starts as the creation-time error, so a standing error is silent and only transitions announce.
