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
## W1-C02.c: SJField, SJInput and SJForm Vue adapters

Branch `feature/m4-c02-vue`. Owned: `packages/vue/src/{form,field,input}/**` and tests, this section. Shared files touched (checkbox-adapter precedent): `packages/vue/package.json` (`./form` export; `./field` and `./input` existed), `packages/vue/vite.config.ts` (`form/index` entry), `packages/vue/src/index.ts` and `index.test.ts` (barrel).

- **Layout**: `form/{context,SJForm}.ts`, `field/SJField.ts`, `input/SJInput.ts`, each dir with a pure re-export `index.ts`. The two injection keys (`SJ_FORM`, `SJ_FIELD`) live in `form/context.ts` so no module under `field/` other than `SJField.ts` exists; every non-test `field/` module references the generated `fieldLive` (lint `contract/live-from-contract`). SJField calls `requireLive` at mount guarded by `fieldLive === 'eager'`.
- **Stores through the shared bridge**: `createForm` and `createInput` own their stores, so `useSJStore` is given `makeStore: () => owner.store` (the existing factory seam) and subscribes/destroys through the runtime bridge (ADR-003). A field registering after mount re-renders inputs because SJInput reads the form snapshot ref in render. Test: 1,000 mount/destroy cycles, created === destroyed stores, listeners back to baseline, no live node left.
- **Announcement**: SJField calls `field.announce()` after mount (next tick, once the provider attached its host) and `onUpdated`. A standing error at mount is silent; a changed text announces once; clear then repeat announces again after the registry's own 1 s dedupe window. The error element has no `role`/`aria-live`; SSR has no live markup.
- **Icon part**: `@ramoslabs/icons` cannot be imported by an adapter (ADR-016), so the Lucide `circle-alert` data (the `alert-circle` alias) is inlined (ISC, noted in the source). The `icon` part (`<span class="sj-field__icon" data-part="icon" aria-hidden="true">` holding `SJIcon size="sm"`) was hand-built before #105 landed `getIconProps`. Follow-up: switch to `field.getIconProps()` once #105 lands (identical output).
- **Label and hint** are prop-or-slot (slot wins); a `hint` prop or slot sets `hasHint` by itself, a blank prop renders nothing. Extra adapter props `label`/`hint` are not in the contract (same as SJCheckbox `label`).
- **Ids**: `baseId(props.id, useId, runtime.idPrefix + 'sj-field-')`.
- **`:user-invalid`**: `runtime.supports.userInvalid` (false without a provider) picks the fallback; `reset` listener is added on the control's owning `form` after mount and removed on unmount.
- **Attributes**: `class`/`style` go to the SJInput root, everything else (value, placeholder, `onInput`, ...) to the control; no `v-model` surface (not in the contract).

### Decisions and open questions

- **Audit round (#110)**: form prop `action` is now `enter` (a native `action` reaches the `<form>`); the OTP autoSubmit workaround is removed (inside a field `enterHint()` is final, core #115); SJField registers with `connect(index)`, the control's index in `form.elements`, and reconnects (old cleanup first) on rename or reorder; the error icon data is the generated `circleAlert`. The old "dynamic order" limit is gone.
- The icon part now comes from core `getIconProps()` (#105).
- 3.3.7 auto-population (`prior()`, `offers()`) is not wired to a value or list; core does not set a value (a2), the owner is reachable through the injected context.

### Size (ADR-011, `node packages/testing/size/cli.js`; adapter chunks gzip from `vite build`)

Core: field 0.724 KiB, form 0.699 KiB, input 0.904 KiB. Vue adapter chunks: SJField 1,268 B, SJForm 629 B, SJInput 1,174 B (shared runtime, icon and core chunks excluded).
## W1-C02.d: SJField, SJInput and SJForm React adapters

Branch `feature/m4-c02-react`. Owned: `packages/react/src/{form,field,input}/**` plus tests, this section. Shared files touched: `packages/react/package.json` (`./form` subpath export; `./field` and `./input` existed), `packages/react/src/index.ts` and `index.test.ts` (barrel, as the checkbox adapter did).

### Shape

- `SJForm` / `SJForm.Root`, `SJField.{Root,Label,Hint}`, `SJInput` / `SJInput.Root` (+ flat `SJFormRoot`, `SJFieldRoot`, `SJFieldLabel`, `SJFieldHint`, `SJInputRoot`, ADR-002). Also exported: `SJFormContext`, `SJFieldContext`, `useSJField()` (custom controls, tests).
- One `createForm` per `SJForm` instance, one `createField` per `SJField` (keeps the announce de-duplication and the registration), one `createInput` per `SJInput`; each reads the latest props through a ref. Rebuilt only when `id`/form/live (field) or field/`userInvalid` (input) change.
- Fields re-render when the form's `fields` list changes (a `useSyncExternalStore` on the `fields` slice, so retained values on each keystroke do not re-render siblings); SJForm's context carries a signature of its props so `submits`/`action`/`fields` changes reach the fields.
- Field effects: layout (`requireLive()` guarded by the generated `fieldLive`), passive `connect()` (children report their kind first, then the field registers; keyed on `name`), passive `announce()` after every commit. A standing error at mount is silent (core ruling 3); StrictMode announces once.
- Input: `data-touched` via a store subscription; the form `reset` listener is attached in an effect through the control ref (`AbortController`), `userInvalid` read from `runtime.supports` (no provider: fallback on).
- Error part: `<div id=-error class=sj-field__error>` = `<span class=sj-field__icon data-part=icon aria-hidden>` holding an aria-hidden `SJIcon` `alert-circle` size `sm`, then the visible text. Rendered only while the trimmed error is non-empty; no `role`/`aria-live` on it.

### Decisions and ambiguities

- **Icon data.** ADR-016 forbids adapters importing `@ramoslabs/icons`, but the ruling needs an `alert-circle` in the adapter. The three Lucide `circle-alert` nodes (ISC) are inlined as an `IconData` constant in `field/index.ts`. Follow-up for the owner: a core-owned constant or an `errorIcon` slot would remove the duplicate.
- **Icon part props.** `getIconProps` lives on #105 (core `field` icon part), not on main yet; the adapter builds `sj-field__icon` / `data-part=icon` / `aria-hidden` itself. Switch to `parts.getIconProps()` once #105 lands.
- **`action` collides with the native form attribute.** The contract prop `action: 'go'|'send'|'search'` wins; the native submission target is not a prop of `SJForm` (type error, never reaches the DOM). Use `onSubmit`. Worth a contract rename (`enterAction`) before `beta`.
- **Contract names stay lowercase.** `autocomplete` is the prop; React's `autoComplete`, `type`, `inputMode`, `enterKeyHint`, `autoCapitalize`, `autoCorrect`, `spellCheck` and `maxLength` are omitted from the types and stripped at runtime (an untyped spread cannot turn an identifier into `type=number` or add `maxlength`).
- **Prop-or-slot.** `label`/`hint` props or `SJField.Label`/`SJField.Hint` parts (give one, not both). The hint part registers itself with the field in a layout effect (one re-render before paint, like Vue), so no `hasHint` is needed in slot form; on the server render only the prop form or `hasHint` references it. `error` is prop-only. Order: label, hint, control, error (matches the CSS fixtures).
- **SSR Enter position** needs the data-first `fields` prop; without it the position appears after mount (registration order).
- Native `:user-invalid` detection is not done by `SJProvider` yet, so unless the app passes `supports.userInvalid` the touched fallback runs (harmless beside the native rule).

### Size

Unminified `tsc` output gzip (comments included, so an upper bound): form 1.04 KiB, field 2.42 KiB, input 1.82 KiB. The `size` tool reports only the whole `adapter:react` barrel (not per component) for adapters.

### Not done / follow-ups

- Two fields announcing in one commit still speak only the last text (known limit, see a1).
- Browser (L2/L3) and forced-false `:user-invalid` runs are `.f`.

### Rebase onto #114/#115 (C02.d)

- Form prop `action` is now `enter`; the native `action` passes through to `<form>` (test). Inside a field the owner's `enterHint()` is final; the input's own `autoSubmit` is standalone only (core, test).
- Field registers with `connect(Array.prototype.indexOf.call(form.elements, control))`; SJInput hands its element to the field (`useSJFieldControl`). Re-read after every commit: a rename or reorder runs the old cleanup, then `connect(newIndex)`.
- Error icon is the generated `circleAlert` (`../generated/icons/circle-alert`); the inlined nodes and the ADR-016 follow-up are gone. The icon part now uses core `getIconProps` (#105).

## W1-C02.f: SJField, SJInput and SJForm conformance

Branch `feature/m4-c02-field-conformance`. Owned: `packages/testing/specs/field/**`, the four `*:field` scripts in `packages/testing/package.json`, the `status` of the three contracts, this section. Defects fixed in the components are listed below.

### One combined `field` directory (justification)

`specs:check` and the template tie a directory to one slug (`SJ_FIELD_PORT`, `field-results.json`, the four `*:field` scripts) and `parity/cli.js` takes one expected declaration per run. The three components are one unit at run time: the form owner computes the Enter position the input renders, the field owns ids, ARIA and the announcement, and every scenario mounts all three together. Three directories would have tripled twenty-three files with one shared host and no composition seam (`composition/` is for specs that compose a component with another, not for a unit that cannot be mounted alone). So: one `field` dir, matrix `component` `SJField`, scenarios named by the contract they exercise, contract fixtures kept per contract (`field/<f>`, `input/<f>`, `form/<f>`). SJForm has no stylesheet by design (C02.b); there is no SJForm visual scene. Consequence for CI: `scripts/e2e-components.mjs` narrows only on `specs/field/`, `*/src/field/` and `field.contract.json`; a change confined to `input` or `form` files runs every component (the safe direction).

### What runs

- **L2 matrix**, 30 scenarios x 3 adapters x 3 engines x 2 paths (`native`, `fallback:all`) = 540 executed cells, parity PASS: 7560 cells, 540 executed (540 passed), 2700 not-applicable (ten single-key paths, with reasons), 4320 not run (floor lanes and devices, with reasons), 0 missing.
- **Kinds from the contract, not the core table.** `matrix.ts` derives every ADR-007 expectation (`expectedAttrs`, `expectedHints`) from `kinds.contract.json` and the rendered control is compared with it: type, inputmode, autocomplete, autocapitalize, autocorrect, spellcheck, enterkeyhint, tag, no `maxlength`, `type=number` only for `quantity`. 30 kinds plus 23 flag cases (variant, digits, section, tokens, meaningful, uppercase). `choice` is SJSelect's (C10) and is left out by name; `country` runs as its text variant.
- **Enter hints**: owner order, overrides (url go, search, otp/cc-csc done), `enter` send/search/go, `submits:false`, textarea exclusion, late-mounted fields (end and middle), reordered fields (four permutations, DOM order checked), data-first list wins over DOM order. OTP: owner `autoSubmit` final inside a form (five combinations, including a contradicting own prop), own `autoSubmit` standalone and in a field without a form.
- **`enter` vs native `action`/`method`**: `action="send"` with `enter="search"` and the mirror case; the attributes reach the `<form>`, no `enter` attribute leaks, no `novalidate`. A real Enter key press submits and a real GET lands on `/echo`. The `<sj-form>` custom element is upgraded in place (`hydrate.e2e.ts`, `form.e2e.ts`).
- **Form state equals bare native inputs** (`form.e2e.ts`, 3 scenes x 10 operation sequences x 3 adapters x 3 engines, plus the `L2` rows): FormData, value, defaultValue, `value` attribute, required, disabled, validity, `:invalid`, query string, after fill, clear and `form.reset()`, plus a real submit.
- **`:user-invalid`**: the two paths run different code, asserted on the page: `native` (real detection) leaves `data-touched` unset and `:user-invalid` paints; `fallback:all` sets `data-touched` and the `[data-touched]:invalid` rule paints (`uv-code-path`, and `expectMechanism` in every `uv-*`). Tab-through paints nothing, change and a failed submit paint, reset clears both. `fallback:all` on current Chromium is the stand-in for the Chromium 114-118 run (the component behaves from the `supports` map, not the UA string; the real 114 floor lane stays declared `not run`, ADR-013).
- **3.3.7**: retained values offered across keys, deduplicated, never for password/otp/cc-csc, a tab-through (forward and back, six fields) keeps the value and retains no empty string.
- **Announcement**: silent at mount (standing error, both with and without a region), once on the transition, silent on re-render, a changed text announces, the same text after the 1 s window announces again; the error has no `role`/`aria-live`; the icon part and its svg are `aria-hidden`, the description is the words exactly (Playwright algorithm on three engines, CDP AX tree on Chromium), no `::before/::after` content.
- **Derived ARIA**: ids, `for`, `aria-describedby` order (hint, error), `aria-invalid` only while an error shows (never `"false"`, whitespace is not an error), `aria-errormessage` only with `errorMessage` and only while invalid, native `required`/`disabled`/`name`, no `aria-required`.
- **Hydration/SSR** (React, Vue): 6 fixtures, same nodes adopted, same ids and IDREFs, no live markup, data-first Enter position in the server markup, hydrated control behaves and resets to the server default. jsdom SSR determinism, cross-root collisions.
- **a11y**: axe on 21 states x 3 adapters x 3 engines (target-size enabled), 2.4.13 on rest/invalid/textarea, 2.5.8 (24 px floor, 44 px design target, disabled keeps its size), contrast of label/hint/error/typed text 4.5:1 and rest/invalid border 3:1 with a thicker invalid border, forced colors, RTL. ARIA snapshots: 18 files (every contract fixture) shared by all adapters and engines, seeded regressions, CDP AX tree (Chromium).
- **Bundle**: core field 0.758, form 0.777, input 0.920 KiB gzip (ceilings 3, 1.5, 3); together 2.46 KiB inside the field 3 KiB; adapter one-entry fixtures import only the field set, icon, runtime and generated code. **VoiceOver hook**: six `atAssertions` from the three contracts, two lanes, expected speech from the fixtures and the kinds contract. **Visual**: 17 scenes (candidates only, `baselines/` empty until human review).

### Known limit: two fields announcing in one commit speak only the last text

Known limit, documented and pinned by the scenario `field: two errors in one commit speak only the last (known limit)` (`announce-limit`): when two fields' errors appear in the same commit the live registry holds one pending text per role, so one of the two messages is spoken (which one depends on the adapter's effect order); both stay visible and both controls are `aria-invalid` and described by their own error. Fields that change one at a time each announce. A consumer-side summary or focus path is the mitigation (not part of the two SJForm duties, ADR-014). It is asserted, not hidden: the scenario fails if the behaviour changes either way.

### Defects found and fixed

1. **Vue SJField rendered the hint after the control** (`label, control, hint, error`), while React and vanilla render `label, hint, control, error` (the order the CSS fixtures and the React notes assume). Found by the shared ARIA snapshot failing on Vue only. Fixed in `packages/vue/src/field/SJField.ts` with a unit test for the child order.
2. **`country` text variant lacked `inputmode="text"`**: the kinds contract note says "The text variant (type=text, inputmode=text) uses country-name" but the row had `inputmode: null`, so the rendered control had no inputmode. Fixed in `kinds.contract.json` (`inputmode: "text"`, `inputmodeWhen: "text variant"`), regenerated the table, and `resolveKind` now never emits `inputmode` for `type=select` (the default `country` is SJSelect's). Unit tests added in `kinds.test.ts`.

### Test-harness findings (not component defects)

- The vanilla live region is `<div role="status" class="sj-sr-only">` appended to `body` (no `data-sj-live`), the React and Vue one carries `data-sj-live`; the host observes `body > [role=status|alert]`, which both produce.
- A Vue `<textarea>` has no default-value channel through SJInput (`value` is a DOM property, so `form.reset()` empties it); this is Vue, not SJ, and is why the textarea fixtures carry no default in the Vue-equivalence scene. React and vanilla reset to the default.
- React writes `enterKeyHint` in server HTML; attribute names are case-insensitive.
- Submission normalises textarea line breaks to CRLF; the host's `query()` does too so the comparison with the real navigation is exact.

### Skips

Only the CDP AX-tree tests (Chromium-only API) skip on Firefox and WebKit: 42 skipped, all `test.skip(browserName !== 'chromium', ...)` carrying `#49` and owner `SrRamos` (reused, as for checkbox).

### Open questions

- Disabled control text is `--color-text-disabled` (#cbd5e1) on `--color-surface-hover` (#f1f5f9), 1.36:1. WCAG 1.4.3 exempts inactive components, but AGENTS.md says text lighter than slate 500 on white "is not allowed for text". The suite pins today's 1.3:1 floor and the disabled label stays 4.5:1; whether the token should move is a design decision, not made here.
- The 3.3.7 offers have no UI: the adapters expose `prior()`/`offers()` and nothing is auto-filled or rendered, so `manual-form-prior-values-offered` describes the consumer-built offer list. A shared offer part would be a new anatomy part (contract change).
- Chromium 114-118 on real binaries remains the per-release floor lane; this PR evidences the code path, not the UA.
