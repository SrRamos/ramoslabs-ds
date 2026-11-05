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
- SHOULD-3 (not fixed, needs a decision): the registry's only cross entry (`crossat-crossbrowser-html-label`) cannot back per-AT rows (evidence:check requires at/platform/browser to match). SJForm rows therefore still cite the SJField `text-field` errormessage entries, which do not evidence enterkeyhint or 3.3.7. Fix needs a new `form.json` evidence file with dated sources, which I did not invent.
- NICE-1: form budget 1.5 KiB is an engineering limit chosen as about twice the measured 0.69 KiB; plan 6.2 puts the form context inside SJField's 3 KiB, and field + form measure 1.4 KiB combined, so the 3 KiB reading holds with margin.
- Ruling 1: `kind` dropped from SJField; SJInput owns it and calls `field.setKind(kind)` (re-registers; `connect()` registers with kind undefined) and reads `field.enterHint()`.
- Ruling 3: `last` starts as the creation-time error, so a standing error is silent and only transitions announce.

## W1-C02.a2: SJInput contract and core

Branch `feature/m4-c02-input-core` (stacked on `feature/m4-c02-field-core`, PR #94; rebase onto main when it lands). Owned: `packages/contracts/contracts/input.contract.json`, `packages/core/src/input/**`, regenerated `*/src/generated/**` (plus `registry.json` and `llms-full.txt`, which the gate regenerates), this section.

### Surface (draft)

```ts
// @ramoslabs/core/input
createInput(getProps: () => InputProps, ctx?: { field?: FieldParts; userInvalid?: boolean }): InputParts
InputParts = { store, tag(), resolved(), getRootProps, getControlProps, connect() }
```

- **Kind** (ADR-007): SJInput owns `kind` (Fable ruling). `getControlProps` spreads `resolveKind(kind, ctx)` into `type`, `inputmode`, `autocomplete`, `enterkeyhint`, `autocapitalize`, `autocorrect`, `spellcheck` (as `"true"`/`"false"`). Never `maxlength`; `type=number` only for `quantity`. Test iterates every kind row. `tag()` is `textarea` for `address` (no `type`), else `input`. `choice` and the select form of `country` belong to SJSelect (C10.a1); here `country` is always the text variant (`country-name`). Textarea gets `enterkeyhint="enter"` (ADR-007 "always enter"); the exclusion from the position computation is the form owner's (`enterKeyHints`).
- **Field wiring**: inside an SJField the bag is passed through `field.getControlProps`, so ids, `aria-describedby`, `aria-invalid`, `name`, `required` and `disabled` come from the field context. `connect()` calls `field.setKind(kind)` (adapter: children mount first, so the kind is recorded before `field.connect()`; call again when `kind` changes) and returns a cleanup that resets it. `enterkeyhint` position comes from `field.enterHint()`. Standalone, the input takes `id/name/required/disabled` props itself; inside a field these props are ignored (documented in the contract).
- **3.3.7**: `onChange` hands the control value to `field.retain` (secrets are filtered by the form owner). Auto-population (`prior()`, `offers()`) stays on the field; the input does not set a value.
- **`:user-invalid`** (ADR-014, ADR-001): `support[]` has `user-invalid` `nativeFrom {119, 88, 17}`, `fallbackUntil {118, 87, 16}`. The Safari native version is 16.5 in ADR-001 but the schema takes integers, so 17/16 are recorded; 16.5/16.4 is recorded after the #92 schema amendment. The fallback is a two-state machine (`pristine` -> `touched`, action `touch`): `onChange` (a user value change) and `onInvalid` (a submission attempt) touch it; blur alone never does (HTML user-validity), and `reset()` (touched -> pristine, action `reset`) is wired by the adapter to the owning form's `reset` event and the control gets `data-touched="true"` for CSS (`[data-touched]:invalid`). With `ctx.userInvalid === true` (runtime `supports.userInvalid`) the handlers are inert and the attribute never appears. Default is the fallback (server render, forced-false run); the forced-false run itself is `.f`. `data-touched` is protected, so a consumer cannot fake it.
- **Contract**: anatomy `root` (span) and `control` (input, native); no slots (the control is a leaf), so no slot shares a prop name. A prop named `kind` is typed `"kind"` and codegen expands it to the union of the contract's `kinds`; `validate.mjs` rejects a literal union on it (seeded test). Shared files touched: `packages/contracts/scripts/{codegen,validate}.mjs`, `packages/contracts/test/validate.test.js`. `atSupport` reuses the five `text-field` registry rows used by SJField (same control, same pair evidence); no new evidence was invented, and assertions `manual-input-invalid-described-announced` and `manual-input-textarea-role-address` are AT-observable. The device scenarios (keyboard, autofill token per kind) move to W1-506.

### Size (ADR-011)

Core `input`: 0.876 KiB gzip (ceiling 3 KiB). SJField 0.724 + SJForm 0.699 + SJInput 0.876 = 2.30 KiB, inside the 3 KiB field-set reading of plan 6.2 (shared modules counted once elsewhere).

### Not done / follow-ups

- ADR-014 names BaseInput prefix/leading/trailing/postfix parts; not part of the .a2 criteria, not added.
- Native-support wiring (`runtime.supports.userInvalid` -> `ctx.userInvalid`) is the adapters' (.c/.d/.e); forced-false proof is .f.
- Two fields announcing in one commit remains a known limit (consumer-side summary/focus path).
