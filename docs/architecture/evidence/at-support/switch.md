# Switch

## Recommended variant

Use `input type="checkbox" role="switch"` with a stable visible label and native `checked`; do not add `aria-checked` to this native host. Space toggles and Enter is optional. This is an explicit APG variant, not an invented role mapping ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).

## Measured evidence and alternatives

The CANDIDATE ARIA-AT reports test exactly this native-checkbox switch variant: NVDA 2025.2/Chrome 141 passed 72/78 MUST assertions; JAWS 2025.2508.120/Chrome 143 passed 75/78 and logged one severe no-output effect; VoiceOver macOS 15.6.1/Safari 18.6 passed 46/54 and logged two severe harness-cursor effects ([ARIA-AT, test plan V25.12.16, results through 2026-04-21](https://aria-at.w3.org/report/163677)).

Discarded: generic `div role="switch"`, duplicate `aria-checked` on the native host, interchangeable `aria-pressed`, and labels that change with state; APG either makes the native host sufficient or explicitly prohibits the practice. TalkBack has no measured evidence; VoiceOver iOS is pending real testing.
