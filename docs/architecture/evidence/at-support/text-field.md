# Text field with description and error

## Recommended variant

Use native `input type="text"` with a persistent visible `label`, visible hint and error linked through `aria-describedby`, `aria-invalid` only while invalid, and an explicit post-submit focus path. `aria-errormessage` is additive only for measured pairs, never the baseline association ([HTML label, updated 2026-10-26](https://html.spec.whatwg.org/multipage/forms.html#the-label-element); [WAI-ARIA aria-invalid, 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#aria-invalid)).

## Pair-specific errormessage evidence

The 2025-12-24 a11ysupport update is now explicit: VoiceOver macOS 15.7.3/Safari 18.6 **fails** to speak the pertinent error; VoiceOver iOS 18.5 and TalkBack 16.2/Chrome 143 **pass**. JAWS 2023.2306.38 passes on Chrome and Edge but fails on Firefox. The older NVDA 2023.1/Edge 114 failure remains a blocker for an errormessage-only design ([published test and pair links, updated 2025-12-24](https://a11ysupport.io/tests/tech__aria__aria-errormessage-with-aria-invalid-true)). Therefore `aria-describedby` stays universal and additive errormessage is enabled only where the target pair passes.

Discarded: placeholder-only labels, dynamic-description-only errors, and color/icon-only invalid state. These either remove persistent semantics or depend on announcement channels with measured gaps. Both VoiceOver implementation lanes remain pending real testing despite the published fixture results.
