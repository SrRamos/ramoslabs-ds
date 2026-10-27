# Text field with description and error

## Recommended variant

Use native `input type="text"` with a persistent visible `label`. Link both hint and visible error through `aria-describedby`, and set `aria-invalid="true"` only while the value is invalid. Keep error text in reading order. After failed submission, focus an error summary or the first invalid field so error discovery does not depend on a live mutation of the current description. HTML provides native input/label semantics ([HTML Standard, updated 2026-05-26](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)); the T1 decision is also grounded in the WAI-ARIA relationship/state model, with dated T2 support evidence in the JSON.

## Discarded alternatives

- **`aria-errormessage` as the only error association**: blocked because the published NVDA 2023.1/Edge test reports no support for conveying the pertinent error; retain `aria-describedby` even if `aria-errormessage` is added ([a11ysupport, 2023-06-20](https://a11ysupport.io/tests/tech__aria__aria-errormessage-with-aria-invalid-true/aria__aria-errormessage_attribute/convey_pertinent/nvda/edge)).
- **Placeholder as the only label or error**: blocked because it is not a persistent visible label and disappears during entry; the native label remains the recommended variant ([HTML Standard, updated 2026-05-26](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)).
- **Only mutating the focused field's description to announce a new error**: blocked as the sole path because the historical matrix reports partial/no dynamic-description support in VoiceOver and TalkBack ([a11ysupport, 2021-10-19](https://a11ysupport.io/tech/aria/aria-describedby_attribute)).
- **Color/icon-only invalid state**: blocked because `aria-invalid` and visible textual error must carry the state independently of styling ([WAI-ARIA 1.2, Recommendation 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#aria-invalid)).

The T2 description results are old and must not be presented as current failures. VoiceOver macOS/iOS remains pending real testing, including initial description, invalid state, post-submit focus, and error discovery.
