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

## C02 core fixes (Fable audit of the C02 adapters)

Branch `feature/c02-core-enter-autosubmit`. Core, contracts and regenerated files only; the adapters (#110, #111, #112) adopt the API below.

- **MUST-1, `action` -> `enter`.** The SJForm prop `action` ('go'|'send'|'search') collided with the native `<form action>` attribute (an adapter forwards unknown attributes to the root). It is now `enter` in `form.contract.json`, `FormProps`, `enterKeyHints(kinds, { enter, submits, autoSubmit })` and the codegen types. Core never reads `action`; a test passes `action` (a label and a URL) and asserts the hints are unchanged. `getRootProps` still passes a consumer `action` through untouched.
- **MUST-2, owner `autoSubmit` reaches an OTP.** `resolveKind` ignores `ctx.enter` for `done/go` rows (kinds/index.ts), so an OTP inside a form only ever saw its own prop. ADR-007 says the owner computes the hint, so inside a field `field.enterHint()` is final: `createInput` uses it as the `enterkeyhint` and passes no own `autoSubmit`. The input prop `autoSubmit` applies standalone only (also in a field with no form, where `enterHint()` is undefined). `resolveKind` is unchanged. Contract description updated. Tests: OTP in a form with owner autoSubmit true/false/absent and a contradicting own prop; standalone OTP.
- **SHOULD, DOM order.** `FieldParts.connect(index?)` takes the control's index in `form.elements`; it reaches the owner as `FormField.index`. The owner keeps `fields` sorted: indexed fields by index (stable), then unindexed ones in registration order. Re-registering a key with a new index re-sorts (reorder); the data-first `fields` prop stays the SSR-safe override and wins when given. Adapters: compute the index after mount (and after each reorder) as `Array.prototype.indexOf.call(form.elements, control)`, call the previous cleanup then `connect(index)` again on rename or reorder (same key and index is a no-op). Tests: late mount, reorder, rename, mixed indexed/unindexed, and a shuffled-registration property.
## W1-C02.b: SJField, SJInput and SJForm CSS

Branch `feature/m4-c02-css`. Owned: `packages/css/src/{field,input}.css`, `packages/css/test/{field,input}.test.js`, the real-contract lists in `packages/css/test/template.test.js` (shared with the disclosure stream: only `field` and `input` added), this section.

- **SJForm ships no `form.css`.** Its anatomy is one part, `root`, a native `<form>` with no visual state, and its two duties (Enter position, retained values) are behavioural. Spacing between fields is the consumer's layout. An empty file would only satisfy a registration; the contract and `checkStylesheets` do not require one. `form` is therefore not in the template.test.js lists. A rule appears here only if SJForm gains a visible part.
- **Hooks**: keyed on exactly what the getters emit (`sj-field__<part>`, `sj-input__root`, `sj-input__control`, `data-invalid`, `data-disabled`, `aria-invalid`, `data-touched`). Root classes are unchanged (issue #88). The field contract part `control` is the SJInput control; `field.css` carries a minimal `.sj-field__control` hook so the anatomy check sees all five parts.
- **Invalid** (ADR-014, ADR-001): three separate rules (`[aria-invalid='true']`, `:user-invalid`, `[data-touched]:invalid`), because a selector list with an unsupported pseudo-class is dropped whole. Paint is the `--color-error-strong` border (4.8:1) at double thickness (padding gives the width back, no layout shift), so colour is not the only cue (1.4.1). The words are the SJField `error` part: visible text plus a drawn "!" marker with empty alt text (`content: '!' / ''`, with a plain fallback declaration for engines without the alt syntax), so it is not read aloud. A native-invalid control with no `error` prop shows the thick border only; SJField is what makes the message mandatory (3.3.1).
- **Contrast**: the shared matrix only reads `sj.variant`, so these files are checked in their own tests, every text colour at 4.5:1 and every border at 3:1 against all `SURFACES`. Rest border `--color-slate-500`; `--color-border` is 1.2:1 and is used only for the disabled control (inactive, exempt). Placeholder is `--color-text-muted`.
- **Focus, target, text size** come from `base/` (2.4.13 ring in `sj.state`, 44 px / 24 px compact floor, 16 px). The input adds no box-shadow or outline reset; a test checks the ring on input, invalid input and textarea.
- **Forced colors**: `ButtonBorder` boundary, `Highlight` border when invalid (plus the thickness), `GrayText` when disabled, marker border `CanvasText`.
- **Textarea** (address): `min-block-size` two targets, `resize: block`.
- **Follow-ups**: hover/readonly styling is not specified by any contract and is not added; the `[data-touched]:invalid` run on a real Chromium 114-118 is the forced-false proof of `.f`.

### C02.b audit fix (SHOULD-1, NICE)

- The error "!" is no longer CSS text: `content: '!' / ''` is hidden only on Chromium 77+, Firefox 128+ and Safari 17.4+, so on the ADR-001 floor (Firefox 125-127, Safari 17.0-17.3) it would enter the accessible description through `aria-describedby`. The field contract gains a static `icon` part (`span`, mirrors SJState), core gains `getIconProps` (`sj-field__icon`, `aria-hidden="true"`), and `field.css` styles only its size and the gap. The adapters (.c/.d/.e) render an `aria-hidden` SJIcon `alert-circle`, size sm, in that part inside the error. A test asserts no `content:` on the error part.
- `input.css` uses `--leading-normal`.
- The local contrast checks stay; a separate testing stream extends the shared matrix and deletes them.
## W1-C02.e: SJForm, SJField and SJInput vanilla adapters

Branch `feature/m4-c02-vanilla`. Owned: `packages/vanilla/src/{form,field,input}/**` and this section. Shared file: `packages/vanilla/package.json` gains the `./form` export (the `./field` and `./input` entries existed). `src/form/apply.ts` is an internal helper shared by the three modules (not an entry point; lives in `form/` because `field/` modules must all reference `fieldLive`).

### Surface

- `mountForm(host, formEl, props) -> FormInstance` (`owner`, `subscribe`, `element`): applies the root part to a native `<form>`; no listeners, no `novalidate`, no submission handling. Re-notifies subscribers on `update` (the Enter position depends on `action`/`submits`).
- `mountField(host, divEl, props, { form?, control? }) -> FieldInstance` (`parts`, `place(node)`, `subscribe`): root `<div>` > label, hint (only while `hint`/`hasHint`), the control(s) placed with `place`, error (only while an error shows). `hasHint` is derived from a non-empty `hint` unless passed. Label and hint accept `string | Node` (prop-or-slot), always as text nodes or the consumer's own Node. The error part holds an `aria-hidden` icon part (`sj-field__icon`) and the visible text; it carries no `role`/`aria-live`. The icon is an SJIcon (`size: 'sm'`) drawn from the generated system icon `circleAlert` (`../generated/icons/circle-alert`). Registration passes `connect(index)` with the control's position in `form.elements`; `field.sync()` re-registers (old cleanup, then `connect(newIndex)`) when the name or the position changed, and runs on patch, `place` and every input render.
- `mountInput(host, spanEl, props, { field? }) -> InputInstance` (`control`): root `<span>` > native `<input>`, or `<textarea>` for `address` (the control is replaced, value kept, listeners moved, when `kind` crosses that line). Kind attributes come from the core row; `kind` changes re-report to the field; the field's id/name/required/disabled/ARIA and Enter position are used inside a field.
- `define(host, name?, registry?)` in each module registers `sj-form`, `sj-field`, `sj-input` (light DOM, no shadow, idempotent, never at import). `sj-form` moves its children into one `<form>`; `sj-field` wraps its children as the control; `sj-input` finds `closest('sj-field')`. Define in the order form, field, input so each ancestor is upgraded first.

### Decisions

- **No FACE** (ADR-014 "only where a custom control needs native form participation"): the control is a real `<input>`/`<textarea>` in the light DOM, so it is a form-associated descendant of the surrounding `<form>`, submits, validates, autofills and resets natively. `attachInternals()` would add a second source of form state. Same reasoning as the checkbox adapter.
- **Live region** (ADR-006): the field spec passes the generated `fieldLive` (`'eager'`) as `live`, so the host inserts the status node at mount; `announce()` runs after every patch. A standing error at mount is silent (ruling 3); a changed text announces once; the registry's 1 s dedupe window keeps an identical repeat silent (core behaviour).
- **Re-render fan-out**: an SJInput subscribes to its field, and the field notifies on its own `update` (error, name, required) and on form store changes (Enter position, retained values). SJInput subscribes after reporting its kind, so the registration it causes does not re-enter a half-mounted instance.
- **Retention (3.3.7)**: `change` (committed value) hands the value to `field.retain`; secrets are filtered by the form owner. `prior()`/`offers()` are exposed on `field.parts`; nothing is auto-filled.
- **`:user-invalid`**: `host.runtime.supports.userInvalid` feeds `ctx.userInvalid`; below it the touched fallback sets `data-touched` on `change`/`invalid`, never blur, and the document-level `reset` (target === `control.form`) clears it. One signalled document listener per input.
- **Instance accessors** use `Object.defineProperties`, not `Object.assign` with getters (assign would freeze the value at call time; the checkbox adapter's `control` has that latent flaw: a follow-up for the C03 owners, not touched here).
- A `name` change on a field re-registers under the new key.

### Size

Core (ADR-011): field 0.724 KiB, form 0.699 KiB, input 0.904 KiB gzip, inside their ceilings. Adapter output (tsc, all files per directory, gzip -9, includes the shared helper once per directory count): form 1.7 KiB, field 2.9 KiB, input 2.4 KiB. No ADR-011 ceiling applies to adapter code; `size` reports the shared vanilla runtime (1.4 KiB).

### Not done / follow-ups

- A forced-false `:user-invalid` browser run and the SSR no-live-markup specs are `.f`.
- Two fields announcing in one commit still speak only the last text (known core limit).
- Real-browser coverage of the custom elements (moving children, upgrade order) is `.f`; unit tests use a DOM double.

`sj-form`: `enter` is the Enter label attribute; `action` and `method` are copied to the native `<form>` (test: `action="/post"` reaches the form and is not an Enter label). The input's own `autoSubmit` applies standalone only (core, `field.enterHint()` is final inside a field). The icon part uses core `getIconProps`.
