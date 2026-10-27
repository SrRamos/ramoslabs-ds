# 03 — Accessibility engine

**Research date:** 2026-10-27. APG links below were retrieved on this date; APG is a design-pattern reference, while WCAG 2.2 is the conformance target. A DOM/ARIA snapshot passing automation is not evidence that a widget is usable with assistive technology (AT).

## Architectural principle

Native HTML supplies keyboard and accessibility behavior that ARIA alone does not. APG explicitly states that browsers do not provide keyboard support for custom ARIA widgets and authors must implement it ([APG keyboard interface, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)). The accessibility engine therefore owns **relationships, focus, keyboard intent, and announcement policy**, but it must not replace native controls where their contract fits.

Each component contract should declare anatomy, accessible-name source, roles/states per part, keyboard map, focus strategy, disabled behavior, native fallback, and manual AT assertions. The same transition events update visual state and ARIA state atomically; adapters must never implement independent keyboard maps.

## Required APG contracts

### Combobox

Use a real text input for an editable combobox. The input owns `role="combobox"`, `aria-expanded`, `aria-controls`, the appropriate `aria-autocomplete`, and `aria-activedescendant` when a list/grid/tree suggestion is active. DOM focus remains on the input for those popup types; a dialog popup instead receives real DOM focus ([APG combobox, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)).

Down Arrow opens/moves to a suggestion, Enter accepts, Escape dismisses without destroying the previous value, and printable characters retain normal text editing. APG specifically warns not to intercept standard editing keys. Left/right cursor movement, selection, Backspace, clipboard commands, and platform editing behavior take precedence over widget shortcuts. Select-only comboboxes are a separate implementation from editable ones; do not imitate them when native `<select>` suffices.

### Listbox

A named `listbox` owns `option` descendants, selection uses `aria-selected` (or a consistently justified `aria-checked` model), and multi-select exposes `aria-multiselectable`. Up/Down navigate; Home/End are strongly recommended beyond five options; typeahead is recommended for every listbox and especially beyond seven ([APG listbox, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)).

Options are not containers for buttons, links, or checkboxes: APG states that the listbox interaction model does not support interactive descendants and directs that use case to grid. Selection and active focus are separate state. Single-select may use selection-follows-focus; multi-select defaults to Space toggling the active option without clearing other selections. Dynamically absent options require accurate `aria-setsize` and `aria-posinset`.

### Menu and menu button

A menu is for commands, not a generic select or navigation disclosure. The trigger is a button with `aria-haspopup="menu"` and `aria-expanded`; Enter/Space opens and focuses the first item, with optional arrow-key opening ([APG menu button, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/menubutton/)). Within the menu, arrows move among items, Home/End move to edges, printable characters perform typeahead, Escape closes and returns focus, and Tab closes rather than creating a tab stop at every item ([APG menu/menubar, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/menu/)). Menu items use roving focus or active-descendant, not both.

### Tabs

Use `tablist` → `tab` → associated `tabpanel`, with `aria-selected`, `aria-controls`, and reverse `aria-labelledby` relationships. One tab is tabbable; horizontal Left/Right and vertical Up/Down navigate, Enter/Space activates in manual mode, and Home/End are supported ([APG tabs, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)). APG recommends automatic activation only when panels appear without noticeable latency; asynchronous panels use manual activation. A panel with no focusable content receives `tabindex="0"` so it remains reachable. Horizontal tabs must not capture Up/Down and block page scrolling.

### Dialog

A modal contains Tab/Shift+Tab, closes on Escape, receives initial focus, and returns focus to its invoker or a logical successor ([APG modal dialog, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)). It has an accessible title and a visible close control. Initial focus is content-dependent: a static `tabindex="-1"` heading for structured/long content, the least destructive action for irreversible tasks, or the primary next action for simple flows. Do not apply one huge `aria-describedby` string to structured content.

Use native `<dialog>.showModal()` where possible; ARIA `aria-modal="true"` is truthful only when all users are actually prevented from interacting outside. Focus return must also cover invoker removal, nested dialogs, cancellation, form submission, and route changes.

### Tooltip

A tooltip appears on hover **or keyboard focus**, closes on Escape, and its trigger references it with `aria-describedby`. It does not receive focus and contains no interactive elements ([APG tooltip, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)). Essential instructions and error content cannot be tooltip-only. A hover card with links is not a tooltip and needs a different disclosure/popover contract.

### Disclosure

A disclosure is a native button with `aria-expanded`; `aria-controls` points to its content, and Enter/Space toggle through native button activation ([APG disclosure, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)). The arrow-key behavior shown in some disclosure navigation examples is optional and pattern-specific, not a requirement for a standalone accordion button. Native `<details>/<summary>` is preferred when its semantics and keyboard behavior fit.

### Radio group

Use native `input type="radio"` with a shared `name` and `fieldset/legend` where possible. In a custom group, arrow keys move focus and check the focused radio, Space checks the current item, and Tab enters/leaves the group as one stop ([APG radio group, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)). Roving tabindex enters on the checked item, or the first enabled item when none is checked. Native radios already implement the platform model; custom code must not double-handle it.

### Switch

A switch is a toggle with role `switch`, an accessible label, and `aria-checked`; Space toggles it, while Enter is optional rather than borrowed automatically from checkbox ([APG switch, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)). Its label must not change when state changes. Use a native checkbox where role `switch` is not necessary; `aria-pressed` is for toggle buttons, not an interchangeable third representation.

## Focus engine

### Roving tabindex versus `aria-activedescendant`

APG defines roving tabindex as one item at `0`, all others at `-1`, with actual `.focus()` on navigation. It gives real DOM focus and browser scrolling to the active item. With active-descendant, the container/input retains DOM focus and the AT active item changes through an IDREF; the component must render the active indicator and scroll it into view itself ([APG keyboard interface, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)).

Use:

- **roving focus** for tabs, radio groups, menus, standalone listboxes, and grids where actual item focus improves AT interaction;
- **active-descendant** for editable comboboxes where DOM focus must remain in the text input;
- **one strategy per composite**, never simultaneous contradictory focus and active-descendant values.

Every active ID must resolve, point to an allowed owned/controlled element, survive list updates, and reset before its element unmounts. Virtualization must keep the active item mounted or move active state before recycling it. Focus and selection require distinct visuals. On item deletion, choose a deterministic successor instead of letting focus fall to `<body>`; APG identifies focus loss after removal as a failure to manage persistence.

### Focus scope and return

The engine keeps an explicit opener reference, nested overlay stack, and post-close target. Native dialog/popover events synchronize the stack. Restoration happens only when the target is still connected, visible, enabled, and not inert; otherwise use a declared logical fallback. Do not restore focus after a workflow deliberately advanced to a new step.

## Typeahead and IME

APG listbox typeahead matches the next option whose accessible name starts with the accumulated printable string, then cycles matches; multi-character matching relies on rapid succession ([APG listbox, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)). Normalize for matching without changing spoken labels: Unicode normalize, trim/collapse whitespace, apply locale-aware case folding, and keep deterministic tie order. Do not strip diacritics by default because that can change meaning; an accent-insensitive search option is separate product policy.

`KeyboardEvent.isComposing` identifies events inside an IME composition, and `compositionend` completes or cancels composition ([MDN `isComposing`, updated 2025-04-03](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing); [MDN `compositionend`, updated 2026-07-28](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)). During composition:

- do not run typeahead, filtering, inline autocomplete, or submit/accept on Enter;
- do not rewrite input value or selection;
- preserve native text input and resume after committed `input` following composition end;
- include a composition-session state guard as well as `isComposing`, because event order is browser-dependent and must be covered by real IME tests.

## Live regions

WAI-ARIA defines `status` with implicit `aria-live="polite"` and `aria-atomic="true"`, while `alert` is assertive and atomic ([WAI-ARIA 1.2 `status`, Recommendation 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#status); [WAI-ARIA 1.2 `alert`, 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#alert)). Use polite status for result counts, save completion, loading completion, and nonurgent selection summaries; reserve assertive alerts for urgent interruptions. Never announce every active-descendant movement through a second live region—the focus/active item already carries that information.

Mount persistent live-region containers before updating their text, update only when the user-facing message changes, and debounce noisy result counts without delaying the underlying list. Visible content should be the message source where possible. NVDA issue 18721 was opened against NVDA 2025.1 on Windows 10; a later commenter supplied an NVDA 2025.3.2/Windows 11 log. Maintainers could not reproduce on Edge 144 and closed it as works-for-me on 2026-01-08. One closed report is not proof of universal reliability or failure; it reinforces browser/AT-specific tests rather than universal timer hacks ([NVDA issue 18721, opened 2025-08-15, closed 2026-01-08](https://github.com/nvaccess/nvda/issues/18721)).

## Known AT × browser evidence: facts, not folklore

AT behavior changes by exact reader version, browser, OS, control variant, and user mode. The following are reproducibility leads, **not permanent compatibility claims**:

- WebKit bug 231724 documents VoiceOver/Safari failing to announce select-only combobox active-descendant options. Later comments report the original case working in Safari 18.4/macOS 15.4.1, so citing it as a current universal Safari defect would be wrong; current APG variants still require testing ([WebKit 231724, opened 2021-10-14, updated through 2025](https://bugs.webkit.org/show_bug.cgi?id=231724)).
- JAWS has Virtual PC Cursor and Forms Modes; automatic forms-mode transitions affect whether arrow keys reach the page or are interpreted as reading commands ([official JAWS ARIA support guide, retrieved 2026-10-27](https://freedomscientific.github.io/standards-support/aria.html)). Test both reading and interaction modes rather than assuming a DOM focus event proves announcement.
- NVDA issue 18721 was filed against NVDA 2025.1 on Windows 10, not the later commenter's NVDA 2025.3.2/Windows 11 environment; it closed unreproduced on 2026-01-08 ([NVDA issue 18721, 2025-08-15–2026-01-08](https://github.com/nvaccess/nvda/issues/18721)).
- Mobile screen readers use touch exploration/gestures, not desktop Tab/arrow interaction alone. The 2026 WebAIM survey reports 91.8% of respondents use a mobile screen reader, with VoiceOver and TalkBack both commonly used ([WebAIM Survey #11, July–August 2026, published 2026-09-29](https://webaim.org/projects/screenreadersurvey11/)). Native mobile controls are therefore the safest default, and custom composites need gesture exploration, activation, scrolling, and dismissal tests.

No honest static matrix can guarantee TalkBack/JAWS/VoiceOver behavior from these bug reports. Maintain a dated compatibility log with a minimal reproduction, actual speech output, exact versions, issue link, and retest result. Do not ship user-agent detection or `aria-owns` as a generic workaround for old VoiceOver bugs; relationship hacks can change reading order and create new failures.

## Required AT test matrix

Test current stable plus the previous major reader release where licensing/lab access permits; record exact builds for every run. The 2026 survey’s most common desktop pairs are JAWS+Chrome, NVDA+Chrome, JAWS+Edge, and NVDA+Firefox, while mobile use is dominated by iOS/VoiceOver with substantial Android/TalkBack use ([WebAIM Survey #11, 2026-09-29](https://webaim.org/projects/screenreadersurvey11/)).

| Tier | Environment | Required coverage |
|---|---|---|
| P1 every release | NVDA current + Chrome and Firefox, Windows | Full keyboard map; browse/focus modes; names/roles/states; active-descendant; live regions |
| P1 every release | JAWS current + Chrome or Edge, Windows | Same, plus virtual cursor/forms-mode transitions and table/grid semantics |
| P1 every release | VoiceOver current + Safari, macOS | Full keyboard map, VO navigation, active-descendant, dialog naming, focus return |
| P1 every release | VoiceOver current + Safari, physical iPhone/iPad | Touch exploration, double-tap activation, rotor, scrolling, native picker/custom fallback, dismissal |
| P1 every release | TalkBack current + Chrome, physical Android device | Touch exploration, swipe order, activation, local/global gestures, virtual keyboard, scrolling/dismissal |
| P2 quarterly | Narrator current + Edge, Windows | Smoke suite for names, focus, forms, dialogs, live status |
| P2 quarterly | VoiceOver + Chrome and JAWS + Firefox | Cross-browser divergence checks for complex composites |

Also test keyboard-only, 200%/400% zoom and reflow, forced colors, reduced motion, switch/voice activation where available, and RTL. These cover different user needs and cannot be inferred from screen-reader tests. WCAG 2.2 is the normative checklist for focus visibility/not-obscured, dragging alternatives, target size, consistent help, redundant entry, and accessible authentication ([WCAG 2.2 Recommendation, updated 2024-12-12](https://www.w3.org/TR/WCAG22/)).

Each manual component run records: exact environment; initial announcement; every supported key/gesture; actual versus expected speech; focus location before/after; reading order; state changes; error/status output; and pass/fail evidence. Automation can assert expected DOM and focus, but a human verifies actual AT output.

## Revision 1: mobile evidence and composite decisions

### Select-only combobox and top-layer relationships

Use **DOM focus on the non-input trigger plus `aria-activedescendant`** for a custom select-only combobox. APG's select-only example uses exactly that model: arrows change the active option without committing its value, while Enter/Space/Tab commits and Escape preserves the prior value. Roving focus would be a different interaction, not an improvement by default ([APG select-only example, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)).

A top-layer listbox need not be a DOM descendant of the trigger: ARIA 1.2 permits active-descendant through a combobox's `aria-controls` to a controlled listbox ([WAI-ARIA 1.2 `aria-activedescendant`, 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#aria-activedescendant)). That structural allowance is not proof of AT support:

- WebKit 289338 is **NEW** (2025-03-07): on iOS Safari, VoiceOver skips a listbox mounted at the end of `<body>` despite `aria-controls` and active-descendant ([WebKit 289338, 2025-03-07](https://bugs.webkit.org/show_bug.cgi?id=289338)).
- APG issue 2855 reports the same navigation failure on TalkBack/Chrome 130, last confirmed 2025-06-13; a July 2025 task-force hypothesis puts the cause at selection failure with active-descendant suspected, not confirmed ([APG issue 2855, opened 2023-11-02, updated 2025-06-13](https://github.com/w3c/aria-practices/issues/2855)).
- The older macOS select-only case in WebKit 231724 was reported working in Safari 18.4, but that does not verify iOS, TalkBack, JAWS, or NVDA ([WebKit 231724, 2021-10-14–2025-07-09](https://bugs.webkit.org/show_bug.cgi?id=231724)).

Therefore native select remains the touch default. A required custom mobile fallback renders the listbox inline/adjacent to the trigger when top-layer navigation fails. P1 certification explicitly covers controlled-active-descendant on NVDA+Chrome/Firefox, JAWS+Chrome/Edge, VoiceOver macOS/iOS, and TalkBack/Android; no pair is marked supported from specification alone.

### Android input events and typeahead

Android IMEs can emit `keyCode=229` and `key="Unidentified"` for printable input, with `isComposing` false. MDN documents 229 as the IME composition value and warns that key values vary by platform ([MDN `keyCode`, updated 2026-08-27](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode); [MDN `isComposing`, 2025-04-03](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)). Consequently:

- Editable combobox filtering/typeahead consumes `beforeinput`/`input` with `inputType` and `data`, not printable `keydown`; `InputEvent.inputType` distinguishes insertion, paste, and deletion ([MDN, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/inputType)).
- Non-editable listbox/menu/select-only typeahead uses `keydown` only for navigation/typeahead delivered by a hardware keyboard or AT. It never waits for text insertion that those widgets cannot receive.
- The composition guard still applies, but is not treated as sufficient for Android.

A dedicated physical-Android/Gboard test types Latin and CJK characters, uses autofill/paste, changes keyboard apps, and asserts exact typeahead results and Enter behavior. iOS Japanese/Chinese keyboard runs cover the same fixture.

### Dated mobile quirk log and required assertions

| Area | Primary evidence and current status | Assertion that remains in P1 |
|---|---|---|
| Active-descendant on mobile | WebKit 289338 **NEW**, 2025-03-07; APG 2855 updated 2025-06-13. | Arrow/key changes spoken active option; swipe reaches popup options; inline and top-layer variants separately. |
| Live regions on iOS | This is not one open WebKit bug with a fixed version. ARIA leaves initial-content behavior under-specified; current testing recommends priming an empty region then changing it ([TetraLogical, published 2024-05-01, updated 2026-04-07](https://tetralogical.com/blog/2024/05/01/why-are-my-live-regions-not-working/)). | Off-screen-but-accessible region, `visibility:hidden` control, pre-populated region, and insert+update in one frame. Assert one announcement, no hidden-region speech. |
| `aria-haspopup` / `aria-expanded` | WebKit 284804 (2024-12-17) reports VoiceOver not announcing changed expanded state on macOS 15.1.1/iOS 18.1.1; a later Safari 18.4 run passed, so no permanent fixed-version claim ([WebKit 284804, 2024-12-17](https://bugs.webkit.org/show_bug.cgi?id=284804)). TalkBack testing has supported `true`/`menu` but not `grid`/`listbox`/`tree` values consistently ([Matuzo measured matrix, 2023-08-17](https://www.matuzo.at/blog/2023/aria-haspopup/)). | Initial and changed expanded state on activation; menu-button and select-trigger popup type on both mobile readers. |
| `display: contents` semantics | Firefox 62 and Chromium fixed the original semantics-stripping bugs in 2018–2019 ([CSSWG issue 3040, opened 2018-08-22](https://github.com/w3c/csswg-drafts/issues/3040)). WebKit later reported the majority resolved and moved edge cases to individual reports ([WebKit 185679, opened 2018-05-16, RESOLVED FIXED, updated 2024-09-24](https://bugs.webkit.org/show_bug.cgi?id=185679)). | Roles/names of buttons, lists, table/grid semantics, and labels with `display: contents`; no blanket “safe everywhere” claim. |
| `inert` and top-layer exposure | WebKit 260837 reports inert number/range inputs reachable in Safari 16.6/macOS ([WebKit 260837, opened 2023-08-28](https://bugs.webkit.org/show_bug.cgi?id=260837)); WebKit 278370 exposed an inert iframe and is **RESOLVED FIXED** (fix landed Sept 2024, backports Sept–Oct 2024) ([WebKit 278370, opened 2024-08-19](https://bugs.webkit.org/show_bug.cgi?id=278370)). Neither proves the iOS rotor is correct. | Rotor Containers/Form Controls and swipe cannot reach background or unrelated top-layer content; native dialog, popover, and nested overlay variants. |

### Programmatic focus visibility

Selectors 4 uses previous-focus and input-modality heuristics for `:focus-visible`; programmatic focus does not create a universal visible indicator ([Selectors 4 `:focus-visible`, retrieved 2026-10-27](https://www.w3.org/TR/selectors-4/#the-focus-visible-pseudo)). The engine sets a `data-active` visual indicator on the active item independently of `:focus-visible`, including pointer-opened menus. Keyboard focus ring and selection remain distinct. The keyboard contract records this rule rather than relying on Chromium's heuristic or the newer `focusVisible` option, which is below the floor.

### Live-region ownership and touch/error details

A client-only, document-scoped registry owns one polite and one assertive region shared by every adapter/root on that document. It is created after client mount (never during SSR), deduplicates identical messages in a short configurable window, and is destroyed only when the document unloads—not by an arbitrary component. This avoids per-island announcements without introducing cross-request SSR state.

Touch has no reliable hover/focus tooltip trigger. Do not make long-press the only discovery path: use an explicit info/disclosure control or persistent text associated with `aria-describedby` ([APG tooltip, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)).

Field errors use visible text linked with `aria-describedby` plus `aria-invalid`; `aria-errormessage` may be additive, never the sole association, because support varies ([MDN `aria-errormessage`, updated 2025-05-12](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-errormessage)).

## Recommendations for ARCHITECTURE.md

1. **Create a shared accessibility kernel for ID relationships, collection registration, roving/active-descendant focus, typeahead, composition guards, overlay focus return, and live-region queues.** *Trade-off:* a common abstraction must expose component-specific options; forcing all widgets into one focus policy would violate APG.
2. **Generate keyboard maps and ARIA contracts from component definitions used by both code and tests.** *Trade-off:* schema maintenance is required, but Vue/React/vanilla cannot drift into different accessibility behavior.
3. **Default to native controls and implement custom ARIA only for capabilities native controls lack.** *Trade-off:* visual customization may be constrained, especially on touch, while ownership of keyboard/AT defects drops substantially.
4. **Use roving DOM focus by default; use active-descendant for editable and select-only comboboxes, with native select on touch and inline popup fallback where required.** *Trade-off:* two popup layouts need parity testing, but mobile/AT navigation is not assumed from ARIA structure alone.
5. **Treat IME and Android `beforeinput`/`input` as first-class paths in every text/typeahead engine.** *Trade-off:* event sequences need extra tests and guards, while CJK and virtual-keyboard input is not broken by premature filtering or keyCode assumptions.
6. **Use sparse, persistent, document-shared client-only live regions with component-level announcement policies.** *Trade-off:* message deduplication adds state, but duplicate/interrupting speech is avoided. No live region may compensate for missing focus or semantics.
7. **Certify against the P1 real-AT matrix on physical mobile devices and record actual speech, not only screenshots.** *Trade-off:* manual releases are slower and require Windows/AT licenses, but automation cannot certify the product’s core accessibility promise.
8. **Maintain dated AT issue records and prohibit unmeasured browser-specific ARIA workarounds.** *Trade-off:* some upstream bugs remain visible until fixed, but global semantic hacks and stale folklore do not propagate through the system.

STATUS: REVISION-1