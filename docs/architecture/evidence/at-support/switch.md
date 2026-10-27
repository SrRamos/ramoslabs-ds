# Switch

## Recommended variant

Use `input type="checkbox" role="switch"` with a stable visible label and native `checked` state. APG explicitly provides this native-checkbox variant and says the checkbox host uses `checked` instead of `aria-checked`; Space toggles, while Enter is optional ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)). Group related switches with `fieldset`/`legend` when group context matters.

## Discarded alternatives

- **Generic `div role="switch"`**: blocked as the default because it recreates focus, activation, and state while the APG native-checkbox host already fits ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).
- **Adding `aria-checked` to the native checkbox host**: discarded because APG specifically directs this host to use HTML `checked` instead; duplicate state mechanisms risk contradictory output ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).
- **`aria-pressed` as an interchangeable switch representation**: blocked because APG treats switch, checkbox, and toggle button as distinct semantics to choose according to the UI, not synonyms to swap for styling ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).
- **Changing the label between On and Off**: blocked because APG explicitly requires a stable switch label ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).

No current AT-specific blocker was established by the verified sources. VoiceOver macOS/iOS remains pending real testing.
