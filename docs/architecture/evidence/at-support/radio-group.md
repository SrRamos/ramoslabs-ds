# Radio group

## Recommended variant

Use native `input type="radio"` with shared `name`, individual visible labels, and `fieldset`/`legend`. `constraints.focusStrategy` is `native-roving`: the kernel observes focus for the active indicator but does not reimplement native arrow behavior. This follows [APG's radio contract](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) (retrieved 2026-10-27) and the native-first tie-break.

## Measured evidence and alternatives

CANDIDATE ARIA-AT roving-radio results are the custom comparison baseline: JAWS 2025.2505.43/Chrome 137 passed 151/151 MUST assertions; NVDA 2023.3/Chrome 133 passed 134/141; VoiceOver macOS 15.3.1/Safari 18 passed 88/98 and recorded cursor and verbosity side effects ([ARIA-AT, test plan V25.10.27](https://aria-at.w3.org/report/163667)).

Discarded: custom radio hosts and active-descendant as defaults because they add focus/state responsibilities without a native-support advantage. NVDA 12718 was removed from this file: it reports a checkbox-group browse-mode description gap and explicitly says radios behaved as expected in focus mode ([NVDA, 2021-08-06](https://github.com/nvaccess/nvda/issues/12718)). The corrected observation now lives in `checkbox.json`. TalkBack 7.3.0/Chrome 76 has a historical native-radio role pass ([a11ysupport, 2019-08-21](https://a11ysupport.io/tests/tech__aria__aria-required-on-html-radio-buttons/html__input(type-radio)_element/convey_role/talkback/and_chr)); VoiceOver iOS is pending.
