---
id: form-elements
title: Form Elements
group: patterns
storybookTitle: Patterns/Form Elements
summary: The canonical, exhaustive form guide: native-first doctrine, the accent-color theming recipe, field anatomy, validation timing, the mobile keyboard contract, the a11y floor, and a per-control catalog of 25 controls
---

The spine is one rule: reach for the native control first, tune it with the right attributes, and build custom only where the platform genuinely falls short.

# Part 1: Doctrine, the rules under every field

## 1. Native-first, and doubly so on mobile

The default is always the plain HTML control with the right `type`, `inputmode`, and `autocomplete`. On a phone this is leverage: a semantic `<input type>` raises the correct on-screen keyboard, opens the platform picker, and arrives with keyboard support, focus handling, and screen-reader semantics already built in. MDN: prefer the semantic input type over hacks.

Go custom only when one of two things is true: the pattern does not exist in HTML (a real multi-select, a filtering combobox, tags, rating), or the brand must style something the platform will not let you style (the popup of a `<select>`, the calendar of a date picker). When you do, prefer desktop, keep a native control underneath as the progressive-enhancement base, and follow the matching WAI-ARIA APG pattern to the letter. On mobile, bias even harder toward native.

Native controls are hard to style, and that is the whole tension. web.dev: today's HTML form elements are difficult to customize. You can style the field box (border, radius, padding, type) of almost anything. What you cannot reliably restyle cross-browser is the `<select>` arrow and popup, and the date and time picker widgets. That single limit, not taste, is what pushes a control from native to custom.

The clearest case is a date. GOV.UK: for a date the user already knows or can look up without a calendar, such as a birthday or an issue date, do not open a calendar. Use three plain text inputs, grouped in a `<fieldset>` with a `<legend>`, each with `inputmode="numeric"`. Reserve the native calendar picker for dates the user picks by looking, like choosing a future session.

- ✓ Recommended: a memorable date, as three fields (day / month / year, each `inputmode="numeric"`).
- ✕ Avoid: a calendar for a birthday. A picker that opens on the current month forces the user to page back through decades to reach a year they could have typed.

## 2. Theming the accent without giving up native

You can brand native controls without rebuilding them. Three CSS properties carry it. Set them once at the root and every native checkbox, radio, range, and text caret in the product turns indigo, and every control follows the OS light or dark theme, with zero per-control work.

```css
:root {
  color-scheme: light dark;               /* native controls follow the OS theme */
  accent-color: var(--color-primary);     /* tints checkbox, radio, range, progress */
  caret-color: var(--color-primary);      /* the text insertion cursor */
}
<!-- in <head>, prevents a theme flash on load -->
<meta name="color-scheme" content="light dark">
```

Read the coverage exactly. `accent-color` tints four controls and nothing else. It does not touch `<select>`, the date and time inputs, `type="color"`, `type="file"`, or any text field. Getting this wrong is the usual reason a "themed" form still shows a stock blue selected option.

| Property | What it does | Reaches | Does not reach |
|----------|--------------|---------|----------------|
| `accent-color` | Tints the control's accent to the brand, keeping native behaviour | checkbox, radio, `range`, `progress` | select, date, time, color, file, text |
| `caret-color` | Colours the text insertion cursor | text, search, tel, email, password, textarea | date, color, checkbox, radio |
| `color-scheme` | Native controls adopt the OS dark or light look, no extra CSS | all native controls, scrollbars | your own custom colours |

**Trust the browser on accent contrast.** Provide the brand colour and the browser picks a legible checkmark or thumb colour against it. For the controls `accent-color` cannot reach, take the decision ladder: accept the native chrome (best on mobile), style only the field box and keep the native popup, or, only if the brand demands it, rebuild with the matching APG pattern on desktop with a native control underneath.

## 3. The anatomy of a field

A field is four parts, and dropping any one shifts the work onto the user. The label asks and stays visible. The control takes the answer. Help pre-empts the mistake. The error appears only when something is wrong, and says exactly how to fix it.

The label stays visible, above the field, never inside it. A placeholder is not a label: it vanishes the instant someone types, and screen readers treat it as unreliable. A single top-aligned column is the fastest form to scan.

Marking the required field is not optional decoration. The `*` is drawn with `aria-hidden`, and the word "required" rides along in an `sr-only` span. Pair the real `required` attribute with that text, and state the convention once at the top of the form.

**Mark the rarer one.** If most fields are required, mark the few optional ones in words; if most are optional, mark the required ones. An asterisk alone is not accessible, so pair it with text or an `aria-label` and state the convention once.

- ✓ Recommended: label above, help visible.
- ✕ Avoid: placeholder as the label. The question disappears the instant the user types, with nowhere left to put help.

## 4. Validate at the right moment, in the right words

Start from HTML constraint validation: `required`, `type`, `pattern`, `min`, `max`, `step`. It is free, works without JavaScript, and is the source of truth. Present its state with `:user-invalid` and `:user-valid`, not `:invalid` and `:valid`. The user variants only match after the person has interacted or tried to submit, which stops a pristine form from lighting up red on load.

```css
/* matches only after interaction, never on first paint */
input:user-invalid { border-color: var(--color-error); }
input:user-valid   { border-color: var(--color-success-strong); }
```

On timing, the rule is reward early, punish late. Confirm a field as valid while the user types, but hold a new error until they leave it. Once a field has already shown an error, switch that field to re-validate on every keystroke and clear the error the instant the value becomes valid.

- While typing: reward, never punish. Show a success tick the moment input becomes valid. Hold the first error back. After a field has erred, re-check on input and clear it the instant it is valid.
- On blur: now you may correct. Surface the inline error, right under the field.
- On submit: catch the rest. Re-check everything, move focus to the first error, summarise in a live region. Never let a form fail silently.

A good error message is visible and specific, says what went wrong in plain language, and tells the user how to fix it. "Invalid input" fails all three. "Enter a date after today, the event cannot start in the past" passes all three. WCAG 3.3.1 requires the error to be identified in text, so the field carries `aria-invalid="true"` and points at the message with `aria-describedby`. The colour reinforces; the words are the message.

**Errors use `--color-error`, the only warm colour on the page.** Everything interactive stays indigo; red's single job is to mark a genuine problem. Do not tint help text, borders, or icons red for emphasis.

## 5. Built for the thumb: the mobile contract

On a phone the `type` attribute is the biggest usability lever. It tells the OS which keyboard to raise. `inputmode` tunes that keyboard without changing meaning, `enterkeyhint` relabels the return key, and `autocomplete` lets the browser fill the field in one tap, which satisfies WCAG 1.3.5 Identify Input Purpose. Avoid `autocomplete="off"` except for genuine one-offs like a CAPTCHA answer.

| You are asking for | Use | Keyboard raised | Autofill token |
|--------------------|-----|-----------------|----------------|
| Email | `type="email"` | Text with a visible @, no shift | `autocomplete="email"` |
| Phone | `type="tel"` | Large numeric dial pad | `autocomplete="tel"` |
| Website | `type="url"` | Text with .com and / shortcuts | `autocomplete="url"` |
| One-time code | `inputmode="numeric"` | Digits only, text semantics kept | `autocomplete="one-time-code"` |
| Amount of money | `inputmode="decimal"` | Digits with a decimal separator | None |
| Quantity of tickets | `type="number"` | Number pad with stepper | None |
| Full name | `type="text"` | Standard, autocapitalized words | `autocomplete="name"` |
| Search | `type="search"` | Text with a Search return key | `enterkeyhint="search"` |

Two numbers are non-negotiable. Inputs render at `font-size: 16px` or larger, because iOS Safari auto-zooms any field below that on focus, and the fix is the size, never disabling `user-scalable`, which breaks zoom for everyone. Interactive targets are at least 24 by 24 CSS pixels to clear WCAG 2.5.8, and the comfortable goal is 44 by 44, the AAA target size and Apple's minimum. Native UA controls are exempt from the strict measure, one more reason to lean native on small screens.

Use the semantic `type` first and reach for `inputmode` to fine-tune. For SMS logins, `autocomplete="one-time-code"` lets iOS and Android drop the texted code straight into the field.

## 6. The accessibility floor

An accessible form is the same form built correctly. AA is the minimum we ship, and we reach for AAA target sizing wherever the layout allows.

| Criterion | Level | What it requires | How the field meets it |
|-----------|-------|------------------|------------------------|
| 3.3.2 Labels or Instructions | A | Every control has a visible label or instruction | Persistent `<label for>` above each field; help linked with `aria-describedby` |
| 3.3.1 Error Identification | A | Errors are identified and described in text | Inline text message plus `aria-invalid="true"`; red reinforces, never carries it alone |
| 3.3.3 Error Suggestion | AA | When a fix is known, suggest it | The message says how to correct the value, not only that it is wrong |
| 1.3.5 Identify Input Purpose | AA | Common fields expose their purpose programmatically | Correct `autocomplete` tokens, which also drive autofill |
| 2.5.8 Target Size | AA | Interactive targets are at least 24 by 24 CSS pixels | Checkboxes and toggles clear 24px; the comfortable target is 44px (AAA 2.5.5) |

**The label is a click target, for free.** A real `<label for>` pointed at the input's `id` names the field for assistive technology and extends the tap area to the words. Group related controls in a `<fieldset>` with a `<legend>` so the group's question is announced too. This is the accessible default, not optional polish.

# Part 2: The catalog, every control we reach for

One card per control, grouped by family. Each names the native element, a verdict of Native, Custom, or Hybrid, the attributes that matter, and the two notes that decide quality: mobile behavior and the accessibility pattern. When a control has no good native form, the note names the WAI-ARIA APG pattern to build against.

## Text and numeric fields

- **Text**: Native, `<input type="text">`. Attrs: `autocomplete`, `enterkeyhint`, `maxlength`. Standard keyboard; keep font-size at 16px. Visible `<label for>`; error via `aria-describedby` and `aria-invalid`.
- **Email**: Native, `<input type="email">`. Attrs: `inputmode="email"`, `autocomplete="email"`. Raises a keyboard with @ and a dot, no shift. Built-in format validation; still write a fix-it error message.
- **Password**: Native, `<input type="password">`. Attrs: `autocomplete="current-password"` / `new-password`. Offer a show-password toggle; never block paste. Use `new-password` on sign-up so managers offer a strong one.
- **Number**: Native, `<input type="number">`. Attrs: `inputmode="numeric"`, `min`, `max`, `step`. For true quantities. For codes and IDs use `text` plus `inputmode`. Native role is spinbutton; arrows step the value.
- **Tel**: Native, `<input type="tel">`. Attrs: `inputmode="tel"`, `autocomplete="tel"`. Raises the phone dial pad. No format validation, so pair with a hint. Add a country selector only when you serve many regions.
- **URL**: Native, `<input type="url">`. Attrs: `inputmode="url"`, `autocomplete="url"`. Keyboard adds / and .com shortcuts. Validates for a scheme; accept input without `https://` and normalise it.
- **Search**: Native, `<input type="search">`. Attrs: `enterkeyhint="search"`. Return key reads "Search"; a clear button appears on many browsers. Carries an implicit searchbox role.
- **Textarea**: Native, `<textarea>`. Attrs: `rows`, `maxlength`, `enterkeyhint="enter"`. Keep 16px; let it auto-grow. If you show a counter, mirror it in an `aria-live` region.

## Selection controls

- **Select, single**: Hybrid, `<select>`. Attrs: `<option>`, `required`. Prefer native: it opens the OS wheel, already accessible. Custom only to style the popup, then follow APG Select-only Combobox. Long lists: switch to an autocomplete.
- **Multi-select**: Custom, no good native form. Attrs: `aria-multiselectable`, `aria-selected`. `<select multiple>` is hostile on touch; use checkboxes or a sheet. Build against APG Listbox multi-select, or decompose into a checkbox group.
- **Checkbox**: Native, `<input type="checkbox">`. Attrs: `accent-color`, `checked`. Target 44px; `accent-color` tints it indigo, no rebuild. For a group, wrap in `<fieldset>` with a `<legend>`. Supports an indeterminate state.
- **Radio group**: Native, `<input type="radio">` x N. Attrs: `name`, `accent-color`. One shared `name`; each option a 44px target. APG Radio Group: one tab-stop, arrows move and select.
- **Switch, toggle**: Custom, checkbox as the base. Attrs: `role="switch"`, `aria-checked`. For an instant on/off setting; the change applies at once. APG Switch: Space toggles, and the label does not change with state.
- **Range, slider**: Native, `<input type="range">`. Attrs: `min`, `max`, `step`, `accent-color`. Tinted by `accent-color`; pair with a visible value, dragging is imprecise. Native covers APG Slider. Two-thumb range: APG Slider Multi-Thumb.

On defaults: pre-check the reminder because people want it, leave the newsletter off because it costs their attention. A default must be the choice the user would make with full attention, and it must stay editable. Pre-fill to save effort, never to extract a choice. (See Patterns / Persuasion on the ethics of defaults.)

## Date, time and colour

- **Calendar date**: Native, `<input type="date">`. Attrs: `min`, `max`. Opens the OS calendar. Right for a date the user picks by looking. Custom only to style the calendar: a button opening an APG Dialog grid.
- **Memorable date**: Hybrid, 3 x `<input type="text">`. Attrs: `inputmode="numeric"`, `fieldset`, `legend`. Birthdays and issue dates: three numeric fields beat a calendar. The GOV.UK pattern: day, month, year, grouped in a fieldset.
- **Time**: Native, `<input type="time">`. Attrs: `datetime-local`, `step`. Native time wheel respects the 12 or 24 hour locale. Use `datetime-local` to capture date and time in one control.
- **Colour**: Native, `<input type="color">`. Attrs: `value` hex. Opens the OS colour picker. `accent-color` does not apply here. Pair with a text hex field so the value is typeable too.

## Specialized inputs

- **File**: Native, `<input type="file">`. Attrs: `accept`, `capture`, `multiple`. `capture` can open the camera directly for a photo upload. Style the triggering `<label>`, never hide the input without a label.
- **Combobox, autocomplete**: Custom, `<input>` + `<datalist>` as base. Attrs: `role="combobox"`, `aria-autocomplete`, `aria-expanded`. Text keyboard; render suggestions as a sheet on small screens. APG Combobox with `aria-activedescendant`. Enhance a real `<select>`.
- **One-time code**: Native, `<input>` single or split. Attrs: `autocomplete="one-time-code"`, `inputmode="numeric"`. iOS and Android autofill the SMS code straight into the field. If you split into boxes, group them and announce progress.
- **Phone with country**: Hybrid, `<input type="tel">` + selector. Attrs: `autocomplete="tel"`, `tel-country-code`. The number stays a native tel input; only the country picker is custom. Country selector follows APG Combobox or Listbox.
- **Currency, masked**: Custom, `<input type="text">` + mask. Attrs: `inputmode="decimal"`, `pattern`, `aria-describedby`. Avoid `type="number"`: it fights thousands separators. Use text plus a mask. State the expected format in help; do not break editing for AT.

## Composite and advanced

- **Tags, chips**: Custom, no native form. Attrs: `role="combobox"`, `aria-label` per chip. Chips are 44px targets; each removable by keyboard, not hover alone. Input follows APG Combobox; each chip's remove button has a label.
- **Rating, stars**: Custom, radio group as base. Attrs: `role="radiogroup"`, `name`. Each star a 44px target; never depend on hover to set a value. One star is one radio option, so APG Radio Group carries it.
- **Stepper, plus and minus**: Native, `<input type="number">`. Attrs: `min`, `max`, `step`, `role="spinbutton"`. Custom plus and minus buttons at 44px beat the tiny native spinners. Native and custom both are APG Spinbutton: arrows, Home, End.
- **Rich text**: Custom, contenteditable, or a library. Attrs: `contenteditable`, `role="toolbar"`. Expensive to make accessible; use only when formatting truly matters. Toolbar follows APG Toolbar; announce applied formatting.

# Close: Rules of the form

**Rule:** Reach for the native control before building a custom one.
**Why:** a native `<select>`, date input, or checkbox ships the keyboard, picker, and accessibility a hand-built widget has to re-earn from scratch.

**Rule:** Brand native controls with `accent-color`, `caret-color`, and `color-scheme`, and know their reach.
**Why:** they tint checkbox, radio, range, progress, and the caret without a rebuild; select, date, and text they do not touch, so plan for those.

**Rule:** Keep the label visible above every field, and mark the rarer of required or optional in words.
**Why:** a placeholder vanishes on the first keystroke and takes the question with it; an asterisk alone reaches no screen reader.

**Rule:** Match `type`, `inputmode`, `enterkeyhint`, and `autocomplete` to the answer.
**Why:** the right keyboard rises on the first tap and a saved profile fills the field in one, instead of a manual retype.

**Rule:** Render inputs at 16px or larger and give interactive targets at least 24px, ideally 44px.
**Why:** below 16px iOS Safari auto-zooms on focus; below 24px the target fails WCAG 2.5.8, and the thumb misses.

**Rule:** Reward valid input while typing with `:user-valid`, and surface errors on blur.
**Why:** flagging a half-typed value as wrong punishes progress; once a field has already erred, re-check on input and clear it the instant it is valid.

**Rule:** Write errors that name the fix, in text, with `aria-invalid` and `aria-describedby`.
**Why:** "Invalid" leaves no way to recover, and a red border alone reaches no screen reader; the words carry the message.

**Rule:** Reserve `--color-error` for genuine errors and nothing else.
**Why:** one warm colour on an otherwise indigo page means its appearance always signals a real problem.

**Rule:** When you must go custom, build against the matching WAI-ARIA APG pattern and keep a native base underneath.
**Why:** the APG pattern encodes the keyboard and roles users expect, and the native base keeps the field working if the script fails.

**Decision ladder.** Adding a field? Stop at the first rung that resolves it.

1. Does this field need to exist? Every field is a cost. If you can infer it, default it, or drop it, do that before styling anything.
2. Can a native control answer it? A `<select>`, `type="date"`, a checkbox. Use it, and keyboard and accessibility come built in.
3. What is the answer's shape? Pick the `type` and `inputmode` that raise the matching keyboard, add `enterkeyhint` and the `autocomplete` token, and brand it with `accent-color`.
4. What can go wrong, and how is it fixed? Write the help and the recovery message before the layout. If you cannot say how to fix it, the rule is wrong, not the user.
5. Only now, assemble it from the primitives: visible label, control, help, error, in one column, states inherited from Patterns / Interactive. If the pattern is not in HTML, build the matching APG pattern over a native base.

## Sources

MDN Web Docs: `accent-color` (and its limits), `caret-color`, `color-scheme`, `<input>` types, `inputmode` and `enterkeyhint`, the `autocomplete` token list, `:user-invalid`. web.dev "accent-color" and Learn Forms (four themable controls, automatic accent contrast, HTML form elements are difficult to customize). caniuse: `accent-color` roughly 94 percent, since Chrome/Edge 93, Firefox 92, Safari 15.4 (March 2022). WAI-ARIA APG patterns for Combobox, Listbox, Switch, Slider, Slider Multi-Thumb, Spinbutton, Radio Group, Checkbox, Dialog, Toolbar. GOV.UK Design System: progressive enhancement, the Select component, and the Date input three-field memorable-date pattern. W3C Understanding WCAG 2.2: SC 3.3.2 (A), 3.3.1 (A) with ARIA21 `aria-invalid`, 3.3.3 (AA), 1.3.5 (AA), 2.5.8 (24px, AA), 2.5.5 (44px, AAA). Mihael Konjevic, "Inline Validation in Web Forms" (Smashing, 2022), source of "reward early, punish late". CSS-Tricks and defensivecss.dev: 16px prevents iOS input zoom. Apple HIG Text fields: content-appropriate keyboards, 44pt minimum. NN/g and Baymard: placeholders cannot replace labels, error messages must be visible/specific/constructive, single-column forms complete faster. The reward-while-typing timing and single-accent error-only use of `--color-error` are house rules layered on the cited guidance.
