# Tooltip

## Recommended variant

Use `role="tooltip"` for short, noninteractive supplemental text referenced by the trigger's `aria-describedby`. Show on keyboard focus and hover, keep DOM focus on the trigger, dismiss on Escape, and never put essential instructions or errors only in a tooltip. On touch, use persistent text or an explicit info disclosure instead of hover/long-press. This follows APG, with the important caveat that APG labels its tooltip pattern **work in progress without task-force consensus** ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)).

## Discarded alternatives

- **Interactive links/buttons inside a tooltip**: blocked because APG says tooltips do not receive focus and interactive hover content needs a nonmodal dialog/popover pattern ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)).
- **Hover-only or long-press-only discovery**: blocked for keyboard/touch because APG defines focus as well as hover, and touch has no equivalent reliable hover ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)).
- **Depending on a late `aria-describedby` text change for announcement**: blocked as the sole path because the historical a11ysupport matrix reports partial/no support for description changes while focused, including VoiceOver and TalkBack ([a11ysupport, 2021-10-19](https://a11ysupport.io/tech/aria/aria-describedby_attribute)). Keep the description available before focus where practical.

The old T2 matrix is not current compatibility certification. VoiceOver macOS/iOS tests are pending, including Escape, focus persistence, touch discovery, and actual description speech.
