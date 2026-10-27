# 04 — Mobile and input UX

**Research date:** 2026-10-27. Input attributes are hints to the browser unless a constraint-validation rule is explicitly named. Device keyboards, autofill, correction, and pickers remain user-agent controlled; the architecture must verify physical-device behavior rather than treating an attribute as a guarantee.

## Attribute semantics

`inputmode` selects an appropriate virtual-keyboard layout and does **not** enforce validity. `decimal` may expose a locale decimal separator and may omit minus; `numeric` targets digits; telephone fields should normally use `type="tel"` ([MDN `inputmode`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)).

`autocomplete` declares the field’s actual autofill purpose using standardized tokens. It supports section, shipping/billing, recipient, and field tokens; valid tokens also support WCAG 1.3.5 Identify Input Purpose. `off` should not be used as a generic security/autofill suppressor, and password managers may ignore it ([MDN `autocomplete`, updated 2026-08-27](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete); [WHATWG autofill tokens, retrieved 2026-10-27](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)).

`enterkeyhint` chooses the virtual Enter-key action label, `autocapitalize` controls capitalization, `autocorrect` requests correction behavior, and `spellcheck` requests spelling checks. They are input behavior hints, not data transforms or validation ([MDN global attributes, updated 2026-10-26](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes); [MDN `enterkeyhint`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint); [MDN `autocapitalize`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocapitalize); [MDN `autocorrect`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocorrect)).

## Recommended intent-to-native mapping

“Default” below means library preset; consumers may override attributes when the declared data semantics remain true. `enterkeyhint` should reflect the real next action, not always `next`. For autocomplete address/contact fields, add the appropriate section/group tokens rather than duplicating one value across unrelated people.

| Intent `kind` | `type` | `inputmode` | `autocomplete` | Other native defaults |
|---|---|---|---|---|
| Free text | `text` | `text` | Context token or `on` | `autocapitalize="sentences"`, `autocorrect="on"`, `spellcheck="true"` |
| Person full name | `text` | `text` | `name` | `autocapitalize="words"`, `autocorrect="off"`, `spellcheck="false"` |
| Given/family name | `text` | `text` | `given-name` / `family-name` | Same as person name |
| Username | `text` | `text` | `username` | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| Email | `email` | `email` | `email` | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| URL | `url` | `url` | `url` when autofill is meaningful | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| Phone | `tel` | `tel` | `tel`, or a specific `tel-*` part | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| Numeric OTP | `text` | `numeric` | `one-time-code` | `maxlength` from contract; `autocapitalize="none"`, correction/spelling off; optional ASCII-digit `pattern` |
| Alphanumeric OTP | `text` | `text` | `one-time-code` | `autocapitalize="characters"` only if canonical form is uppercase; correction/spelling off |
| Decimal amount | `text` | `decimal` | `transaction-amount` only in that payment context | `autocorrect="off"`, `spellcheck="false"`; locale-aware parser; no spinbutton |
| Integer quantity | `number` when stepping helps, otherwise `text` | `numeric` for text variant | Context token or `off` | `min`/`max`/`step` for number variant; never use number semantics for identifiers |
| Postal/account/reference code | `text` | `numeric` only when digits-only by contract | `postal-code` or appropriate token | Preserve leading zeroes; no `type="number"` |
| Search | `search` | `search` | Usually `off` for a transient query | `enterkeyhint="search"`; correction/spelling according to domain |
| Current password | `password` | `text` | `current-password` | `autocapitalize="none"`, correction/spelling off |
| New/confirmed password | `password` | `text` | `new-password` | Same; use distinct section tokens if needed |
| Date | `date` | Not applicable | `bday` only for an actual birth date | Native picker; normalized `yyyy-mm-dd` value |
| Time | `time` | Not applicable | Context token or `off` | Native picker; `step` when needed |
| Native single choice | `<select>` | Not applicable | Actual purpose token | Native option/picker; no ARIA listbox recreation |

The OTP, phone, postal/reference, and amount presets deliberately avoid `type="number"`. MDN recommends number only for incremental numeric values and warns that spinbutton behavior and invalid-character handling are problematic for identifiers ([MDN number input, updated 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)). OTP remains one text control so paste and autofill can fill the complete code; split-character inputs require extra paste, focus, screen-reader, and deletion logic and are not the default.

## One-time codes

The standardized `autocomplete="one-time-code"` identifies an out-of-channel verification code ([WHATWG autofill tokens, retrieved 2026-10-27](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)). Use it with a named, labelled text input and numeric keyboard for numeric codes. `maxlength` and pattern guide/validate length and alphabet; they do not replace server verification, expiry, rate limiting, or replay protection.

Accept the complete pasted/autofilled string in one input transaction, normalize only characters explicitly allowed by the contract, and submit from the resulting value rather than a stale pre-input snapshot. Do not disable autocomplete for OTP. WebOTP-specific APIs are optional enhancements, not the baseline, because the portable autofill contract already covers the main UX.

## Phone formatting without damaging input

`type="tel"` supplies telephone semantics and keyboard but does not impose an international format or validate a particular phone syntax ([MDN tel input, updated 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/tel)). Therefore:

1. Keep the editing value as user-entered text; preserve leading `+`, extension markers, and valid non-digit separators until validation.
2. Do not reflow the value into national groups on every keystroke by default. Group for display on blur or in a separate formatted preview.
3. On paste/autofill, process the whole string once; never synthesize per-digit key events or move focus among cells.
4. If a product explicitly requires live formatting, record selection/caret before transformation, map it to the corresponding logical digit afterward, and never rewrite while IME composition is active. `setSelectionRange` exposes native selection control, but it does not solve the logical mapping for the author ([MDN `setSelectionRange`, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setSelectionRange)).
5. Validate with a declared default region and explicit country/region control where necessary; do not infer country from keyboard locale. Store a canonical value separately from the presentation string.

The trade-off is that default editing looks less “formatted” than a mask, but cursor jumps, deletion errors, broken paste, and ambiguous national assumptions are avoided. Masks are acceptable only for genuinely fixed-format local identifiers, not international phone numbers.

## Locale-aware numbers and currency

`Intl.NumberFormat` provides locale-sensitive decimal/currency formatting, including locale digits and separators ([MDN `Intl.NumberFormat`, updated 2025-07-10](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)). Use `formatToParts` to discover grouping/decimal characters for display/parser policy rather than maintaining a hand-written locale table ([MDN `formatToParts`, updated 2025-07-10](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts)).

Formatting and parsing are different jobs. `Intl.NumberFormat` formats canonical numbers; it does not turn arbitrary localized input into an exact decimal. A small owned parser should:

- accept the active locale’s decimal separator and, optionally, the unambiguous ASCII decimal form;
- remove only recognized grouping separators after checking their placement;
- preserve an incomplete editing state (`-`, trailing separator, empty) separately from a committed numeric value;
- reject ambiguous/group-invalid input rather than silently deleting punctuation;
- keep money in integer minor units or an exact decimal-string model when arithmetic precision matters; JavaScript binary `Number` is not exact decimal storage ([ECMA-262 Number type, 2026 edition](https://tc39.es/ecma262/#sec-ecmascript-language-types-number-type)).

Use `type="number"` when native spinbutton/min/max/step semantics help and locale behavior passes target-device tests; use `text + inputmode="decimal"` for currency/exact decimal editing. The latter needs an owned parser, so it is not automatically superior for every quantity.

## When native pickers win

Use native date/time inputs and `<select>` by default, especially for coarse-pointer/touch users. They provide platform keyboard/picker behavior, form participation, constraint validation, and mobile interaction without a custom grid/listbox. Native date values normalize to `yyyy-mm-dd` independently of display format ([MDN date input, updated 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date)).

A custom calendar is justified by capabilities such as range selection with cross-month constraints, unavailable-date visualization, week numbers, multi-month comparison, or complex availability—not by a desire to make pixels identical across operating systems. Even then, retain text entry or a native alternative where practical, full grid keyboard behavior, locale/week-start rules, and physical-device AT tests.

A custom combobox/listbox is justified for filtering, asynchronous suggestions, rich non-interactive descriptions, or values beyond native option capabilities. It is not justified for a short fixed single-choice list. On touch, prefer a native select even when desktop uses a customized trigger if the contracts can remain equivalent; test that switching presentation does not change accessible name/value or form state.

## Touch targets and gestures

WCAG 2.2 SC 2.5.8 requires pointer targets at least 24 by 24 CSS pixels, subject to spacing, equivalent-control, inline, user-agent, and essential exceptions; it explicitly recommends larger targets and considering the enhanced criterion for important controls ([W3C Understanding Target Size Minimum, WCAG 2.2 updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Apple separately recommends a 44 by 44 point hit region for buttons ([Apple Human Interface Guidelines, retrieved 2026-10-27](https://developer.apple.com/design/human-interface-guidelines/buttons)).

Set the design-system touch preset to a tokenized **44 CSS-pixel minimum target** where layout permits, with WCAG 24 as the absolute conformance floor, not the desired UX. The icon may remain smaller; the interactive hit area and spacing count. Do not enlarge overlapping pseudo-element hit areas over neighboring targets.

Every drag interaction needs a single-pointer non-drag alternative under WCAG 2.2 SC 2.5.7 ([W3C Understanding Dragging Movements, 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)). Hover is never the only trigger, long-press never the only route, and swipe actions need visible/button alternatives.

## Virtual keyboard and viewport

The layout viewport is the CSS layout box; the visual viewport is the currently visible region. An on-screen keyboard can shrink the visual viewport without changing the layout viewport, and `window.visualViewport` exposes dimensions, offsets, scale, `resize`, and `scroll` events ([MDN Visual Viewport API, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)). Therefore `100vh` and `position: fixed` alone cannot prove that an input, focused option, or action bar remains visible.

Use this layered policy:

1. Allow the browser’s normal focus/scroll behavior first; avoid preventing focus/touch defaults.
2. Size overlay content against available visual viewport and cap internal list height; keep focused controls out of sticky/keyboard occlusion.
3. On `visualViewport.resize`, recompute only affected overlay geometry and ensure the active input/item is visible. Batch reads/writes in one animation frame; do not move the whole page on every keystroke.
4. Keep scroll ownership in the active overlay/list, not simultaneous body and popup scrolling. Restore prior scroll on close.
5. Test hardware keyboard, software keyboard, rotation, pinch zoom, browser chrome collapse, split-screen, and keyboard accessory bars.

`navigator.virtualKeyboard.overlaysContent = true` opts out of automatic browser resizing and exposes keyboard geometry, but the VirtualKeyboard API is experimental, secure-context only, and limited availability ([MDN VirtualKeyboard API, updated 2025-11-06](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API)). Do not enable overlay mode globally as a “polyfill”; it shifts keyboard avoidance entirely to the library and can break pages without the API. It is an opt-in enhancement only after VisualViewport behavior works.

## Verification matrix

For each field kind, test current iOS Safari and Android Chrome on physical devices, plus desktop keyboard: correct keyboard; minus/decimal availability; Enter label/action; autofill; paste full value; selection/caret; deletion; IME; leading zeroes; empty/incomplete states; rotation; keyboard-open focus visibility; validation/error announcement; and form submission/reset. Record browser/OS versions because keyboard behavior is user-agent controlled.

## Recommendations for ARCHITECTURE.md

1. **Make a declarative `kind -> native attributes` table part of every field’s machine-readable contract.** Start with the mapping above and let explicit props refine autocomplete/Enter action. *Trade-off:* the table needs device-level certification and occasional overrides, but wrong keyboards and autocapitalization become systematic defects rather than repeated app mistakes.
2. **Use single text inputs for OTP and identifiers, `tel` for phone, and number inputs only for true incremental quantities.** *Trade-off:* numeric-looking identifiers lose spinbuttons and native number validation, which is desirable; quantity presets choose between native stepping and exact text parsing explicitly.
3. **Default phone editing to unmasked input with formatting on blur/preview.** Require caret-mapping and paste tests for any live mask. *Trade-off:* less visual guidance while typing in exchange for robust international entry and autofill.
4. **Separate localized editing text from canonical numeric value; use `Intl` for formatting and an owned deterministic parser for input.** *Trade-off:* parser and locale fixtures add code, but silent corruption from `parseFloat`, punctuation stripping, or binary money arithmetic is avoided.
5. **Use native date/time/select on touch by default; require a capability statement before custom picker/listbox UI.** *Trade-off:* cross-platform visual consistency yields to platform UX and lower accessibility risk.
6. **Adopt a tokenized 44-CSS-pixel touch preset, 24-CSS-pixel WCAG floor, and non-drag alternatives.** *Trade-off:* dense desktop layouts need a separate density preset rather than shrinking touch usability.
7. **Build keyboard-aware overlays on VisualViewport with capped internal scrolling; never make VirtualKeyboard API a prerequisite.** *Trade-off:* geometry handling and physical-device tests remain necessary, but focused inputs/actions stay visible across browser resizing models.

STATUS: DRAFT-COMPLETE