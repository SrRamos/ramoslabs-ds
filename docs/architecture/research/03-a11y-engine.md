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

Mount persistent live-region containers before updating their text, update only when the user-facing message changes, and debounce noisy result counts without delaying the underlying list. Visible content should be the message source where possible. An NVDA issue filed 2025-08-15 documents a particular polite-region failure, not proof that all live regions are unreliable; it reinforces the need for browser/AT-specific tests rather than universal timer hacks ([NVDA issue 18721, 2025-08-15](https://github.com/nvaccess/nvda/issues/18721)).

## Known AT × browser evidence: facts, not folklore

AT behavior changes by exact reader version, browser, OS, control variant, and user mode. The following are reproducibility leads, **not permanent compatibility claims**:

- WebKit bug 231724 documents VoiceOver/Safari failing to announce select-only combobox active-descendant options. Later comments report the original case working in Safari 18.4/macOS 15.4.1, so citing it as a current universal Safari defect would be wrong; current APG variants still require testing ([WebKit 231724, opened 2021-10-12, updated through 2025](https://bugs.webkit.org/show_bug.cgi?id=231724)).
- JAWS has Virtual PC Cursor and Forms Modes; automatic forms-mode transitions affect whether arrow keys reach the page or are interpreted as reading commands ([official JAWS ARIA support guide, retrieved 2026-10-27](https://freedomscientific.github.io/standards-support/aria.html)). Test both reading and interaction modes rather than assuming a DOM focus event proves announcement.
- NVDA issue 18721 records one live-region failure in NVDA 2025.3.2 on Windows 11; it does not justify claiming that NVDA never supports `role="status"` ([NVDA issue 18721, 2025-08-15](https://github.com/nvaccess/nvda/issues/18721)).
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

## Recommendations for ARCHITECTURE.md

1. **Create a shared accessibility kernel for ID relationships, collection registration, roving/active-descendant focus, typeahead, composition guards, overlay focus return, and live-region queues.** *Trade-off:* a common abstraction must expose component-specific options; forcing all widgets into one focus policy would violate APG.
2. **Generate keyboard maps and ARIA contracts from component definitions used by both code and tests.** *Trade-off:* schema maintenance is required, but Vue/React/vanilla cannot drift into different accessibility behavior.
3. **Default to native controls and implement custom ARIA only for capabilities native controls lack.** *Trade-off:* visual customization may be constrained, especially on touch, while ownership of keyboard/AT defects drops substantially.
4. **Use roving DOM focus by default; reserve active-descendant for text-entry composites and carefully justified high-scale lists.** *Trade-off:* virtualization and DOM-focus movement become more complex for large lists, but mobile/AT behavior is generally more directly testable than pseudo-focus.
5. **Treat IME as a first-class state in every text/typeahead engine.** *Trade-off:* event sequences need extra tests and guards, while CJK input is not broken by premature filtering, selection, or submission.
6. **Use sparse, persistent live regions with component-level announcement policies.** *Trade-off:* message deduplication adds state, but duplicate/interrupting speech is avoided. No live region may compensate for missing focus or semantics.
7. **Certify against the P1 real-AT matrix on physical mobile devices and record actual speech, not only screenshots.** *Trade-off:* manual releases are slower and require Windows/AT licenses, but automation cannot certify the product’s core accessibility promise.
8. **Maintain dated AT issue records and prohibit unmeasured browser-specific ARIA workarounds.** *Trade-off:* some upstream bugs remain visible until fixed, but global semantic hacks and stale folklore do not propagate through the system.

STATUS: DRAFT-COMPLETE