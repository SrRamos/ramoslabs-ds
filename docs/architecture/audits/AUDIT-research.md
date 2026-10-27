# AUDIT — research/ (round 1)

Auditor: ds-fable (independent). Brief: `docs/architecture/BRIEF.md`.
Method: every support claim is re-derived from `@mdn/browser-compat-data` 8.1.7 (BCD, pulled
2026-10-27) and mapped to release dates from the same dataset; spec claims are checked against the
WHATWG HTML living standard and CSSWG drafts. Verdict rules: FAIL if any claim is wrong in a way that
would change an architecture decision, or if a brief requirement for the question is unmet. Fixes are
numbered; a file PASSES when every MUST is resolved.

Progress: 7/7 audited. Round 1 complete; see summary at the end.

---

## 01-platform-primitives.md — verdict: **FAIL**

**What is right (verified):** Popover attribute versions and April 2024 Baseline; anchor positioning
core versions (Chromium 125 / Safari 26 / Firefox 147, 2026-01-13); `<dialog>`; `closedby`
(Chromium 134 / Firefox 141 / Safari none); `inert`; Invoker Commands (Chromium 135 / Firefox 144 /
Safari 26.2, 2025-12-12); `ElementInternals`; View Transitions same-document Baseline October 2025
(Firefox 144, 2025-10-14); `interestfor` Chromium-only; `position-try-order` later than the core
(Firefox 148). The "what it replaces" column and the native-first framing match the brief. The
modal-vs-popover split (rec. 2) and "never import a positioning library" (rec. 3) are correct and
should survive into ARCHITECTURE.md.

### MUST fix

1. **The `closedby` fallback itself has a support gap you do not state.** The file tells the engine
   to "implement outside-click through `requestClose()`" for browsers lacking `closedby`.
   `HTMLDialogElement.requestClose()` is Chrome 134 (2025-03-04), Firefox 139, Safari 18.4. Every
   browser that has `closedby` already has `requestClose()`, and the browsers that lack `closedby`
   (Safari 18.4–27) have `requestClose()` but Safari < 18.4 (iOS 17 and 18.0–18.3 devices) has
   neither. The fallback must be two-tier: `requestClose()` when present, otherwise dispatch a
   cancelable `cancel` event and call `close()` only if not prevented. State the three tiers and
   their versions in the table row. (BCD `api.HTMLDialogElement.requestClose`.)

2. **`popover="hint"` is presented as a stable third state; it is not.** BCD records Chromium
   133–151 and Firefox 149–153 as *partial* ("implements an older version of the specification
   with inconsistent behaviors", crbug 499019927, bugzil.la 2029974); full behavior only in Chrome
   151 (2026-07-28) and Firefox 153 (2026-07-21); Safari has no support (preview only). A tooltip
   component built on `hint` semantics (not closing `auto` popovers) behaves differently across the
   2026 floor. Add a row or sub-row for `hint` with these versions and state the fallback: tooltips
   use `popover="manual"` with engine-controlled show/hide, and `hint` is a detected enhancement.

3. **Customizable `<select>` row has no support data; the brief requires it per primitive.**
   `appearance: base-select` is Chrome 135 (2025-04-01), Safari 27 (2026-09-14), Firefox 149
   behind a flag; `::picker(select)` Chrome 135 / Safari 27 / Firefox none; `<selectedcontent>`
   Chrome 135 / Safari 27 / Firefox none. "Still limited/experimental" understates it: two of
   three engines ship it unflagged, and Safari shipping it six weeks before the research date is
   material to the `SJSelect` preset decision. Put the versions in the table and cite BCD or the
   per-property MDN pages, not only the Learn guide.

4. **Define the browser floor, or recommendations 3 and 4 are not decidable.** The fallback column
   repeatedly defers to "when the product browser floor requires it" but the file never proposes a
   floor. Propose one with rationale and the consequence per primitive. Reference point from the
   data: a floor of Safari/iOS 17 (popover) means anchor positioning (Safari 26, 2025-09-15) and
   `requestClose()` (Safari 18.4) need fallbacks for roughly two iOS generations; a floor of
   Safari/iOS 26 removes the geometry fallback entirely. The brief constraint "zero runtime
   dependencies" makes this the single biggest bundle decision in the library; the research must
   give ARCHITECTURE.md the numbers to make it.

5. **Top-layer nesting and the Escape order are missing, and the table claims `<dialog>` solves
   the "Escape stack".** The architecture needs the rules for: an `auto` popover inside a modal
   dialog (popover closes first on Escape; dialog's `closedby` does not fire), nested `auto`
   popovers (only ancestor/invoker-related popovers stay open), a `<dialog>` opened from inside a
   popover (dialog enters the top layer above and the popover is closed unless it is in the
   dialog's ancestor chain), `hint` vs `auto` interplay, and non-modal `dialog.show()` (not in the
   top layer at all). Cite the HTML "topmost auto popover" / "hide all popovers until" algorithms
   and the dialog close-request steps. Without these, `SJSelect` inside `SJDialog` and `SJMenu`
   inside `SJPopover` are unspecified.

### SHOULD fix

6. **Invoker Commands: enumerate the built-in command set and its skew.** `show-modal`, `close`,
   `toggle-popover`, `show-popover`, `hide-popover` ship with the feature; `request-close` is
   Chrome 139 / Firefox 144 / Safari 26.2 (BCD `html.elements.button.command.request-close`).
   Also state that `commandfor`/`popovertarget` are ID references and do not cross shadow roots;
   the `commandForElement`/`popoverTargetElement` IDL properties accept element references and are
   the path for the vanilla custom-element adapter.

7. **`interestfor`: give the version and the standards status.** Chrome 142 (2025-10-28) only; BCD
   marks `interestForElement`/`InterestEvent` as *not on a standards track* (OpenUI proposal, HTML
   PR still open). "Limited availability" hides that it may change shape; say explicitly that no
   contract field may depend on it.

8. **Fill the empty version cells.** `:user-invalid` (Chrome 119 2023-10-31 / Firefox 88 / Safari
   16.5; Baseline is late October 2023, not November). View Transitions same-document (Chrome 111 /
   Safari 18 / Firefox 144) and cross-document (`@view-transition`: Chrome 126 / Safari 18.2 /
   Firefox none) as two rows, since the brief's SPA/MPA use differs.

9. **Anchor positioning: list the property-level floors you allude to.** `position-visibility`
   is Safari 26.2 (2025-12-12), `position-try-order` Firefox 148, `position-area` Chromium 129
   under that name (125–131 as `inset-area`). One small table replaces "individual properties have
   different floors".

### Nice to have

10. Popover focus semantics (no trap; `autofocus` honored on show; focus returns to invoker on hide
    only if it was inside) belong in the Popover section since they shape `SJMenu`.
11. `ToggleEvent.source` (Chrome 140 / Firefox 145 / Safari 26.5) lets the engine learn which
    invoker opened a popover; relevant to rec. 4 "observe native state".

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## 02-headless-engine.md — verdict: **FAIL**

**What is right (verified):** TC39 Signals is Stage 1 with an explicitly unstable API (repo
README, retrieved 2026-10-27); every `useSyncExternalStore` caveat quoted (cached `getSnapshot`,
`Object.is`, mandatory `getServerSnapshot`, Transition mutation falls back to blocking, `subscribe`
identity) matches react.dev verbatim; Vue 3.5 `useId` + `app.config.idPrefix` (2024-09-01); Vue
directives are skipped in SSR unless `getSSRProps`; `AbortSignal` listener cleanup; Rollup
tree-shaking conditions. The decision (pure reducer + explicit FSM tables for complex components,
effect descriptors, no signals/statechart runtime, prop getters canonical, consumer-first
cancellation via `defaultPrevented`, no `stopPropagation` dependence, `useId`-rooted ids with
anatomy suffixes, injected id factory for vanilla SSR, per-request stores, side-effect-free
modules with per-component entries) is sound and should carry into ARCHITECTURE.md as-is. The
bundle ceilings are honestly labelled as unmeasured limits.

The failures are all in the binding layer the brief asks for ("how one core binds to Vue
reactivity, React, and vanilla DOM"): the file names the pieces but leaves the three mechanisms
that actually decide correctness unspecified.

### MUST fix

1. **Effect timing relative to render commit is unspecified, and the current wording is wrong
   for Vue and React.** The decision says effects (focus, scroll, `showModal()`, announcements)
   "run after transitions through adapter-owned effect commands". `dispatch()` returns
   synchronously; in React the new snapshot is rendered later (and, under a Transition, possibly
   discarded and restarted), and in Vue the `shallowRef` write schedules an async re-render. An
   effect such as "focus item 3" or "move focus into the panel" executed when `dispatch` returns
   targets DOM that does not exist yet. This is exactly the mechanism behind two of the brief's
   known defects (no focus trap, no focus return). Specify the contract: effects are queued on
   the store, drained by the adapter after commit (`useLayoutEffect`/`useEffect` keyed on the
   snapshot in React; `watch(snapshot, …, { flush: 'post' })` or `onUpdated` in Vue; microtask
   after DOM patch in vanilla), each effect is idempotent and carries the snapshot version it was
   produced for so a superseded effect is dropped, and `showModal()`/`showPopover()` are the one
   class of effect that must run *before* dependent focus effects. State what happens when an
   effect cannot execute (element unmounted) and that effect execution never dispatches
   synchronously back into the reducer.

2. **The props-in direction is missing.** Controlled values "are authoritative" but the file never
   says how a changed React/Vue prop reaches the store. Writing to an external store during render
   is forbidden by the React model this file relies on, and syncing in an effect introduces one
   render of stale ARIA state. Specify: controlled props are read by the store through an
   adapter-provided `getProps()` accessor evaluated at transition time (not copied into state),
   or set via a `store.setContext(props)` call made in a layout-phase hook with the reducer treating
   context as input, and say which. Then specify reconciliation when native state disagrees with a
   controlled prop (user pressed Escape, native `<dialog>` is closed, `open` prop still `true`):
   which side wins, and that the adapter issues a corrective native effect rather than re-dispatching
   the user event. Without this, "native events are facts" and "controlled props are authoritative"
   contradict each other.

3. **Compound composition has no registration design.** Hard constraint 6 requires
   `SJSelect.Root / .Trigger / .Content / .Item`; the store lists "item registration" as a field and
   stops. Specify how an `.Item` finds its `.Root` (React context / Vue `provide`-`inject` / vanilla
   DOM ancestor query), how item order is established (render order is not DOM order after
   conditional rendering; `Node.compareDocumentPosition` on registration is the known solution and
   is unavailable during SSR), how a virtualized collection registers items that are not rendered
   (the collection must be data-driven, not DOM-driven, for `aria-setsize`/`aria-posinset` and
   typeahead to be correct), and how item keys map to ids (the file already requires stable keys).
   This decision constrains research 03 (`aria-activedescendant` needs ids for unrendered items)
   and 05 (virtualization), so it cannot be deferred.

### SHOULD fix

4. **React StrictMode and Fast Refresh double-invocation.** Store construction must be in
   `useState(() => create())`/`useRef`; effects mount, unmount, and remount in development, so
   `destroy()` must either be reversible or the adapter must re-create the store on remount, and
   `subscribe` must be idempotent. Say which, because the current "`destroy()` for subscriptions,
   observers, listeners, timers" reads as one-way.

5. **Listener ordering between the engine and React's delegated events.** React attaches its
   handlers at the root container; a vanilla `document`-level `pointerdown` listener used for
   outside-dismiss fallbacks (research 01 MUST 1) runs after React's handlers for targets inside
   the root and before them for targets outside. Specify that outside-dismiss uses `pointerdown`
   in the capture phase on `document` and ignores events whose composed path includes the
   component's own elements, and that it is only installed when the native popover/dialog light
   dismiss is unavailable.

6. **Generated ids are not guaranteed CSS identifiers.** react.dev does not specify the `useId`
   format; React 18 emitted `:r0:` and React 19.1+ `«r0»`, neither a valid `<custom-ident>`. Any
   derivation of `anchor-name`, `view-transition-name`, or `querySelector('#…')` from a `useId`
   base must go through `CSS.escape` or a sanitizing map; IDREF attributes (`aria-labelledby`,
   `commandfor`, `popovertarget`) accept any string and are fine. Add this rule to the id section.

7. **Ground the comparison in the references the brief allows.** The brief lists React Aria,
   Radix, Ark/Zag, Headless UI, Melt, Floating UI as study material and asks that licences be noted
   when cited. The file cites none, so the prop-getter vs attribute-spread vs directive table and the
   reducer-vs-statechart choice are argued from first principles only. Add one paragraph per
   reference stating which model it uses (Zag: XState-style machines + prop getters, MIT; React
   Aria: hooks returning prop objects + collection API, Apache-2.0; Radix: compound components +
   `useControllableState` + `Slot` merging, MIT; Melt: Svelte builders/actions, MIT; Headless UI:
   compound components, MIT) and what each one's measured gzip size for a combobox is, so the
   3 KiB / 8 KiB ceilings have a reference point instead of being round numbers.

8. **Vue: `markRaw` the snapshot and registries.** The file says "do not deeply proxy"; the way to
   enforce that against consumers who pass the snapshot into `reactive()` is `markRaw`. One line.

### Nice to have

9. The timer story (typeahead reset, tooltip delay, long-press) is implied by "reducers never
   touch clocks"; state that timers are effect descriptors with an injectable scheduler so tests
   and SSR never touch `setTimeout` directly.

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## 03-a11y-engine.md — verdict: **FAIL**

**What is right (verified):** All nine APG pattern summaries match the current APG text
(listbox Home/End > 5 and typeahead > 7; switch Space required / Enter optional; tabs automatic
activation only without latency, empty panel `tabindex="0"`; menu Tab closes; dialog initial-focus
rules; tooltip hover-or-focus, Escape, no interactive content; disclosure native button). ARIA 1.2
`status`/`alert` implicit values and the 2023-06-06 date; WCAG 2.2 updated 2024-12-12. WebAIM Survey
#11 numbers are exact (July–August 2026, last updated 2026-09-29, 91.8% mobile, JAWS+Chrome 31.2%,
NVDA+Chrome 17.3%, JAWS+Edge 17.0%, NVDA+Firefox 9.1%, VoiceOver 72.2% / TalkBack 29.5% mobile).
WebKit 231724 is still NEW with comment 12 (2025-07-09) reporting it working in Safari 18.4; the
file's "do not cite it as a current universal defect" framing is correct. The roving-vs-
activedescendant rule set, the focus-return conditions (connected, visible, enabled, not inert),
the typeahead normalization policy, the "one strategy per composite" rule, and the AT matrix tiers
are all sound and should carry into ARCHITECTURE.md.

The failure is scope: the brief asks for "known screen reader × browser quirks (VoiceOver
iOS/macOS, NVDA, JAWS, TalkBack)". The file delivers one macOS WebKit bug, one NVDA issue
(misattributed), a generic JAWS-modes note, and nothing for VoiceOver iOS or TalkBack, which the
file's own survey citation shows are the two readers most users touch. "No honest static matrix"
is true of permanence, not of the research task.

### MUST fix

1. **Add the mobile quirks with primary sources, or the P1 mobile matrix has nothing to
   assert.** Minimum set, each with tracker link, dates, versions tested, and whether it is still
   open: (a) `aria-activedescendant` on VoiceOver iOS and on TalkBack/Chrome Android, where
   pseudo-focus has historically not moved the reader cursor and users must swipe into the
   listbox; this directly tests the file's own rule "active-descendant for editable comboboxes";
   (b) `aria-live`/`role="status"` on VoiceOver iOS when the region is off-screen,
   `visibility:hidden`, or updated in the same frame it is inserted; (c) `aria-haspopup` and
   `aria-expanded` announcement on iOS VoiceOver and TalkBack for the menu button and select
   trigger; (d) `display: contents` dropping semantics (state which engines fixed it and when);
   (e) `inert` and top-layer content exposure to the VoiceOver iOS rotor. If a quirk is believed
   fixed, say which version fixed it and keep the retest row. The file already prescribes the
   log format; populate it.

2. **Android virtual keyboards break `keydown`-based typeahead, and the IME guard does not
   cover it.** Gboard and most Android IMEs deliver `keydown` with `keyCode` 229 and
   `key: "Unidentified"` for printable characters (MDN `KeyboardEvent.keyCode` notes 229 as the
   IME-composition value), and `isComposing` can be false. Typeahead and shortcut matching for
   listbox/menu/combobox must therefore be driven from `beforeinput`/`input` with `inputType`
   (and `data`) on the editable combobox, and from `keydown` only on non-editable composites where
   the reader rather than the IME delivers keys. State this, add it to the IME section, and add a
   physical-Android row to the test protocol for typeahead specifically.

3. **The select-only combobox has no focus strategy, and the activedescendant-across-popover
   case has no evidence.** The rules give roving focus to "standalone listboxes" and
   active-descendant to "editable comboboxes"; the custom fallback for `SJSelect` (research 01
   rec. 5) is a select-only combobox, which APG implements with `aria-activedescendant` on a
   non-input trigger. Decide and justify. Then address the structural fact that with Popover/top
   layer the listbox is not a DOM descendant of the combobox element, so `aria-activedescendant`
   must resolve through `aria-controls` (ARIA 1.2 §aria-activedescendant allows this for
   combobox); record which reader/browser pairs in the P1 matrix honour that path, with sources.
   Research 02 MUST 3 (collection registration) depends on this answer.

### SHOULD fix

4. **Correct the NVDA citation.** Issue 18721 was opened 2025-08-15 against NVDA 2025.1 on
   Windows 10; the 2025.3.2 / Windows 11 log is a later commenter; maintainers could not
   reproduce on Edge 144 and closed it as works-for-me on 2026-01-08. The file's argument
   (one report is not a universal failure) gets stronger with the real facts, so state them.
   WebKit 231724 was opened 2021-10-14, not 10-12.

5. **`:focus-visible` after programmatic focus.** The engine moves DOM focus with `.focus()`
   on every roving step and on overlay open. Per the Selectors 4 heuristic, the new element
   matches `:focus-visible` only if the previously focused element did, or the focus move was
   keyboard-initiated; a menu opened by pointer that focuses its first item may show no visible
   focus in Chromium. The hard constraint is "visible focus"; specify the policy (force a visible
   state on the active item via a data attribute independent of `:focus-visible`, or rely on the
   heuristic and document the pointer-open exception) and add it to the keyboard-map contract.

6. **Live-region plumbing across frameworks.** "Mount persistent containers before updating"
   is right; say *where*: one region pair per document owned by the vanilla kernel and shared by
   all adapters (so two React roots and a Vue island do not each insert their own), with a
   per-message dedupe window. This is also where the "one per request" SSR rule from research 02
   needs an exception (regions are client-only).

7. **Tooltip trigger on touch.** APG tooltip assumes hover/focus; on touch there is neither.
   State the touch behavior (long-press is not discoverable; prefer an explicit control or
   `aria-describedby` on the control itself) since research 04 will otherwise have to invent it.

### Nice to have

8. `aria-errormessage` vs `aria-describedby` for field errors: support is uneven across the
   matrix; a one-line recommendation (describedby with `aria-invalid`, errormessage as additive)
   saves the forms work in 04 from re-deriving it.

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## 04-mobile-input-ux.md — verdict: **FAIL** (closest to PASS so far)

**What is right (verified):** `inputmode` is a hint, `decimal` may omit minus; `autocomplete`
tokens and the WCAG 1.3.5 link; `one-time-code` is the standardized token and WebOTP
(`OTPCredential`: Chrome/Android only, experimental in BCD) is correctly demoted to an
enhancement; `type="number"` rejected for identifiers (BCD notes Chromium blocks non-numeric
typing while Firefox/Safari reflect an empty `value`, which is exactly the inconsistency the file
avoids); `type="tel"` imposes no format; `Intl.NumberFormat`/`formatToParts` and the "no
`Intl` parser exists" point; WCAG 2.2 SC 2.5.8 (24 px, exceptions) and SC 2.5.7; Apple HIG 44 pt;
VisualViewport vs layout viewport; VirtualKeyboard API Chrome 94 only, experimental, not to be
enabled globally. The phone policy (unmasked editing, format on blur, whole-string paste, caret
mapping only if a product demands a live mask, canonical value separate from presentation) and
the money policy (integer minor units or exact decimal string) are the right calls and should
carry into ARCHITECTURE.md verbatim. The verification matrix is complete.

### MUST fix

1. **`enterkeyhint` is in the brief's per-kind list and absent from the table.** The file
   states the principle ("reflect the real next action") and then gives a default only for
   Search. Add the column with a rule, not just values: the Field contract takes `enterkeyhint`
   from its form position (`next` when another field follows, `done` on the last field of a
   non-submitting group, `go`/`send`/`search` when Enter submits and the submit action is
   navigation / message / query), with per-kind overrides where the kind implies the action
   (URL → `go`, Search → `search`, OTP → `done` when auto-submit is off, `go` when on). Say which
   component owns the form-position information, because a field cannot know it alone.

2. **The viewport section skips the two declarative platform answers.** The brief's hard
   constraint is native-first, and the file jumps from "`100vh` cannot prove visibility" straight
   to a JS policy on `visualViewport.resize`. Add: dynamic viewport units (`dvh`/`svh`/`lvh`,
   Chrome 108 / Firefox 101 / Safari 15.4; `svh` for sticky action bars, never `dvh` for content
   that must not jump) and the `interactive-widget` viewport meta (`resizes-content` /
   `resizes-visual` / `overlays-content`, Chrome Android 108 (2022-11-29), Firefox Android 133,
   no iOS), which is how Android Chrome's keyboard-resize model is chosen and the reason iOS and
   Android need different overlay math (iOS always behaves like `resizes-visual`). The JS policy
   then becomes the fallback for what these cannot express, which is the ladder research 01
   prescribes.

3. **iOS Safari zooms the page when a focused input's font-size is under 16 CSS px.** This is a
   token-level defect the design system must design out (the type scale decides it), it is not
   mentioned, and it belongs here because it is viewport behavior triggered by the virtual
   keyboard. State the rule (every `SJ` input renders at ≥ 16 px computed font-size on touch,
   enforced by the size tokens, never by `maximum-scale=1`, which breaks pinch zoom and WCAG
   1.4.4) and add it to the verification matrix.

### SHOULD fix

4. **Decimal separator mismatch between device keyboard and app locale.** The parser rule
   "accept the active locale's decimal separator and, optionally, ASCII" leaves the common case
   undefined: a Colombian user with an English keyboard on `inputmode="decimal"` gets a `.` key,
   or a Spanish keyboard emits `,` into an `en` form. Specify the rule: for `amount` kinds the
   parser accepts both `,` and `.` as decimal when the value contains exactly one separator and no
   grouping, treats a separator followed by exactly three digits and another separator as
   grouping, and otherwise rejects; and state that the Field never pre-fills grouping characters
   into the editable value. Add the keyboard-locale ≠ app-locale case to the matrix.

5. **`maxlength` truncates pasted formatted values.** A pasted `+57 (301) 555-1234` into a
   `tel` field with `maxlength="10"` loses digits before the engine sees it. Rule: no `maxlength`
   on phone/amount/reference kinds; enforce length after normalization in the contract. OTP keeps
   `maxlength` only because its paste path normalizes first (say that explicitly, since the OTP
   row currently sets `maxlength` from the contract).

6. **Add the payment and address kinds.** The library's consumers (ticketing, invoicing) need
   `cc-number` (`text` + `inputmode="numeric"` + `autocomplete="cc-number"`, never `number`),
   `cc-exp` / `cc-exp-month` / `cc-exp-year`, `cc-csc`, `cc-name`, `street-address` /
   `address-line1..3`, `postal-code`, `country` / `country-name`, `organization`, and a
   `tax-id` style reference kind (digits with a check digit, leading zeros preserved). The table
   is the machine-readable contract source (rec. 1), so missing kinds become app-level
   improvisation.

7. **Cite Material 3 alongside Apple HIG for the 44 px preset.** Material specifies 48 × 48 dp
   touch targets with 8 dp spacing; TalkBack users are 29.5% of the file's own mobile figure.
   Also note that `autocorrect` landed in Chrome only in 153 (2026-09-08) and Firefox 136, and
   Samsung Internet has none, so the `autocorrect="off"` defaults are Safari-reliable and
   best-effort elsewhere (BCD `html.global_attributes.autocorrect`).

8. **Autofill prerequisites.** iOS and Chrome autofill need a `<form>`, a stable `name`/`id`,
   and a visible label; the OTP paragraph says "named, labelled", the table does not. One
   sentence in the mapping preamble.

### Nice to have

9. `field-sizing: content` (Chrome 123 / Firefox 152 / Safari 26.2) for auto-growing textareas,
   with a JS fallback only below the floor from research 01.
10. The iOS domain-bound SMS format (`@domain #code`) is what makes `one-time-code` autofill
    secure; it is a backend contract, so a pointer in the OTP section is enough.

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## 05-performance.md — verdict: **FAIL** (judgement call; two structural gaps, facts are sound)

**What is right (verified):** pipeline stages and the transform/opacity rule; 16.7 ms is 60 Hz
and web.dev's ~10 ms app budget; INP good ≤ 200 ms at p75; LoAF 50 ms; passive listeners cannot
cancel (Chrome post last updated 2016-06-05); `ResizeObserver` loop-error semantics;
`content-visibility` demo 232 ms → 30 ms "7×" and the accessibility-tree statement, both quoted
accurately from web.dev (published 2020-08-05, updated 2025-09-23); V8 hidden classes and the
generational "most objects die young" quote. The folklore section is the best part of the file:
delegation is not a speedup, passive is not "faster", debounce delays feedback, rAF is not free,
`will-change` is not free, "zero allocations" is not a rule, signals are not inherently faster.
The benchmark protocol (control vs candidate, same session, randomized, tail latency, physical
mid-tier phone, heap after destroy) is right and should carry into ARCHITECTURE.md.

### MUST fix

1. **The protocol has no absolute gates, so the first implementation cannot be certified by
   it.** "No optimization merges without a statistically visible win over the control" presumes a
   control; the initial engine has none, and the library's promise to consumers is an absolute
   budget, not a relative one. Add provisional lab ceilings per scenario, labelled as revisable
   by ADR exactly as research 02 did for bytes: e.g. key-to-paint for one roving-focus step
   ≤ 50 ms p95 on the reference mid-tier Android device, overlay open ≤ 100 ms p95 including
   `showModal()`/`showPopover()`, combobox filter keystroke ≤ 50 ms p95 at 1,000 items with the
   result-count announcement, zero retained store/listener/observer after 1,000 mount/destroy
   cycles, and a named reference device class (say which: a specific Moto G / Galaxy A model and
   an iPhone two generations back). Also give a provisional virtualization default (fixed-size
   path from N rows) with the measurement that will revise it; "a measured threshold, not a magic
   item count" leaves the first `SJTable` with no rule.

2. **Reconcile the frame scheduler with research 01 and 02.** Rec. 1 says "build one
   read→compute→write frame scheduler for overlays"; research 01 rec. 3 makes CSS anchor
   positioning the default so overlays need no JS geometry at all on the floor, and research 02
   MUST 1 requires DOM effects to run after the framework's commit. State explicitly that: the
   scheduler runs only on the geometry fallback path and for measurement-driven features
   (variable-height virtualization, keyboard-viewport reactions), it is drained after adapter
   commit (not in an independent rAF that races React/Vue's own render), and overlay placement
   on the floor is CSS-only with no scheduler involvement. Without this the three files describe
   two different overlay engines.

### SHOULD fix

3. **Correct the two V8 dates.** "Fast properties in V8" is published 2017-08-30 (not 08-23);
   "Trash talk" is 2019-01-03 (not 01-09). The brief requires dated citations; dates must be
   right.

4. **LoAF is Chromium-only.** `PerformanceLongAnimationFrameTiming` is Chrome 123, no Firefox or
   Safari (BCD). The file presents LoAF attribution as the acceptance evidence; name the
   cross-engine substitute (Event Timing API + Firefox Profiler / Safari Timelines) so the
   protocol can run on the three engines it claims to compare.

5. **Long filtering work needs a yield strategy, not only a scheduler.** A 10,000-item
   combobox filter is the one place the engine itself can block input. `scheduler.yield()`
   (Chrome 129 / Firefox 142 / Safari none) and `isInputPending()` (Chrome only) are the
   platform tools; state the policy (chunk filters above a measured size, yield between chunks
   via `scheduler.yield` when present, `setTimeout(0)`/`MessageChannel` otherwise, and never
   delay the keystroke echo itself). Cross-reference research 06 for the ranking cost.

6. **CSS containment is missing.** `contain: layout paint` (or `content`) on overlay panels and
   on list rows (Safari 15.4+, widely available) bounds layout invalidation for exactly the
   collection updates the first section worries about, and `contain-intrinsic-size` (Safari 17+)
   is the partner of `content-visibility`. One paragraph, with the caveat that `contain: size`
   on auto-height items is wrong.

7. **Pointer Events over touch listeners.** The passive-listener discussion is framed around
   `touchstart`/`touchmove`; the engine should use `pointerdown`/`pointermove` (Safari 13+) plus
   `touch-action` to declare scroll intent, which removes most of the passive/active question
   from component code. Keep touch listeners only for gesture recognizers that need multi-touch.

8. **`content-visibility: auto` Safari caveat.** BCD records Safari 18–26 as partial (skipped
   content not findable in find-in-page), full in Safari 26; Baseline Newly available
   2025-09-15 per web.dev. Add to the section since the file otherwise cites only the Chromium
   demo.

### Nice to have

9. `focus({ preventScroll: true })` + an explicit `scrollIntoView({ block: 'nearest' })` with
   `scroll-margin` on items avoids the double-scroll jank in roving focus; one line in the
   virtualization list.

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## 06-math-ml.md — verdict: **FAIL** (two correctness MUSTs; the judgement calls are right)

**What is right (verified):** Floating UI is MIT and is cited as studied reference only, with the
middleware-order observation; BM25 citation (Robertson & Zaragoza 2009, DOI 10.1561/1500000019);
Speculation Rules semantics (prefetch vs prerender cost, `Sec-Purpose`, `Document.prerendering`)
match MDN; WebNN is still a W3C working document; APG typeahead definition. Every verdict in the
hype register is correct and well argued: fuzzy typeahead rejected on APG grounds, learned row
heights rejected because measurement is exact, runtime kind inference rejected because the
declared `kind` is the contract, ML out of the core behind an ADR with artifact sizes. The
"combobox filtering may rank, listbox/menu typeahead must be prefix" distinction is the single
most important sentence in the file and must survive into ARCHITECTURE.md. The virtualization
formulas (fixed-size index, prefix offsets + binary search) are correct.

### MUST fix

1. **Manual scroll-anchor correction fights native scroll anchoring.** The variable-size section
   says "correct scroll anchoring only when the changed item is above the visible start". CSS
   scroll anchoring (`overflow-anchor`, Chrome 56 / Firefox 66 / Safari 27, 2026-09-14) already
   adjusts scroll position when content above the viewport changes size; an engine that also
   corrects will double-correct in Chromium/Firefox and single-correct in Safari < 27. The
   native-first ladder applies: rely on native anchoring where present, set
   `overflow-anchor: none` on the scroller when the engine corrects manually, and never do both.
   State which, and note that the spacer/padding technique for virtualization must keep an
   anchor node candidate in the DOM or native anchoring has nothing to anchor to.

2. **The fallback positioning pipeline must speak the CSS anchor vocabulary, or the component
   contract needs two placement policies.** Hard constraint 7 requires one machine-readable
   contract; research 01 makes CSS anchor positioning primary; this file designs the fallback
   with its own "preferred and alternate placements in logical coordinates". Specify that the
   fallback accepts exactly the `position-area` keywords, the `position-try-fallbacks` ordered
   list (including `flip-block`/`flip-inline`), and the `position-visibility` values
   (`anchors-visible`, `no-overflow`) as its inputs, so a component declares one placement policy
   that compiles to CSS on the floor and to the geometry pipeline below it, and parity tests can
   assert the same candidate is chosen on both paths for the same rectangles. Step 4 ("choose
   the first valid declared fallback, or minimum overflow") already mirrors the spec's try-
   fallback algorithm; say so and cite §position-try-fallbacks.

### SHOULD fix

3. **Cite Levenshtein's primary record.** levenshtein.net is a third-party commentary. The
   primary is V. I. Levenshtein, "Binary codes capable of correcting deletions, insertions, and
   reversals", Soviet Physics Doklady 10(8):707–710, 1966 (Russian original: Doklady Akademii
   Nauk SSSR 163(4):845–848, 1965). The brief requires primary sources.

4. **Speculation Rules support is Chromium-only and the section does not say so.** BCD:
   Chrome 109 (same-origin prerender only in 105–109), Firefox preview with prefetch-of-URL-list
   only, Safari 26.2 behind a flag; `Document.prerendering` Chrome 108 only. `<link
   rel="prefetch">` is the cross-engine primitive (Safari behind a flag). This does not change
   the recommendation (app-level, intent only) but the words "safe-ish browser mechanism" imply a
   portability it lacks.

5. **Word-prefix matching needs `Intl.Segmenter` for scripts without spaces.** The ranker's
   "word-prefix in original order" tier is undefined for CJK and Thai without segmentation;
   `Intl.Segmenter` (Chrome 87 / Safari 14.1 / Firefox 125) is the dependency-free answer and
   belongs next to `Intl.Collator`. State that segmentation is done once at index time, not per
   keystroke.

6. **Date arithmetic is the largest piece of math in the brief's "engine + presets (calendar)"
   and is absent.** With zero runtime dependencies the calendar engine cannot import date-fns or
   Luxon. State the policy: `Temporal` where available (Chrome 144 / Firefox 139, Safari preview
   only, so not on the floor), otherwise owned UTC-noon-anchored day arithmetic with
   `Intl.DateTimeFormat` for week-start, month names, and numbering systems, and
   `Intl.DateTimeFormat().resolvedOptions()`/`Intl.Locale` `getWeekInfo()` for first-day-of-week.
   Name the DST and calendar-system (Gregorian only?) boundaries of the owned code.

### Nice to have

7. Name the studied fuzzy scorers with licences, as the brief asks for references: fzf's
   algorithm (MIT), VS Code's `fuzzyScorer` (MIT), Sublime-style scoring; one line each on what
   the owned ranker takes from them (bonus for word-boundary and camel-case hits, gap penalties).
8. Component-level prefetch intent: an explicit `prefetch` intent event on trigger focus/hover
   for async option lists is the one deterministic prefetch that belongs *in* a component
   (combobox with remote options); the section covers only navigation.

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## 07-testing-certification.md — verdict: **FAIL** (two MUSTs; the protocol design is the right shape)

**What is right (verified):** ACT Rules Format 1.1 published February 2026 and the "automated,
semi-automated, and manual" quote; Playwright Apache-2.0, axe-core MPL-2.0, both test-only;
Playwright actionability vs `dispatchEvent`; Playwright WebKit ≠ branded Safari; `toHaveScreenshot`
environment variance; ARIA-AT. The six-layer structure maps one-to-one onto the brief's list.
The strongest decisions, which must carry into ARCHITECTURE.md: one versioned semantic spec
drives reducer tests, all three adapter suites, the registry contract, and the manual AT
assertions; invariants over snapshots; axe results phrased as "zero detected violations in these
states", never conformance; "incomplete" triaged, never dropped; exceptions with owner and
expiry; flaky tests are failures, retries diagnose and never certify; the P1 AT run happens on the
release candidate; the per-release evidence manifest.

### MUST fix

1. **The floor is never tested.** Research 01 (after its MUST 4) will fix a browser floor
   below current stable; this file's gates run Playwright's latest engines plus "stable branded
   Safari/Chrome/Edge". Nothing executes the fallback paths on a browser that actually lacks the
   feature, so every "supported from Safari N" claim in the contract is unevidenced. Specify
   both halves: (a) feature detection in the engine is injectable (`supports` map overridable per
   test) so Chromium runs the fallback paths deterministically in CI, and the parity matrix
   carries a `path: native | fallback` column; (b) a floor lane runs the interaction suite on real
   floor browsers (device lab or hosted real devices for iOS N and Android/Chrome N; a pinned
   old WebKit build is not a substitute for iOS Safari because the floor claim is about iOS), at
   least per release and on changes to any component with a fallback. Without (a), fallback code
   is tested only when a tester happens to have an old phone; without (b), (a) proves the code
   runs, not that the browser behaves.

2. **WCAG 2.2 AA is the floor and the file delegates 2.2 to axe, which covers one criterion.**
   axe-core's rule list (develop branch, retrieved 2026-10-27) has exactly one WCAG 2.2 rule,
   `target-size` (SC 2.5.8), and it is disabled by default. "Configure the WCAG 2.2 A/AA rules
   supported by the pinned axe version" therefore enables one rule. The semantic-assertion list
   must name executable checks for the 2.2 criteria that apply to components: 2.4.11 Focus Not
   Obscured (after every focus move, intersect the focused element's rect with sticky/fixed/
   top-layer siblings and assert non-zero visible area); 2.4.13 Focus Appearance as a tokenized
   contrast + area check on the focus indicator (AAA, but the brief says "visible focus"; state
   the chosen floor); 2.5.7 Dragging (every drag fixture has a single-pointer alternative
   exercised); 2.5.8 (enable axe `target-size` and add a bounding-box ≥ 24 px check with the
   spacing exception, since the axe rule returns many "needs review" results); 3.3.7 Redundant
   Entry and 3.3.8 Accessible Authentication at the preset level where forms/OTP are involved.
   Say which are PR gates and which are release gates.

### SHOULD fix

3. **Use the accessibility-tree assertions Playwright already has.** `expect(locator)
   .toMatchAriaSnapshot()` (role/name YAML, Playwright ≥ 1.49) and `getByRole` are the direct
   tool for "assert relationships, not DOM" and for the parity matrix (one aria snapshot per
   state, shared across the three adapters). Note the limit: Playwright computes names itself;
   for the browser's own tree use CDP `Accessibility.getFullAXTree` in Chromium and treat Firefox/
   WebKit as manual-AT territory.

4. **IME tests have no automation path.** Research 03 requires real IME coverage; Playwright's
   `keyboard.press` cannot compose. State: Chromium via CDP `Input.imeSetComposition` /
   `insertText` for the automated composition sequences (start, update, commit, cancel, Enter
   during composition), and physical-device manual runs (Gboard, iOS Japanese/Chinese keyboards)
   in the AT protocol for Firefox/WebKit, where no driver exists.

5. **"Property/invariant tests" names no generator.** The listed invariants are assertions;
   the value of a reducer core is model-based testing: random action sequences from the spec's
   action set checked against the invariants after every step, with shrinking. fast-check (MIT)
   is the test-only tool; say so, and require the generator to cover disabled/removed items and
   controlled rejection, which hand-written sequences rarely reach.

6. **Scripted real-AT runs are possible for part of the matrix.** Guidepup (MIT) drives
   VoiceOver on macOS and NVDA on Windows from Playwright and returns spoken phrases; it can run
   the NVDA and macOS VoiceOver rows of the P1 matrix in CI on self-hosted runners, with the
   manual protocol kept for JAWS, iOS, and Android. Position it as a regression net under the
   manual protocol, not a replacement, consistent with the ARIA-AT caveat already in the file.

7. **Token-level contrast is a build-time test, not an axe scan.** The DS already exposes
   `check_contrast`; every `variant × tone × size` text/background and focus-indicator pair in
   the token set should be asserted against the 4.5:1 / 3:1 floors at build time, so a token
   change fails before any component renders. One sentence in Layer 3 or in the PR gates.

8. **Visual baselines: name the font strategy.** "Local pinned fonts" conflicts with the
   repo's self-hosted brand fonts only if the test fixtures load a different set; say the
   fixtures load the production font files with `font-display: block` and that baselines are
   per `engine × platform × DPR`.

### Nice to have

9. Validate the component contract against a JSON Schema in CI and generate `registry.json`
   from it in the same job, so the "contract is the source" claim is enforced, not stated.
10. The evidence manifest should carry the BCD/Baseline dataset version used for support
    claims, since this audit's own verification depends on it.

**Re-audit trigger:** resubmit with `STATUS: DRAFT-COMPLETE` restored at the end of the file.

---

## Round 1 summary

| File | Verdict | MUST | SHOULD | Headline |
|---|---|---|---|---|
| 01 platform primitives | FAIL | 5 | 4 | `requestClose()` fallback has its own gap; `popover=hint` unstable; no `<select>` versions; no browser floor; no top-layer nesting rules |
| 02 headless engine | FAIL | 3 | 5 | Effect timing vs render commit; props-in direction; compound item registration |
| 03 a11y engine | FAIL | 3 | 4 | No VoiceOver iOS / TalkBack quirks; Android `keyCode` 229; select-only combobox focus strategy |
| 04 mobile input | FAIL | 3 | 5 | `enterkeyhint` per kind; `dvh`/`interactive-widget`; iOS 16 px focus zoom |
| 05 performance | FAIL | 2 | 6 | No absolute gates; scheduler contradicts 01/02 |
| 06 math & ML | FAIL | 2 | 4 | Manual scroll anchoring fights `overflow-anchor`; fallback must use CSS anchor vocabulary |
| 07 testing | FAIL | 2 | 6 | Floor never tested; axe covers one WCAG 2.2 criterion |

**Cross-file decisions that need one owner before ARCHITECTURE.md** (each is currently
answered differently, or not at all, by two files):

1. **Browser floor** (01 MUST 4 → consumed by 02 bundle budgets, 05 gates, 07 floor lane).
2. **Overlay engine**: CSS anchor positioning primary (01), geometry fallback vocabulary (06 MUST 2),
   scheduler scope and commit timing (05 MUST 2, 02 MUST 1).
3. **Collection model**: item registration and ordering (02 MUST 3) ↔ `aria-activedescendant`
   across the top layer and virtualization (03 MUST 3, 05 virtualization, 06 MUST 1).
4. **Focus strategy table** per composite including the select-only combobox (03 MUST 3) and the
   `:focus-visible`-after-programmatic-focus policy (03 SHOULD 5), consumed by 07's 2.4.11/2.4.13
   assertions.
5. **Typeahead input source**: `keydown` vs `beforeinput` (03 MUST 2) ↔ reducer event vocabulary
   (02) ↔ test automation path (07 SHOULD 4).

**Accuracy record.** Of roughly 70 dated support or citation claims checked against BCD 8.1.7,
spec text, or the cited page, 6 were wrong or misattributed: `popover=hint` stability (01), the
NVDA issue version/OS/closure (03), WebKit 231724 open date (03), both V8 blog dates (05), and the
Levenshtein primary source (06). None of the six changes a recommendation on its own; the FAILs
are for omissions the brief explicitly required, and for the cross-file contradictions above.

**What passes as a body of work.** The native-first ladder, modal-vs-popover split, reducer core
with effect descriptors, prop getters with consumer-first cancellation, `useId`-rooted ids,
roving-vs-activedescendant rules, unmasked phone editing, exact-decimal money, the folklore
register, deterministic typeahead vs ranked search, ML behind an ADR, and the six-layer
certification with an evidence manifest are consistent with every hard constraint in the brief
and should be lifted into ARCHITECTURE.md unchanged once the MUSTs land.

AUDIT-ROUND-1 DONE
