# 04 — Mobile and input UX

**Research date:** 2026-10-27. Input attributes are hints to the browser unless a constraint-validation rule is explicitly named. Device keyboards, autofill, correction, and pickers remain user-agent controlled; the architecture must verify physical-device behavior rather than treating an attribute as a guarantee.

## Attribute semantics

`inputmode` selects an appropriate virtual-keyboard layout and does **not** enforce validity. `decimal` may expose a locale decimal separator and may omit minus; `numeric` targets digits; telephone fields should normally use `type="tel"` ([MDN `inputmode`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)).

`autocomplete` declares the field’s actual autofill purpose using standardized tokens. It supports section, shipping/billing, recipient, and field tokens; valid tokens also support WCAG 1.3.5 Identify Input Purpose. `off` should not be used as a generic security/autofill suppressor, and password managers may ignore it ([MDN `autocomplete`, updated 2026-08-27](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete); [WHATWG autofill tokens, retrieved 2026-10-27](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)).

`enterkeyhint` chooses the virtual Enter-key action label, `autocapitalize` controls capitalization, `autocorrect` requests correction behavior, and `spellcheck` requests spelling checks. They are input behavior hints, not data transforms or validation ([MDN global attributes, updated 2026-10-26](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes); [MDN `enterkeyhint`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint); [MDN `autocapitalize`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocapitalize); [MDN `autocorrect`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocorrect)).

## Recommended intent-to-native mapping

“Default” below means library preset; consumers may override attributes when the declared data semantics remain true. Autofill fields have a stable `name`/`id`, an owning `<form>`, and a visible label. For autocomplete address/contact fields, add appropriate section/group tokens rather than duplicating one value across unrelated people ([MDN `autocomplete`, 2026-08-27](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)).

The **form owner**, not an isolated Field, computes `enterkeyhint`: `next` when another editable field follows; `done` on the last field of a non-submitting group; `go` when Enter performs navigation/submission; `send` for messaging; `search` for query submission. Kind overrides include URL→`go`, Search→`search`, and OTP→`done` when auto-submit is off / `go` when on ([MDN `enterkeyhint`, updated 2026-04-17](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint)).

| Intent `kind` | `type` | `inputmode` | `autocomplete` | `enterkeyhint` | Other native defaults |
|---|---|---|---|---|---|
| Free text | `text` | `text` | Context token or `on` | Form position | `autocapitalize="sentences"`, `autocorrect="on"`, `spellcheck="true"` |
| Person full name | `text` | `text` | `name` | Usually `next` | `autocapitalize="words"`, `autocorrect="off"`, `spellcheck="false"` |
| Given/family name | `text` | `text` | `given-name` / `family-name` | Form position | Same as person name |
| Username | `text` | `text` | `username` | Form position | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| Email | `email` | `email` | `email` | Form position | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| URL | `url` | `url` | `url` when autofill is meaningful | `go` | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| Phone | `tel` | `tel` | `tel`, or a specific `tel-*` part | Form position | `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` |
| Numeric OTP | `text` | `numeric` | `one-time-code` | `done` / `go` by auto-submit | `autocapitalize="none"`, correction/spelling off; optional ASCII-digit `pattern`; length validated after normalization |
| Alphanumeric OTP | `text` | `text` | `one-time-code` | `done` / `go` by auto-submit | `autocapitalize="characters"` only if canonical form is uppercase; correction/spelling off |
| Decimal amount | `text` | `decimal` | `transaction-amount` only in that payment context | Form position | `autocorrect="off"`, `spellcheck="false"`; locale-aware parser; no spinbutton |
| Integer quantity | `number` when stepping helps, otherwise `text` | `numeric` for text variant | Context token or `off` | Form position | `min`/`max`/`step` for number variant; never use number semantics for identifiers |
| Postal/account/reference code | `text` | `numeric` only when digits-only by contract | `postal-code` or appropriate token | Form position | Preserve leading zeroes; no `type="number"` or `maxlength` |
| Search | `search` | `search` | Usually `off` for a transient query | `search` | Correction/spelling according to domain |
| Current password | `password` | `text` | `current-password` | Form position | `autocapitalize="none"`, correction/spelling off |
| New/confirmed password | `password` | `text` | `new-password` | Form position | Same; use distinct section tokens if needed |
| Date | `date` | Not applicable | `bday` only for an actual birth date | Form position | Native picker; normalized `yyyy-mm-dd` value |
| Time | `time` | Not applicable | Context token or `off` | Form position | Native picker; `step` when needed |
| Native single choice | `<select>` | Not applicable | Actual purpose token | Form position | Native option/picker; no ARIA listbox recreation |
| Card number | `text` | `numeric` | `cc-number` | Form position | Never `type="number"`; normalize then validate/checksum |
| Card expiry | `text` | `numeric` | `cc-exp` | Form position | Accept only contract-supported separators; validate after normalization |
| Card expiry month/year | `text` | `numeric` | `cc-exp-month` / `cc-exp-year` | Form position | Preserve two-digit month and leading zeroes where applicable |
| Card security code | `text` | `numeric` | `cc-csc` | Usually `done` | Correction/spelling off; never `type="number"` |
| Cardholder name | `text` | `text` | `cc-name` | Form position | `autocapitalize="words"`, correction/spelling off |
| Street address | `textarea` | `text` | `street-address` | Form position | Use `address-line1..3` instead when separate lines are required |
| Address line 1–3 | `text` | `text` | `address-line1` / `address-line2` / `address-line3` | Form position | Do not combine with `street-address` |
| Country | `text` | `text` | `country` for code, `country-name` for name | Form position | Do not infer country from keyboard locale |
| Organization | `text` | `text` | `organization` | Form position | `autocapitalize="words"` as a hint only |
| Tax/reference ID | `text` | `numeric` only when digits-only by contract | `off` (no standard tax token) | Form position | Preserve leading zeroes; normalize then validate check digit |

The OTP, phone, postal/reference, and amount presets deliberately avoid `type="number"`. MDN recommends number only for incremental numeric values and warns that spinbutton behavior and invalid-character handling are problematic for identifiers ([MDN number input, updated 2026-10-14](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)). OTP remains one text control so paste and autofill can fill the complete code; split-character inputs require extra paste, focus, screen-reader, and deletion logic and are not the default.

## One-time codes

The standardized `autocomplete="one-time-code"` identifies an out-of-channel verification code ([WHATWG autofill tokens, retrieved 2026-10-27](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)). Use it with a named, labelled text input and numeric keyboard for numeric codes. Pattern guides the alphabet; expected length is validated **after** whole-value normalization. OTP does not use `maxlength`, because browser length limits can truncate a formatted paste before the engine sees it. These checks do not replace server verification, expiry, rate limiting, or replay protection ([MDN `maxlength`, updated 2026-04-20](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/maxlength)).

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

## Revision 1: declarative viewport and input boundaries

### Native viewport ladder

Use dynamic viewport units before JavaScript geometry: `dvh` tracks changing browser chrome, `svh` reserves the small/stable area for sticky action bars, and `lvh` is the large area. Chromium 108, Firefox 101, and Safari/iOS 15.4 support the family ([MDN `<length>` viewport units, updated 2026-07-08](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)). Do not use `dvh` for content that must not jump during chrome/keyboard transitions; use `svh` for those stable regions.

The viewport meta `interactive-widget` selects `resizes-visual` (visual only), `resizes-content` (visual and layout), or `overlays-content` (neither). Chrome Android 108 made visual-only the default; Firefox Android 133 supports the key, while iOS has no corresponding opt-in and behaves as visual-only ([Chrome viewport resize guidance, published 2022-10-27](https://developer.chrome.com/blog/viewport-resize-behavior); [MDN viewport meta, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)). A host choosing `resizes-content` gets declarative Android layout resizing; iOS and visual-only Android still need VisualViewport overlay math. JavaScript is the fallback for focus restoration and cases these declarations cannot express, not the first step.

### Prevent focus-triggered zoom through type tokens

iOS Safari zooms toward focused form controls whose computed font size is below 16 CSS pixels. Every input/select/textarea on touch therefore renders at **at least 16 CSS pixels computed size**, enforced by the size tokens and verified on device. Do not use `maximum-scale=1` or `user-scalable=no`: WCAG 1.4.4 requires 200% text resizing and WebKit itself ignores viewport scale limits to preserve pinch zoom ([reproducible iOS input-zoom issue, opened 2025-05-27](https://github.com/heroui-inc/heroui/issues/5326); [W3C Resize Text, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html); [WebKit iOS zoom behavior, published 2016-09-20](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/)). The verification matrix records computed font size and viewport scale before/after focus and blur.

### Keyboard locale versus app locale

For amount kinds, accept both `,` and `.` as decimal separators only when the value has exactly one separator and no grouping. If multiple separators occur, a separator followed by exactly three digits and then another separator is interpreted as grouping only when the complete grouping structure is valid; otherwise reject as ambiguous. Never prefill grouping characters into the editable value, and never silently strip punctuation. Test a Colombian app locale with an English keyboard and a Spanish keyboard with an `en` form, in both directions, alongside incomplete trailing separators.

Phone, amount, reference, tax, card, and OTP kinds do not use `maxlength`: enforce length after normalization so formatted paste is not truncated before inspection. The OTP paste/autofill path consumes the whole input first and only then removes allowed separators and validates length.

Material Design recommends 48×48 dp touch targets; the design-system 44-CSS-pixel preset exceeds WCAG's 24 floor but remains a preset, not a claim that 44 Android dp equals 44 CSS px. Validate Android density separately and preserve spacing between targets ([Material Design touch targets, retrieved 2026-10-27](https://m3.material.io/foundations/designing/structure)).

`autocorrect` support is still uneven: BCD records Chromium 153, Firefox 136, and Safari 14.1, so `off` is a best-effort hint rather than a cross-browser behavior guarantee ([BCD `autocorrect`, retrieved 2026-10-27](https://github.com/mdn/browser-compat-data/blob/main/html/global_attributes.json)). Field tests must verify that usernames, emails, codes, URLs, and phone values are not transformed even when the hint is ignored.

## Recommendations for ARCHITECTURE.md

1. **Make a declarative `kind -> native attributes` table part of every field’s machine-readable contract, with `enterkeyhint` supplied by the form owner.** Start with the mapping above and let explicit props refine autocomplete/Enter action. *Trade-off:* the table needs device-level certification and occasional overrides, but wrong keyboards and autocapitalization become systematic defects rather than repeated app mistakes.
2. **Use single text inputs for OTP and identifiers, `tel` for phone, and number inputs only for true incremental quantities.** *Trade-off:* numeric-looking identifiers lose spinbuttons and native number validation, which is desirable; quantity presets choose between native stepping and exact text parsing explicitly.
3. **Default phone editing to unmasked input with formatting on blur/preview and no `maxlength` before normalization.** Require caret-mapping and paste tests for any live mask. *Trade-off:* less visual guidance while typing in exchange for robust international entry and autofill.
4. **Separate localized editing text from canonical numeric value; use `Intl` for formatting and an owned deterministic parser for input.** *Trade-off:* parser and locale fixtures add code, but silent corruption from `parseFloat`, punctuation stripping, or binary money arithmetic is avoided.
5. **Use native date/time/select on touch by default; require a capability statement before custom picker/listbox UI.** *Trade-off:* cross-platform visual consistency yields to platform UX and lower accessibility risk.
6. **Adopt a tokenized 44-CSS-pixel touch preset, 24-CSS-pixel WCAG floor, and non-drag alternatives, checking Android's separate 48-dp guidance.** *Trade-off:* dense desktop layouts need a separate density preset rather than shrinking touch usability.
7. **Use `svh`/`dvh` and `interactive-widget` first, then VisualViewport for residual keyboard-aware overlay behavior; never make VirtualKeyboard API a prerequisite.** *Trade-off:* host and iOS/Android resize models still need tests, but declarative sizing handles the common cases without JavaScript.
8. **Set touch input type tokens to at least 16 CSS pixels computed size without disabling user zoom.** *Trade-off:* compact desktop and touch typography need different presets, but focus no longer causes an avoidable viewport jump.

STATUS: REVISION-1