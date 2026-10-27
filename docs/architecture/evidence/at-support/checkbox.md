# Checkbox

## Recommended variant

Use native `input type="checkbox"` with a visible `label`, native `checked`, and `fieldset`/`legend` for groups. APG supplies the T1 role/state/keyboard contract ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)); [HTML's checkbox state](https://html.spec.whatwg.org/multipage/input.html#checkbox-state-(type=checkbox)) supplies the native element (Living Standard updated 2026-10-26).

## Measured evidence and alternatives

CANDIDATE ARIA-AT custom-checkbox reports are comparison baselines: JAWS passed 102/102 MUST assertions, NVDA 96/102, and VoiceOver macOS 64/76 with two severe harness-cursor effects ([ARIA-AT, test plan V25.12.19](https://aria-at.w3.org/report/163678)). The separate historical native matrix reports broad support, including TalkBack 8.1 and VoiceOver iOS 13.2.3, but its 2019–2021 results are not current certification ([a11ysupport, 2021-07-29](https://a11ysupport.io/tech/html/input(type-checkbox)_element)).

Discarded: custom checkbox hosts and visual-only checked state because native controls already provide focus, Space activation, and programmatic state. NVDA 12718 is now accurately scoped to checkbox group descriptions in browse mode; the issue says radios behaved as expected in focus mode ([NVDA, 2021-08-06](https://github.com/nvaccess/nvda/issues/12718)). Essential instructions must not exist only in that group description. Current VoiceOver testing remains pending.
