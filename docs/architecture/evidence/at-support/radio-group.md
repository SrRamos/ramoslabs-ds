# Radio group

## Recommended variant

Use native `input type="radio"` elements with a shared `name`, an individual visible `label` per option, and `fieldset`/`legend` for the group name. Preserve native arrow-key selection and one-group Tab stop rather than reimplementing them. HTML defines the native group and labels ([HTML Standard, updated 2026-10-14](https://html.spec.whatwg.org/multipage/input.html#radio-button-state-(type=radio))); APG defines the equivalent custom contract and confirms expected arrow/Space behavior ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)).

## Discarded alternatives

- **Custom `role="radio"` collection as the default**: blocked because it recreates native selection, focus, checked state, and keyboard behavior without a support advantage ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)).
- **`aria-activedescendant` for the shared radio group**: discarded in favor of real native input focus; APG allows a custom active-descendant example, but it adds ID lifecycle and scrolling responsibilities with no native-support tie-break advantage ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)).
- **Essential instructions only in a group `aria-describedby`**: blocked as the sole channel because NVDA 12718 documents a browse-mode group-description gap ([NVDA, 2021-08-06](https://github.com/nvaccess/nvda/issues/12718)). Keep instructions visible and associated with individual controls when essential.

The NVDA issue is historical and implementation-specific, not a current universal failure. VoiceOver macOS/iOS real tests remain pending.
